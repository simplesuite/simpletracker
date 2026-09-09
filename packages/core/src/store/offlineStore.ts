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
}

const initialOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

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
}));

// ─── Browser connectivity → isOnline ────────────────────────────────────────
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => useOfflineStore.getState().setIsOnline(true));
    window.addEventListener('offline', () => useOfflineStore.getState().setIsOnline(false));
}

// ─── Legend-State sync status → isSyncing / pendingCount ─────────────────────
// Poll the aggregate sync state of all synced observables. Legend exposes a
// per-observable syncState with isGetting/isSetting (in-flight) and a count of
// pending local changes. We roll these up into the store's fields for the UI.
if (typeof window !== 'undefined') {
    const poll = () => {
        try {
            const states = getAllSyncStates();
            let syncing = false;
            let pending = 0;
            for (const [state$] of states) {
                const s: any = state$.get();
                if (s?.isGetting || s?.isSetting) syncing = true;
                // numPendingSets = local changes waiting to upload (the "queue").
                if (typeof s?.numPendingSets === 'number') pending += s.numPendingSets;
            }
            const store = useOfflineStore.getState();
            if (store.isSyncing !== syncing) store.setIsSyncing(syncing);
            if (store.pendingCount !== pending) store.setPendingCount(pending);
        } catch {
            // getAllSyncStates may be empty/unavailable before any observable
            // is activated — ignore and try again next tick.
        }
    };
    setInterval(poll, 1000);
}
