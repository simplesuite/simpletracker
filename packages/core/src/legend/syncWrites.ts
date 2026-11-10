/**
 * Shared write-settlement helpers for synced observables.
 *
 * Offline-first writes go to a Legend-State observable optimistically, then
 * upload in the background. A naive store reports success the instant it calls
 * `.set()`, so a write that later FAILS to upload (lost connection, auth gap,
 * RLS rejection) looks like it saved when it did not. These helpers let a store
 * action:
 *   - wait until local persistence has finished loading before writing, so the
 *     sync listener actually observes the change (writes made before the local
 *     table loads are dropped by the plugin), and
 *   - wait for the pending-upload counter to drain and surface any real sync
 *     error, so the UI can tell the user a save failed instead of lying.
 *
 * `taskStore` pioneered this; `noteStore` and `projectStore` reuse it here so
 * all three behave identically. Each helper is parameterized by the collection's
 * observable, since Legend's `syncState` is keyed per observable.
 */

import { syncState } from '@legendapp/state';
import { useOfflineStore } from '../store/offlineStore';

export type WriteResult = {
    saved: boolean;
    error: string | null;
};

/**
 * Writes made before Legend-State has loaded its local table are not observed
 * by the persistence/sync listener. Wait only while a real local load is in
 * progress; the plain observable used by the core unit tests has no load to
 * await.
 */
export async function waitForPersistenceReady(observable$: unknown): Promise<void> {
    const state = syncState(observable$ as any) as any;
    const isPersistLoaded = state?.isPersistLoaded;
    const pendingLocalLoads = state?.numPendingLocalLoads;
    const pendingLoadCount = pendingLocalLoads?.peek?.();
    if (!isPersistLoaded || isPersistLoaded.peek() !== false || pendingLoadCount === undefined || pendingLoadCount <= 0) return;

    await new Promise<void>((resolve) => {
        let unsubscribe = () => undefined;
        const finish = () => {
            unsubscribe();
            resolve();
        };
        unsubscribe = isPersistLoaded.onChange(({ value }: { value: boolean }) => {
            if (value) finish();
        });
        if (isPersistLoaded.peek()) finish();
    });
}

export function getSyncError(observable$: unknown): string | null {
    const state = syncState(observable$ as any) as any;
    const error = state?.error?.peek?.();
    if (!error) return null;
    return error instanceof Error ? error.message : String(error);
}

export function clearSyncError(observable$: unknown): void {
    const state = syncState(observable$ as any) as any;
    state?.error?.set?.(undefined);
}

/**
 * Resolve once the observable's pending uploads have drained (or immediately
 * when offline, since nothing can upload). Reports any sync error that surfaced.
 * Times out after 10s so a stuck upload never hangs a caller forever.
 */
export async function waitForWritesToSettle(observable$: unknown): Promise<WriteResult> {
    if (!useOfflineStore.getState().isOnline) return { saved: true, error: null };

    // Let Legend-State process the observable change before inspecting its
    // pending-set counter. This also catches a create queued immediately before
    // an update for the same record.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const state = syncState(observable$ as any) as any;
    const pendingSets = state?.numPendingSets;
    const pendingCount = pendingSets?.peek?.();
    if (typeof pendingCount !== 'number' || pendingCount <= 0) {
        const error = getSyncError(observable$);
        return { saved: !error, error };
    }

    return new Promise<WriteResult>((resolve) => {
        let finished = false;
        let unsubscribe = () => undefined;
        const timeout = setTimeout(() => finish(false), 10000);
        const finish = (saved: boolean) => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            unsubscribe();
            const error = getSyncError(observable$);
            resolve({ saved: saved && !error, error });
        };
        unsubscribe = pendingSets.onChange(({ value }: { value: number }) => {
            if (value <= 0) finish(true);
        });
        if ((pendingSets.peek() || 0) <= 0) finish(true);
    });
}

/** Build a user-facing error message for a failed write. */
export function writeErrorMessage(action: string, result: WriteResult): string {
    return result.error
        ? `Unable to ${action}: ${result.error}`
        : `Unable to ${action}. Check your connection and try again.`;
}
