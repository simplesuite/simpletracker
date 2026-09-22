import * as React from 'react';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import {
  themes,
  useGlobalStore
} from "./store/globalStore";
import AppToolbar from './components/subcomponents/AppToolbar'
import Toolbar from '@mui/material/Toolbar';
import { Navigate, Outlet } from "react-router-dom";
import Snackbar from '@mui/material/Snackbar';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import useMediaQuery from '@mui/material/useMediaQuery';
import Button from '@mui/material/Button';
import { useLocation } from "react-router-dom";
import FloatingTabBar from './components/subcomponents/FloatingTabBar';
import CircularProgress from "@mui/material/CircularProgress";
import Backdrop from "@mui/material/Backdrop";
import AreYouSure from "./components/subcomponents/AreYouSure";
import UpdatePrompt from "./components/subcomponents/UpdatePrompt";
import NotificationPrompt from "./components/subcomponents/NotificationPrompt";
import { usePwaStore } from "./store/pwaStore";
import { hasSupabaseSession, supabase } from "./lib/supabase";
import { setSyncEnabled, useNoteStore, useTaskStore, useProjectStore } from "@simpletracker/core";
import { checkAndNotify } from "./lib/notifications";

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  props,
  ref,
) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function App() {
  let location = useLocation();
  const currentTheme = useGlobalStore(s => s.themeAtom);
  const snackText = useGlobalStore(s => s.snackBarText);
  const snackSev = useGlobalStore(s => s.snackBarSeverity);
  const snackOpen = useGlobalStore(s => s.snackBarOpen);
  const setSnackOpen = useGlobalStore(s => s.setSnackBarOpen);
  const snackAction = useGlobalStore(s => s.snackBarAction);
  const setSnackAction = useGlobalStore(s => s.setSnackBarAction);
  const [actTheme, setTheme] = React.useState(themes.darkTheme);
  const needRefresh = usePwaStore(s => s.needRefresh);
  const setNeedRefresh = usePwaStore(s => s.setNeedRefresh);
  const pwaUpdateSW = usePwaStore(s => s.updateSW);
  const loadingOpen = useGlobalStore(s => s.mainLoading);
  const setLoadingOpen = useGlobalStore(s => s.setMainLoading);
  const [authChecked, setAuthChecked] = React.useState(() => hasSupabaseSession());
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => hasSupabaseSession());
  const isLargeScreen = useMediaQuery(actTheme.breakpoints.up('md'));

  // Listen for auth state changes to handle login/logout properly
  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setAuthChecked(true);
      // Gate Legend-State syncing on auth: activates synced observables on login,
      // stops them on logout.
      setSyncEnabled(!!session);
      if (session?.user) {
        const store = useGlobalStore.getState();
        if (!store.currentUser.recordID) {
          store.setCurrentUser({
            recordID: session.user.id,
            fullName: store.currentUser.fullName,
            userType: store.currentUser.userType,
          });
        }
      }
    });
    // Also check current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setAuthChecked(true);
      setSyncEnabled(!!session);
      if (session?.user) {
        const store = useGlobalStore.getState();
        if (!store.currentUser.recordID) {
          store.setCurrentUser({
            recordID: session.user.id,
            fullName: store.currentUser.fullName,
            userType: store.currentUser.userType,
          });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Eagerly fetch all data once authenticated so every tab is populated immediately
  React.useEffect(() => {
    if (!isAuthenticated) return;

    useNoteStore.getState().fetchNotes();
    useNoteStore.getState().fetchArchivedNotes();
    useTaskStore.getState().fetchTasks();
    useProjectStore.getState().fetchProjects();
  }, [isAuthenticated]);

  // Activate Legend-State synced observables on startup. Legend rehydrates each
  // collection from local persistence automatically (instant render) and syncs
  // with Supabase in the background — no manual cache load or sync engine needed.
  React.useEffect(() => {
    useNoteStore.getState().fetchNotes();
    useTaskStore.getState().fetchTasks();
    useProjectStore.getState().fetchProjects();
  }, []);

  // Check for due/overdue tasks and send a grouped notification (once per day).
  // Reads tasks from the (Legend-backed) task store rather than a separate cache.
  React.useEffect(() => {
    const runCheck = () => {
      try {
        const tasks = useTaskStore.getState().tasks;
        if (tasks.length > 0) checkAndNotify(tasks);
      } catch (err) {
        console.warn('Notification check failed:', err);
      }
    };

    runCheck();

    // Also check when the app regains visibility (covers next-day scenario)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') runCheck();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  React.useEffect(() => {
    if (currentTheme === 'dark') {
      setTheme(themes.darkTheme);
    } else if (currentTheme === 'light') {
      setTheme(themes.lightTheme);
    }
  }, [currentTheme]);

  // Wait for auth check to complete before rendering
  if (!authChecked && !isAuthenticated) {
    return null;
  }

  if (!isAuthenticated && authChecked) { return <Navigate to="/login" /> }

  if (location.pathname === '/') { return <Navigate to="/notes" /> }

  // On large screens, detail pages render as a side pane next to the list, so
  // the app chrome (toolbar + bottom nav) should stay visible. On small screens
  // detail pages are full-screen, so we hide the chrome as before.
  const isDetailRoute = /^\/(notes|tasks|projects)\/.+/.test(location.pathname);
  const isDetailPage = isDetailRoute && !isLargeScreen;

  const snackClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') { return }
    setSnackOpen(false);
    setSnackAction(null);
  };

  return (
    <>
      <ThemeProvider theme={actTheme}>
        <CssBaseline />
        <Box sx={{
          display: 'flex',
          minHeight: window.innerHeight,
          bgcolor: 'background.default',
        }}>
          <Box sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>{!isDetailPage && <AppToolbar />}</Box>
          <Box component="main"
            sx={{ width: '100%', p: 2, mb: isDetailPage ? 0 : 11, height: '100%', paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
            {!isDetailPage && <Toolbar />}<Outlet />
          </Box>
          {!isDetailPage && <FloatingTabBar />}
        </Box>
        <Snackbar open={snackOpen} autoHideDuration={snackAction ? 5000 : 2000} onClose={snackClose} sx={{ mb: 11 }}>
          {/*@ts-ignore*/}
          <Alert onClose={snackClose} severity={snackSev} sx={{ width: '100%' }} action={snackAction && (
            <Button color="inherit" size="small" onClick={() => { snackAction(); snackClose(); }}>
              Undo
            </Button>
          )}>
            {snackText}
          </Alert>
        </Snackbar>
        <Backdrop
          sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 200 }}
          open={loadingOpen}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
        <AreYouSure />
        <NotificationPrompt />
        <UpdatePrompt
          open={needRefresh}
          onUpdate={() => { if (pwaUpdateSW) pwaUpdateSW(true); }}
          onDismiss={() => setNeedRefresh(false)}
        />
      </ThemeProvider>
    </>
  );
}
