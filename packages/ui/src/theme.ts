export interface UiThemeTokens {
    background: string;
    surface: string;
    surfaceVariant: string;
    primary: string;
    primaryContainer: string;
    onPrimary: string;
    onSurface: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    error: string;
    errorContainer: string;
    onErrorContainer: string;
}

export const lightTokens: UiThemeTokens = {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceVariant: '#f1f5f9',
    primary: '#4f46e5',
    primaryContainer: '#e0e7ff',
    onPrimary: '#ffffff',
    onSurface: '#0f172a',
    onSurfaceVariant: '#64748b',
    outline: '#cbd5e1',
    outlineVariant: '#e2e8f0',
    error: '#dc2626',
    errorContainer: '#fee2e2',
    onErrorContainer: '#7f1d1d',
};

export const darkTokens: UiThemeTokens = {
    background: '#020617',
    surface: '#0f172a',
    surfaceVariant: '#1e293b',
    primary: '#a5b4fc',
    primaryContainer: '#312e81',
    onPrimary: '#0f172a',
    onSurface: '#f8fafc',
    onSurfaceVariant: '#94a3b8',
    outline: '#475569',
    outlineVariant: '#334155',
    error: '#fca5a5',
    errorContainer: '#7f1d1d',
    onErrorContainer: '#fee2e2',
};

export function getUiTheme(theme: 'light' | 'dark'): UiThemeTokens {
    return theme === 'dark' ? darkTokens : lightTokens;
}
