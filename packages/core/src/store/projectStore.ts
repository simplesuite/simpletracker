import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { observe } from '@legendapp/state';
import { getSupabase, getCurrentUserId } from '../runtime';
import { syncedTable } from '../legend/syncedTable';
import { validateProjectName } from '../lib/validation';
import { lookupUserByID, isProjectSharedLocally } from '../lib/sharing';
import { useOfflineStore } from './offlineStore';
import { ensureSession } from '../lib/ensureSession';
import type { Project, ProjectShared } from '../types/index';

// ─── Synced observables (Legend-State) ──────────────────────────────────────
// projects$ = task_projects visible to the user (own + shared, per RLS).
// projectShares$ = task_projects_shared rows involving the user (as creator or
// recipient), used to derive the sharedProjectIDs set that note/task stores rely
// on for shared-item detection.

export const projects$ = syncedTable<Project>({
    collection: 'task_projects',
    persistName: 'st_projects',
});

export const projectShares$ = syncedTable<ProjectShared>({
    collection: 'task_projects_shared',
    persistName: 'st_project_shares',
});

interface ProjectStore {
    projects: Project[];
    /** Set of project IDs that are shared (shared by the user OR shared to the user) */
    sharedProjectIDs: Set<string>;
    loading: boolean;
    error: string | null;

    fetchProjects: () => Promise<void>;
    createProject: (name: string, description?: string) => Promise<Project | null>;
    createBlankProject: () => Promise<Project>;
    updateProject: (id: string, fields: Partial<Pick<Project, 'name' | 'description'>>) => Promise<boolean>;
    deleteProject: (id: string) => Promise<boolean>;
    shareProject: (projectID: string, userID: string) => Promise<boolean>;
    unshareProject: (projectID: string, sharedToID: string) => Promise<boolean>;
    getSharesForProject: (projectID: string) => Promise<ProjectShared[]>;
}

function currentUserID(): string {
    return getCurrentUserId();
}

function findProject(id: string): Project | undefined {
    return useProjectStore.getState().projects.find((p) => p.recordID === id);
}

function projectIsShared(project: Project | undefined): boolean {
    if (!project) return false;
    const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
    return isProjectSharedLocally(project.creatorID, project.recordID, currentUserID(), sharedProjectIDs);
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
    projects: [],
    sharedProjectIDs: new Set<string>(),
    loading: false,
    error: null,

    fetchProjects: async () => {
        projects$.get();
        projectShares$.get();
    },

    createProject: async (name, description) => {
        const validation = validateProjectName(name);
        if (!validation.valid) {
            set({ error: validation.error || 'Invalid project name' });
            return null;
        }

        const now = Date.now();
        const project: Project = {
            recordID: uuid(),
            creatorID: currentUserID(),
            name: name.trim(),
            description: description?.trim() || '',
            createdAt: now,
            updatedAt: now,
        };

        projects$[project.recordID].set(project as any);
        set({ error: null });
        return project;
    },

    createBlankProject: async () => {
        const now = Date.now();
        const project: Project = {
            recordID: uuid(),
            creatorID: currentUserID(),
            name: 'Untitled project',
            description: '',
            createdAt: now,
            updatedAt: now,
        };

        projects$[project.recordID].set(project as any);
        set({ error: null });
        return project;
    },

    updateProject: async (id, fields) => {
        if (fields.name !== undefined) {
            const validation = validateProjectName(fields.name);
            if (!validation.valid) {
                set({ error: validation.error || 'Invalid project name' });
                return false;
            }
        }

        const project = findProject(id);
        if (!project) {
            set({ error: 'Project not found' });
            return false;
        }

        if (projectIsShared(project) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        const payload: Partial<Project> = { updatedAt: Date.now() };
        if (fields.name !== undefined) payload.name = fields.name.trim();
        if (fields.description !== undefined) payload.description = fields.description.trim();

        projects$[id].set({ ...project, ...payload } as any);
        set({ error: null });
        return true;
    },

    deleteProject: async (id) => {
        const project = findProject(id);

        if (projectIsShared(project) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        // Projects are OPTIONAL parents: deleting a project must NOT delete its
        // notes/tasks (no cascade on those FKs). We only delete the project row;
        // orphaned notes/tasks simply become project-less, which is valid.
        projects$[id].delete();
        set({ error: null });
        return true;
    },

    // ─── Sharing (multi-user; requires connectivity — direct Supabase) ──────

    shareProject: async (projectID, userID) => {
        const uid = currentUserID();
        await ensureSession();

        const user = await lookupUserByID(userID);
        if (!user) {
            set({ error: 'User not found' });
            return false;
        }
        if (user.recordID === uid) {
            set({ error: 'Cannot share with yourself' });
            return false;
        }

        const { data: existing } = await getSupabase()
            .from('task_projects_shared')
            .select('recordID')
            .eq('projectID', projectID)
            .eq('sharedToID', user.recordID)
            .single();

        if (existing) {
            set({ error: 'Already shared with this user' });
            return false;
        }

        const shareRecord: ProjectShared = {
            recordID: uuid(),
            projectID,
            creatorID: uid,
            sharedToID: user.recordID,
            createdAt: Date.now(),
        };

        const { error } = await getSupabase().from('task_projects_shared').insert(shareRecord);
        if (error) {
            set({ error: error.message || 'Failed to share project' });
            return false;
        }

        // Reflect immediately in the shared set (the synced observable will also
        // pick it up, but this keeps shared-detection instant).
        set((state) => ({
            sharedProjectIDs: new Set([...state.sharedProjectIDs, projectID]),
            error: null,
        }));

        return true;
    },

    unshareProject: async (projectID, sharedToID) => {
        await ensureSession();
        const { error } = await getSupabase()
            .from('task_projects_shared')
            .delete()
            .eq('projectID', projectID)
            .eq('sharedToID', sharedToID);

        if (error) {
            set({ error: error.message || 'Failed to unshare project' });
            return false;
        }

        set({ error: null });
        return true;
    },

    getSharesForProject: async (projectID) => {
        await ensureSession();
        const { data, error } = await getSupabase()
            .from('task_projects_shared')
            .select('*')
            .eq('projectID', projectID);

        if (error) {
            set({ error: error.message || 'Failed to fetch shares' });
            return [];
        }

        return (data || []) as ProjectShared[];
    },
}));

// ─── Bridge: synced observables → Zustand state ─────────────────────────────

observe(() => {
    const byId = projects$.get() || {};
    const projects = (Object.values(byId).filter(Boolean) as Project[]).sort(
        (a, b) => b.updatedAt - a.updatedAt
    );
    useProjectStore.setState({ projects });
});

observe(() => {
    const byId = projectShares$.get() || {};
    const shares = Object.values(byId).filter(Boolean) as ProjectShared[];
    // Any project appearing in a share record (as creator or recipient) is shared.
    const sharedProjectIDs = new Set<string>();
    for (const s of shares) {
        sharedProjectIDs.add(s.projectID);
    }
    useProjectStore.setState({ sharedProjectIDs });
});
