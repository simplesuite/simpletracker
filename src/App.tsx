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
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Paper from '@mui/material/Paper';
import SettingsIcon from '@mui/icons-material/Settings';
import NotesIcon from '@mui/icons-material/Notes';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import FolderIcon from '@mui/icons-material/Folder';
import { redirect, useLocation } from "react-router-dom";
import {
  Link as RouterLink,
} from 'react-router-dom';
import CircularProgress from "@mui/material/CircularProgress";
import Backdrop from "@mui/material/Backdrop";
import AreYouSure from "./components/subcomponents/AreYouSure";
import UpdatePrompt from "./components/subcomponents/UpdatePrompt";
import NotificationPrompt from "./components/subcomponents/NotificationPrompt";
import { usePwaStore } from "./store/pwaStore";
import { hasSupabaseSession, supabase } from "./lib/supabase";
import { initOfflineSync } from "./lib/offlineSync";
import { getCachedNotes, getCachedTasks, getCachedProjects, clearLegacyCache } from "./lib/cache";
import { checkAndNotify } from "./lib/notifications";
import { useNoteStore } from "./store/noteStore";
import { useTaskStore } from "./store/taskStore";
import { useProjectStore } from "./store/projectStore";

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
  const [actTheme, setTheme] = React.useState(themes.darkTheme);
  const [tabValue, setTabValue] = React.useState(location.pathname);
  const needRefresh = usePwaStore(s => s.needRefresh);
  const setNeedRefresh = usePwaStore(s => s.setNeedRefresh);
  const pwaUpdateSW = usePwaStore(s => s.updateSW);
  const loadingOpen = useGlobalStore(s => s.mainLoading);
  const setLoadingOpen = useGlobalStore(s => s.setMainLoading);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => hasSupabaseSession());

  // Listen for auth state changes to handle login/logout properly
  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      setAuthChecked(true);
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

  // Initialize offline sync listeners and load cached data on startup
  React.useEffect(() => {
    // Clear legacy budget cache keys
    clearLegacyCache();

    // Load cached notes/tasks/projects from localStorage for instant render
    const cachedNotes = getCachedNotes();
    if (cachedNotes.length > 0) {
      const nonArchived = cachedNotes
        .filter((n) => !n.archived)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      useNoteStore.setState({ notes: nonArchived });
    }

    const cachedTasks = getCachedTasks();
    if (cachedTasks.length > 0) {
      useTaskStore.setState({ tasks: cachedTasks });
    }

    const cachedProjects = getCachedProjects();
    if (cachedProjects.length > 0) {
      useProjectStore.setState({ projects: cachedProjects });
    }

    // Initialize the generalized offline sync engine
    const cleanup = initOfflineSync();
    return cleanup;
  }, []);

  // Check for due/overdue tasks and send a grouped notification (once per day)
  React.useEffect(() => {
    try {
      const cachedTasks = getCachedTasks();
      if (cachedTasks.length > 0) {
        checkAndNotify(cachedTasks);
      }
    } catch (err) {
      console.warn('Notification check failed on mount:', err);
    }

    // Also check when the app regains visibility (covers next-day scenario)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        try {
          const tasks = getCachedTasks();
          if (tasks.length > 0) checkAndNotify(tasks);
        } catch (err) {
          console.warn('Notification check failed on visibility change:', err);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Update tab value when location changes (browser navigation or deep link)
  React.useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/notes')) {
      setTabValue('/notes');
    } else if (path.startsWith('/tasks')) {
      setTabValue('/tasks');
    } else if (path.startsWith('/projects')) {
      setTabValue('/projects');
    } else if (path.startsWith('/settings')) {
      setTabValue('/settings');
    }
  }, [location.pathname]);

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

  const snackClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') { return }
    setSnackOpen(false);
  };

  return (
    <>
      <ThemeProvider theme={actTheme}>
        <CssBaseline />
        <Box sx={{
          display: 'flex',
          minHeight: window.innerHeight,
          backgroundImage: (currentTheme === 'dark' ? 'linear-gradient(to bottom right, #161616, #252525)' : 'linear-gradient(to bottom right,#eee,#fff)'),
          bgcolor: (currentTheme === 'dark' ? '#171717' : 'grey.100')
        }}>
          <Box sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}><AppToolbar /></Box>
          <Box component="main"
            sx={{ width: '100%', p: 2, mb: 8, height: '100%', paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
            <Toolbar /><Outlet />
          </Box>
          <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)', zIndex: (theme) => theme.zIndex.appBar }} elevation={3}>
            <BottomNavigation
              showLabels
              value={tabValue}
              onChange={(event, newValue: string) => {
                setTabValue(newValue);
                redirect("/" + newValue);
              }}>
              <BottomNavigationAction label="Notes" value='/notes' component={RouterLink} to="notes" icon={<NotesIcon />} />
              <BottomNavigationAction label="Tasks" value='/tasks' component={RouterLink} to="tasks" icon={<TaskAltIcon />} />
              <BottomNavigationAction label="Projects" value='/projects' component={RouterLink} to="projects" icon={<FolderIcon />} />
              <BottomNavigationAction label="Settings" value='/settings' component={RouterLink} to="settings" icon={<SettingsIcon />} />
            </BottomNavigation>
          </Paper>
        </Box>
        <Snackbar open={snackOpen} autoHideDuration={2000} onClose={snackClose} sx={{ mb: 8 }}>
          {/*@ts-ignore*/}
          <Alert onClose={snackClose} severity={snackSev} sx={{ width: '100%' }}>
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
