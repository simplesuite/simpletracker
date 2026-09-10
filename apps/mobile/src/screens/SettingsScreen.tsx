import { useEffect, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Button, Card, Dialog, Divider, Pill, Radio, Snackbar, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { clearLocalData } from '@simpletracker/core';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

const appUrl = 'https://tracker.simplesuite.dev';

export function SettingsScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const userId = useAuthStore((s) => s.userId);
    const { themeMode, effectiveTheme, setThemeMode } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const [email, setEmail] = useState<string | null>(null);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');

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

    const shareText = async (message: string, successMessage: string) => {
        try {
            const result = await Share.share({ message });
            setStatusMessage(result.action === Share.sharedAction ? successMessage : 'Sharing was cancelled.');
        } catch {
            setStatusMessage('Sharing was cancelled or unavailable.');
        }
    };

    const handleChangePassword = async () => {
        if (newPassword.length < 8) {
            setPasswordError('Password must be at least 8 characters.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('Passwords do not match.');
            return;
        }
        setSavingPassword(true);
        setPasswordError('');
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setSavingPassword(false);
        if (error) {
            setPasswordError(error.message);
            return;
        }
        setNewPassword('');
        setConfirmPassword('');
        setPasswordDialogOpen(false);
        setStatusMessage('Password updated.');
    };

    const openPasswordDialog = () => {
        setNewPassword('');
        setConfirmPassword('');
        setPasswordError('');
        setPasswordDialogOpen(true);
    };

    const themeLabel = themeMode === 'system' ? 'System default' : themeMode === 'light' ? 'Light' : 'Dark';
    const setMode = (mode: 'system' | 'light' | 'dark') => setThemeMode(mode);

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: tabBarHeight + 24, gap: 12 }}
            >
                <View className="mb-2 gap-1">
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
                    <View className="mt-2 flex-row flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                        <Button variant="tonal" compact icon={<MaterialCommunityIcons name="share-variant-outline" size={17} color={theme.primary} />} disabled={!userId} onPress={() => shareText(`My SimpleTracker user ID is ${userId}`, 'User ID ready to share.')}>Share user ID</Button>
                        <Button variant="outlined" compact icon={<MaterialCommunityIcons name="lock-reset" size={17} color={theme.primary} />} onPress={openPasswordDialog}>Change password</Button>
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

                <Card className="overflow-hidden p-5">
                    <View className="mb-3 flex-row items-center justify-between gap-3">
                        <View>
                            <Text variant="titleLarge">Share SimpleTracker</Text>
                            <Text variant="bodySmall">Invite someone to open the web app</Text>
                        </View>
                        <MaterialCommunityIcons name="open-in-new" size={22} color={theme.primary} />
                    </View>
                    <Button variant="tonal" icon={<MaterialCommunityIcons name="share-variant-outline" size={18} color={theme.primary} />} onPress={() => shareText(`Try SimpleTracker: ${appUrl}`, 'App link ready to share.')}>Share app link</Button>
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

            <Dialog
                visible={passwordDialogOpen}
                onDismiss={() => setPasswordDialogOpen(false)}
                title="Change password"
                actions={(
                    <>
                        <Button variant="text" compact onPress={() => setPasswordDialogOpen(false)}>Cancel</Button>
                        <Button compact loading={savingPassword} onPress={handleChangePassword}>Update</Button>
                    </>
                )}
            >
                <TextField
                    label="New password"
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    className="mb-3"
                    error={!!passwordError}
                />
                <TextField
                    label="Confirm new password"
                    placeholder="Enter it again"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    error={!!passwordError}
                    helperText={passwordError || 'You will stay signed in on this device.'}
                />
            </Dialog>
            <Snackbar visible={!!statusMessage} onDismiss={() => setStatusMessage('')} onAction={() => setStatusMessage('')} bottomOffset={tabBarHeight + 24}>{statusMessage}</Snackbar>
        </View>
    );
}
