export interface UiThemeTokens {
    background: string;
    surface: string;
    surfaceVariant: string;
    primary: string;
    secondary: string;
    primaryContainer: string;
    onPrimaryContainer: string;
    secondaryContainer: string;
    onSecondaryContainer: string;
    onPrimary: string;
    onSecondary: string;
    onSurface: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    error: string;
    errorContainer: string;
    onErrorContainer: string;
    scrim: string;
}

export const lightTokens: UiThemeTokens = {
    background: '#f8fafc',
    surface: '#ffffff',
    surfaceVariant: '#f1f5f9',
    primary: '#d79a00',
    secondary: '#5897d6',
    primaryContainer: '#ffedb3',
    onPrimaryContainer: '#5c4300',
    secondaryContainer: '#dbeafe',
    onSecondaryContainer: '#1e3a5f',
    onPrimary: '#0f172a',
    onSecondary: '#0f172a',
    onSurface: '#0f172a',
    onSurfaceVariant: '#64748b',
    outline: '#cbd5e1',
    outlineVariant: '#e2e8f0',
    error: '#dc2626',
    errorContainer: '#fee2e2',
    onErrorContainer: '#7f1d1d',
    scrim: '#00000080',
};

export const darkTokens: UiThemeTokens = {
    background: '#161719',
    surface: '#202023',
    surfaceVariant: '#313335',
    primary: '#d79a00',
    secondary: '#5897d6',
    primaryContainer: '#6b4d00',
    onPrimaryContainer: '#ffedb3',
    secondaryContainer: '#21466e',
    onSecondaryContainer: '#dbeafe',
    onPrimary: '#191c21',
    onSecondary: '#191c21',
    onSurface: '#f8fafc',
    onSurfaceVariant: '#94a3b8',
    outline: '#475569',
    outlineVariant: '#334155',
    error: '#fca5a5',
    errorContainer: '#7f1d1d',
    onErrorContainer: '#fee2e2',
    scrim: '#00000080',
};

export function getUiTheme(theme: 'light' | 'dark'): UiThemeTokens {
    return theme === 'dark' ? darkTokens : lightTokens;
}
