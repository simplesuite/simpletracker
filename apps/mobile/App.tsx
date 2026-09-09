import { useEffect, useState } from 'react';
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
import { setSyncEnabled } from '@simpletracker/core';
import { supabase } from './src/lib/supabase';
import { useAuthStore } from './src/store/authStore';
import { NotesStack } from './src/navigation/NotesStack';
import { TasksStack } from './src/navigation/TasksStack';
import { ProjectsStack } from './src/navigation/ProjectsStack';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SignInScreen } from './src/screens/SignInScreen';
import type { RootTabParamList } from './src/navigation/types';

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function App() {
    const scheme = useColorScheme();
    const theme = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;

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

    if (!ready) {
        return (
            <PaperProvider theme={theme}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator />
                </View>
                <StatusBar style="auto" />
            </PaperProvider>
        );
    }

    return (
        <PaperProvider theme={theme}>
            <NavigationContainer>
                {isAuthenticated ? (
                    <Tab.Navigator screenOptions={{ headerShown: false }}>
                        <Tab.Screen name="Notes" component={NotesStack} />
                        <Tab.Screen name="Tasks" component={TasksStack} />
                        <Tab.Screen name="Projects" component={ProjectsStack} />
                        <Tab.Screen name="Settings" component={SettingsScreen} />
                    </Tab.Navigator>
                ) : (
                    <SignInScreen />
                )}
            </NavigationContainer>
            <StatusBar style="auto" />
        </PaperProvider>
    );
}
