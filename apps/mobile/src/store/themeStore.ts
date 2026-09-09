import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';

type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
    themeMode: ThemeMode;
    effectiveTheme: 'dark' | 'light';
    setThemeMode: (themeMode: ThemeMode) => void;
}

const getSystemTheme = (): 'dark' | 'light' =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';

let preferenceWasSelected = false;

export const useThemeStore = create<ThemeState>((set) => ({
    themeMode: 'system',
    effectiveTheme: getSystemTheme(),
    setThemeMode: (themeMode) => {
        preferenceWasSelected = true;
        const effectiveTheme = themeMode === 'system'
            ? getSystemTheme()
            : themeMode;
        set({ themeMode, effectiveTheme });
        void AsyncStorage.setItem('themeMode', themeMode).catch(() => {
            // Theme preference persistence is best-effort while offline or during startup.
        });
    },
}));

Appearance.addChangeListener(({ colorScheme }) => {
    if (useThemeStore.getState().themeMode === 'system') {
        useThemeStore.setState({ effectiveTheme: colorScheme === 'dark' ? 'dark' : 'light' });
    }
});

// Restore the user's preference without delaying app startup.
void AsyncStorage.getItem('themeMode').then((saved) => {
    if (!preferenceWasSelected && (saved === 'dark' || saved === 'light' || saved === 'system')) {
        useThemeStore.getState().setThemeMode(saved);
    }
}).catch(() => {
    // Use the system theme when no persisted preference is available.
});
