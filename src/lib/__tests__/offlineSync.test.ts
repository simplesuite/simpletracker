import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';

// Mock supabase before importing offlineSync
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

const mockFrom = vi.fn((_table: string) => ({
    insert: mockInsert,
    update: (...args: any[]) => {
        mockUpdate(...args);
        return { eq: mockEq };
    },
    delete: (...args: any[]) => {
        mockDelete(...args);
        return { eq: mockEq };
    },
}));

vi.mock('../supabase', () => ({
    supabase: {
        from: (table: string) => mockFrom(table),
        auth: {
            getSession: vi.fn().mockResolvedValue({ data: { session: { expires_at: Math.floor(Date.now() / 1000) + 3600 } } }),
            refreshSession: vi.fn().mockResolvedValue({ error: null }),
        },
    },
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_KEY: 'test-key',
}));

vi.mock('../../components/extras/ensureSession', () => ({
    ensureSession: vi.fn().mockResolvedValue(true),
}));

// We need to import after mocks are set up
import {
    insertWithOfflineSupport,
    updateWithOfflineSupport,
    deleteWithOfflineSupport,
    syncPendingMutations,
    _resetSyncStateForTesting,
} from '../offlineSync';
import { getAll, enqueue, pendingCount } from '../offlineQueue';
import { useOfflineStore } from '../../store/offlineStore';
import { ensureSession } from '../../components/extras/ensureSession';
import type { PendingMutation } from '../../types';

describe('offlineSync', () => {
    beforeEach(() => {
        // Fresh IndexedDB for each test
        globalThis.indexedDB = new IDBFactory();
        globalThis.IDBKeyRange = IDBKeyRange;

        // Reset module-level sync state
        _resetSyncStateForTesting();

        // Reset navigator.onLine to true
        Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });

        // Reset all mocks
        vi.clearAllMocks();
        mockInsert.mockResolvedValue({ error: null });
        mockEq.mockResolvedValue({ error: null });
        vi.mocked(ensureSession).mockResolvedValue(true);

        // Reset offline store
        useOfflineStore.getState().setPendingCount(0);
        useOfflineStore.getState().setIsSyncing(false);
        useOfflineStore.getState().setIsOnline(true);
        useOfflineStore.getState().setLastSyncError(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('insertWithOfflineSupport', () => {
        it('enqueues the mutation to IndexedDB', async () => {
            const payload = { recordID: 'note-1', title: 'Test Note', creatorID: 'user-1' };

            const result = await insertWithOfflineSupport('note', 'notes', payload);

            expect(result).toEqual({ success: true, queued: true });

            const pending = await getAll();
            expect(pending).toHaveLength(1);
            expect(pending[0].entityType).toBe('note');
            expect(pending[0].operation).toBe('insert');
            expect(pending[0].recordID).toBe('note-1');
            expect(pending[0].payload).toEqual(payload);
        });

        it('updates pending count in offline store', async () => {
            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };

            await insertWithOfflineSupport('note', 'notes', payload);

            expect(useOfflineStore.getState().pendingCount).toBe(1);
        });

        it('does not attempt network sync when offline', async () => {
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', payload);

            // Should not call supabase
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('attempts background sync when online', async () => {
            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', payload);

            // Give the fire-and-forget sync time to execute
            await vi.waitFor(() => {
                expect(mockFrom).toHaveBeenCalledWith('notes');
            });
            expect(mockInsert).toHaveBeenCalledWith(payload);
        });

        it('dequeues the mutation after successful sync', async () => {
            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', payload);

            // Wait for background sync
            await vi.waitFor(async () => {
                const count = await pendingCount();
                expect(count).toBe(0);
            });
        });

        it('leaves mutation in queue on network failure', async () => {
            mockInsert.mockRejectedValue(new Error('Network timeout'));

            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', payload);

            // Wait for the background sync attempt to finish
            await new Promise((r) => setTimeout(r, 50));

            const pending = await getAll();
            expect(pending).toHaveLength(1);
        });

        it('dequeues mutation on duplicate key conflict (23505)', async () => {
            mockInsert.mockResolvedValue({ error: { code: '23505', message: 'duplicate key' } });

            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', payload);

            await vi.waitFor(async () => {
                const count = await pendingCount();
                expect(count).toBe(0);
            });
        });

        it('dequeues mutation on permanent failure (RLS violation)', async () => {
            mockInsert.mockResolvedValue({ error: { code: '42501', message: 'RLS denied' } });

            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', payload);

            await vi.waitFor(async () => {
                const count = await pendingCount();
                expect(count).toBe(0);
            });
        });

        it('leaves mutation in queue on transient error', async () => {
            mockInsert.mockResolvedValue({ error: { code: '500', message: 'Internal server error' } });

            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', payload);

            await new Promise((r) => setTimeout(r, 50));

            const pending = await getAll();
            expect(pending).toHaveLength(1);
        });

        it('does not sync when session is invalid', async () => {
            vi.mocked(ensureSession).mockResolvedValueOnce(false);

            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', payload);

            await new Promise((r) => setTimeout(r, 50));

            // Mutation stays in queue
            const pending = await getAll();
            expect(pending).toHaveLength(1);
            // Supabase was not called
            expect(mockFrom).not.toHaveBeenCalled();
        });
    });

    describe('updateWithOfflineSupport', () => {
        it('enqueues update mutation when no pending insert exists', async () => {
            const payload = { title: 'Updated Title', updatedAt: Date.now() };

            const result = await updateWithOfflineSupport('note', 'notes', 'note-1', payload);

            expect(result).toEqual({ success: true, queued: true });

            const pending = await getAll();
            expect(pending).toHaveLength(1);
            expect(pending[0].operation).toBe('update');
            expect(pending[0].recordID).toBe('note-1');
            expect(pending[0].payload).toEqual(payload);
        });

        it('merges into pending insert instead of creating separate update', async () => {
            // First, enqueue an insert
            const insertPayload = { recordID: 'note-1', title: 'Original', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', insertPayload);

            // Wait a moment for background sync to attempt (will fail or succeed)
            // Reset mocks to isolate the update behavior
            mockInsert.mockResolvedValue({ error: { code: '500', message: 'fail' } });
            await new Promise((r) => setTimeout(r, 50));

            // Reset indexedDB with the insert still pending
            // Actually, let's check what's in the queue first
            // The insert may have been dequeued if sync succeeded. Let's make it fail.
            globalThis.indexedDB = new IDBFactory();
            const insertMutation: PendingMutation = {
                id: 'note-insert-note-1-12345',
                entityType: 'note',
                operation: 'insert',
                recordID: 'note-1',
                payload: { recordID: 'note-1', title: 'Original', creatorID: 'user-1' },
                _queuedAt: 12345,
            };
            await enqueue(insertMutation);

            // Now update
            const updatePayload = { title: 'Updated', updatedAt: 99999 };
            await updateWithOfflineSupport('note', 'notes', 'note-1', updatePayload);

            // Should still have just 1 mutation (the insert, now merged)
            const pending = await getAll();
            expect(pending).toHaveLength(1);
            expect(pending[0].operation).toBe('insert');
            expect(pending[0].payload).toEqual({
                recordID: 'note-1',
                title: 'Updated',
                creatorID: 'user-1',
                updatedAt: 99999,
            });
        });

        it('triggers syncPendingMutations after merge when online', async () => {
            // Enqueue a pending insert
            const insertMutation: PendingMutation = {
                id: 'note-insert-note-1-12345',
                entityType: 'note',
                operation: 'insert',
                recordID: 'note-1',
                payload: { recordID: 'note-1', title: 'Original', creatorID: 'user-1' },
                _queuedAt: 12345,
            };
            await enqueue(insertMutation);

            // Simulate successful insert
            mockInsert.mockResolvedValue({ error: null });

            const updatePayload = { title: 'Updated', updatedAt: 99999 };
            await updateWithOfflineSupport('note', 'notes', 'note-1', updatePayload);

            // syncPendingMutations should eventually drain the queue
            await vi.waitFor(async () => {
                const count = await pendingCount();
                expect(count).toBe(0);
            });

            // The insert should have been called with merged payload
            expect(mockFrom).toHaveBeenCalledWith('notes');
            expect(mockInsert).toHaveBeenCalledWith({
                recordID: 'note-1',
                title: 'Updated',
                creatorID: 'user-1',
                updatedAt: 99999,
            });
        });

        it('does not attempt sync when offline', async () => {
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

            const payload = { title: 'Updated', updatedAt: Date.now() };
            await updateWithOfflineSupport('note', 'notes', 'note-1', payload);

            expect(mockFrom).not.toHaveBeenCalled();

            const pending = await getAll();
            expect(pending).toHaveLength(1);
        });

        it('uses correct table mapping for different entity types', async () => {
            mockEq.mockResolvedValue({ error: null });

            await updateWithOfflineSupport('task', 'tasks', 'task-1', { title: 'Updated' });

            await vi.waitFor(() => {
                expect(mockFrom).toHaveBeenCalledWith('tasks');
            });
        });
    });

    describe('deleteWithOfflineSupport', () => {
        it('enqueues delete mutation', async () => {
            const result = await deleteWithOfflineSupport('note', 'notes', 'note-1');

            expect(result).toEqual({ success: true, queued: true });

            const pending = await getAll();
            expect(pending).toHaveLength(1);
            expect(pending[0].operation).toBe('delete');
            expect(pending[0].recordID).toBe('note-1');
            expect(pending[0].payload).toEqual({});
        });

        it('attempts background sync when online', async () => {
            mockEq.mockResolvedValue({ error: null });

            await deleteWithOfflineSupport('note', 'notes', 'note-1');

            await vi.waitFor(() => {
                expect(mockFrom).toHaveBeenCalledWith('notes');
            });
            expect(mockDelete).toHaveBeenCalled();
        });

        it('does not attempt sync when offline', async () => {
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

            await deleteWithOfflineSupport('note', 'notes', 'note-1');

            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('dequeues after successful delete', async () => {
            mockEq.mockResolvedValue({ error: null });

            await deleteWithOfflineSupport('note', 'notes', 'note-1');

            await vi.waitFor(async () => {
                const count = await pendingCount();
                expect(count).toBe(0);
            });
        });
    });

    describe('syncPendingMutations', () => {
        it('processes all pending mutations in FIFO order', async () => {
            const callOrder: string[] = [];
            mockInsert.mockImplementation(async (payload: any) => {
                callOrder.push(payload.recordID);
                return { error: null };
            });

            // Enqueue multiple mutations
            const mutations: PendingMutation[] = [
                { id: 'note-insert-1', entityType: 'note', operation: 'insert', recordID: 'note-1', payload: { recordID: 'note-1' }, _queuedAt: 1000 },
                { id: 'note-insert-2', entityType: 'note', operation: 'insert', recordID: 'note-2', payload: { recordID: 'note-2' }, _queuedAt: 2000 },
                { id: 'note-insert-3', entityType: 'note', operation: 'insert', recordID: 'note-3', payload: { recordID: 'note-3' }, _queuedAt: 3000 },
            ];
            for (const m of mutations) {
                await enqueue(m);
            }

            const result = await syncPendingMutations();

            expect(result.synced).toBe(3);
            expect(result.failed).toBe(0);
            expect(callOrder).toEqual(['note-1', 'note-2', 'note-3']);

            const remaining = await pendingCount();
            expect(remaining).toBe(0);
        });

        it('returns early when offline', async () => {
            Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

            const mutation: PendingMutation = {
                id: 'test-1', entityType: 'note', operation: 'insert',
                recordID: 'note-1', payload: { recordID: 'note-1' }, _queuedAt: 1000,
            };
            await enqueue(mutation);

            const result = await syncPendingMutations();

            expect(result).toEqual({ synced: 0, failed: 0 });
            expect(mockFrom).not.toHaveBeenCalled();
        });

        it('stops processing when session is invalid', async () => {
            vi.mocked(ensureSession).mockResolvedValue(false);

            const mutations: PendingMutation[] = [
                { id: 'test-1', entityType: 'note', operation: 'insert', recordID: 'note-1', payload: { recordID: 'note-1' }, _queuedAt: 1000 },
                { id: 'test-2', entityType: 'note', operation: 'insert', recordID: 'note-2', payload: { recordID: 'note-2' }, _queuedAt: 2000 },
            ];
            for (const m of mutations) {
                await enqueue(m);
            }

            const result = await syncPendingMutations();

            expect(result.failed).toBe(1);
            // Supabase should not have been called
            expect(mockInsert).not.toHaveBeenCalled();
            // All mutations remain in queue
            const remaining = await pendingCount();
            expect(remaining).toBe(2);
        });

        it('handles mixed success and permanent failures', async () => {
            let callCount = 0;
            mockInsert.mockImplementation(async () => {
                callCount++;
                if (callCount === 2) {
                    return { error: { code: '23503', message: 'FK violation' } };
                }
                return { error: null };
            });

            const mutations: PendingMutation[] = [
                { id: 'test-1', entityType: 'note', operation: 'insert', recordID: 'note-1', payload: { recordID: 'note-1' }, _queuedAt: 1000 },
                { id: 'test-2', entityType: 'note', operation: 'insert', recordID: 'note-2', payload: { recordID: 'note-2' }, _queuedAt: 2000 },
                { id: 'test-3', entityType: 'note', operation: 'insert', recordID: 'note-3', payload: { recordID: 'note-3' }, _queuedAt: 3000 },
            ];
            for (const m of mutations) {
                await enqueue(m);
            }

            const result = await syncPendingMutations();

            // All 3 should be processed (permanent failures are dequeued too)
            expect(result.synced).toBe(3);
            expect(result.failed).toBe(0);
            expect(await pendingCount()).toBe(0);
        });

        it('retains mutations with transient errors', async () => {
            let callCount = 0;
            mockInsert.mockImplementation(async () => {
                callCount++;
                if (callCount === 2) {
                    return { error: { code: '500', message: 'Server error' } };
                }
                return { error: null };
            });

            const mutations: PendingMutation[] = [
                { id: 'test-1', entityType: 'note', operation: 'insert', recordID: 'note-1', payload: { recordID: 'note-1' }, _queuedAt: 1000 },
                { id: 'test-2', entityType: 'note', operation: 'insert', recordID: 'note-2', payload: { recordID: 'note-2' }, _queuedAt: 2000 },
                { id: 'test-3', entityType: 'note', operation: 'insert', recordID: 'note-3', payload: { recordID: 'note-3' }, _queuedAt: 3000 },
            ];
            for (const m of mutations) {
                await enqueue(m);
            }

            const result = await syncPendingMutations();

            expect(result.synced).toBe(2);
            expect(result.failed).toBe(1);
            // The failed one remains
            const remaining = await getAll();
            expect(remaining).toHaveLength(1);
            expect(remaining[0].recordID).toBe('note-2');
        });

        it('prevents concurrent execution (syncInProgress guard)', async () => {
            // Make insert take time to resolve
            let resolveFirst: () => void;
            const firstCallPromise = new Promise<void>((r) => { resolveFirst = r; });
            mockInsert.mockImplementationOnce(async () => {
                await firstCallPromise;
                return { error: null };
            });

            const mutation: PendingMutation = {
                id: 'test-1', entityType: 'note', operation: 'insert',
                recordID: 'note-1', payload: { recordID: 'note-1' }, _queuedAt: 1000,
            };
            await enqueue(mutation);

            // Start first sync (will block on the mock)
            const firstSync = syncPendingMutations();

            // Second sync should return immediately
            const secondSync = await syncPendingMutations();
            expect(secondSync).toEqual({ synced: 0, failed: 0 });

            // Unblock first sync
            resolveFirst!();
            const firstResult = await firstSync;
            expect(firstResult.synced).toBe(1);
        });

        it('sets isSyncing flag during sync', async () => {
            let wasSyncing = false;
            mockInsert.mockImplementation(async () => {
                wasSyncing = useOfflineStore.getState().isSyncing;
                return { error: null };
            });

            const mutation: PendingMutation = {
                id: 'test-1', entityType: 'note', operation: 'insert',
                recordID: 'note-1', payload: { recordID: 'note-1' }, _queuedAt: 1000,
            };
            await enqueue(mutation);

            await syncPendingMutations();

            expect(wasSyncing).toBe(true);
            expect(useOfflineStore.getState().isSyncing).toBe(false);
        });

        it('handles update mutations correctly', async () => {
            mockEq.mockResolvedValue({ error: null });

            const mutation: PendingMutation = {
                id: 'test-1', entityType: 'task', operation: 'update',
                recordID: 'task-1', payload: { title: 'Updated', updatedAt: 12345 }, _queuedAt: 1000,
            };
            await enqueue(mutation);

            const result = await syncPendingMutations();

            expect(result.synced).toBe(1);
            expect(mockFrom).toHaveBeenCalledWith('tasks');
            expect(mockUpdate).toHaveBeenCalledWith({ title: 'Updated', updatedAt: 12345 });
            expect(mockEq).toHaveBeenCalledWith('recordID', 'task-1');
        });

        it('handles delete mutations correctly', async () => {
            mockEq.mockResolvedValue({ error: null });

            const mutation: PendingMutation = {
                id: 'test-1', entityType: 'project', operation: 'delete',
                recordID: 'proj-1', payload: {}, _queuedAt: 1000,
            };
            await enqueue(mutation);

            const result = await syncPendingMutations();

            expect(result.synced).toBe(1);
            expect(mockFrom).toHaveBeenCalledWith('task_projects');
            expect(mockDelete).toHaveBeenCalled();
            expect(mockEq).toHaveBeenCalledWith('recordID', 'proj-1');
        });

        it('maps entity types to correct table names', async () => {
            const cases: Array<[PendingMutation['entityType'], string]> = [
                ['note', 'notes'],
                ['task', 'tasks'],
                ['subtask', 'task_subtasks'],
                ['project', 'task_projects'],
                ['noteListItem', 'notes_listitems'],
            ];

            for (const [entityType, expectedTable] of cases) {
                vi.clearAllMocks();
                globalThis.indexedDB = new IDBFactory();
                mockInsert.mockResolvedValue({ error: null });

                const mutation: PendingMutation = {
                    id: `test-${entityType}`, entityType, operation: 'insert',
                    recordID: `${entityType}-1`, payload: { recordID: `${entityType}-1` }, _queuedAt: 1000,
                };
                await enqueue(mutation);

                await syncPendingMutations();

                expect(mockFrom).toHaveBeenCalledWith(expectedTable);
            }
        });
    });

    describe('in-flight mutation guard', () => {
        it('insertWithOfflineSupport does not double-execute via concurrent syncPendingMutations', async () => {
            // Make the insert take some time so we can overlap calls
            let insertCallCount = 0;
            let resolveInsert: () => void;
            const insertPromise = new Promise<void>((r) => { resolveInsert = r; });

            mockInsert.mockImplementation(async () => {
                insertCallCount++;
                await insertPromise;
                return { error: null };
            });

            const payload = { recordID: 'note-1', title: 'Test', creatorID: 'user-1' };
            await insertWithOfflineSupport('note', 'notes', payload);

            // syncSingleMutation is fire-and-forget but since it's async, it starts
            // executing on the microtask queue. Let's flush microtasks so it registers
            // in the inFlight set.
            await new Promise((r) => setTimeout(r, 10));

            // Now trigger syncPendingMutations while syncSingleMutation is in-flight
            const batchResult = await syncPendingMutations();

            // syncPendingMutations should have skipped the in-flight mutation
            expect(batchResult.synced).toBe(0);
            expect(batchResult.failed).toBe(0);

            // Resolve the pending insert
            resolveInsert!();
            await new Promise((r) => setTimeout(r, 10));

            // Insert should have been called exactly once (by syncSingleMutation only)
            expect(insertCallCount).toBe(1);
        });
    });
});
