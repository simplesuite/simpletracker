import { create } from 'zustand';
import { useEffect } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
    themeMode: ThemeMode;
    effectiveTheme: 'dark' | 'light';
    setThemeMode: (themeMode: ThemeMode) => void;
}

// System theme detection helper
let cachedSystemTheme: 'dark' | 'light' | null = null;

const getSystemTheme = (): 'dark' | 'light' => {
    if (cachedSystemTheme !== null) {
        return cachedSystemTheme;
    }
    
    try {
        const systemScheme = useSystemColorScheme();
        cachedSystemTheme = systemScheme === 'dark' ? 'dark' : 'light';
        return cachedSystemTheme;
    } catch {
        // Fallback - try window matchMedia (for web/development)
        if (typeof window !== 'undefined' && window.matchMedia) {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                cachedSystemTheme = 'dark';
                return 'dark';
            }
        }
        cachedSystemTheme = 'light';
        return 'light';
    }
};

// Create the store
const createThemeStore = () =>
    create<ThemeState>((set, get) => ({
        themeMode: 'system',
        effectiveTheme: getSystemTheme(),
        setThemeMode: (themeMode) => {
            const effectiveTheme = themeMode === 'system'
                ? getSystemTheme()
                : themeMode;
            set({ themeMode, effectiveTheme });
            // Persist to localStorage
            try {
                localStorage.setItem('themeMode', themeMode);
            } catch { /* ignore */ }
        },
    }));

export const useThemeStore = createThemeStore();

// Load persisted theme on init and set up system theme listener
try {
    const saved = localStorage.getItem('themeMode');
    if (saved && ['dark', 'light', 'system'].includes(saved)) {
        const themeMode = saved as ThemeMode;
        useThemeStore.getState().setThemeMode(themeMode);
    }
} catch { /* ignore */ }
