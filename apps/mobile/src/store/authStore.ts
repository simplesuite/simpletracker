import { create } from 'zustand';

/**
 * Minimal mobile auth store. Holds the current session's user id, which the core
 * reads via the configureCore getCurrentUserId seam. The web app uses its
 * globalStore for this; mobile keeps a tiny dedicated store (no MUI/theme).
 */
interface AuthState {
    userId: string;
    isAuthenticated: boolean;
    setSession: (userId: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    userId: '',
    isAuthenticated: false,
    setSession: (userId) =>
        set({ userId: userId ?? '', isAuthenticated: !!userId }),
}));
