import { describe, it, expect } from 'vitest';
import { summarizeSyncStates } from '../offlineStore';

describe('summarizeSyncStates', () => {
    it('reports an idle, error-free state for no collections', () => {
        expect(summarizeSyncStates([])).toEqual({ syncing: false, pending: 0, error: null });
    });

    it('sums pending writes across collections and flags syncing', () => {
        const result = summarizeSyncStates([
            { numPendingSets: 2, isSetting: true },
            { numPendingSets: 1 },
            { isGetting: false },
        ]);
        expect(result).toEqual({ syncing: true, pending: 3, error: null });
    });

    it('surfaces the first sync error (Error instance or string)', () => {
        expect(summarizeSyncStates([{}, { error: new Error('RLS denied') }, { error: 'later' }]).error).toBe('RLS denied');
        expect(summarizeSyncStates([{ error: 'boom' }]).error).toBe('boom');
    });

    it('clears the error once no collection reports one', () => {
        expect(summarizeSyncStates([{ error: undefined }, { numPendingSets: 0 }]).error).toBeNull();
    });
});

import { describeRejectedWrites, useOfflineStore } from '../offlineStore';

describe('rejected writes', () => {
    it('describes nothing when empty', () => {
        expect(describeRejectedWrites([])).toBeNull();
    });

    it('summarizes the count and the first reason', () => {
        const text = describeRejectedWrites([
            { collection: 'tasks', recordID: 'a', action: 'create', message: '"A": bad' },
            { collection: 'notes', recordID: 'b', action: 'update', message: '"B": worse' },
        ]);
        expect(text).toBe('2 changes were rejected by the server and not saved: "A": bad');
    });

    it('clearRejectedWrites empties the list and the error', () => {
        useOfflineStore.setState({
            rejectedWrites: [{ collection: 'tasks', recordID: 'a', action: 'create', message: 'x' }],
            lastSyncError: 'x',
        });
        useOfflineStore.getState().clearRejectedWrites();
        expect(useOfflineStore.getState().rejectedWrites).toHaveLength(0);
        expect(useOfflineStore.getState().lastSyncError).toBeNull();
    });
});
