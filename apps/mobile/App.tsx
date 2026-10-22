import './global.css';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createNavigationContainerRef, getFocusedRouteNameFromRoute, NavigationContainer, DefaultTheme as NavigationLightTheme, DarkTheme as NavigationDarkTheme, type RouteProp } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorScheme } from 'nativewind';
import { setSyncEnabled, useNoteStore, useTaskStore, useProjectStore } from '@simpletracker/core';
import { getUiTheme } from '@simpletracker/ui';
import { supabase } from './src/lib/supabase';
import { useAuthStore } from './src/store/authStore';
import { useThemeStore } from './src/store/themeStore';
import { NotesStack } from './src/navigation/NotesStack';
import { TasksStack } from './src/navigation/TasksStack';
import { ProjectsStack } from './src/navigation/ProjectsStack';
import { SettingsStack } from './src/navigation/SettingsStack';
import { AuthStack } from './src/navigation/AuthStack';
import type { RootTabParamList } from './src/navigation/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FloatingTabBar } from './src/components/ui/FloatingTabBar';
import { cancelLocalTaskNotifications, subscribeToTaskNotificationResponses, syncLocalTaskNotifications } from './src/lib/notifications';

const Tab = createBottomTabNavigator<RootTabParamList>();
const navigationRef = createNavigationContainerRef<RootTabParamList>();

// Nested stack routes on which the floating tab bar should hide, matching the
// web app where the bar disappears on the task/note/project detail pages.
const DETAIL_ROUTES = new Set(['TaskDetail', 'NoteDetail', 'ProjectDetail']);

// Hide the tab bar when a tab's nested stack is focused on a detail screen.
// FloatingTabBar returns null when it sees tabBarStyle display:'none'.
function tabScreenOptions({ route }: { route: RouteProp<RootTabParamList> }) {
    const focused = getFocusedRouteNameFromRoute(route);
    return focused && DETAIL_ROUTES.has(focused)
        ? { tabBarStyle: { display: 'none' as const } }
        : {};
}

export default function App() {
    const { effectiveTheme } = useThemeStore();
    const { setColorScheme } = useColorScheme();
    const theme = getUiTheme(effectiveTheme);

    useEffect(() => {
        setColorScheme(effectiveTheme);
    }, [effectiveTheme, setColorScheme]);

    const navigationTheme = {
        ...(effectiveTheme === 'dark' ? NavigationDarkTheme : NavigationLightTheme),
        dark: effectiveTheme === 'dark',
        colors: {
            primary: theme.primary,
            background: theme.background,
            card: theme.surface,
            text: theme.onSurface,
            border: theme.outline,
            notification: theme.error,
        },
    };

    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const tasks = useTaskStore((s) => s.tasks);
    const setSession = useAuthStore((s) => s.setSession);
    const [ready, setReady] = useState(false);
    const [navigationReady, setNavigationReady] = useState(false);
    const [pendingTaskID, setPendingTaskID] = useState<string | null>(null);

    const queueTaskNotification = useCallback((taskID: string) => {
        setPendingTaskID(taskID);
    }, []);

    const openPendingTask = useCallback(() => {
        if (!pendingTaskID || !isAuthenticated || !navigationReady || !tasks.some((task) => task.recordID === pendingTaskID)) return;
        navigationRef.navigate('Tasks', { screen: 'TaskDetail', params: { id: pendingTaskID } });
        setPendingTaskID(null);
    }, [isAuthenticated, navigationReady, pendingTaskID, tasks]);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: () => void = () => undefined;
        subscribeToTaskNotificationResponses(queueTaskNotification).then((remove) => {
            if (cancelled) remove();
            else unsubscribe = remove;
        });
        return () => {
            cancelled = true;
            unsubscribe();
        };
    }, [queueTaskNotification]);

    useEffect(() => {
        openPendingTask();
    }, [openPendingTask]);

    useEffect(() => {
        const apply = (userId: string | null) => {
            setSession(userId);
            setSyncEnabled(!!userId);
        };
        supabase.auth.getSession().then(({ data: { session } }) => {
            apply(session?.user?.id ?? null);
            setReady(true);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            apply(session?.user?.id ?? null);
        });
        return () => subscription.unsubscribe();
    }, [setSession]);

    useEffect(() => {
        if (isAuthenticated) {
            useNoteStore.getState().fetchNotes();
            useNoteStore.getState().fetchArchivedNotes();
            useTaskStore.getState().fetchTasks();
            useProjectStore.getState().fetchProjects();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) void syncLocalTaskNotifications(tasks);
        else void cancelLocalTaskNotifications();
    }, [isAuthenticated, tasks]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') void syncLocalTaskNotifications(useTaskStore.getState().tasks);
        });
        return () => subscription.remove();
    }, [isAuthenticated]);

    if (!ready) {
        return (
            <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
                <ActivityIndicator color={theme.primary} />
                <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
            </View>
        );
    }

    return (
        <>
            <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
            <NavigationContainer ref={navigationRef} onReady={() => setNavigationReady(true)} theme={navigationTheme}>
                {isAuthenticated ? (
                    <Tab.Navigator
                        tabBar={(props) => <FloatingTabBar {...props} />}
                        screenOptions={{
                            headerShown: false,
                            sceneStyle: { backgroundColor: theme.background },
                            tabBarHideOnKeyboard: true,
                        }}
                    >
                        <Tab.Screen name="Notes" component={NotesStack} options={(props) => ({ tabBarAccessibilityLabel: 'Notes', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="note-text-outline" color={color} size={size} />, ...tabScreenOptions(props) })} />
                        <Tab.Screen name="Tasks" component={TasksStack} options={(props) => ({ tabBarAccessibilityLabel: 'Tasks', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="format-list-checks" color={color} size={size} />, ...tabScreenOptions(props) })} />
                        <Tab.Screen name="Projects" component={ProjectsStack} options={(props) => ({ tabBarAccessibilityLabel: 'Projects', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="folder-outline" color={color} size={size} />, ...tabScreenOptions(props) })} />
                        <Tab.Screen name="Settings" component={SettingsStack} options={{ tabBarAccessibilityLabel: 'Settings', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog-outline" color={color} size={size} /> }} />
                    </Tab.Navigator>
                ) : <AuthStack />}
            </NavigationContainer>
        </>
    );
}
