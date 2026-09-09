import { useEffect, useState, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
    PaperProvider,
    MD3DarkTheme,
    MD3LightTheme,
    ActivityIndicator,
} from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, useColorScheme } from 'react-native';
// Safe to import from the barrel here: index.ts imports ./src/initCore first,
// so configureCore has already run before this module (and the stores) load.
import { setSyncEnabled, useNoteStore, useTaskStore, useProjectStore } from '@simpletracker/core';
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

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function App() {
    const { themeMode, effectiveTheme } = useThemeStore();

    // Use the theme store's effectiveTheme directly
    // The theme store handles system theme detection
    const theme = effectiveTheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const setSession = useAuthStore((s) => s.setSession);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        // Gate core syncing on auth; track the current user id for the core seam.
        const apply = (userId: string | null) => {
            setSession(userId);
            setSyncEnabled(!!userId);
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            apply(session?.user?.id ?? null);
            setReady(true);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            apply(session?.user?.id ?? null);
        });

        return () => subscription.unsubscribe();
    }, [setSession]);

    // Fetch data when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            useNoteStore.getState().fetchNotes();
            useNoteStore.getState().fetchArchivedNotes();
            useTaskStore.getState().fetchTasks();
            useProjectStore.getState().fetchProjects();
        }
    }, [isAuthenticated]);

    if (!ready) {
        return (
            <PaperProvider theme={theme} settings={{
                icon: (props) => <MaterialCommunityIcons {...props} />,
            }}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator />
                </View>
                <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
            </PaperProvider>
        );
    }

    return (
        <PaperProvider theme={theme}>
            <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
            <NavigationContainer>
                {isAuthenticated ? (
                    <Tab.Navigator screenOptions={{ headerShown: false }}>
                        <Tab.Screen name="Notes" component={NotesStack} />
                        <Tab.Screen name="Tasks" component={TasksStack} />
                        <Tab.Screen name="Projects" component={ProjectsStack} />
                        <Tab.Screen name="Settings" component={SettingsScreen} />
                    </Tab.Navigator>
                ) : (
                    <AuthStack />
                )}
            </NavigationContainer>
        </PaperProvider>
    );
}
