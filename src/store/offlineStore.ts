import { create } from 'zustand';

interface OfflineState {
    isOnline: boolean;
    setIsOnline: (val: boolean) => void;
    pendingCount: number;
    setPendingCount: (val: number) => void;
    isSyncing: boolean;
    setIsSyncing: (val: boolean) => void;
    /** Timestamp of last successful network verification */
    lastVerifiedAt: number;
    setLastVerifiedAt: (val: number) => void;
    /** Last sync error message for debugging */
    lastSyncError: string | null;
    setLastSyncError: (val: string | null) => void;
}

export const useOfflineStore = create<OfflineState>((set) => ({
    isOnline: navigator.onLine,
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
