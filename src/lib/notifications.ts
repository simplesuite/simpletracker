import type { Task } from '../types';
import { useNotificationStore } from '../store/notificationStore';

/**
 * Check if the browser supports the Notification API.
 */
export function notificationsSupported(): boolean {
    return 'Notification' in window;
}

/**
 * Request notification permission from the browser.
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (!notificationsSupported()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const result = await Notification.requestPermission();
    return result === 'granted';
}

/**
 * Get today's date string in YYYY-MM-DD format.
 */
function getTodayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Determine which open tasks are due today or overdue.
 */
export function getActionableTasks(tasks: Task[]): { dueToday: Task[]; overdue: Task[] } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    const dueToday: Task[] = [];
    const overdue: Task[] = [];

    for (const task of tasks) {
        if (task.status !== 'open' || task.dueDate == null) continue;

        if (task.dueDate < todayStart) {
            overdue.push(task);
        } else if (task.dueDate <= todayEnd) {
            dueToday.push(task);
        }
    }

    return { dueToday, overdue };
}

/**
 * Build a grouped notification message from actionable tasks.
 */
function buildNotificationBody(dueToday: Task[], overdue: Task[]): string {
    const lines: string[] = [];

    if (overdue.length === 1) {
        lines.push(`Overdue: "${overdue[0].title}"`);
    } else if (overdue.length > 1) {
        lines.push(`${overdue.length} overdue tasks`);
    }

    if (dueToday.length === 1) {
        lines.push(`Due today: "${dueToday[0].title}"`);
    } else if (dueToday.length > 1) {
        lines.push(`${dueToday.length} tasks due today`);
    }

    return lines.join('\n');
}

/**
 * Check tasks and send a single grouped notification if needed.
 * Only fires once per calendar day.
 */
export function checkAndNotify(tasks: Task[]): void {
    const store = useNotificationStore.getState();

    if (!store.enabled) return;
    if (!notificationsSupported()) return;
    if (Notification.permission !== 'granted') return;

    const today = getTodayString();
    if (store.lastNotifiedDate === today) return; // Already notified today

    const { dueToday, overdue } = getActionableTasks(tasks);

    if (dueToday.length === 0 && overdue.length === 0) return;

    const body = buildNotificationBody(dueToday, overdue);
    const total = dueToday.length + overdue.length;
    const title = total === 1 ? 'Task Reminder' : `${total} Task Reminders`;

    try {
        // Use the Service Worker to show notifications — the `new Notification()`
        // constructor is blocked on Android and most mobile browsers. The SW
        // approach works universally (desktop + mobile).
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistration().then((reg) => {
                if (reg) {
                    reg.showNotification(title, {
                        body,
                        icon: '/android-chrome-192x192.png',
                        tag: 'task-due-reminder',
                    });
                } else {
                    // Fallback for desktop if SW isn't registered yet
                    new Notification(title, { body, icon: '/android-chrome-192x192.png', tag: 'task-due-reminder' });
                }
            });
        } else {
            // No SW support at all — use the constructor (desktop only)
            new Notification(title, { body, icon: '/android-chrome-192x192.png', tag: 'task-due-reminder' });
        }
    } catch (err) {
        // Swallow the error so the app doesn't crash on load.
        console.warn('Failed to show notification:', err);
        return;
    }

    store.setLastNotifiedDate(today);
}
