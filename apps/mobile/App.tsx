import './global.css';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
    PaperProvider,
    MD3DarkTheme,
    MD3LightTheme,
    ActivityIndicator,
} from 'react-native-paper';
import { NavigationContainer, DefaultTheme as NavigationLightTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, View } from 'react-native';
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

function colorWithAlpha(color: string, alpha: number) {
    if (!color.startsWith('#')) return color;
    const hex = color.slice(1);
    const normalized = hex.length === 3
        ? hex.split('').map((value) => `${value}${value}`).join('')
        : hex.slice(0, 6);
    const red = parseInt(normalized.slice(0, 2), 16);
    const green = parseInt(normalized.slice(2, 4), 16);
    const blue = parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const styles = StyleSheet.create({
    tabBarGlass: { borderRadius: 28 },
});

export default function App() {
    const { effectiveTheme } = useThemeStore();

    // Use the theme store's effectiveTheme directly
    // The theme store handles system theme detection
    const theme = effectiveTheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
    const navigationTheme = {
        ...(effectiveTheme === 'dark' ? NavigationDarkTheme : NavigationLightTheme),
        dark: effectiveTheme === 'dark',
        colors: {
            primary: theme.colors.primary,
            background: theme.colors.background,
            card: theme.colors.surface,
            text: theme.colors.onSurface,
            border: theme.colors.outline,
            notification: theme.colors.error,
        },
    };

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
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background }}>
                    <ActivityIndicator />
                </View>
                <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
            </PaperProvider>
        );
    }

    return (
        <PaperProvider theme={theme}>
            <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} />
            <NavigationContainer theme={navigationTheme}>
                {isAuthenticated ? (
                    <Tab.Navigator
                        screenOptions={{
                            headerShown: false,
                            sceneStyle: { backgroundColor: theme.colors.background },
                            tabBarActiveTintColor: theme.colors.primary,
                            tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
                            tabBarActiveBackgroundColor: colorWithAlpha(theme.colors.primaryContainer, 0.72),
                            tabBarLabelVisibilityMode: 'unlabeled',
                            tabBarHideOnKeyboard: true,
                            tabBarIconStyle: { marginTop: 2 },
                            tabBarItemStyle: { marginHorizontal: 4, marginVertical: 4, borderRadius: 22 },
                            tabBarStyle: {
                                position: 'absolute',
                                left: 12,
                                right: 12,
                                bottom: 12,
                                borderRadius: 28,
                                overflow: 'hidden',
                                backgroundColor: 'transparent',
                                borderColor: colorWithAlpha(theme.colors.outlineVariant, 0.7),
                                borderWidth: StyleSheet.hairlineWidth,
                                paddingTop: 4,
                                paddingBottom: 4,
                                elevation: 8,
                                shadowColor: theme.colors.shadow,
                                shadowOpacity: effectiveTheme === 'dark' ? 0.35 : 0.14,
                                shadowRadius: 18,
                                shadowOffset: { width: 0, height: 8 },
                            },
                            tabBarBackground: () => (
                                <View
                                    pointerEvents="none"
                                    style={[
                                        StyleSheet.absoluteFill,
                                        styles.tabBarGlass,
                                        { backgroundColor: colorWithAlpha(theme.colors.surface, effectiveTheme === 'dark' ? 0.92 : 0.84) },
                                    ]}
                                />
                            ),
                        }}
                    >
                        <Tab.Screen
                            name="Notes"
                            component={NotesStack}
                            options={{
                                tabBarAccessibilityLabel: 'Notes',
                                tabBarIcon: ({ color, size }) => (
                                    <MaterialCommunityIcons name="note-text-outline" color={color} size={size} />
                                ),
                            }}
                        />
                        <Tab.Screen
                            name="Tasks"
                            component={TasksStack}
                            options={{
                                tabBarAccessibilityLabel: 'Tasks',
                                tabBarIcon: ({ color, size }) => (
                                    <MaterialCommunityIcons name="format-list-checks" color={color} size={size} />
                                ),
                            }}
                        />
                        <Tab.Screen
                            name="Projects"
                            component={ProjectsStack}
                            options={{
                                tabBarAccessibilityLabel: 'Projects',
                                tabBarIcon: ({ color, size }) => (
                                    <MaterialCommunityIcons name="folder-outline" color={color} size={size} />
                                ),
                            }}
                        />
                        <Tab.Screen
                            name="Settings"
                            component={SettingsScreen}
                            options={{
                                tabBarAccessibilityLabel: 'Settings',
                                tabBarIcon: ({ color, size }) => (
                                    <MaterialCommunityIcons name="cog-outline" color={color} size={size} />
                                ),
                            }}
                        />
                    </Tab.Navigator>
                ) : (
                    <AuthStack />
                )}
            </NavigationContainer>
        </PaperProvider>
    );
}
