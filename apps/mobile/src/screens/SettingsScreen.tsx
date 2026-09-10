import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, Share, Switch, View } from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import { Button, Card, Dialog, Divider, Pill, Radio, Snackbar, Text, TextField, getUiTheme } from '@simpletracker/ui';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { clearLocalData, useNoteStore, useProjectStore, useTaskStore } from '@simpletracker/core';
import type { Note, Project, Task } from '@simpletracker/core';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useEntitlement, redirectToBillingPortal, redirectToCheckout } from '../lib/entitlement';
import { getNotificationsEnabled, setTaskNotificationsEnabled } from '../lib/notifications';
import { toCsv } from '../lib/csv';

const appUrl = 'https://tracker.simplesuite.dev';
const guidesUrl = 'https://simplesuite.dev/guides';
const bugUrl = 'https://github.com/simplesuite/simpletracker/issues';

type CsvKind = 'notes' | 'tasks' | 'projects';

function iso(value: number | null | undefined): string {
    return value ? new Date(value).toISOString() : '';
}

function noteRows(notes: Note[], archivedNotes: Note[], projects: Project[]) {
    return [...notes, ...archivedNotes].map((note) => ({
        title: note.title,
        body: note.body,
        type: note.noteType,
        project: projects.find((project) => project.recordID === note.projectID)?.name || '',
        archived: note.archived ? 'Yes' : 'No',
        pinned: note.pinned ? 'Yes' : 'No',
        createdAt: iso(note.createdAt),
        updatedAt: iso(note.updatedAt),
    }));
}

function taskRows(tasks: Task[], projects: Project[]) {
    return tasks.map((task) => ({
        title: task.title,
        body: task.body,
        status: task.status,
        project: projects.find((project) => project.recordID === task.projectID)?.name || '',
        dueDate: iso(task.dueDate),
        isRecurring: task.isRecurring ? 'Yes' : 'No',
        recurrenceInterval: task.recurrenceInterval ?? '',
        recurrenceUnit: task.recurrenceUnit ?? '',
        completedAt: iso(task.completedAt),
        createdAt: iso(task.createdAt),
        updatedAt: iso(task.updatedAt),
    }));
}

function projectRows(projects: Project[]) {
    return projects.map((project) => ({
        name: project.name,
        description: project.description,
        createdAt: iso(project.createdAt),
        updatedAt: iso(project.updatedAt),
    }));
}

export function SettingsScreen() {
    const tabBarHeight = useBottomTabBarHeight();
    const userId = useAuthStore((state) => state.userId);
    const { themeMode, effectiveTheme, setThemeMode } = useThemeStore();
    const theme = getUiTheme(effectiveTheme);
    const notes = useNoteStore((state) => state.notes);
    const archivedNotes = useNoteStore((state) => state.archivedNotes);
    const tasks = useTaskStore((state) => state.tasks);
    const projects = useProjectStore((state) => state.projects);
    const { entitlement, subscriptionState, loading: entitlementLoading, error: entitlementError, refresh: refreshEntitlement } = useEntitlement();
    const [email, setEmail] = useState<string | null>(null);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [savingPassword, setSavingPassword] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [qrDialogOpen, setQrDialogOpen] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [notificationsLoading, setNotificationsLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) setEmail(session?.user?.email ?? null);
        });
        getNotificationsEnabled().then((enabled) => {
            if (mounted) setNotificationsEnabled(enabled);
        });
        return () => { mounted = false; };
    }, []);

    const signOut = async () => {
        try { await clearLocalData(); } catch { /* best effort */ }
        try { await supabase.auth.signOut(); } catch { /* best effort */ }
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
        if (newPassword.length < 8) return setPasswordError('Password must be at least 8 characters.');
        if (newPassword !== confirmPassword) return setPasswordError('Passwords do not match.');
        setSavingPassword(true);
        setPasswordError('');
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        setSavingPassword(false);
        if (error) return setPasswordError(error.message);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordDialogOpen(false);
        setStatusMessage('Password updated.');
    };

    const handleNotifications = async (enabled: boolean) => {
        setNotificationsLoading(true);
        const result = await setTaskNotificationsEnabled(enabled, tasks);
        setNotificationsLoading(false);
        if (!result.granted && enabled) {
            setStatusMessage('Notification permission was not granted.');
            return;
        }
        setNotificationsEnabled(enabled && result.granted);
        setStatusMessage(enabled
            ? 'Task reminders enabled on this device.'
            : 'Task notifications disabled.');
    };

    const exportData = async (kind: CsvKind) => {
        if (subscriptionState === 'free' || entitlementLoading) {
            setStatusMessage('CSV export is a Pro feature.');
            return;
        }
        const rows = kind === 'notes'
            ? noteRows(notes, archivedNotes, projects)
            : kind === 'tasks' ? taskRows(tasks, projects) : projectRows(projects);
        const filename = `simpletracker-${kind}.csv`;
        try {
            const uri = `${FileSystem.cacheDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(uri, toCsv(rows as Array<Record<string, unknown>>), { encoding: FileSystem.EncodingType.UTF8 });
            if (!(await Sharing.isAvailableAsync())) {
                setStatusMessage('File sharing is not available on this device.');
                return;
            }
            await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: `Share ${filename}` });
        } catch (error) {
            setStatusMessage(error instanceof Error ? error.message : 'Unable to export data.');
        }
    };

    const copyUserId = async () => {
        if (!userId) return;
        await Clipboard.setStringAsync(userId);
        setStatusMessage('User ID copied.');
    };

    const openSupportLink = async (url: string) => {
        try { await Linking.openURL(url); }
        catch { setStatusMessage('Unable to open that link.'); }
    };

    const themeLabel = themeMode === 'system' ? 'System default' : themeMode === 'light' ? 'Light' : 'Dark';
    const hasPro = subscriptionState !== 'free';
    const subscriptionLabel = subscriptionState === 'canceling' ? 'Canceling' : subscriptionState === 'trialing' ? 'Trial' : hasPro ? 'Pro' : 'Free';
    const exportCounts = useMemo(() => ({ notes: notes.length + archivedNotes.length, tasks: tasks.length, projects: projects.length }), [notes, archivedNotes, tasks, projects]);

    return (
        <View className="flex-1" style={{ backgroundColor: theme.background }}>
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingTop: 20, paddingBottom: tabBarHeight + 24, gap: 12 }}>

                <Card className="overflow-hidden p-5">
                    <View className="mb-2 flex-row items-center justify-between gap-3">
                        <View><Text variant="titleLarge">Account</Text></View>
                        <View className="h-11 w-11 items-center justify-center rounded-2xl bg-primary-container dark:bg-primary-container-dark"><MaterialCommunityIcons name="account-outline" size={22} color={theme.primary} /></View>
                    </View>
                    <View className="flex-row items-center py-3">
                        <MaterialCommunityIcons name="email-outline" size={22} color={theme.onSurfaceVariant} />
                        <View className="min-w-0 flex-1 pl-3"><Text className="font-semibold" numberOfLines={1}>{email || 'Signed in'}</Text>{userId ? <Text variant="bodySmall" numberOfLines={1}>User ID: {userId}</Text> : null}</View>
                    </View>
                    <View className="mt-2 flex-row flex-wrap gap-2 border-t border-outline-variant pt-3 dark:border-outline-variant-dark">
                        <Button variant="tonal" compact icon={<MaterialCommunityIcons name="qrcode" size={17} color={theme.primary} />} disabled={!userId} onPress={() => setQrDialogOpen(true)}>My QR code</Button>
                        <Button variant="tonal" compact icon={<MaterialCommunityIcons name="content-copy" size={17} color={theme.primary} />} disabled={!userId} onPress={copyUserId}>Copy ID</Button>
                        <Button variant="outlined" compact icon={<MaterialCommunityIcons name="lock-reset" size={17} color={theme.primary} />} onPress={() => { setPasswordError(''); setPasswordDialogOpen(true); }}>Change password</Button>
                    </View>
                </Card>

                <Card className="overflow-hidden p-5">
                    <View className="mb-3 flex-row items-center justify-between gap-3"><View><Text variant="titleLarge">Plan</Text></View><Pill compact>{entitlementLoading ? 'Loading…' : subscriptionLabel}</Pill></View>
                    {entitlementError ? <Text variant="bodySmall" style={{ color: theme.error }}>{entitlementError}</Text> : null}
                    {subscriptionState === 'free' ? <Button variant="contained" icon={<MaterialCommunityIcons name="star-outline" size={18} color={theme.onPrimary} />} onPress={async () => { try { await redirectToCheckout(); await refreshEntitlement(); } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Unable to start checkout.'); } }}>Upgrade to Pro</Button> : <Button variant="outlined" icon={<MaterialCommunityIcons name="credit-card-outline" size={18} color={theme.primary} />} onPress={async () => { try { await redirectToBillingPortal(); await refreshEntitlement(); } catch (error) { setStatusMessage(error instanceof Error ? error.message : 'Unable to open billing.'); } }}>Manage subscription</Button>}
                    {entitlement?.current_period_end ? <Text variant="bodySmall" className="mt-2">Plan date: {new Date(entitlement.current_period_end).toLocaleDateString()}</Text> : null}
                </Card>

                <Card className="overflow-hidden p-5">
                    <View className="mb-3 flex-row items-center justify-between gap-3"><View><Text variant="titleLarge">Task notifications</Text></View><Switch value={notificationsEnabled} onValueChange={handleNotifications} disabled={notificationsLoading} trackColor={{ false: theme.outline, true: theme.primary }} thumbColor={notificationsEnabled ? theme.primary : theme.surface} /></View>
                    {notificationsLoading ? <ActivityIndicator color={theme.primary} /> : <Text variant="bodySmall">Each open task with a due date gets a day-of reminder, a 15-minute reminder for timed tasks, and a daily overdue reminder.</Text>}
                </Card>

                <Card className="overflow-hidden p-5">
                    <View className="mb-3"><Text variant="titleLarge">Export data</Text><Text variant="bodySmall">All your data as CSV files.</Text></View>
                    {hasPro ? <View className="gap-2"><Button variant="outlined" compact onPress={() => exportData('notes')}>Notes ({exportCounts.notes})</Button><Button variant="outlined" compact onPress={() => exportData('tasks')}>Tasks ({exportCounts.tasks})</Button><Button variant="outlined" compact onPress={() => exportData('projects')}>Projects ({exportCounts.projects})</Button></View> : <View className="flex-row items-center gap-2"><MaterialCommunityIcons name="lock-outline" size={18} color={theme.onSurfaceVariant} /><Text variant="bodySmall">Exports are available with Pro.</Text></View>}
                </Card>

                <Card className="overflow-hidden p-5">
                    <View className="mb-3 flex-row items-center justify-between gap-3"><View><Text variant="titleLarge">Appearance</Text></View><Pill compact icon={<MaterialCommunityIcons name="palette-outline" size={15} color={theme.onSurfaceVariant} />}>{themeLabel}</Pill></View>
                    {([['system', 'Use system setting'], ['light', 'Light'], ['dark', 'Dark']] as const).map(([value, title]) => <View key={value} className="min-h-16 flex-row items-center justify-between border-b border-outline-variant py-1 dark:border-outline-variant-dark"><View className="min-w-0 flex-1 gap-0.5"><Text variant="bodyLarge">{title}</Text></View><Radio checked={themeMode === value} onPress={() => setThemeMode(value)} accessibilityLabel={title} /></View>)}
                </Card>

                <Card className="overflow-hidden p-5">
                    <View className="mb-3 flex-row items-center justify-between gap-3"><View><Text variant="titleLarge">Support</Text></View><MaterialCommunityIcons name="help-circle-outline" size={22} color={theme.primary} /></View>
                    <View className="gap-2"><Button variant="outlined" compact icon={<MaterialCommunityIcons name="book-open-outline" size={18} color={theme.primary} />} onPress={() => openSupportLink(guidesUrl)}>Guides</Button><Button variant="outlined" compact icon={<MaterialCommunityIcons name="bug-outline" size={18} color={theme.primary} />} onPress={() => openSupportLink(bugUrl)}>Report a bug / Suggest a Feature</Button><Button variant="tonal" compact icon={<MaterialCommunityIcons name="share-variant-outline" size={18} color={theme.primary} />} onPress={() => shareText(`Try SimpleTracker: ${appUrl}`, 'App link ready to share.')}>Share app link</Button></View>
                </Card>

                <View className="mt-1 flex-row items-center justify-between gap-3 rounded-3xl border p-4" style={{ backgroundColor: theme.errorContainer, borderColor: theme.error }}><View className="min-w-0 flex-1 gap-1"><Text variant="title">Sign out</Text><Text variant="bodySmall" style={{ color: theme.onErrorContainer }}>Local synced data will be cleared from this device.</Text></View><Button variant="outlined" compact icon={<MaterialCommunityIcons name="logout" size={18} color={theme.error} />} textClassName="text-error dark:text-error-dark" className="border-error dark:border-error-dark" onPress={signOut}>Sign out</Button></View>
                <Divider className="mt-2" /><Text variant="bodySmall" className="mb-2 text-center">Theme preferences are saved on this device.</Text>
            </ScrollView>

            <Dialog visible={passwordDialogOpen} onDismiss={() => setPasswordDialogOpen(false)} title="Change password" actions={<><Button variant="text" compact onPress={() => setPasswordDialogOpen(false)}>Cancel</Button><Button compact loading={savingPassword} onPress={handleChangePassword}>Update</Button></>}>
                <TextField label="New password" placeholder="At least 8 characters" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" className="mb-3" error={!!passwordError} />
                <TextField label="Confirm new password" placeholder="Enter it again" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" error={!!passwordError} helperText={passwordError || 'You will stay signed in on this device.'} />
            </Dialog>
            <Dialog visible={qrDialogOpen} onDismiss={() => setQrDialogOpen(false)} title="My user ID" actions={<><Button variant="text" compact onPress={() => setQrDialogOpen(false)}>Close</Button><Button compact onPress={copyUserId}>Copy ID</Button></>}>
                <View className="items-center gap-3"><QRCode value={userId || ''} size={190} backgroundColor={theme.surface} color={theme.onSurface} /><Text variant="bodySmall" className="text-center">{userId}</Text></View>
            </Dialog>
            <Snackbar visible={!!statusMessage} onDismiss={() => setStatusMessage('')} onAction={() => setStatusMessage('')} bottomOffset={tabBarHeight + 24}>{statusMessage}</Snackbar>
        </View>
    );
}
