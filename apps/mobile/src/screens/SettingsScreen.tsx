import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Button, Card, Divider, Pill, Radio, Text, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { clearLocalData } from '@simpletracker/core';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

export function SettingsScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const userId = useAuthStore((s) => s.userId);
    const { themeMode, effectiveTheme, setThemeMode } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const [email, setEmail] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) setEmail(session?.user?.email ?? null);
        });
        return () => {
            mounted = false;
        };
    }, []);

    const signOut = async () => {
        try {
            await clearLocalData();
        } catch {
            /* best-effort */
        }
        await supabase.auth.signOut();
    };

    const themeLabel = themeMode === 'system' ? 'System default' : themeMode === 'light' ? 'Light' : 'Dark';
    const setMode = (mode: 'system' | 'light' | 'dark') => setThemeMode(mode);

    return (
        <ScrollView
            className="flex-1"
            style={{ backgroundColor: theme.background }}
            contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: tabBarHeight + 24, gap: 12 }}
        >
            <View className="mb-2 gap-1">
                <Text variant="label" style={{ color: theme.primary }}>PREFERENCES</Text>
                <Text variant="headline">Settings</Text>
                <Text variant="body" style={{ color: theme.onSurfaceVariant }}>Manage your account and app appearance.</Text>
            </View>

            <Card className="overflow-hidden p-5">
                <View className="mb-2 flex-row items-center justify-between gap-3">
                    <View>
                        <Text variant="titleLarge">Account</Text>
                        <Text variant="bodySmall">Your current signed-in account</Text>
                    </View>
                    <View className="h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950">
                        <MaterialCommunityIcons name="account-outline" size={22} color={theme.primary} />
                    </View>
                </View>
                <View className="flex-row items-center py-3">
                    <MaterialCommunityIcons name="email-outline" size={22} color={theme.onSurfaceVariant} />
                    <View className="min-w-0 flex-1 pl-3">
                        <Text className="font-semibold" numberOfLines={1}>{email || 'Signed in'}</Text>
                        {userId ? <Text variant="bodySmall" numberOfLines={1}>User ID: {userId}</Text> : null}
                    </View>
                </View>
            </Card>

            <Card className="overflow-hidden p-5">
                <View className="mb-3 flex-row items-center justify-between gap-3">
                    <View>
                        <Text variant="titleLarge">Appearance</Text>
                        <Text variant="bodySmall">Choose how SimpleTracker looks</Text>
                    </View>
                    <Pill compact icon={<MaterialCommunityIcons name="palette-outline" size={15} color={theme.onSurfaceVariant} />}>{themeLabel}</Pill>
                </View>
                <View className="border-t border-slate-200 dark:border-slate-800">
                    {([
                        ['system', 'Use system setting', 'Follow your device theme'],
                        ['light', 'Light', 'A bright interface'],
                        ['dark', 'Dark', 'A darker interface'],
                    ] as const).map(([value, title, description]) => (
                        <View key={value} className="min-h-16 flex-row items-center justify-between border-b border-slate-200 py-1 dark:border-slate-800">
                            <View className="min-w-0 flex-1 gap-0.5">
                                <Text variant="bodyLarge">{title}</Text>
                                <Text variant="bodySmall">{description}</Text>
                            </View>
                            <Radio checked={themeMode === value} onPress={() => setMode(value)} accessibilityLabel={title} />
                        </View>
                    ))}
                </View>
            </Card>

            <View className="mt-1 flex-row items-center justify-between gap-3 rounded-3xl border p-4" style={{ backgroundColor: theme.errorContainer, borderColor: theme.error }}>
                <View className="min-w-0 flex-1 gap-1">
                    <Text variant="title">Sign out</Text>
                    <Text variant="bodySmall" style={{ color: theme.onErrorContainer }}>Local synced data will be cleared from this device.</Text>
                </View>
                <Button variant="outlined" compact icon={<MaterialCommunityIcons name="logout" size={18} color={theme.error} />} textClassName="text-red-600 dark:text-red-300" className="border-red-500 dark:border-red-400" onPress={signOut}>Sign out</Button>
            </View>

            <Divider className="mt-2" />
            <Text variant="bodySmall" className="mb-2 text-center">Theme preferences are saved on this device.</Text>
        </ScrollView>
    );
}
