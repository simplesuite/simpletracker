/**
 * Tests for the fetch/merge logic in stores that preserves locally-created items
 * (pending inserts) and excludes items with pending deletes during server fetch.
 *
 * These tests verify the fixes to:
 * - noteStore.fetchNotes: preserves pending inserts, filters pending deletes
 * - taskStore.fetchTasks: preserves pending inserts, filters pending deletes
 * - projectStore.fetchProjects: preserves pending inserts, filters pending deletes
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import type { Note, Task, Project, PendingMutation } from '../../types/index';

// --- Mock setup ---

const TEST_USER_ID = 'user-123';

// Mock Supabase - tracks table queries and returns configured responses
let mockTableData: Record<string, any[]> = {};

/**
 * Creates a deeply chainable mock that eventually resolves with data
 * from mockTableData based on the table name used in .from().
 */
function createDeepChain(tableName: string): any {
    const handler: ProxyHandler<any> = {
        get(_target, prop) {
            if (prop === 'then') {
                // When awaited or .then'd, resolve with configured data
                return (resolve: any, reject: any) => {
                    const data = mockTableData[tableName] || [];
                    return Promise.resolve({ data, error: null }).then(resolve, reject);
                };
            }
            // All method calls return the same proxy (chainable)
            return (..._args: any[]) => new Proxy({}, handler);
        },
        apply() {
            return new Proxy({}, handler);
        },
    };
    return new Proxy(function () { }, handler);
}

vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: (table: string) => createDeepChain(table),
    },
}));

vi.mock('../../lib/offlineSync', () => ({
    insertWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: true }),
    updateWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: true }),
    deleteWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: true }),
}));

vi.mock('../../lib/cache', () => ({
    getCachedNotes: vi.fn().mockReturnValue([]),
    setCachedNotes: vi.fn(),
    getCachedSharedNotes: vi.fn().mockReturnValue([]),
    setCachedSharedNotes: vi.fn(),
    getCachedTasks: vi.fn().mockReturnValue([]),
    setCachedTasks: vi.fn(),
    getCachedSubtasks: vi.fn().mockReturnValue({}),
    setCachedSubtasks: vi.fn(),
    getCachedProjects: vi.fn().mockReturnValue([]),
    setCachedProjects: vi.fn(),
    removeCachedItem: vi.fn(),
}));

vi.mock('../../lib/sharing', () => ({
    isNoteSharedLocally: vi.fn().mockReturnValue(false),
    isTaskSharedLocally: vi.fn().mockReturnValue(false),
    isProjectSharedLocally: vi.fn().mockReturnValue(false),
    lookupUserByID: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../lib/recurrence', () => ({
    spawnRecurringTask: vi.fn().mockReturnValue({ task: {}, subtasks: [] }),
}));

vi.mock('../../components/extras/ensureSession', () => ({
    ensureSession: vi.fn().mockResolvedValue(true),
}));

// Mock offlineQueue - this is the key module for these tests
const mockGetAll = vi.fn().mockResolvedValue([]);
vi.mock('../../lib/offlineQueue', () => ({
    getAll: () => mockGetAll(),
    enqueue: vi.fn().mockResolvedValue(undefined),
    dequeue: vi.fn().mockResolvedValue(undefined),
    pendingCount: vi.fn().mockResolvedValue(0),
    hasPendingInsert: vi.fn().mockResolvedValue(false),
    mergeIntoInsert: vi.fn().mockResolvedValue(undefined),
    removeByRecordID: vi.fn().mockResolvedValue(undefined),
}));

import { useNoteStore } from '../noteStore';
import { useTaskStore } from '../taskStore';
import { useProjectStore } from '../projectStore';
import { useGlobalStore } from '../globalStore';
import { useOfflineStore } from '../offlineStore';

describe('Store fetch/merge logic with pending mutations', () => {
    beforeEach(() => {
        // Fresh IndexedDB
        globalThis.indexedDB = new IDBFactory();
        globalThis.IDBKeyRange = IDBKeyRange;

        // Reset mock responses
        mockTableData = {};
        mockGetAll.mockResolvedValue([]);

        // Reset stores
        useGlobalStore.setState({
            currentUser: { recordID: TEST_USER_ID, fullName: 'Test User', userType: 'free' },
        });
        useOfflineStore.setState({
            isOnline: true,
            pendingCount: 0,
            isSyncing: false,
            lastVerifiedAt: 0,
            lastSyncError: null,
        });
        useNoteStore.setState({
            notes: [],
            archivedNotes: [],
            sharedNotes: [],
            listItems: {},
            loading: false,
            error: null,
        });
        useTaskStore.setState({
            tasks: [],
            subtasks: {},
            statusFilter: 'open',
            loading: false,
            error: null,
        });
        useProjectStore.setState({
            projects: [],
            sharedProjectIDs: new Set(),
            loading: false,
            error: null,
        });

        vi.clearAllMocks();
    });

    describe('noteStore.fetchNotes', () => {
        const makeNote = (id: string, title: string, updatedAt: number): Note => ({
            recordID: id,
            creatorID: TEST_USER_ID,
            title,
            body: '',
            createdAt: updatedAt - 1000,
            updatedAt,
            projectID: null,
            archived: false,
            pinned: false,
            noteType: 'text',
        });

        it('preserves locally-created notes that have pending insert mutations', async () => {
            // A note exists only in local state (pending sync)
            const localNote = makeNote('local-note-1', 'Local Note', 5000);
            useNoteStore.setState({ notes: [localNote] });

            // The offline queue has a pending insert for this note
            mockGetAll.mockResolvedValue([
                {
                    id: 'note-insert-local-note-1',
                    entityType: 'note',
                    operation: 'insert',
                    recordID: 'local-note-1',
                    payload: { recordID: 'local-note-1', title: 'Local Note' },
                    _queuedAt: 5000,
                } as PendingMutation,
            ]);

            // Server returns no notes (the insert hasn't synced yet)
            mockTableData['notes'] = [];

            await useNoteStore.getState().fetchNotes();

            const notes = useNoteStore.getState().notes;
            expect(notes).toHaveLength(1);
            expect(notes[0].recordID).toBe('local-note-1');
            expect(notes[0].title).toBe('Local Note');
        });

        it('filters out notes with pending delete mutations', async () => {
            // Server returns a note that the user has locally deleted
            const serverNote = makeNote('deleted-note-1', 'Deleted Note', 3000);
            mockTableData['notes'] = [serverNote];

            // The offline queue has a pending delete for this note
            mockGetAll.mockResolvedValue([
                {
                    id: 'note-delete-deleted-note-1',
                    entityType: 'note',
                    operation: 'delete',
                    recordID: 'deleted-note-1',
                    payload: {},
                    _queuedAt: 4000,
                } as PendingMutation,
            ]);

            await useNoteStore.getState().fetchNotes();

            const notes = useNoteStore.getState().notes;
            expect(notes).toHaveLength(0);
        });

        it('does not duplicate notes that exist both locally and on server', async () => {
            // A note that was created locally AND has already synced to server
            const note = makeNote('synced-note-1', 'Synced Note', 5000);
            useNoteStore.setState({ notes: [note] });

            // Server returns the same note
            mockTableData['notes'] = [note];

            // Pending insert still in queue (will be dequeued on next sync)
            mockGetAll.mockResolvedValue([
                {
                    id: 'note-insert-synced-note-1',
                    entityType: 'note',
                    operation: 'insert',
                    recordID: 'synced-note-1',
                    payload: { recordID: 'synced-note-1' },
                    _queuedAt: 5000,
                } as PendingMutation,
            ]);

            await useNoteStore.getState().fetchNotes();

            const notes = useNoteStore.getState().notes;
            // Should NOT have duplicates
            const ids = notes.map((n) => n.recordID);
            const uniqueIds = [...new Set(ids)];
            expect(ids).toEqual(uniqueIds);
        });

        it('preserves multiple pending local notes alongside server notes', async () => {
            // Two local notes pending sync
            const localNote1 = makeNote('local-1', 'Local 1', 6000);
            const localNote2 = makeNote('local-2', 'Local 2', 7000);
            useNoteStore.setState({ notes: [localNote2, localNote1] });

            // Server returns one existing note
            const serverNote = makeNote('server-1', 'Server Note', 4000);
            mockTableData['notes'] = [serverNote];

            // Queue has pending inserts for both local notes
            mockGetAll.mockResolvedValue([
                { id: 'note-insert-local-1', entityType: 'note', operation: 'insert', recordID: 'local-1', payload: {}, _queuedAt: 6000 } as PendingMutation,
                { id: 'note-insert-local-2', entityType: 'note', operation: 'insert', recordID: 'local-2', payload: {}, _queuedAt: 7000 } as PendingMutation,
            ]);

            await useNoteStore.getState().fetchNotes();

            const notes = useNoteStore.getState().notes;
            expect(notes.length).toBeGreaterThanOrEqual(3);
            expect(notes.find((n) => n.recordID === 'local-1')).toBeDefined();
            expect(notes.find((n) => n.recordID === 'local-2')).toBeDefined();
            expect(notes.find((n) => n.recordID === 'server-1')).toBeDefined();
        });

        it('only considers note-type mutations (ignores task/project pending mutations)', async () => {
            // A task has a pending delete - should not affect notes
            mockGetAll.mockResolvedValue([
                { id: 'task-delete-task-1', entityType: 'task', operation: 'delete', recordID: 'task-1', payload: {}, _queuedAt: 1000 } as PendingMutation,
            ]);

            const serverNote = makeNote('note-1', 'Server Note', 3000);
            mockTableData['notes'] = [serverNote];

            await useNoteStore.getState().fetchNotes();

            const notes = useNoteStore.getState().notes;
            expect(notes).toHaveLength(1);
            expect(notes[0].recordID).toBe('note-1');
        });
    });

    describe('taskStore.fetchTasks', () => {
        const makeTask = (id: string, title: string, updatedAt: number): Task => ({
            recordID: id,
            creatorID: TEST_USER_ID,
            projectID: null,
            title,
            body: '',
            status: 'open',
            dueDate: null,
            isRecurring: false,
            recurrenceInterval: null,
            recurrenceUnit: null,
            recurrenceAnchor: 'due_date',
            completedAt: null,
            createdAt: updatedAt - 1000,
            updatedAt,
        });

        it('preserves locally-created tasks that have pending insert mutations', async () => {
            const localTask = makeTask('local-task-1', 'Local Task', 5000);
            useTaskStore.setState({ tasks: [localTask] });

            mockGetAll.mockResolvedValue([
                {
                    id: 'task-insert-local-task-1',
                    entityType: 'task',
                    operation: 'insert',
                    recordID: 'local-task-1',
                    payload: { recordID: 'local-task-1', title: 'Local Task' },
                    _queuedAt: 5000,
                } as PendingMutation,
            ]);

            // Server returns no tasks
            mockTableData['tasks'] = [];

            await useTaskStore.getState().fetchTasks();

            const tasks = useTaskStore.getState().tasks;
            expect(tasks).toHaveLength(1);
            expect(tasks[0].recordID).toBe('local-task-1');
        });

        it('filters out tasks with pending delete mutations', async () => {
            const serverTask = makeTask('deleted-task-1', 'Deleted Task', 3000);
            mockTableData['tasks'] = [serverTask];

            mockGetAll.mockResolvedValue([
                {
                    id: 'task-delete-deleted-task-1',
                    entityType: 'task',
                    operation: 'delete',
                    recordID: 'deleted-task-1',
                    payload: {},
                    _queuedAt: 4000,
                } as PendingMutation,
            ]);

            await useTaskStore.getState().fetchTasks();

            const tasks = useTaskStore.getState().tasks;
            expect(tasks).toHaveLength(0);
        });

        it('does not duplicate tasks that exist both locally and on server', async () => {
            const task = makeTask('synced-task-1', 'Synced Task', 5000);
            useTaskStore.setState({ tasks: [task] });

            mockTableData['tasks'] = [task];

            mockGetAll.mockResolvedValue([
                {
                    id: 'task-insert-synced-task-1',
                    entityType: 'task',
                    operation: 'insert',
                    recordID: 'synced-task-1',
                    payload: { recordID: 'synced-task-1' },
                    _queuedAt: 5000,
                } as PendingMutation,
            ]);

            await useTaskStore.getState().fetchTasks();

            const tasks = useTaskStore.getState().tasks;
            const ids = tasks.map((t) => t.recordID);
            const uniqueIds = [...new Set(ids)];
            expect(ids).toEqual(uniqueIds);
        });

        it('only considers task-type mutations (ignores note/project pending mutations)', async () => {
            mockGetAll.mockResolvedValue([
                { id: 'note-delete-note-1', entityType: 'note', operation: 'delete', recordID: 'note-1', payload: {}, _queuedAt: 1000 } as PendingMutation,
            ]);

            const serverTask = makeTask('task-1', 'Server Task', 3000);
            mockTableData['tasks'] = [serverTask];

            await useTaskStore.getState().fetchTasks();

            const tasks = useTaskStore.getState().tasks;
            expect(tasks).toHaveLength(1);
            expect(tasks[0].recordID).toBe('task-1');
        });
    });

    describe('projectStore.fetchProjects', () => {
        const makeProject = (id: string, name: string, updatedAt: number): Project => ({
            recordID: id,
            creatorID: TEST_USER_ID,
            name,
            description: '',
            createdAt: updatedAt - 1000,
            updatedAt,
        });

        it('preserves locally-created projects that have pending insert mutations', async () => {
            const localProject = makeProject('local-proj-1', 'Local Project', 5000);
            useProjectStore.setState({ projects: [localProject] });

            mockGetAll.mockResolvedValue([
                {
                    id: 'project-insert-local-proj-1',
                    entityType: 'project',
                    operation: 'insert',
                    recordID: 'local-proj-1',
                    payload: { recordID: 'local-proj-1', name: 'Local Project' },
                    _queuedAt: 5000,
                } as PendingMutation,
            ]);

            // Server returns no projects
            mockTableData['task_projects'] = [];

            await useProjectStore.getState().fetchProjects();

            const projects = useProjectStore.getState().projects;
            expect(projects).toHaveLength(1);
            expect(projects[0].recordID).toBe('local-proj-1');
            expect(projects[0].name).toBe('Local Project');
        });

        it('filters out projects with pending delete mutations', async () => {
            const serverProject = makeProject('deleted-proj-1', 'Deleted Project', 3000);
            mockTableData['task_projects'] = [serverProject];

            mockGetAll.mockResolvedValue([
                {
                    id: 'project-delete-deleted-proj-1',
                    entityType: 'project',
                    operation: 'delete',
                    recordID: 'deleted-proj-1',
                    payload: {},
                    _queuedAt: 4000,
                } as PendingMutation,
            ]);

            await useProjectStore.getState().fetchProjects();

            const projects = useProjectStore.getState().projects;
            expect(projects).toHaveLength(0);
        });

        it('does not duplicate projects that exist both locally and on server', async () => {
            const project = makeProject('synced-proj-1', 'Synced Project', 5000);
            useProjectStore.setState({ projects: [project] });

            mockTableData['task_projects'] = [project];

            mockGetAll.mockResolvedValue([
                {
                    id: 'project-insert-synced-proj-1',
                    entityType: 'project',
                    operation: 'insert',
                    recordID: 'synced-proj-1',
                    payload: { recordID: 'synced-proj-1' },
                    _queuedAt: 5000,
                } as PendingMutation,
            ]);

            await useProjectStore.getState().fetchProjects();

            const projects = useProjectStore.getState().projects;
            const ids = projects.map((p) => p.recordID);
            const uniqueIds = [...new Set(ids)];
            expect(ids).toEqual(uniqueIds);
        });

        it('only considers project-type mutations (ignores note/task pending mutations)', async () => {
            mockGetAll.mockResolvedValue([
                { id: 'note-delete-note-1', entityType: 'note', operation: 'delete', recordID: 'proj-1', payload: {}, _queuedAt: 1000 } as PendingMutation,
            ]);

            const serverProject = makeProject('proj-1', 'Server Project', 3000);
            mockTableData['task_projects'] = [serverProject];

            await useProjectStore.getState().fetchProjects();

            const projects = useProjectStore.getState().projects;
            expect(projects).toHaveLength(1);
            expect(projects[0].recordID).toBe('proj-1');
        });
    });

    describe('cross-entity isolation', () => {
        it('pending note delete does not affect tasks with same recordID', async () => {
            // Edge case: a note and a task happen to share the same recordID (unlikely but tests isolation)
            const task: Task = {
                recordID: 'shared-id',
                creatorID: TEST_USER_ID,
                projectID: null,
                title: 'A Task',
                body: '',
                status: 'open',
                dueDate: null,
                isRecurring: false,
                recurrenceInterval: null,
                recurrenceUnit: null,
                recurrenceAnchor: 'due_date',
                completedAt: null,
                createdAt: 1000,
                updatedAt: 2000,
            };

            mockTableData['tasks'] = [task];

            // A note with the same ID has a pending delete
            mockGetAll.mockResolvedValue([
                { id: 'note-delete-shared-id', entityType: 'note', operation: 'delete', recordID: 'shared-id', payload: {}, _queuedAt: 3000 } as PendingMutation,
            ]);

            await useTaskStore.getState().fetchTasks();

            const tasks = useTaskStore.getState().tasks;
            // The task should NOT be filtered out - the delete is for a note, not a task
            expect(tasks).toHaveLength(1);
            expect(tasks[0].recordID).toBe('shared-id');
        });
    });
});
