import { syncState } from '@legendapp/state';
import { notes$, noteListItems$, useNoteStore } from '../store/noteStore';
import { tasks$, subtasks$, useTaskStore } from '../store/taskStore';
import { projects$, projectShares$, useProjectStore } from '../store/projectStore';

const allSynced = [
    notes$,
    noteListItems$,
    tasks$,
    subtasks$,
    projects$,
    projectShares$,
];

type SyncController = {
    sync: (options?: { resetLastSync?: boolean }) => Promise<void> | void;
};

/**
 * Wait for a single collection's pending upload queue to drain.
 *
 * `numPendingSets` counts local writes that haven't been confirmed by the
 * server yet (the offline/optimistic queue). We must not force a full-list
 * reconcile while it is non-zero: with `changesSince: 'all'` and no soft-delete
 * column, the reconcile reads the entire authoritative row set and drops any
 * local row that isn't in the server response — including a just-created record
 * whose INSERT is still in flight. That is what made a new task disappear on
 * refresh. Bounded wait so a stuck upload can't hang refresh forever.
 */
function waitForPendingSetsToDrain(observable: unknown, timeoutMs = 10000): Promise<void> {
    const state = syncState(observable as any) as any;
    const pendingSets = state?.numPendingSets;
    if (!pendingSets || typeof pendingSets.peek !== 'function') return Promise.resolve();
    if ((pendingSets.peek() || 0) <= 0) return Promise.resolve();

    return new Promise<void>((resolve) => {
        let finished = false;
        let unsubscribe = () => undefined;
        const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            unsubscribe();
            resolve();
        };
        const timeout = setTimeout(finish, timeoutMs);
        unsubscribe = pendingSets.onChange(({ value }: { value: number }) => {
            if (value <= 0) finish();
        });
        if ((pendingSets.peek() || 0) <= 0) finish();
    });
}

/**
 * Force a server reconciliation for every synced collection.
 *
 * The normal fetch actions activate their observables and keep the local state
 * current. A manual refresh also resets each collection's last-sync marker so
 * Legend-State performs a fresh read instead of treating the local cache as
 * already current.
 *
 * Before resetting the marker we drain each collection's pending upload queue.
 * Otherwise the full-list read (changesSince: 'all', hard deletes) would
 * reconcile away local-only rows whose create/update hasn't reached the server
 * yet — the "new task deleted on refresh" bug.
 */
export async function refreshAllData(): Promise<void> {
    await Promise.all([
        useNoteStore.getState().fetchNotes(),
        useTaskStore.getState().fetchTasks(),
        useProjectStore.getState().fetchProjects(),
    ]);

    // Let any optimistic local creates/updates finish uploading before we force
    // a full-list reconcile, so the authoritative read can't drop them.
    await Promise.all(allSynced.map((observable) => waitForPendingSetsToDrain(observable)));

    await Promise.all(
        allSynced.map(async (observable) => {
            // If writes are STILL unconfirmed after the bounded wait (offline, or
            // a write the server keeps rejecting), skip the replacing read for
            // this collection. Forcing it would silently drop those local rows
            // (upstream Legend-State #666). It retries on the next refresh.
            if (pendingSetCount(observable) > 0) return;
            await (syncState(observable) as unknown as SyncController).sync({ resetLastSync: true });
        })
    );
}

function pendingSetCount(observable: unknown): number {
    const state = syncState(observable as any) as any;
    return state?.numPendingSets?.peek?.() || 0;
}

const RESUME_MIN_INTERVAL_MS = 15000;
let lastResumeRefreshAt = 0;
let resumeRefreshInFlight: Promise<void> | null = null;

/**
 * Pull the latest server state when the app returns to the foreground.
 *
 * Realtime is off, and the stores' fetch actions only activate an observable
 * (a no-op once active), so without this a device never sees changes made on
 * another device until a manual refresh. Throttled and de-duplicated so rapid
 * tab/app switching doesn't hammer the backend; failures are swallowed since
 * the next resume simply tries again.
 */
export function refreshOnResume(minIntervalMs: number = RESUME_MIN_INTERVAL_MS): Promise<void> {
    if (resumeRefreshInFlight) return resumeRefreshInFlight;
    const now = Date.now();
    if (now - lastResumeRefreshAt < minIntervalMs) return Promise.resolve();
    lastResumeRefreshAt = now;
    resumeRefreshInFlight = refreshAllData()
        .catch(() => undefined)
        .finally(() => {
            resumeRefreshInFlight = null;
        });
    return resumeRefreshInFlight;
}
