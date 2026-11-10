import { create } from 'zustand';
import { getAllSyncStates } from '@legendapp/state/sync';

/**
 * Online/sync status store.
 *
 * Legend-State now owns the actual offline queue + upload/retry, so this store
 * no longer drives sync — it only reflects status for the UI. The field names
 * are preserved so existing consumers (AppToolbar, OfflineAlert/OfflineBanner,
 * NoteDetailPage, TaskDetailPage, the stores' shared-item connectivity guard)
 * keep working unchanged:
 *   - isOnline:     browser connectivity (navigator.onLine + online/offline events)
 *   - isSyncing:    true while any synced observable is uploading/downloading
 *   - pendingCount: number of synced observables with pending local changes
 *   - lastSyncError / lastVerifiedAt: retained for API compat (best-effort)
 */
interface OfflineState {
    isOnline: boolean;
    setIsOnline: (val: boolean) => void;
    pendingCount: number;
    setPendingCount: (val: number) => void;
    isSyncing: boolean;
    setIsSyncing: (val: boolean) => void;
    lastVerifiedAt: number;
    setLastVerifiedAt: (val: number) => void;
    lastSyncError: string | null;
    setLastSyncError: (val: string | null) => void;
    /**
     * Writes the server permanently rejected (constraint / RLS / bad input).
     * Retrying cannot fix these, so sync stops retrying them; they stay here
     * (sticky, unlike the engine's error which clears on the next success)
     * until the user dismisses them.
     */
    rejectedWrites: RejectedWrite[];
    addRejectedWrite: (write: RejectedWrite) => void;
    clearRejectedWrites: () => void;
}

export interface RejectedWrite {
    collection: string;
    recordID: string | null;
    action: string;
    message: string;
}

// On React Native `navigator` exists but `navigator.onLine` is undefined, so
// only trust it when it's an actual boolean; otherwise assume online.
const initialOnline =
    typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
        ? navigator.onLine
        : true;

export const useOfflineStore = create<OfflineState>((set) => ({
    isOnline: initialOnline,
    setIsOnline: (val) => set({ isOnline: val }),
    pendingCount: 0,
    setPendingCount: (val) => set({ pendingCount: val }),
    isSyncing: false,
    setIsSyncing: (val) => set({ isSyncing: val }),
    lastVerifiedAt: 0,
    setLastVerifiedAt: (val) => set({ lastVerifiedAt: val }),
    lastSyncError: null,
    setLastSyncError: (val) => set({ lastSyncError: val }),
    rejectedWrites: [],
    addRejectedWrite: (write) =>
        set((state) => {
            const duplicate = state.rejectedWrites.some(
                (w) => w.collection === write.collection && w.recordID === write.recordID && w.message === write.message
            );
            return duplicate ? state : { rejectedWrites: [...state.rejectedWrites, write] };
        }),
    clearRejectedWrites: () => set({ rejectedWrites: [], lastSyncError: null }),
}));

/** Human-readable line for the sticky rejected-writes list, or null if empty. */
export function describeRejectedWrites(writes: RejectedWrite[]): string | null {
    if (writes.length === 0) return null;
    const noun = writes.length === 1 ? 'change was' : 'changes were';
    return `${writes.length} ${noun} rejected by the server and not saved: ${writes[0].message}`;
}

// ─── Browser connectivity → isOnline ────────────────────────────────────────
// NOTE: feature-detect addEventListener rather than `typeof window`. React
// Native defines a `window` global, but it is NOT a DOM object and has no
// addEventListener — so a bare `typeof window !== 'undefined'` guard passes on
// RN and then `window.addEventListener(...)` throws "undefined is not a
// function" at module load (crashing the app on Hermes before the runtime is
// ready). Guarding on the method's existence keeps this web-only.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', () => useOfflineStore.getState().setIsOnline(true));
    window.addEventListener('offline', () => useOfflineStore.getState().setIsOnline(false));
}

/**
 * Roll up per-collection Legend sync states into the UI-facing summary.
 * Pure so it can be unit tested without a live sync engine.
 */
export function summarizeSyncStates(states: unknown[]): { syncing: boolean; pending: number; error: string | null } {
    let syncing = false;
    let pending = 0;
    let error: string | null = null;
    for (const raw of states) {
        const s: any = raw;
        if (s?.isGetting || s?.isSetting) syncing = true;
        // numPendingSets = local changes waiting to upload (the "queue").
        if (typeof s?.numPendingSets === 'number') pending += s.numPendingSets;
        if (!error && s?.error) error = s.error instanceof Error ? s.error.message : String(s.error);
    }
    return { syncing, pending, error };
}

// ─── Legend-State sync status → isSyncing / pendingCount / lastSyncError ─────
// Poll the aggregate sync state of all synced observables. Legend exposes a
// per-observable syncState with isGetting/isSetting (in-flight) and a count of
// pending local changes. We roll these up into the store's fields for the UI.
// Only needs setInterval (present on both web and React Native), so this runs
// on all platforms — previously it was web-gated and never ran on mobile.
if (typeof setInterval === 'function') {
    const poll = () => {
        try {
            const summary = summarizeSyncStates(
                Array.from(getAllSyncStates() as Iterable<[{ get: () => unknown }, ...unknown[]]>).map(([state$]) => state$.get())
            );
            const store = useOfflineStore.getState();
            if (store.isSyncing !== summary.syncing) store.setIsSyncing(summary.syncing);
            if (store.pendingCount !== summary.pending) store.setPendingCount(summary.pending);
            // Surface real sync failures (previously never populated, which left
            // the OfflineBanner error branch dead). Cleared once errors resolve.
            const error = describeRejectedWrites(store.rejectedWrites) ?? summary.error;
            if (store.lastSyncError !== error) store.setLastSyncError(error);
        } catch {
            // getAllSyncStates may be empty/unavailable before any observable
            // is activated — ignore and try again next tick.
        }
    };
    setInterval(poll, 1000);
}
