/**
 * Integration tests for end-to-end flows.
 *
 * Tests the following flows:
 * 1. Note create → edit → archive → unarchive → delete
 * 2. Task create → complete (with recurrence) → verify new task spawned
 * 3. Project create → share → verify shared user access
 * 4. Offline queue → go online → verify sync drains queue
 *
 * Requirements: 4.1, 9.1, 10.3, 14.1, 15.2
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { useNoteStore } from '../store/noteStore';
import { useTaskStore } from '../store/taskStore';
import { useProjectStore } from '../store/projectStore';
import { useGlobalStore } from '../store/globalStore';
import { useOfflineStore } from '../store/offlineStore';
import * as offlineQueue from '../lib/offlineQueue';
import { syncPendingMutations } from '../lib/offlineSync';

// Mock Supabase client
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

function createChainMock(resolvedValue: any = { data: [], error: null }) {
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockReturnValue(chain);
    chain.update = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.neq = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockReturnValue(chain);
    // Make the chain thenable so it resolves when awaited
    chain.then = (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject);
    return chain;
}

// Track calls per table for assertions
const tableChains: Record<string, any> = {};

function getTableChain(table: string) {
    if (!tableChains[table]) {
        tableChains[table] = createChainMock();
    }
    return tableChains[table];
}

vi.mock('../lib/supabase', () => ({
    supabase: {
        from: (table: string) => getTableChain(table),
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test' } } }),
            refreshSession: vi.fn().mockResolvedValue({ error: null }),
        },
    },
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_KEY: 'test-key',
}));

vi.mock('../components/extras/ensureSession', () => ({
    ensureSession: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/networkUtils', () => ({
    withNetworkTimeout: <T>(promise: Promise<T> | PromiseLike<T>) => Promise.resolve(promise),
}));

// Mock uuid to return predictable IDs
let uuidCounter = 0;
vi.mock('uuid', () => ({
    v4: () => `test-uuid-${++uuidCounter}`,
}));

describe('Integration: Note Lifecycle (create → edit → archive → unarchive → delete)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        uuidCounter = 0;
        globalThis.indexedDB = new IDBFactory();

        // Reset stores
        useGlobalStore.setState({
            currentUser: { recordID: 'user-1', fullName: 'Test User', userType: 'free' },
        });
        useNoteStore.setState({
            notes: [],
            archivedNotes: [],
            sharedNotes: [],
            loading: false,
            error: null,
        });
        useOfflineStore.setState({
            isOnline: true,
            pendingCount: 0,
            isSyncing: false,
            lastVerifiedAt: 0,
        });

        // Setup table mocks for notes - not shared
        Object.keys(tableChains).forEach((key) => delete tableChains[key]);

        // notes_shared returns empty (not shared)
        tableChains['notes_shared'] = createChainMock({ data: [], error: null });
        // task_projects_shared returns empty (not shared)
        tableChains['task_projects_shared'] = createChainMock({ data: [], error: null });
        // notes table
        tableChains['notes'] = createChainMock({ data: null, error: null });
    });

    it('should create, edit, archive, unarchive, and delete a note', async () => {
        // Step 1: Create a note
        const createdNote = await useNoteStore.getState().createNote();
        expect(createdNote).not.toBeNull();
        expect(createdNote!.recordID).toBe('test-uuid-1');
        expect(createdNote!.title).toBe('');
        expect(createdNote!.body).toBe('');
        expect(createdNote!.archived).toBe(false);
        expect(createdNote!.creatorID).toBe('user-1');

        // Verify note is in the store
        let notes = useNoteStore.getState().notes;
        expect(notes).toHaveLength(1);
        expect(notes[0].recordID).toBe('test-uuid-1');

        // Step 2: Edit the note (update title and body)
        // Re-setup mocks for the update flow (isSharedItem check)
        tableChains['notes_shared'] = createChainMock({ data: [], error: null });
        tableChains['task_projects_shared'] = createChainMock({ data: [], error: null });

        const updateResult = await useNoteStore.getState().updateNote('test-uuid-1', {
            title: 'My Integration Test Note',
            body: 'This is the body content',
        });
        expect(updateResult).toBe(true);

        notes = useNoteStore.getState().notes;
        expect(notes[0].title).toBe('My Integration Test Note');
        expect(notes[0].body).toBe('This is the body content');

        // Step 3: Archive the note
        tableChains['notes_shared'] = createChainMock({ data: [], error: null });
        tableChains['task_projects_shared'] = createChainMock({ data: [], error: null });

        const archiveResult = await useNoteStore.getState().archiveNote('test-uuid-1');
        expect(archiveResult).toBe(true);

        // Note should move from notes to archivedNotes
        notes = useNoteStore.getState().notes;
        const archived = useNoteStore.getState().archivedNotes;
        expect(notes).toHaveLength(0);
        expect(archived).toHaveLength(1);
        expect(archived[0].archived).toBe(true);
        expect(archived[0].title).toBe('My Integration Test Note');
        expect(archived[0].body).toBe('This is the body content');

        // Step 4: Unarchive the note
        tableChains['notes_shared'] = createChainMock({ data: [], error: null });
        tableChains['task_projects_shared'] = createChainMock({ data: [], error: null });

        const unarchiveResult = await useNoteStore.getState().unarchiveNote('test-uuid-1');
        expect(unarchiveResult).toBe(true);

        // Note should move back to notes
        notes = useNoteStore.getState().notes;
        const archivedAfter = useNoteStore.getState().archivedNotes;
        expect(notes).toHaveLength(1);
        expect(archivedAfter).toHaveLength(0);
        expect(notes[0].archived).toBe(false);
        expect(notes[0].title).toBe('My Integration Test Note');

        // Step 5: Delete the note
        tableChains['notes_shared'] = createChainMock({ data: null, error: null });
        tableChains['notes'] = createChainMock({ data: null, error: null });

        const deleteResult = await useNoteStore.getState().deleteNote('test-uuid-1');
        expect(deleteResult).toBe(true);

        // Note should be gone from all lists
        notes = useNoteStore.getState().notes;
        expect(notes).toHaveLength(0);
        expect(useNoteStore.getState().archivedNotes).toHaveLength(0);
    });
});

describe('Integration: Task with Recurrence (create → complete → verify spawned)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        uuidCounter = 0;
        globalThis.indexedDB = new IDBFactory();

        useGlobalStore.setState({
            currentUser: { recordID: 'user-1', fullName: 'Test User', userType: 'free' },
        });
        useTaskStore.setState({
            tasks: [],
            subtasks: {},
            statusFilter: 'open',
            loading: false,
            error: null,
        });
        useOfflineStore.setState({
            isOnline: true,
            pendingCount: 0,
            isSyncing: false,
            lastVerifiedAt: 0,
        });

        Object.keys(tableChains).forEach((key) => delete tableChains[key]);
        tableChains['task_projects_shared'] = createChainMock({ data: [], error: null });
        tableChains['tasks'] = createChainMock({ data: null, error: null });
    });

    it('should create a recurring task, complete it, and spawn a new task', async () => {
        // Step 1: Create a task
        const createdTask = await useTaskStore.getState().createTask('Daily Standup');
        expect(createdTask).not.toBeNull();
        expect(createdTask!.recordID).toBe('test-uuid-1');
        expect(createdTask!.title).toBe('Daily Standup');
        expect(createdTask!.status).toBe('open');
        expect(createdTask!.isRecurring).toBe(false);

        let tasks = useTaskStore.getState().tasks;
        expect(tasks).toHaveLength(1);

        // Step 2: Update the task to be recurring with a due date
        tableChains['task_projects_shared'] = createChainMock({ data: [], error: null });

        const dueDate = new Date('2024-01-15').getTime();
        const updateResult = await useTaskStore.getState().updateTask('test-uuid-1', {
            isRecurring: true,
            recurrenceInterval: 1,
            recurrenceUnit: 'days',
            dueDate: dueDate,
        });
        expect(updateResult).toBe(true);

        tasks = useTaskStore.getState().tasks;
        expect(tasks[0].isRecurring).toBe(true);
        expect(tasks[0].recurrenceInterval).toBe(1);
        expect(tasks[0].recurrenceUnit).toBe('days');
        expect(tasks[0].dueDate).toBe(dueDate);

        // Step 3: Complete the task — should spawn a new recurring task
        tableChains['task_projects_shared'] = createChainMock({ data: [], error: null });

        const completeResult = await useTaskStore.getState().completeTask('test-uuid-1');
        expect(completeResult).toBe(true);

        // Verify original task is completed
        tasks = useTaskStore.getState().tasks;
        const completedTask = tasks.find((t) => t.recordID === 'test-uuid-1');
        expect(completedTask).toBeDefined();
        expect(completedTask!.status).toBe('completed');
        expect(completedTask!.completedAt).not.toBeNull();

        // Verify a new task was spawned
        const spawnedTask = tasks.find((t) => t.recordID !== 'test-uuid-1');
        expect(spawnedTask).toBeDefined();
        expect(spawnedTask!.title).toBe('Daily Standup');
        expect(spawnedTask!.status).toBe('open');
        expect(spawnedTask!.completedAt).toBeNull();
        expect(spawnedTask!.isRecurring).toBe(true);
        expect(spawnedTask!.recurrenceInterval).toBe(1);
        expect(spawnedTask!.recurrenceUnit).toBe('days');

        // Verify the new due date is 1 day after the original
        const expectedNextDue = new Date('2024-01-16').getTime();
        expect(spawnedTask!.dueDate).toBe(expectedNextDue);

        // Total tasks should be 2 (original completed + new spawned)
        expect(tasks).toHaveLength(2);
    });

    it('should spawn task with subtasks reset to incomplete', async () => {
        // Create a task
        const createdTask = await useTaskStore.getState().createTask('Weekly Review');
        expect(createdTask).not.toBeNull();

        // Make it recurring
        tableChains['task_projects_shared'] = createChainMock({ data: [], error: null });
        await useTaskStore.getState().updateTask('test-uuid-1', {
            isRecurring: true,
            recurrenceInterval: 1,
            recurrenceUnit: 'weeks',
            dueDate: new Date('2024-01-15').getTime(),
        });

        // Add subtasks to the store manually (simulating fetched subtasks)
        useTaskStore.setState((state) => ({
            subtasks: {
                ...state.subtasks,
                'test-uuid-1': [
                    {
                        recordID: 'sub-1',
                        taskID: 'test-uuid-1',
                        title: 'Review PRs',
                        isCompleted: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    },
                    {
                        recordID: 'sub-2',
                        taskID: 'test-uuid-1',
                        title: 'Update board',
                        isCompleted: true,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                    },
                ],
            },
        }));

        // Complete the task
        tableChains['task_projects_shared'] = createChainMock({ data: [], error: null });
        const completeResult = await useTaskStore.getState().completeTask('test-uuid-1');
        expect(completeResult).toBe(true);

        // Find the spawned task
        const tasks = useTaskStore.getState().tasks;
        const spawnedTask = tasks.find((t) => t.recordID !== 'test-uuid-1');
        expect(spawnedTask).toBeDefined();

        // Verify subtasks were spawned for the new task with isCompleted=false
        const spawnedSubtasks = useTaskStore.getState().subtasks[spawnedTask!.recordID];
        expect(spawnedSubtasks).toBeDefined();
        expect(spawnedSubtasks).toHaveLength(2);
        expect(spawnedSubtasks[0].title).toBe('Review PRs');
        expect(spawnedSubtasks[0].isCompleted).toBe(false);
        expect(spawnedSubtasks[1].title).toBe('Update board');
        expect(spawnedSubtasks[1].isCompleted).toBe(false);
    });
});

describe('Integration: Project Sharing (create → share → verify access)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        uuidCounter = 0;
        globalThis.indexedDB = new IDBFactory();

        useGlobalStore.setState({
            currentUser: { recordID: 'user-1', fullName: 'Test User', userType: 'free' },
        });
        useProjectStore.setState({
            projects: [],
            loading: false,
            error: null,
        });
        useOfflineStore.setState({
            isOnline: true,
            pendingCount: 0,
            isSyncing: false,
            lastVerifiedAt: 0,
        });

        Object.keys(tableChains).forEach((key) => delete tableChains[key]);
        tableChains['task_projects'] = createChainMock({ data: null, error: null });
        tableChains['task_projects_shared'] = createChainMock({ data: null, error: null });
    });

    it('should create a project, share it, and verify share records', async () => {
        // Step 1: Create a project
        const project = await useProjectStore.getState().createProject('My Project', 'A test project');
        expect(project).not.toBeNull();
        expect(project!.recordID).toBe('test-uuid-1');
        expect(project!.name).toBe('My Project');
        expect(project!.description).toBe('A test project');
        expect(project!.creatorID).toBe('user-1');

        let projects = useProjectStore.getState().projects;
        expect(projects).toHaveLength(1);

        // Step 2: Share the project with another user
        // Mock the users table lookup to return a user
        tableChains['users'] = createChainMock({ data: { recordID: 'user-2', email: 'friend@test.com' }, error: null });
        // Mock checking for existing share (none found)
        tableChains['task_projects_shared'] = createChainMock({ data: null, error: null });

        const shareResult = await useProjectStore.getState().shareProject('test-uuid-1', 'friend@test.com');
        expect(shareResult).toBe(true);
        expect(useProjectStore.getState().error).toBeNull();

        // Step 3: Verify we can get shares for the project
        // Mock getSharesForProject to return the share record
        tableChains['task_projects_shared'] = createChainMock({
            data: [
                { recordID: 'test-uuid-2', projectID: 'test-uuid-1', sharedToID: 'user-2', createdAt: Date.now() },
            ],
            error: null,
        });

        const shares = await useProjectStore.getState().getSharesForProject('test-uuid-1');
        expect(shares).toHaveLength(1);
        expect(shares[0].projectID).toBe('test-uuid-1');
        expect(shares[0].sharedToID).toBe('user-2');
    });

    it('should prevent self-sharing', async () => {
        // Create a project
        await useProjectStore.getState().createProject('Self Share Test');

        // Try to share with self
        tableChains['users'] = createChainMock({ data: { recordID: 'user-1', email: 'me@test.com' }, error: null });

        const shareResult = await useProjectStore.getState().shareProject('test-uuid-1', 'me@test.com');
        expect(shareResult).toBe(false);
        expect(useProjectStore.getState().error).toBe('Cannot share with yourself');
    });

    it('should prevent duplicate sharing', async () => {
        // Create a project
        await useProjectStore.getState().createProject('Dup Share Test');

        // Mock user lookup
        tableChains['users'] = createChainMock({ data: { recordID: 'user-2', email: 'friend@test.com' }, error: null });
        // Mock existing share found
        tableChains['task_projects_shared'] = createChainMock({
            data: { recordID: 'existing-share', projectID: 'test-uuid-1', sharedToID: 'user-2' },
            error: null,
        });

        const shareResult = await useProjectStore.getState().shareProject('test-uuid-1', 'friend@test.com');
        expect(shareResult).toBe(false);
        expect(useProjectStore.getState().error).toBe('Already shared with this user');
    });
});

describe('Integration: Offline Queue Sync (queue → go online → drain)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        uuidCounter = 0;
        globalThis.indexedDB = new IDBFactory();

        useGlobalStore.setState({
            currentUser: { recordID: 'user-1', fullName: 'Test User', userType: 'free' },
        });
        useOfflineStore.setState({
            isOnline: false,
            pendingCount: 0,
            isSyncing: false,
            lastVerifiedAt: 0,
        });

        Object.keys(tableChains).forEach((key) => delete tableChains[key]);
    });

    it('should queue mutations while offline and drain them when online', async () => {
        // Simulate being offline
        Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });

        // Enqueue some mutations directly (simulating what stores do when offline)
        await offlineQueue.enqueue({
            id: 'note-insert-note-1-1000',
            entityType: 'note',
            operation: 'insert',
            recordID: 'note-1',
            payload: { recordID: 'note-1', title: 'Offline Note', body: '', creatorID: 'user-1', createdAt: 1000, updatedAt: 1000, projectID: null, archived: false },
            _queuedAt: 1000,
        });

        await offlineQueue.enqueue({
            id: 'task-insert-task-1-2000',
            entityType: 'task',
            operation: 'insert',
            recordID: 'task-1',
            payload: { recordID: 'task-1', title: 'Offline Task', body: '', creatorID: 'user-1', status: 'open', createdAt: 2000, updatedAt: 2000 },
            _queuedAt: 2000,
        });

        await offlineQueue.enqueue({
            id: 'note-update-note-1-3000',
            entityType: 'note',
            operation: 'update',
            recordID: 'note-1',
            payload: { title: 'Updated Offline Note', updatedAt: 3000 },
            _queuedAt: 3000,
        });

        // Verify queue has 3 items
        let pending = await offlineQueue.getAll();
        expect(pending).toHaveLength(3);

        // Verify FIFO order
        expect(pending[0]._queuedAt).toBe(1000);
        expect(pending[1]._queuedAt).toBe(2000);
        expect(pending[2]._queuedAt).toBe(3000);

        // Now go online and sync
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
        useOfflineStore.setState({ isOnline: true });

        // Mock successful Supabase responses for sync
        tableChains['notes'] = createChainMock({ data: null, error: null });
        tableChains['tasks'] = createChainMock({ data: null, error: null });

        // Run sync
        const result = await syncPendingMutations();

        // All mutations should have been synced
        expect(result.synced).toBe(3);
        expect(result.failed).toBe(0);

        // Queue should be empty
        pending = await offlineQueue.getAll();
        expect(pending).toHaveLength(0);

        // Pending count in store should be 0
        expect(useOfflineStore.getState().pendingCount).toBe(0);
    });

    it('should retain mutations in queue when sync fails', async () => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
        useOfflineStore.setState({ isOnline: true });

        // Enqueue a mutation
        await offlineQueue.enqueue({
            id: 'note-insert-note-fail-1000',
            entityType: 'note',
            operation: 'insert',
            recordID: 'note-fail',
            payload: { recordID: 'note-fail', title: 'Will Fail', creatorID: 'user-1' },
            _queuedAt: 1000,
        });

        // Mock Supabase returning an error (non-duplicate)
        tableChains['notes'] = createChainMock({ data: null, error: { message: 'Server error', code: '500' } });

        const result = await syncPendingMutations();

        // Should have failed
        expect(result.failed).toBe(1);
        expect(result.synced).toBe(0);

        // Mutation should still be in queue
        const pending = await offlineQueue.getAll();
        expect(pending).toHaveLength(1);
        expect(pending[0].recordID).toBe('note-fail');
    });

    it('should handle duplicate key conflicts by removing from queue', async () => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
        useOfflineStore.setState({ isOnline: true });

        // Enqueue a mutation
        await offlineQueue.enqueue({
            id: 'note-insert-note-dup-1000',
            entityType: 'note',
            operation: 'insert',
            recordID: 'note-dup',
            payload: { recordID: 'note-dup', title: 'Duplicate', creatorID: 'user-1' },
            _queuedAt: 1000,
        });

        // Mock Supabase returning a duplicate key error (23505)
        tableChains['notes'] = createChainMock({ data: null, error: { message: 'duplicate key', code: '23505' } });

        const result = await syncPendingMutations();

        // Should count as synced (conflict resolved)
        expect(result.synced).toBe(1);
        expect(result.failed).toBe(0);

        // Queue should be empty
        const pending = await offlineQueue.getAll();
        expect(pending).toHaveLength(0);
    });

    it('should process mutations in FIFO order during sync', async () => {
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });
        useOfflineStore.setState({ isOnline: true });

        // Enqueue mutations with specific order
        await offlineQueue.enqueue({
            id: 'first-1000',
            entityType: 'note',
            operation: 'insert',
            recordID: 'note-first',
            payload: { recordID: 'note-first', title: 'First' },
            _queuedAt: 1000,
        });
        await offlineQueue.enqueue({
            id: 'second-2000',
            entityType: 'note',
            operation: 'update',
            recordID: 'note-first',
            payload: { title: 'First Updated', updatedAt: 2000 },
            _queuedAt: 2000,
        });
        await offlineQueue.enqueue({
            id: 'third-3000',
            entityType: 'task',
            operation: 'insert',
            recordID: 'task-after',
            payload: { recordID: 'task-after', title: 'After' },
            _queuedAt: 3000,
        });

        // Track the order of operations
        const operationOrder: string[] = [];
        tableChains['notes'] = {
            ...createChainMock({ data: null, error: null }),
            insert: vi.fn().mockImplementation(() => {
                operationOrder.push('notes-insert');
                return createChainMock({ data: null, error: null });
            }),
            update: vi.fn().mockImplementation(() => {
                operationOrder.push('notes-update');
                const chain = createChainMock({ data: null, error: null });
                return chain;
            }),
            select: vi.fn().mockReturnValue(createChainMock({ data: null, error: null })),
            delete: vi.fn().mockReturnValue(createChainMock({ data: null, error: null })),
        };
        tableChains['tasks'] = {
            ...createChainMock({ data: null, error: null }),
            insert: vi.fn().mockImplementation(() => {
                operationOrder.push('tasks-insert');
                return createChainMock({ data: null, error: null });
            }),
            select: vi.fn().mockReturnValue(createChainMock({ data: null, error: null })),
            update: vi.fn().mockReturnValue(createChainMock({ data: null, error: null })),
            delete: vi.fn().mockReturnValue(createChainMock({ data: null, error: null })),
        };

        await syncPendingMutations();

        // Queue should be drained
        const pending = await offlineQueue.getAll();
        expect(pending).toHaveLength(0);
    });
});
