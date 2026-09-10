import './global.css';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme as NavigationLightTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
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
import { SettingsScreen } from './src/screens/SettingsScreen';
import { AuthStack } from './src/navigation/AuthStack';
import type { RootTabParamList } from './src/navigation/types';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FloatingTabBar } from './src/components/ui/FloatingTabBar';
import { syncLocalTaskNotifications } from './src/lib/notifications';

const Tab = createBottomTabNavigator<RootTabParamList>();

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
    }, [isAuthenticated, tasks]);

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
            <NavigationContainer theme={navigationTheme}>
                {isAuthenticated ? (
                    <Tab.Navigator
                        tabBar={(props) => <FloatingTabBar {...props} />}
                        screenOptions={{
                            headerShown: false,
                            sceneStyle: { backgroundColor: theme.background },
                            tabBarHideOnKeyboard: true,
                        }}
                    >
                        <Tab.Screen name="Notes" component={NotesStack} options={{ tabBarAccessibilityLabel: 'Notes', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="note-text-outline" color={color} size={size} /> }} />
                        <Tab.Screen name="Tasks" component={TasksStack} options={{ tabBarAccessibilityLabel: 'Tasks', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="format-list-checks" color={color} size={size} /> }} />
                        <Tab.Screen name="Projects" component={ProjectsStack} options={{ tabBarAccessibilityLabel: 'Projects', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="folder-outline" color={color} size={size} /> }} />
                        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarAccessibilityLabel: 'Settings', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog-outline" color={color} size={size} /> }} />
                    </Tab.Navigator>
                ) : <AuthStack />}
            </NavigationContainer>
        </>
    );
}
