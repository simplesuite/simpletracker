import { describe, it, expect, vi, beforeEach } from 'vitest';

let currentUser = 'user-1';
let capturedOnError: ((error: unknown, params: any) => void) | undefined;

vi.mock('../../runtime', () => ({
    getSupabase: () => ({}),
    getPersistPlugin: () => undefined,
    getCurrentUserId: () => currentUser,
}));

vi.mock('../config', () => ({ syncEnabled$: { get: () => true } }));

vi.mock('@legendapp/state/sync-plugins/supabase', () => ({
    syncedSupabase: (opts: any) => {
        capturedOnError = opts.onError;
        return {};
    },
}));

import { syncedTable } from '../syncedTable';
import { useOfflineStore } from '../../store/offlineStore';

function activate() {
    const table$ = syncedTable<any>({ collection: 'tasks', persistName: 'st_test' });
    // Activation runs the lazy factory, which is what calls syncedSupabase.
    try {
        (table$ as any).peek();
    } catch {
        /* the stubbed synced config is not a real sync descriptor */
    }
    if (!capturedOnError) throw new Error('onError not captured');
    return capturedOnError;
}

function makeParams(source = 'create') {
    return {
        type: 'set' as const,
        source,
        input: { recordID: 'task-1', title: 'Water plants' },
        retry: { retryNum: 0, cancelRetry: false },
        setParams: { update: vi.fn() },
        revert: vi.fn(),
    };
}

describe('syncedTable poison-write handling', () => {
    beforeEach(() => {
        currentUser = 'user-1';
        useOfflineStore.setState({ rejectedWrites: [], lastSyncError: null });
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('cancels, unwedges, reverts and records a constraint rejection', () => {
        const onError = activate();
        const params = makeParams();
        onError(new Error('violates foreign key constraint "fk"'), params);

        expect(params.retry.cancelRetry).toBe(true);
        expect(params.setParams.update).toHaveBeenCalledWith({ value: {}, mode: 'merge', changes: [] });
        expect(params.revert).toHaveBeenCalled();
        const rejected = useOfflineStore.getState().rejectedWrites;
        expect(rejected).toHaveLength(1);
        expect(rejected[0]).toMatchObject({ collection: 'tasks', recordID: 'task-1', action: 'create' });
        expect(rejected[0].message).toContain('"Water plants"');
    });

    it('keeps retrying a transient failure and leaves local work alone', () => {
        const onError = activate();
        const params = makeParams();
        onError(new Error('Failed to fetch'), params);

        expect(params.retry.cancelRetry).toBe(false);
        expect(params.setParams.update).not.toHaveBeenCalled();
        expect(params.revert).not.toHaveBeenCalled();
        expect(useOfflineStore.getState().rejectedWrites).toHaveLength(0);
    });

    it('keeps an RLS-denied write when the session has lapsed', () => {
        currentUser = '';
        const onError = activate();
        const params = makeParams();
        onError(new Error('new row violates row-level security policy for table "tasks"'), params);

        expect(params.retry.cancelRetry).toBe(false);
        expect(params.revert).not.toHaveBeenCalled();
    });

    it('records the same rejection only once across repeated callbacks', () => {
        const onError = activate();
        onError(new Error('duplicate key value violates unique constraint'), makeParams());
        onError(new Error('duplicate key value violates unique constraint'), makeParams());
        expect(useOfflineStore.getState().rejectedWrites).toHaveLength(1);
    });
});
