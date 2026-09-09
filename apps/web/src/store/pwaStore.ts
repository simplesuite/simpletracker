import { create } from 'zustand';

interface PwaState {
    needRefresh: boolean;
    setNeedRefresh: (val: boolean) => void;
    updateSW: ((reloadPage?: boolean) => Promise<void>) | null;
    setUpdateSW: (fn: (reloadPage?: boolean) => Promise<void>) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
    needRefresh: false,
    setNeedRefresh: (val) => set({ needRefresh: val }),
    updateSW: null,
    setUpdateSW: (fn) => set({ updateSW: fn }),
}));
