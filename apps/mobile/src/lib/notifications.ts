import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Task } from '@simpletracker/core';

const ENABLED_KEY = 'simpletracker.notifications.enabled';
const SCHEDULED_KEY = 'simpletracker.notifications.scheduled';
const CHANNEL_ID = 'task-reminders';
const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;
type ReminderKind = 'day_of' | 'before_due' | 'overdue_daily';

type ScheduledNotification = {
    id: string;
    taskID: string;
    kind: ReminderKind;
};

type LocalNotificationApi = {
    setNotificationHandler: typeof import('expo-notifications/build/NotificationsHandler').setNotificationHandler;
    getPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').getPermissionsAsync;
    requestPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').requestPermissionsAsync;
    setNotificationChannelAsync: typeof import('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync;
    scheduleNotificationAsync: typeof import('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync;
    cancelScheduledNotificationAsync: typeof import('expo-notifications/build/cancelScheduledNotificationAsync').cancelScheduledNotificationAsync;
    addNotificationResponseReceivedListener: typeof import('expo-notifications/build/NotificationsEmitter').addNotificationResponseReceivedListener;
    getLastNotificationResponse: typeof import('expo-notifications/build/NotificationsEmitter').getLastNotificationResponse;
    clearLastNotificationResponse: typeof import('expo-notifications/build/NotificationsEmitter').clearLastNotificationResponse;
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
            import('expo-notifications/build/NotificationsEmitter'),
            import('expo-notifications/build/NotificationChannelManager.types'),
            import('expo-notifications/build/Notifications.types'),
        ]).then(([handler, permissions, channel, scheduler, cancellation, emitter, channelTypes, notificationTypes]) => ({
            setNotificationHandler: handler.setNotificationHandler,
            getPermissionsAsync: permissions.getPermissionsAsync,
            requestPermissionsAsync: permissions.requestPermissionsAsync,
            setNotificationChannelAsync: channel.setNotificationChannelAsync,
            scheduleNotificationAsync: scheduler.scheduleNotificationAsync,
            cancelScheduledNotificationAsync: cancellation.cancelScheduledNotificationAsync,
            addNotificationResponseReceivedListener: emitter.addNotificationResponseReceivedListener,
            getLastNotificationResponse: emitter.getLastNotificationResponse,
            clearLastNotificationResponse: emitter.clearLastNotificationResponse,
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

function isDateOnlyDueDate(due: Date): boolean {
    return due.getHours() === 0
        && due.getMinutes() === 0
        && due.getSeconds() === 0
        && due.getMilliseconds() === 0;
}

function startOfLocalDay(date: Date): Date {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return day;
}

function localReminderTime(date: Date): Date {
    const reminder = startOfLocalDay(date);
    reminder.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
    return reminder;
}

function addLocalDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function isReminderKind(value: unknown): value is ReminderKind {
    return value === 'day_of' || value === 'before_due' || value === 'overdue_daily';
}

async function readScheduledNotifications(): Promise<ScheduledNotification[]> {
    const raw = await AsyncStorage.getItem(SCHEDULED_KEY);
    if (!raw) return [];

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const records: ScheduledNotification[] = [];
        for (const item of parsed) {
            // The previous implementation stored a flat string[]; retain those IDs
            // so an upgrade can cancel them before writing the new record format.
            if (typeof item === 'string') {
                records.push({ id: item, taskID: '', kind: 'day_of' });
                continue;
            }
            if (!item || typeof item !== 'object') continue;
            const candidate = item as { id?: unknown; taskID?: unknown; kind?: unknown };
            if (typeof candidate.id === 'string' && typeof candidate.taskID === 'string' && isReminderKind(candidate.kind)) {
                records.push({ id: candidate.id, taskID: candidate.taskID, kind: candidate.kind });
            }
        }
        return records;
    } catch {
        return [];
    }
}

async function cancelScheduledNotifications(api: LocalNotificationApi, records: ScheduledNotification[]): Promise<void> {
    await Promise.all(records.map(({ id }) => api.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}

export async function cancelLocalTaskNotifications(): Promise<void> {
    const records = await readScheduledNotifications();
    const api = await getLocalNotificationApi();
    if (api) await cancelScheduledNotifications(api, records);
    await AsyncStorage.removeItem(SCHEDULED_KEY);
}

type ReminderSpec = {
    kind: ReminderKind;
    trigger: Record<string, unknown>;
};

function dailyOverdueTrigger(triggerTypes: LocalNotificationApi['triggerTypes']): Record<string, unknown> {
    if (Platform.OS === 'android') {
        return { type: triggerTypes.DAILY, hour: REMINDER_HOUR, minute: REMINDER_MINUTE };
    }
    return { type: triggerTypes.CALENDAR, hour: REMINDER_HOUR, minute: REMINDER_MINUTE, repeats: true };
}

function reminderSpecs(task: Task, now: number, triggerTypes: LocalNotificationApi['triggerTypes']): ReminderSpec[] {
    if (task.dueDate == null) return [];

    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return [];

    const dueDayReminder = localReminderTime(due);
    const specs: ReminderSpec[] = [];

    if (dueDayReminder.getTime() > now) {
        specs.push({
            kind: 'day_of',
            trigger: { type: triggerTypes.DATE, date: dueDayReminder },
        });
    }

    // Midnight is the existing core-model representation for a date-only task.
    // Timed tasks additionally receive a reminder 15 minutes before their due time.
    if (!isDateOnlyDueDate(due)) {
        const beforeDue = new Date(due.getTime() - 15 * 60 * 1000);
        if (beforeDue.getTime() > now) {
            specs.push({
                kind: 'before_due',
                trigger: { type: triggerTypes.DATE, date: beforeDue },
            });
        }
    }

    // A daily trigger cannot be delayed until a future due date, so schedule
    // one next-morning reminder first. Once that date has passed, a native
    // daily trigger can repeat at 09:00 without firing before the task is due.
    const overdueStart = addLocalDays(dueDayReminder, 1);
    specs.push({
        kind: 'overdue_daily',
        trigger: overdueStart.getTime() <= now
            ? dailyOverdueTrigger(triggerTypes)
            : { type: triggerTypes.DATE, date: overdueStart },
    });

    return specs;
}

function notificationContent(task: Task, kind: ReminderKind): { title: string; body: string; data: Record<string, string> } {
    const title = kind === 'before_due'
        ? 'Task due soon'
        : kind === 'overdue_daily'
            ? 'Task overdue'
            : 'Task due today';
    return {
        title,
        body: task.title || 'A task needs your attention.',
        data: { taskID: task.recordID, reminderKind: kind },
    };
}

export async function syncLocalTaskNotifications(tasks: Task[]): Promise<void> {
    if (!(await getNotificationsEnabled())) return;
    const api = await getLocalNotificationApi();
    if (!api) return;
    try {
        const channelConfigured = await ensureAndroidNotificationChannel(api);
        const scheduled = await readScheduledNotifications();
        await cancelScheduledNotifications(api, scheduled);
        const now = Date.now();
        const nextRecords: ScheduledNotification[] = [];

        for (const task of tasks) {
            if (task.status !== 'open' || task.dueDate == null) continue;
            for (const spec of reminderSpecs(task, now, api.triggerTypes)) {
                try {
                    const id = await api.scheduleNotificationAsync({
                        content: notificationContent(task, spec.kind),
                        trigger: {
                            ...spec.trigger,
                            ...(channelConfigured ? { channelId: CHANNEL_ID } : {}),
                        } as never,
                    });
                    nextRecords.push({ id, taskID: task.recordID, kind: spec.kind });
                } catch (error) {
                    console.warn(`Unable to schedule ${spec.kind} reminder for task ${task.recordID}.`, error);
                }
            }
        }
        await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(nextRecords));
    } catch (error) {
        console.warn('Unable to synchronize local task reminders.', error);
    }
}

export async function subscribeToTaskNotificationResponses(onTaskID: (taskID: string) => void): Promise<() => void> {
    const api = await getLocalNotificationApi();
    if (!api) return () => undefined;

    let active = true;
    const handleResponse = (response: Parameters<LocalNotificationApi['addNotificationResponseReceivedListener']>[0] extends (event: infer Event) => void ? Event : never) => {
        const taskID = response.notification.request.content.data?.taskID;
        if (active && typeof taskID === 'string') onTaskID(taskID);
        try { api.clearLastNotificationResponse(); } catch { /* best effort */ }
    };

    const subscription = api.addNotificationResponseReceivedListener(handleResponse);
    const lastResponse = api.getLastNotificationResponse();
    if (lastResponse) handleResponse(lastResponse);
    return () => {
        active = false;
        subscription.remove();
    };
}

export async function setTaskNotificationsEnabled(enabled: boolean, tasks: Task[]): Promise<{ granted: boolean }> {
    if (!enabled) {
        await cancelLocalTaskNotifications();
        await AsyncStorage.multiRemove([ENABLED_KEY, SCHEDULED_KEY]);
        return { granted: false };
    }
    const granted = await requestNotificationPermission();
    if (!granted) return { granted: false };
    await AsyncStorage.setItem(ENABLED_KEY, 'true');
    await syncLocalTaskNotifications(tasks);
    return { granted: true };
}
