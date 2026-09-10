import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Task } from '@simpletracker/core';

const ENABLED_KEY = 'simpletracker.notifications.enabled';
const SCHEDULED_KEY = 'simpletracker.notifications.scheduled';
const CHANNEL_ID = 'task-reminders';

type LocalNotificationApi = {
    setNotificationHandler: typeof import('expo-notifications/build/NotificationsHandler').setNotificationHandler;
    getPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').getPermissionsAsync;
    requestPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').requestPermissionsAsync;
    setNotificationChannelAsync: typeof import('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync;
    scheduleNotificationAsync: typeof import('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync;
    cancelScheduledNotificationAsync: typeof import('expo-notifications/build/cancelScheduledNotificationAsync').cancelScheduledNotificationAsync;
    androidImportance: typeof import('expo-notifications/build/NotificationChannelManager.types').AndroidImportance;
    triggerTypes: typeof import('expo-notifications/build/Notifications.types').SchedulableTriggerInputTypes;
};

let localNotificationApiPromise: Promise<LocalNotificationApi> | null = null;
let androidChannelAttempted = false;
let androidChannelConfigured = Platform.OS !== 'android';

async function loadLocalNotificationApi(): Promise<LocalNotificationApi> {
    if (!localNotificationApiPromise) {
        localNotificationApiPromise = Promise.all([
            import('expo-notifications/build/NotificationsHandler'),
            import('expo-notifications/build/NotificationPermissions'),
            import('expo-notifications/build/setNotificationChannelAsync'),
            import('expo-notifications/build/scheduleNotificationAsync'),
            import('expo-notifications/build/cancelScheduledNotificationAsync'),
            import('expo-notifications/build/NotificationChannelManager.types'),
            import('expo-notifications/build/Notifications.types'),
        ]).then(([handler, permissions, channel, scheduler, cancellation, channelTypes, notificationTypes]) => ({
            setNotificationHandler: handler.setNotificationHandler,
            getPermissionsAsync: permissions.getPermissionsAsync,
            requestPermissionsAsync: permissions.requestPermissionsAsync,
            setNotificationChannelAsync: channel.setNotificationChannelAsync,
            scheduleNotificationAsync: scheduler.scheduleNotificationAsync,
            cancelScheduledNotificationAsync: cancellation.cancelScheduledNotificationAsync,
            androidImportance: channelTypes.AndroidImportance,
            triggerTypes: notificationTypes.SchedulableTriggerInputTypes,
        }));
    }
    return localNotificationApiPromise;
}

async function getLocalNotificationApi(): Promise<LocalNotificationApi | null> {
    try {
        const api = await loadLocalNotificationApi();
        api.setNotificationHandler({
            handleNotification: async () => ({
                shouldShowAlert: true,
                shouldShowBanner: true,
                shouldShowList: true,
                shouldPlaySound: false,
                shouldSetBadge: false,
            }),
        });
        return api;
    } catch (error) {
        console.warn('Local notifications are unavailable in this runtime.', error);
        return null;
    }
}

export async function getNotificationsEnabled(): Promise<boolean> {
    return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true';
}

async function ensureAndroidNotificationChannel(api: LocalNotificationApi): Promise<boolean> {
    if (Platform.OS !== 'android' || androidChannelAttempted) return androidChannelConfigured;

    androidChannelAttempted = true;
    try {
        await api.setNotificationChannelAsync(CHANNEL_ID, {
            name: 'Task reminders',
            importance: api.androidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            sound: 'default',
        });
        androidChannelConfigured = true;
    } catch {
        // Some runtimes expose the channel API without registering its provider.
        // Let Expo use its built-in fallback channel for these runtimes.
        androidChannelConfigured = false;
    }
    return androidChannelConfigured;
}

export async function requestNotificationPermission(): Promise<boolean> {
    const api = await getLocalNotificationApi();
    if (!api) return false;
    try {
        await ensureAndroidNotificationChannel(api);
        const current = await api.getPermissionsAsync();
        if (current.granted) return true;
        const requested = await api.requestPermissionsAsync();
        return requested.granted;
    } catch (error) {
        console.warn('Unable to request local notification permission.', error);
        return false;
    }
}

function reminderDate(task: Task): Date | null {
    if (task.dueDate == null) return null;
    const due = new Date(task.dueDate);
    // Date-only task deadlines are represented at midnight by the core model.
    // Remind at 09:00 local time instead of notifying at midnight.
    if (due.getHours() === 0 && due.getMinutes() === 0) due.setHours(9, 0, 0, 0);
    return due;
}

export async function syncLocalTaskNotifications(tasks: Task[]): Promise<void> {
    if (!(await getNotificationsEnabled())) return;
    const api = await getLocalNotificationApi();
    if (!api) return;
    try {
        const channelConfigured = await ensureAndroidNotificationChannel(api);
        const scheduled = JSON.parse(await AsyncStorage.getItem(SCHEDULED_KEY) || '[]') as string[];
        await Promise.all(scheduled.map((id) => api.cancelScheduledNotificationAsync(id).catch(() => undefined)));
        const now = Date.now();
        const nextIds: string[] = [];
        for (const task of tasks) {
            if (task.status !== 'open') continue;
            const date = reminderDate(task);
            if (!date || date.getTime() <= now) continue;
            const id = await api.scheduleNotificationAsync({
                content: {
                    title: task.isRecurring ? 'Recurring task reminder' : 'Task reminder',
                    body: task.title || 'A task is due.',
                    data: { taskID: task.recordID },
                },
                trigger: {
                    type: api.triggerTypes.DATE,
                    date,
                    ...(channelConfigured ? { channelId: CHANNEL_ID } : {}),
                } as never,
            });
            nextIds.push(id);
        }
        await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(nextIds));
    } catch (error) {
        console.warn('Unable to synchronize local task reminders.', error);
    }
}

export async function setTaskNotificationsEnabled(enabled: boolean, tasks: Task[]): Promise<{ granted: boolean }> {
    if (!enabled) {
        const api = await getLocalNotificationApi();
        const scheduled = JSON.parse(await AsyncStorage.getItem(SCHEDULED_KEY) || '[]') as string[];
        if (api) await Promise.all(scheduled.map((id) => api.cancelScheduledNotificationAsync(id).catch(() => undefined)));
        await AsyncStorage.multiRemove([ENABLED_KEY, SCHEDULED_KEY]);
        return { granted: false };
    }
    const granted = await requestNotificationPermission();
    if (!granted) return { granted: false };
    await AsyncStorage.setItem(ENABLED_KEY, 'true');
    await syncLocalTaskNotifications(tasks);
    return { granted: true };
}
