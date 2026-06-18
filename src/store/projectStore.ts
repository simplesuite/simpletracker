import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { supabase } from '../lib/supabase';
import { validateProjectName } from '../lib/validation';
import { getCachedProjects, setCachedProjects, removeCachedItem } from '../lib/cache';
import {
    insertWithOfflineSupport,
    updateWithOfflineSupport,
    deleteWithOfflineSupport,
} from '../lib/offlineSync';
import { lookupUserByID, isProjectSharedLocally } from '../lib/sharing';
import { useGlobalStore } from './globalStore';
import { useOfflineStore } from './offlineStore';
import { ensureSession } from '../components/extras/ensureSession';
import type { Project, ProjectShared } from '../types/index';

interface ProjectStore {
    projects: Project[];
    /** Set of project IDs that are shared (either shared by the user or shared to the user) */
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

export const useProjectStore = create<ProjectStore>((set, get) => ({
    projects: [],
    sharedProjectIDs: new Set<string>(),
    loading: false,
    error: null,

    fetchProjects: async () => {
        set({ loading: true, error: null });

        // Load from cache first for instant render
        const cached = getCachedProjects();
        if (cached.length > 0) {
            set({ projects: cached });
        }

        try {
            await ensureSession();
            const currentUserID = useGlobalStore.getState().currentUser.recordID;

            // Fetch projects created by the user
            const { data: ownProjects, error: ownError } = await supabase
                .from('task_projects')
                .select('*')
                .eq('creatorID', currentUserID)
                .order('updatedAt', { ascending: false });

            if (ownError) {
                set({ error: ownError.message, loading: false });
                return;
            }

            // Fetch projects shared with the user
            const { data: sharedRecords, error: sharedError } = await supabase
                .from('task_projects_shared')
                .select('projectID')
                .eq('sharedToID', currentUserID);

            if (sharedError) {
                set({ error: sharedError.message, loading: false });
                return;
            }

            // Also fetch projects the user has shared with others
            const { data: sharedByUser, error: sharedByUserError } = await supabase
                .from('task_projects_shared')
                .select('projectID')
                .eq('creatorID', currentUserID);

            if (sharedByUserError) {
                set({ error: sharedByUserError.message, loading: false });
                return;
            }

            let sharedProjects: Project[] = [];
            if (sharedRecords && sharedRecords.length > 0) {
                const sharedProjectIDs = sharedRecords.map((r) => r.projectID);
                const { data: sharedData, error: sharedDataError } = await supabase
                    .from('task_projects')
                    .select('*')
                    .in('recordID', sharedProjectIDs)
                    .order('updatedAt', { ascending: false });

                if (sharedDataError) {
                    set({ error: sharedDataError.message, loading: false });
                    return;
                }
                sharedProjects = (sharedData || []) as Project[];
            }

            // Build the set of all shared project IDs (shared to user + shared by user)
            const allSharedProjectIDs = new Set<string>();
            for (const r of (sharedRecords || [])) {
                allSharedProjectIDs.add(r.projectID);
            }
            for (const r of (sharedByUser || [])) {
                allSharedProjectIDs.add(r.projectID);
            }

            // Combine and deduplicate, ordered by updatedAt desc
            const projectMap = new Map<string, Project>();
            for (const p of [...(ownProjects || []), ...sharedProjects]) {
                projectMap.set(p.recordID, p as Project);
            }
            const allProjects = Array.from(projectMap.values())
                .sort((a, b) => b.updatedAt - a.updatedAt);

            // Merge: preserve any locally-created projects not yet on the server (pending sync)
            const serverIDs = new Set(allProjects.map(p => p.recordID));
            const localOnly = get().projects.filter(
                (p) => p.creatorID === currentUserID && !serverIDs.has(p.recordID)
            );
            const mergedProjects = [...localOnly, ...allProjects];

            set({ projects: mergedProjects, sharedProjectIDs: allSharedProjectIDs, loading: false, error: null });

            // Cache only non-shared projects (projects the user created that aren't shared)
            const ownedNonSharedProjects = mergedProjects.filter(
                (p) => p.creatorID === currentUserID && !allSharedProjectIDs.has(p.recordID)
            );
            setCachedProjects(ownedNonSharedProjects);
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch projects', loading: false });
        }
    },

    createProject: async (name: string, description?: string) => {
        const validation = validateProjectName(name);
        if (!validation.valid) {
            set({ error: validation.error || 'Invalid project name' });
            return null;
        }

        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const now = Date.now();
        const recordID = uuid();

        const project: Project = {
            recordID,
            creatorID: currentUserID,
            name: name.trim(),
            description: description?.trim() || '',
            createdAt: now,
            updatedAt: now,
        };

        // Optimistically add to local state
        set((state) => ({
            projects: [project, ...state.projects],
            error: null,
        }));

        // Update cache
        const currentUserProjects = get().projects.filter((p) => p.creatorID === currentUserID);
        setCachedProjects(currentUserProjects);

        // Persist via offline support
        await insertWithOfflineSupport('project', 'task_projects', project as unknown as Record<string, unknown>);

        return project;
    },

    createBlankProject: async () => {
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const now = Date.now();
        const recordID = uuid();

        const project: Project = {
            recordID,
            creatorID: currentUserID,
            name: 'Untitled project',
            description: '',
            createdAt: now,
            updatedAt: now,
        };

        // Optimistically add to local state
        set((state) => ({
            projects: [project, ...state.projects],
            error: null,
        }));

        // Update cache so the project persists across fetchProjects reloads
        const currentUserProjects = get().projects.filter((p) => p.creatorID === currentUserID);
        setCachedProjects(currentUserProjects);

        // Persist via offline support
        await insertWithOfflineSupport('project', 'task_projects', project as unknown as Record<string, unknown>);

        return project;
    },

    updateProject: async (id: string, fields: Partial<Pick<Project, 'name' | 'description'>>) => {
        // Validate name if provided
        if (fields.name !== undefined) {
            const validation = validateProjectName(fields.name);
            if (!validation.valid) {
                set({ error: validation.error || 'Invalid project name' });
                return false;
            }
        }

        const now = Date.now();
        const payload: Record<string, unknown> = { updatedAt: now };

        if (fields.name !== undefined) {
            payload.name = fields.name.trim();
        }
        if (fields.description !== undefined) {
            payload.description = fields.description.trim();
        }

        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const project = get().projects.find((p) => p.recordID === id);
        const sharedProjectIDs = get().sharedProjectIDs;
        const shared = project
            ? isProjectSharedLocally(project.creatorID, project.recordID, currentUserID, sharedProjectIDs)
            : false;

        if (shared) {
            // Shared projects: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('task_projects')
                    .update(payload)
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to update project' });
                return false;
            }
        } else {
            // Non-shared: use offline support
            await updateWithOfflineSupport('project', 'task_projects', id, payload);
        }

        // Optimistically update local state
        set((state) => ({
            projects: state.projects.map((p) =>
                p.recordID === id
                    ? { ...p, ...payload } as Project
                    : p
            ),
            error: null,
        }));

        // Update cache only for non-shared projects
        if (!shared) {
            const currentUserProjects = get().projects.filter(
                (p) => p.creatorID === currentUserID && !sharedProjectIDs.has(p.recordID)
            );
            setCachedProjects(currentUserProjects);
        }

        return true;
    },

    deleteProject: async (id: string) => {
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const project = get().projects.find((p) => p.recordID === id);
        const sharedProjectIDs = get().sharedProjectIDs;
        const shared = project
            ? isProjectSharedLocally(project.creatorID, project.recordID, currentUserID, sharedProjectIDs)
            : false;

        if (shared) {
            // Shared projects: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Delete directly from server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('task_projects')
                    .delete()
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to delete project' });
                return false;
            }
        } else {
            // Non-shared: use offline support
            await deleteWithOfflineSupport('project', 'task_projects', id);
        }

        // Optimistically remove from local state
        set((state) => ({
            projects: state.projects.filter((p) => p.recordID !== id),
            error: null,
        }));

        // Remove from cache for non-shared items
        if (!shared) {
            removeCachedItem('cachedProjects', id);
        }

        return true;
    },

    shareProject: async (projectID: string, userID: string) => {
        const currentUserID = useGlobalStore.getState().currentUser.recordID;

        // Look up the user by ID
        await ensureSession();
        const user = await lookupUserByID(userID);
        if (!user) {
            set({ error: 'User not found' });
            return false;
        }

        // Prevent self-sharing
        if (user.recordID === currentUserID) {
            set({ error: 'Cannot share with yourself' });
            return false;
        }

        // Check for duplicate share
        const { data: existing } = await supabase
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
            creatorID: currentUserID,
            sharedToID: user.recordID,
            createdAt: Date.now(),
        };

        const { error } = await supabase
            .from('task_projects_shared')
            .insert(shareRecord);

        if (error) {
            set({ error: error.message || 'Failed to share project' });
            return false;
        }

        // Remove project from local cache since it's now shared
        removeCachedItem('cachedProjects', projectID);

        // Add to local shared project IDs set
        set((state) => ({
            sharedProjectIDs: new Set([...state.sharedProjectIDs, projectID]),
            error: null,
        }));

        return true;
    },

    unshareProject: async (projectID: string, sharedToID: string) => {
        await ensureSession();
        const { error } = await supabase
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

    getSharesForProject: async (projectID: string) => {
        await ensureSession();
        const { data, error } = await supabase
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
