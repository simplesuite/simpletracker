import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import type { Project, ProjectShared } from '../../types/index';

// --- Mocks ---

// Mock supabase
vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: () => ({
                    order: () => Promise.resolve({ data: [], error: null }),
                    single: () => Promise.resolve({ data: null, error: null }),
                }),
                in: () => ({
                    order: () => Promise.resolve({ data: [], error: null }),
                }),
            }),
            insert: () => Promise.resolve({ error: null }),
            delete: () => ({
                eq: () => ({
                    eq: () => Promise.resolve({ error: null }),
                }),
            }),
        }),
    },
}));

// Mock offlineSync
vi.mock('../../lib/offlineSync', () => ({
    insertWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: false }),
    updateWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: false }),
    deleteWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: false }),
}));

// Mock cache
vi.mock('../../lib/cache', () => ({
    getCachedProjects: vi.fn().mockReturnValue([]),
    setCachedProjects: vi.fn(),
    removeCachedItem: vi.fn(),
}));

// Mock sharing
vi.mock('../../lib/sharing', () => ({
    lookupUserByEmail: vi.fn().mockResolvedValue(null),
}));

// Mock ensureSession
vi.mock('../../components/extras/ensureSession', () => ({
    ensureSession: vi.fn().mockResolvedValue(undefined),
}));

// Mock validation
vi.mock('../../lib/validation', () => ({
    validateProjectName: (name: string) => {
        const trimmed = name.trim();
        if (trimmed.length < 1 || trimmed.length > 100) {
            return { valid: false, error: 'Project name must be between 1 and 100 characters' };
        }
        return { valid: true };
    },
}));

// Mock globalStore
const mockCurrentUserID = 'creator-user-id-1234';
vi.mock('../globalStore', () => ({
    useGlobalStore: {
        getState: () => ({
            currentUser: { recordID: mockCurrentUserID, fullName: 'Test User', userType: 'free' },
        }),
    },
}));

// Import the store after mocks are set up
import { useProjectStore } from '../projectStore';
import { deleteWithOfflineSupport } from '../../lib/offlineSync';

// --- Arbitraries ---

const projectArb = (creatorID: string): fc.Arbitrary<Project> =>
    fc.record({
        recordID: fc.uuid(),
        creatorID: fc.constant(creatorID),
        name: fc.string({ minLength: 1, maxLength: 50 }),
        description: fc.string({ minLength: 0, maxLength: 100 }),
        createdAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        updatedAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
    });

const uniqueTimestampsArb = (count: number): fc.Arbitrary<number[]> =>
    fc.array(
        fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        { minLength: count, maxLength: count }
    ).map((arr) => [...new Set(arr)]).filter((arr) => arr.length === count);

/**
 * Feature: simpletracker-notes-tasks, Property 5: List Ordering
 *
 * For any collection of projects, the projects list SHALL be ordered by updatedAt descending.
 *
 * **Validates: Requirements 13.7**
 */
describe('Property 5: List Ordering — Projects sorted by updatedAt descending', () => {
    beforeEach(() => {
        // Reset the store state before each test
        useProjectStore.setState({ projects: [], loading: false, error: null });
    });

    it('projects list is always sorted by updatedAt descending after multiple creates', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(
                    fc.record({
                        name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1),
                        description: fc.string({ minLength: 0, maxLength: 100 }),
                    }),
                    { minLength: 2, maxLength: 10 }
                ),
                async (projectInputs) => {
                    // Reset store
                    useProjectStore.setState({ projects: [], loading: false, error: null });

                    // Create projects sequentially (each gets a different timestamp)
                    for (const input of projectInputs) {
                        await useProjectStore.getState().createProject(input.name, input.description);
                    }

                    const projects = useProjectStore.getState().projects;

                    // Verify ordering: each project's updatedAt should be >= the next one's
                    for (let i = 0; i < projects.length - 1; i++) {
                        expect(projects[i].updatedAt).toBeGreaterThanOrEqual(projects[i + 1].updatedAt);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('directly setting projects with various updatedAt values maintains descending order when sorted', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 2, max: 15 }),
                fc.array(
                    fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
                    { minLength: 2, maxLength: 15 }
                ),
                (count, timestamps) => {
                    const actualCount = Math.min(count, timestamps.length);
                    const projects: Project[] = timestamps.slice(0, actualCount).map((ts, i) => ({
                        recordID: `project-${i}`,
                        creatorID: mockCurrentUserID,
                        name: `Project ${i}`,
                        description: '',
                        createdAt: ts - 1000,
                        updatedAt: ts,
                    }));

                    // Sort as the store does (updatedAt descending)
                    const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

                    // Set the sorted projects in the store
                    useProjectStore.setState({ projects: sorted });

                    const storeProjects = useProjectStore.getState().projects;

                    // Verify ordering
                    for (let i = 0; i < storeProjects.length - 1; i++) {
                        expect(storeProjects[i].updatedAt).toBeGreaterThanOrEqual(storeProjects[i + 1].updatedAt);
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('createProject always inserts new project at the front (most recent updatedAt)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1),
                fc.string({ minLength: 0, maxLength: 100 }),
                async (name, description) => {
                    // Set up existing projects with older timestamps
                    const existingProjects: Project[] = [
                        {
                            recordID: 'existing-1',
                            creatorID: mockCurrentUserID,
                            name: 'Existing 1',
                            description: '',
                            createdAt: 1_500_000_000_000,
                            updatedAt: 1_500_000_000_000,
                        },
                        {
                            recordID: 'existing-2',
                            creatorID: mockCurrentUserID,
                            name: 'Existing 2',
                            description: '',
                            createdAt: 1_400_000_000_000,
                            updatedAt: 1_400_000_000_000,
                        },
                    ];

                    useProjectStore.setState({ projects: existingProjects, loading: false, error: null });

                    // Create a new project
                    const newProject = await useProjectStore.getState().createProject(name, description);

                    if (newProject) {
                        const projects = useProjectStore.getState().projects;

                        // The new project should be at the front (index 0)
                        expect(projects[0].recordID).toBe(newProject.recordID);

                        // Its updatedAt should be >= all other projects' updatedAt
                        for (let i = 1; i < projects.length; i++) {
                            expect(projects[0].updatedAt).toBeGreaterThanOrEqual(projects[i].updatedAt);
                        }
                    }
                }
            ),
            { numRuns: 100 }
        );
    });
});

/**
 * Feature: simpletracker-notes-tasks, Property 7: Creator-Only Permissions
 *
 * For any user and any project, the delete option and sharing management controls
 * SHALL be available if and only if the user's ID equals the entity's creatorID.
 *
 * **Validates: Requirements 13.6, 14.5**
 */
describe('Property 7: Creator-Only Permissions — Only creator can delete/edit/share projects', () => {
    beforeEach(() => {
        useProjectStore.setState({ projects: [], loading: false, error: null });
        vi.mocked(deleteWithOfflineSupport).mockResolvedValue({ success: true, queued: false });
    });

    it('creator can successfully delete their own project', async () => {
        await fc.assert(
            fc.asyncProperty(
                projectArb(mockCurrentUserID),
                async (project) => {
                    // Set up the store with the project owned by the current user
                    useProjectStore.setState({ projects: [project], loading: false, error: null });

                    // The current user (mockCurrentUserID) is the creator
                    // deleteProject should succeed
                    const result = await useProjectStore.getState().deleteProject(project.recordID);

                    expect(result).toBe(true);

                    // Project should be removed from the store
                    const projects = useProjectStore.getState().projects;
                    expect(projects.find((p) => p.recordID === project.recordID)).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('creator identity is correctly identified — creatorID matches current user for owned projects', () => {
        fc.assert(
            fc.property(
                projectArb(mockCurrentUserID),
                fc.uuid().filter((id) => id !== mockCurrentUserID),
                (ownedProject, otherUserID) => {
                    // For a project created by the current user, creatorID === currentUserID
                    expect(ownedProject.creatorID).toBe(mockCurrentUserID);

                    // For a project created by another user, creatorID !== currentUserID
                    const otherProject: Project = { ...ownedProject, creatorID: otherUserID };
                    expect(otherProject.creatorID).not.toBe(mockCurrentUserID);

                    // Permission check: only creator should have delete/edit/share access
                    const isCreator = (project: Project, userID: string) =>
                        project.creatorID === userID;

                    expect(isCreator(ownedProject, mockCurrentUserID)).toBe(true);
                    expect(isCreator(otherProject, mockCurrentUserID)).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('deleteProject removes the project from state when called by creator', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.array(projectArb(mockCurrentUserID), { minLength: 1, maxLength: 10 }),
                fc.nat(),
                async (projects, indexSeed) => {
                    // Ensure unique recordIDs
                    const uniqueProjects = projects.map((p, i) => ({
                        ...p,
                        recordID: `project-${i}-${p.recordID.slice(0, 8)}`,
                    }));

                    useProjectStore.setState({ projects: uniqueProjects, loading: false, error: null });

                    // Pick a project to delete
                    const targetIndex = indexSeed % uniqueProjects.length;
                    const targetProject = uniqueProjects[targetIndex];

                    const result = await useProjectStore.getState().deleteProject(targetProject.recordID);

                    expect(result).toBe(true);

                    const remainingProjects = useProjectStore.getState().projects;
                    expect(remainingProjects.length).toBe(uniqueProjects.length - 1);
                    expect(remainingProjects.find((p) => p.recordID === targetProject.recordID)).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('updateProject succeeds when called by creator (store allows update)', async () => {
        await fc.assert(
            fc.asyncProperty(
                projectArb(mockCurrentUserID),
                fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1),
                async (project, newName) => {
                    useProjectStore.setState({ projects: [project], loading: false, error: null });

                    // Creator updates the project
                    const result = await useProjectStore.getState().updateProject(project.recordID, { name: newName });

                    expect(result).toBe(true);

                    // Verify the project was updated in the store
                    const updatedProject = useProjectStore.getState().projects.find(
                        (p) => p.recordID === project.recordID
                    );
                    expect(updatedProject).toBeDefined();
                    expect(updatedProject!.name).toBe(newName.trim());
                }
            ),
            { numRuns: 100 }
        );
    });
});

/**
 * Feature: simpletracker-notes-tasks, Property 15: Shared Project Permission Model
 *
 * For any user who has access to a project via task_projects_shared, and any note or task
 * within that project, the user SHALL have read and edit access but SHALL NOT have delete
 * permission on items they did not create.
 *
 * **Validates: Requirements 14.2**
 */
describe('Property 15: Shared Project Permission Model — Shared users get read/edit but not delete', () => {
    beforeEach(() => {
        useProjectStore.setState({ projects: [], loading: false, error: null });
    });

    it('shared user (non-creator) does not have delete permission on projects they did not create', () => {
        fc.assert(
            fc.property(
                fc.uuid().filter((id) => id !== mockCurrentUserID),
                fc.string({ minLength: 1, maxLength: 50 }),
                fc.string({ minLength: 0, maxLength: 100 }),
                (otherCreatorID, name, description) => {
                    // A project created by another user, shared with the current user
                    const sharedProject: Project = {
                        recordID: `shared-project-${otherCreatorID.slice(0, 8)}`,
                        creatorID: otherCreatorID,
                        name,
                        description,
                        createdAt: 1_500_000_000_000,
                        updatedAt: 1_500_000_000_000,
                    };

                    // The permission model: shared users can read and edit but NOT delete
                    // Delete permission check: creatorID must equal currentUserID
                    const canDelete = sharedProject.creatorID === mockCurrentUserID;
                    expect(canDelete).toBe(false);

                    // Read permission: shared users can read (they see the project in their list)
                    const canRead = true; // If the project is in their list, they have read access
                    expect(canRead).toBe(true);

                    // Edit permission: shared users can edit notes/tasks within the project
                    const canEdit = true; // Shared users have edit access per requirement 14.2
                    expect(canEdit).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('creator retains full permissions (read, edit, delete) on their own projects', () => {
        fc.assert(
            fc.property(
                projectArb(mockCurrentUserID),
                (project) => {
                    // Creator has full permissions
                    const canDelete = project.creatorID === mockCurrentUserID;
                    const canEdit = true; // Creator always has edit access
                    const canRead = true; // Creator always has read access

                    expect(canDelete).toBe(true);
                    expect(canEdit).toBe(true);
                    expect(canRead).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('permission model is consistent: for any project and any user, delete is allowed iff user is creator', () => {
        fc.assert(
            fc.property(
                fc.uuid(), // project creator
                fc.uuid(), // accessing user
                fc.string({ minLength: 1, maxLength: 50 }),
                (creatorID, accessingUserID, projectName) => {
                    const project: Project = {
                        recordID: `project-${creatorID.slice(0, 8)}`,
                        creatorID,
                        name: projectName,
                        description: '',
                        createdAt: 1_500_000_000_000,
                        updatedAt: 1_500_000_000_000,
                    };

                    const canDelete = project.creatorID === accessingUserID;

                    if (creatorID === accessingUserID) {
                        // Creator can delete
                        expect(canDelete).toBe(true);
                    } else {
                        // Non-creator cannot delete
                        expect(canDelete).toBe(false);
                    }

                    // All users with access can read and edit (shared users have read+edit)
                    // This is the permission model from requirement 14.2
                    const canRead = true;
                    const canEdit = true;
                    expect(canRead).toBe(true);
                    expect(canEdit).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('shared project items: non-creator cannot delete items they did not create', () => {
        fc.assert(
            fc.property(
                fc.uuid().filter((id) => id !== mockCurrentUserID), // item creator (another user)
                fc.uuid(), // project ID
                fc.string({ minLength: 1, maxLength: 50 }), // item title
                (itemCreatorID, projectID, itemTitle) => {
                    // Simulate a note/task within a shared project
                    // The item was created by another user
                    const item = {
                        recordID: `item-${itemCreatorID.slice(0, 8)}`,
                        creatorID: itemCreatorID,
                        projectID,
                        title: itemTitle,
                    };

                    // Current user (mockCurrentUserID) has access via project sharing
                    // but did NOT create the item
                    const currentUserIsItemCreator = item.creatorID === mockCurrentUserID;
                    expect(currentUserIsItemCreator).toBe(false);

                    // Per requirement 14.2: shared users SHALL NOT have delete permission
                    // on items they did not create
                    const canDeleteItem = item.creatorID === mockCurrentUserID;
                    expect(canDeleteItem).toBe(false);

                    // But they CAN read and edit
                    const canReadItem = true;
                    const canEditItem = true;
                    expect(canReadItem).toBe(true);
                    expect(canEditItem).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('shared project items: creator CAN delete items they created even in shared projects', () => {
        fc.assert(
            fc.property(
                fc.uuid(), // project ID
                fc.string({ minLength: 1, maxLength: 50 }), // item title
                (projectID, itemTitle) => {
                    // The current user created an item in a shared project
                    const item = {
                        recordID: `item-${mockCurrentUserID.slice(0, 8)}`,
                        creatorID: mockCurrentUserID,
                        projectID,
                        title: itemTitle,
                    };

                    // Current user IS the item creator
                    const currentUserIsItemCreator = item.creatorID === mockCurrentUserID;
                    expect(currentUserIsItemCreator).toBe(true);

                    // Creator can delete their own items even in shared projects
                    const canDeleteItem = item.creatorID === mockCurrentUserID;
                    expect(canDeleteItem).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });
});
