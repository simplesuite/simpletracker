import { describe, it, expect, vi } from 'vitest';

// Control the online flag the settlement helper reads.
let online = true;
vi.mock('../../store/offlineStore', () => ({
    useOfflineStore: {
        getState: () => ({ isOnline: online }),
    },
}));

import { waitForWritesToSettle, writeErrorMessage } from '../syncWrites';
import { observable } from '@legendapp/state';

describe('writeErrorMessage', () => {
    it('includes the sync error when present', () => {
        expect(writeErrorMessage('save note', { saved: false, error: 'RLS denied' })).toBe(
            'Unable to save note: RLS denied'
        );
    });

    it('falls back to a connection hint when no specific error', () => {
        expect(writeErrorMessage('create task', { saved: false, error: null })).toBe(
            'Unable to create task. Check your connection and try again.'
        );
    });
});

describe('waitForWritesToSettle', () => {
    it('reports saved immediately while offline (nothing can upload)', async () => {
        online = false;
        const obs = observable<Record<string, unknown>>({});
        const result = await waitForWritesToSettle(obs);
        expect(result).toEqual({ saved: true, error: null });
        online = true;
    });

    it('reports saved for a plain observable with no pending-set tracking', async () => {
        // A plain observable (as used in unit tests) exposes no numPendingSets,
        // so the helper treats the write as settled with no error.
        online = true;
        const obs = observable<Record<string, unknown>>({});
        const result = await waitForWritesToSettle(obs);
        expect(result.saved).toBe(true);
        expect(result.error).toBeNull();
    });
});
