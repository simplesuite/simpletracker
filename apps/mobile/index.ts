import 'react-native-get-random-values';
import { createElement, useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { registerRootComponent } from 'expo';
import { initializeSupabase } from './src/lib/supabase';

type AppComponent = ComponentType;

function Root() {
    const [App, setApp] = useState<AppComponent | null>(null);
    const [startupError, setStartupError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            // Backend configuration must be resolved before initCore imports any
            // synced stores. A saved custom backend takes effect on next launch.
            await initializeSupabase();
            await import('./src/initCore');
            const appModule = await import('./App');
            if (mounted) setApp(() => appModule.default);
        })().catch((error: unknown) => {
            console.error('SimpleTracker startup failed:', error);
            if (mounted) {
                setStartupError(error instanceof Error ? error.message : String(error));
            }
        });
        return () => { mounted = false; };
    }, []);

    if (startupError) {
        return createElement(
            View,
            { style: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 } },
            createElement(Text, { style: { fontSize: 20, fontWeight: '700', marginBottom: 12 } }, 'Unable to start SimpleTracker'),
            createElement(Text, { selectable: true, style: { textAlign: 'center' } }, startupError),
        );
    }

    if (!App) {
        return createElement(View, { style: { flex: 1, alignItems: 'center', justifyContent: 'center' } }, createElement(ActivityIndicator));
    }

    return createElement(App);
}

// Register synchronously so a startup import failure cannot turn into the
// misleading Expo "main was not registered" error.
registerRootComponent(Root);
