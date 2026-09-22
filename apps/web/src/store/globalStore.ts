import { create } from "zustand";
import { createTheme, type Theme } from "@mui/material/styles";
import { darkTokens, lightTokens, type UiThemeTokens } from "@simpletracker/ui/theme";
import { getSupabaseStorageKey } from "../lib/supabase";

// Brand colors are shared with the mobile app via the @simpletracker/ui tokens.
export const primaryMain = lightTokens.primary;
export const secondaryMain = lightTokens.secondary;

/**
 * Build an MUI theme from the shared mobile design tokens so the web app
 * matches the mobile look. Mapping the semantic token roles into the MUI
 * palette propagates the colors across every component that reads standard
 * theme roles (text.primary, text.secondary, divider, background.paper, etc.)
 * without touching individual component files.
 */
const createTokenTheme = (mode: 'light' | 'dark', tokens: UiThemeTokens): Theme =>
    createTheme({
        palette: {
            mode,
            primary: { main: tokens.primary },
            secondary: { main: tokens.secondary },
            error: { main: tokens.error },
            background: {
                default: tokens.background,
                paper: tokens.surface,
            },
            text: {
                primary: tokens.onSurface,
                secondary: tokens.onSurfaceVariant,
            },
            divider: tokens.outlineVariant,
        },
        shape: {
            // Mobile uses large, soft corners (rounded-2xl ≈ 16px on inputs/buttons).
            borderRadius: 16,
        },
        components: {
            MuiAutocomplete: {
                styleOverrides: { popper: { zIndex: 1500 } },
            },
            // Flat, bordered cards to match the mobile Surface/Card look
            // (rounded-3xl border border-outline-variant bg-surface, no shadow).
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundImage: 'none',
                    },
                },
            },
            MuiCard: {
                styleOverrides: {
                    root: {
                        borderRadius: 20,
                        border: `1px solid ${tokens.outlineVariant}`,
                        boxShadow: 'none',
                    },
                },
            },
            MuiButton: {
                styleOverrides: {
                    root: {
                        borderRadius: 16,
                        textTransform: 'none',
                        fontWeight: 700,
                    },
                },
            },
            MuiChip: {
                styleOverrides: {
                    root: {
                        borderRadius: 999,
                    },
                },
            },
            MuiSwitch: {
                styleOverrides: {
                    root: {
                        width: 42,
                        height: 24,
                        padding: 0,
                    },
                    switchBase: {
                        padding: 2,
                        '&.Mui-checked': {
                            transform: 'translateX(18px)',
                            color: '#fff',
                            '& + .MuiSwitch-track': {
                                opacity: 1,
                                backgroundColor: tokens.primary,
                            },
                        },
                    },
                    thumb: {
                        width: 20,
                        height: 20,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    },
                    track: {
                        borderRadius: 12,
                        opacity: 1,
                        backgroundColor: 'rgba(150,150,150,0.3)',
                        transition: 'background-color 0.2s ease',
                    },
                },
            },
        },
    });

export const themes = {
    darkTheme: createTokenTheme('dark', darkTokens),
    lightTheme: createTokenTheme('light', lightTokens),
};

if (localStorage.getItem("userTheme") === null) {
    localStorage.setItem("userTheme", "dark");
}

let user: any;
let auth: string;
try {
    const storageKey = getSupabaseStorageKey();
    const raw = localStorage.getItem(storageKey);
    if (raw) {
        const parsed = JSON.parse(raw);
        user = parsed?.user ?? null;
        // In newer supabase-js, user may be stored separately at <key>-user
        if (!user) {
            const userRaw = localStorage.getItem(storageKey + '-user');
            if (userRaw) {
                const userParsed = JSON.parse(userRaw);
                user = userParsed?.user ?? null;
            }
        }
    }
} catch {
    user = null;
}

if (user && user.aud === 'authenticated') {
    auth = 'true';
} else {
    user = { id: '' };
    auth = 'false';
}

interface GlobalState {
    themeAtom: string | null;
    setThemeAtom: (val: string | null) => void;
    snackBarText: string;
    setSnackBarText: (val: string) => void;
    snackBarSeverity: string;
    setSnackBarSeverity: (val: string) => void;
    snackBarOpen: boolean;
    setSnackBarOpen: (val: boolean) => void;
    snackBarAction: (() => void) | null;
    setSnackBarAction: (val: (() => void) | null) => void;
    authAtom: string;
    setAuthAtom: (val: string) => void;
    currentUser: { recordID: string; fullName: string | null; userType: string };
    setCurrentUser: (val: { recordID: string; fullName: string | null; userType: string }) => void;
    mainLoading: boolean;
    setMainLoading: (val: boolean) => void;
    areYouSureTitle: string;
    setAreYouSureTitle: (val: string) => void;
    areYouSureDetails: string;
    setAreYouSureDetails: (val: string) => void;
    areYouSureAccept: boolean;
    setAreYouSureAccept: (val: boolean) => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
    themeAtom: localStorage.getItem("userTheme"),
    setThemeAtom: (val) => set({ themeAtom: val }),
    snackBarText: 'message',
    setSnackBarText: (val) => set({ snackBarText: val }),
    snackBarSeverity: 'success',
    setSnackBarSeverity: (val) => set({ snackBarSeverity: val }),
    snackBarOpen: false,
    setSnackBarOpen: (val) => set({ snackBarOpen: val }),
    snackBarAction: null,
    setSnackBarAction: (val) => set({ snackBarAction: val }),
    authAtom: auth,
    setAuthAtom: (val) => set({ authAtom: val }),
    currentUser: {
        recordID: user.id || '',
        fullName: localStorage.getItem('fullName'),
        userType: 'free',
    },
    setCurrentUser: (val) => set({ currentUser: val }),
    mainLoading: false,
    setMainLoading: (val) => set({ mainLoading: val }),
    areYouSureTitle: 'Title',
    setAreYouSureTitle: (val) => set({ areYouSureTitle: val }),
    areYouSureDetails: 'Details',
    setAreYouSureDetails: (val) => set({ areYouSureDetails: val }),
    areYouSureAccept: false,
    setAreYouSureAccept: (val) => set({ areYouSureAccept: val }),
}));

export const appName = 'simpleTracker';

export const dialogPaperStyles = {
    style: {
        bgColor: 'background.paper',
        borderRadius: 24,
        borderColor: darkTokens.outlineVariant,
        borderStyle: 'solid',
        borderWidth: 1.4,
        borderLeftWidth: 5,
        borderRightWidth: 5,
    },
};
