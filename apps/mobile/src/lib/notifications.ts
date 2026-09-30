import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Task } from '@simpletracker/core';

const ENABLED_KEY = 'simpletracker.notifications.enabled';
const SCHEDULED_KEY = 'simpletracker.notifications.scheduled';
const KIND_PREFS_KEY = 'simpletracker.notifications.kinds';
const TIME_KEY = 'simpletracker.notifications.time';
const SOUND_KEY = 'simpletracker.notifications.sound';
const CHANNEL_ID = 'task-reminders';
const DEFAULT_REMINDER_HOUR = 9;
const DEFAULT_REMINDER_MINUTE = 0;
type ReminderKind = 'day_of' | 'before_due' | 'overdue_daily';

// The time-of-day (local) at which day-of and overdue reminders fire. Persisted
// so the user can change it; defaults to 9:00 AM (the previous fixed value).
export type ReminderTime = { hour: number; minute: number };

// Per-kind toggles that live beneath the master enable flag. Each defaults to
// on, so an upgrade (no stored prefs) keeps the previous "all reminders" behavior.
export type ReminderPreferences = Record<ReminderKind, boolean>;

const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
    day_of: true,
    before_due: true,
    overdue_daily: true,
};

type LocalNotificationApi = {
    setNotificationHandler: typeof import('expo-notifications/build/NotificationsHandler').setNotificationHandler;
    getPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').getPermissionsAsync;
    requestPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').requestPermissionsAsync;
    setNotificationChannelAsync: typeof import('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync;
    scheduleNotificationAsync: typeof import('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync;
    cancelScheduledNotificationAsync: typeof import('expo-notifications/build/cancelScheduledNotificationAsync').cancelScheduledNotificationAsync;
    cancelAllScheduledNotificationsAsync: typeof import('expo-notifications/build/cancelAllScheduledNotificationsAsync').cancelAllScheduledNotificationsAsync;
    getAllScheduledNotificationsAsync: typeof import('expo-notifications/build/getAllScheduledNotificationsAsync').getAllScheduledNotificationsAsync;
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
            import('expo-notifications/build/cancelAllScheduledNotificationsAsync'),
            import('expo-notifications/build/getAllScheduledNotificationsAsync'),
            import('expo-notifications/build/NotificationsEmitter'),
            import('expo-notifications/build/NotificationChannelManager.types'),
            import('expo-notifications/build/Notifications.types'),
        ]).then(([handler, permissions, channel, scheduler, cancellation, cancellationAll, scheduledList, emitter, channelTypes, notificationTypes]) => ({
            setNotificationHandler: handler.setNotificationHandler,
            getPermissionsAsync: permissions.getPermissionsAsync,
            requestPermissionsAsync: permissions.requestPermissionsAsync,
            setNotificationChannelAsync: channel.setNotificationChannelAsync,
            scheduleNotificationAsync: scheduler.scheduleNotificationAsync,
            cancelScheduledNotificationAsync: cancellation.cancelScheduledNotificationAsync,
            cancelAllScheduledNotificationsAsync: cancellationAll.cancelAllScheduledNotificationsAsync,
            getAllScheduledNotificationsAsync: scheduledList.getAllScheduledNotificationsAsync,
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
                // Honor the in-app sound preference for foreground presentation.
                shouldPlaySound: await getReminderSoundEnabled(),
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

// True only when the in-app flag is on AND the OS still grants permission.
// The Settings screen uses this to detect permission revoked in system settings
// and to re-sync its toggle. When permission was revoked, we also flip the
// in-app flag off and cancel so state stays consistent.
export async function getEffectiveNotificationsEnabled(): Promise<boolean> {
    if (!(await getNotificationsEnabled())) return false;
    const api = await getLocalNotificationApi();
    if (!api) return false;
    if (await hasNotificationPermission(api)) return true;
    // Permission revoked at the OS level: reconcile in-app state to match.
    await AsyncStorage.removeItem(ENABLED_KEY);
    await cancelLocalTaskNotifications();
    return false;
}

function isReminderKindKey(value: string): value is ReminderKind {
    return value === 'day_of' || value === 'before_due' || value === 'overdue_daily';
}

export async function getReminderPreferences(): Promise<ReminderPreferences> {
    const prefs: ReminderPreferences = { ...DEFAULT_REMINDER_PREFERENCES };
    const raw = await AsyncStorage.getItem(KIND_PREFS_KEY);
    if (!raw) return prefs;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return prefs;
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            // Only a stored `false` overrides the default; anything else keeps the
            // kind enabled so a partial/corrupt record fails safe toward "on".
            if (isReminderKindKey(key) && value === false) prefs[key] = false;
        }
        return prefs;
    } catch {
        return prefs;
    }
}

export async function setReminderPreference(kind: ReminderKind, enabled: boolean): Promise<ReminderPreferences> {
    const prefs = await getReminderPreferences();
    prefs[kind] = enabled;
    await AsyncStorage.setItem(KIND_PREFS_KEY, JSON.stringify(prefs));
    return prefs;
}

function clampHour(value: number): number {
    return Number.isInteger(value) && value >= 0 && value <= 23 ? value : DEFAULT_REMINDER_HOUR;
}

function clampMinute(value: number): number {
    return Number.isInteger(value) && value >= 0 && value <= 59 ? value : DEFAULT_REMINDER_MINUTE;
}

export async function getReminderTime(): Promise<ReminderTime> {
    const raw = await AsyncStorage.getItem(TIME_KEY);
    if (!raw) return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') throw new Error('bad');
        const { hour, minute } = parsed as { hour?: unknown; minute?: unknown };
        return {
            hour: clampHour(typeof hour === 'number' ? hour : NaN),
            minute: clampMinute(typeof minute === 'number' ? minute : NaN),
        };
    } catch {
        return { hour: DEFAULT_REMINDER_HOUR, minute: DEFAULT_REMINDER_MINUTE };
    }
}

export async function setReminderTime(time: ReminderTime): Promise<ReminderTime> {
    const next: ReminderTime = { hour: clampHour(time.hour), minute: clampMinute(time.minute) };
    await AsyncStorage.setItem(TIME_KEY, JSON.stringify(next));
    return next;
}

export async function getReminderSoundEnabled(): Promise<boolean> {
    // Default off, matching the app's prior quiet-reminder behavior.
    return (await AsyncStorage.getItem(SOUND_KEY)) === 'true';
}

export async function setReminderSoundEnabled(enabled: boolean): Promise<boolean> {
    if (enabled) await AsyncStorage.setItem(SOUND_KEY, 'true');
    else await AsyncStorage.removeItem(SOUND_KEY);
    return enabled;
}

async function ensureAndroidNotificationChannel(api: LocalNotificationApi): Promise<boolean> {
    if (Platform.OS !== 'android' || androidChannelAttempted) return androidChannelConfigured;

    androidChannelAttempted = true;
    try {
        await api.setNotificationChannelAsync(CHANNEL_ID, {
            name: 'Task reminders',
            importance: api.androidImportance.DEFAULT,
            vibrationPattern: [0, 250, 250, 250],
            // `null` uses the system default notification sound. A string here is
            // treated as a custom bundled sound filename and throws if the file
            // isn't registered in the expo-notifications config plugin.
            sound: null,
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

function localReminderTime(date: Date, time: ReminderTime): Date {
    const reminder = startOfLocalDay(date);
    reminder.setHours(time.hour, time.minute, 0, 0);
    return reminder;
}

function addLocalDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

// Bookkeeping is only a best-effort fallback now that cancellation is
// authoritative (cancelAllScheduledNotificationsAsync). We only ever need the
// scheduled identifiers, so store a plain string[]. Older builds stored an
// array of {id,...} records; tolerate those by extracting the id.
async function readScheduledNotificationIDs(): Promise<string[]> {
    const raw = await AsyncStorage.getItem(SCHEDULED_KEY);
    if (!raw) return [];
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const ids: string[] = [];
        for (const item of parsed) {
            if (typeof item === 'string') ids.push(item);
            else if (item && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string') {
                ids.push((item as { id: string }).id);
            }
        }
        return ids;
    } catch {
        return [];
    }
}

async function cancelScheduledNotificationIDs(api: LocalNotificationApi, ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => api.cancelScheduledNotificationAsync(id).catch(() => undefined)));
}

// Authoritatively clear every notification the OS currently holds for this app.
// The OS is the source of truth, not our AsyncStorage bookkeeping: a scheduling
// error, an interrupted write, or a prior install can leave "orphaned"
// notifications that are not in SCHEDULED_KEY. Those orphans are exactly what
// made reminders survive after a task was completed/deleted or after the user
// turned notifications off. This app only ever schedules task reminders through
// this module, so cancelling everything is safe.
async function cancelAllOsNotifications(api: LocalNotificationApi): Promise<void> {
    try {
        await api.cancelAllScheduledNotificationsAsync();
        return;
    } catch (error) {
        console.warn('Unable to cancel all scheduled notifications; falling back to tracked IDs.', error);
    }
    // Fallback for runtimes that expose the module without a working provider:
    // cancel whatever we can enumerate, then whatever we recorded.
    try {
        const scheduled = await api.getAllScheduledNotificationsAsync();
        await Promise.all(scheduled.map((item) => api.cancelScheduledNotificationAsync(item.identifier).catch(() => undefined)));
    } catch {
        const ids = await readScheduledNotificationIDs();
        await cancelScheduledNotificationIDs(api, ids);
    }
}

export async function cancelLocalTaskNotifications(): Promise<void> {
    const api = await getLocalNotificationApi();
    if (api) await cancelAllOsNotifications(api);
    else {
        // No API available: at least drop bookkeeping so a later reconcile
        // starts from a clean slate.
    }
    await AsyncStorage.removeItem(SCHEDULED_KEY);
}

type ReminderSpec = {
    kind: ReminderKind;
    trigger: Record<string, unknown>;
};

function dailyOverdueTrigger(triggerTypes: LocalNotificationApi['triggerTypes'], time: ReminderTime): Record<string, unknown> {
    if (Platform.OS === 'android') {
        return { type: triggerTypes.DAILY, hour: time.hour, minute: time.minute };
    }
    return { type: triggerTypes.CALENDAR, hour: time.hour, minute: time.minute, repeats: true };
}

function reminderSpecs(task: Task, now: number, triggerTypes: LocalNotificationApi['triggerTypes'], prefs: ReminderPreferences, time: ReminderTime): ReminderSpec[] {
    if (task.dueDate == null) return [];

    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return [];

    const dueDayReminder = localReminderTime(due, time);
    const specs: ReminderSpec[] = [];

    if (prefs.day_of && dueDayReminder.getTime() > now) {
        specs.push({
            kind: 'day_of',
            trigger: { type: triggerTypes.DATE, date: dueDayReminder },
        });
    }

    // Midnight is the existing core-model representation for a date-only task.
    // Timed tasks additionally receive a reminder 15 minutes before their due time.
    if (prefs.before_due && !isDateOnlyDueDate(due)) {
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
    // daily trigger can repeat at the reminder time without firing before the
    // task is due.
    if (prefs.overdue_daily) {
        const overdueStart = addLocalDays(dueDayReminder, 1);
        specs.push({
            kind: 'overdue_daily',
            trigger: overdueStart.getTime() <= now
                ? dailyOverdueTrigger(triggerTypes, time)
                : { type: triggerTypes.DATE, date: overdueStart },
        });
    }

    return specs;
}

function notificationContent(task: Task, kind: ReminderKind, soundEnabled: boolean): { title: string; body: string; data: Record<string, string>; sound?: boolean } {
    const title = kind === 'before_due'
        ? 'Task due soon'
        : kind === 'overdue_daily'
            ? 'Task overdue'
            : 'Task due today';
    return {
        title,
        body: task.title || 'A task needs your attention.',
        data: { taskID: task.recordID, reminderKind: kind },
        // iOS reads sound from the content; Android uses the channel's sound.
        // Pass the boolean `true` to request the OS default sound. A string here
        // is treated as a custom bundled sound filename by expo-notifications and
        // throws if no matching file is registered in the config plugin.
        ...(soundEnabled ? { sound: true } : {}),
    };
}

async function hasNotificationPermission(api: LocalNotificationApi): Promise<boolean> {
    try {
        const current = await api.getPermissionsAsync();
        return current.granted;
    } catch {
        return false;
    }
}

// Reconciles can be triggered from several places at once (the tasks-array
// effect, the AppState "active" listener, the settings toggle). Each reconcile
// cancels everything and reschedules, so overlapping runs could interleave and
// leave the OS in an inconsistent state. Serialize them: while one is running,
// coalesce callers onto a single trailing run using the latest task list.
let reconcileInFlight: Promise<void> | null = null;
let pendingTasks: Task[] | null = null;

export function syncLocalTaskNotifications(tasks: Task[]): Promise<void> {
    if (reconcileInFlight) {
        // A reconcile is already running; remember the newest task list and let
        // the in-flight run schedule a single trailing pass with it.
        pendingTasks = tasks;
        return reconcileInFlight;
    }

    const drain = async (initial: Task[]): Promise<void> => {
        let current: Task[] | null = initial;
        while (current) {
            pendingTasks = null;
            await runSyncLocalTaskNotifications(current);
            current = pendingTasks;
        }
    };

    reconcileInFlight = drain(tasks).finally(() => {
        reconcileInFlight = null;
    });
    return reconcileInFlight;
}

async function runSyncLocalTaskNotifications(tasks: Task[]): Promise<void> {
    const api = await getLocalNotificationApi();
    if (!api) return;

    // Honor the in-app toggle AND the OS permission. If either is off, the
    // authoritative action is to clear everything the OS holds so no stale
    // reminder can fire. Returning early here (the previous behavior) is what
    // let notifications keep firing after the toggle was turned off.
    const enabled = await getNotificationsEnabled();
    if (!enabled || !(await hasNotificationPermission(api))) {
        await cancelAllOsNotifications(api);
        await AsyncStorage.removeItem(SCHEDULED_KEY);
        return;
    }

    try {
        const channelConfigured = await ensureAndroidNotificationChannel(api);
        const prefs = await getReminderPreferences();
        // Clear everything (including orphans) before rescheduling, so completed
        // and deleted tasks cannot leave a reminder behind.
        await cancelAllOsNotifications(api);
        const now = Date.now();
        const soundEnabled = await getReminderSoundEnabled();
        const time = await getReminderTime();
        const scheduledIDs: string[] = [];

        for (const task of tasks) {
            if (task.status !== 'open' || task.dueDate == null) continue;
            for (const spec of reminderSpecs(task, now, api.triggerTypes, prefs, time)) {
                try {
                    const id = await api.scheduleNotificationAsync({
                        content: notificationContent(task, spec.kind, soundEnabled),
                        trigger: {
                            ...spec.trigger,
                            ...(channelConfigured ? { channelId: CHANNEL_ID } : {}),
                        } as never,
                    });
                    scheduledIDs.push(id);
                } catch (error) {
                    console.warn(`Unable to schedule ${spec.kind} reminder for task ${task.recordID}.`, error);
                }
            }
        }
        await AsyncStorage.setItem(SCHEDULED_KEY, JSON.stringify(scheduledIDs));
    } catch (error) {
        console.warn('Unable to synchronize local task reminders.', error);
    }
}

// Change a single reminder-kind preference and re-reconcile so the change takes
// effect immediately. Returns the full updated preference set for the UI.
export async function setTaskReminderKindEnabled(kind: ReminderKind, enabled: boolean, tasks: Task[]): Promise<ReminderPreferences> {
    const prefs = await setReminderPreference(kind, enabled);
    // Only reschedule when the master toggle is on; when off, the reconcile is a
    // no-op cleanup, so we skip the work but still persist the preference.
    if (await getNotificationsEnabled()) await syncLocalTaskNotifications(tasks);
    return prefs;
}

// Persist a new reminder time and reschedule so existing reminders move.
export async function setTaskReminderTime(time: ReminderTime, tasks: Task[]): Promise<ReminderTime> {
    const next = await setReminderTime(time);
    if (await getNotificationsEnabled()) await syncLocalTaskNotifications(tasks);
    return next;
}

// Persist the sound preference and reschedule so already-scheduled reminders
// pick up the new sound setting in their content.
export async function setTaskReminderSoundEnabled(enabled: boolean, tasks: Task[]): Promise<boolean> {
    await setReminderSoundEnabled(enabled);
    if (await getNotificationsEnabled()) await syncLocalTaskNotifications(tasks);
    return enabled;
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
        // Clear the flag first so any reconcile racing with this disable sees
        // the off state and cancels rather than reschedules.
        await AsyncStorage.removeItem(ENABLED_KEY);
        await cancelLocalTaskNotifications();
        return { granted: false };
    }
    const granted = await requestNotificationPermission();
    if (!granted) return { granted: false };
    await AsyncStorage.setItem(ENABLED_KEY, 'true');
    await syncLocalTaskNotifications(tasks);
    return { granted: true };
}
