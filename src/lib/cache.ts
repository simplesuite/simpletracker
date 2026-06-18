import type { Note, Task, Subtask, Project } from '../types/index';

// Cache keys
const CACHE_KEY_NOTES = 'cachedNotes';
const CACHE_KEY_SHARED_NOTES = 'cachedSharedNotes';
const CACHE_KEY_TASKS = 'cachedTasks';
const CACHE_KEY_SUBTASKS = 'cachedSubtasks';
const CACHE_KEY_PROJECTS = 'cachedProjects';

// Legacy budget cache keys to clear on startup
const LEGACY_CACHE_KEYS = [
    'cachedBudgets',
    'cachedSections',
    'cachedCategories',
    'cachedTransactions',
];

// 50MB size limit (using string length as byte approximation)
const MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024;

// --- Read/Write functions ---

export function getCachedNotes(): Note[] {
    try {
        const raw = localStorage.getItem(CACHE_KEY_NOTES);
        if (!raw) return [];
        return JSON.parse(raw) as Note[];
    } catch {
        return [];
    }
}

export function setCachedNotes(notes: Note[]): void {
    try {
        localStorage.setItem(CACHE_KEY_NOTES, JSON.stringify(notes));
        evictIfOverLimit();
    } catch {
        // localStorage may be full or unavailable
    }
}

export function getCachedSharedNotes(): Note[] {
    try {
        const raw = localStorage.getItem(CACHE_KEY_SHARED_NOTES);
        if (!raw) return [];
        return JSON.parse(raw) as Note[];
    } catch {
        return [];
    }
}

export function setCachedSharedNotes(notes: Note[]): void {
    try {
        localStorage.setItem(CACHE_KEY_SHARED_NOTES, JSON.stringify(notes));
        evictIfOverLimit();
    } catch {
        // localStorage may be full or unavailable
    }
}

export function getCachedTasks(): Task[] {
    try {
        const raw = localStorage.getItem(CACHE_KEY_TASKS);
        if (!raw) return [];
        return JSON.parse(raw) as Task[];
    } catch {
        return [];
    }
}

export function setCachedTasks(tasks: Task[]): void {
    try {
        localStorage.setItem(CACHE_KEY_TASKS, JSON.stringify(tasks));
        evictIfOverLimit();
    } catch {
        // localStorage may be full or unavailable
    }
}

export function getCachedSubtasks(): Record<string, Subtask[]> {
    try {
        const raw = localStorage.getItem(CACHE_KEY_SUBTASKS);
        if (!raw) return {};
        return JSON.parse(raw) as Record<string, Subtask[]>;
    } catch {
        return {};
    }
}

export function setCachedSubtasks(subtasks: Record<string, Subtask[]>): void {
    try {
        localStorage.setItem(CACHE_KEY_SUBTASKS, JSON.stringify(subtasks));
        evictIfOverLimit();
    } catch {
        // localStorage may be full or unavailable
    }
}

export function getCachedProjects(): Project[] {
    try {
        const raw = localStorage.getItem(CACHE_KEY_PROJECTS);
        if (!raw) return [];
        return JSON.parse(raw) as Project[];
    } catch {
        return [];
    }
}

export function setCachedProjects(projects: Project[]): void {
    try {
        localStorage.setItem(CACHE_KEY_PROJECTS, JSON.stringify(projects));
        evictIfOverLimit();
    } catch {
        // localStorage may be full or unavailable
    }
}

// --- Remove a specific item from a cache array by recordID ---

export function removeCachedItem(key: string, recordID: string): void {
    try {
        if (key === CACHE_KEY_SUBTASKS) {
            // For subtasks, remove the entry keyed by recordID (which is the taskID)
            const subtasks = getCachedSubtasks();
            delete subtasks[recordID];
            localStorage.setItem(CACHE_KEY_SUBTASKS, JSON.stringify(subtasks));
            return;
        }

        const raw = localStorage.getItem(key);
        if (!raw) return;

        const items = JSON.parse(raw) as Array<{ recordID: string }>;
        const filtered = items.filter((item) => item.recordID !== recordID);
        localStorage.setItem(key, JSON.stringify(filtered));
    } catch {
        // Silently handle corrupted data
    }
}

// --- Clear legacy budget cache keys ---

export function clearLegacyCache(): void {
    for (const key of LEGACY_CACHE_KEYS) {
        try {
            localStorage.removeItem(key);
        } catch {
            // Ignore errors
        }
    }
}

// --- LRU Eviction ---

/**
 * Calculate the total size of all cache keys (in string length as byte approximation).
 */
export function getTotalCacheSize(): number {
    let total = 0;
    const keys = [CACHE_KEY_NOTES, CACHE_KEY_SHARED_NOTES, CACHE_KEY_TASKS, CACHE_KEY_SUBTASKS, CACHE_KEY_PROJECTS];
    for (const key of keys) {
        try {
            const value = localStorage.getItem(key);
            if (value) {
                total += value.length;
            }
        } catch {
            // Ignore
        }
    }
    return total;
}

interface EvictableItem {
    recordID: string;
    updatedAt: number;
    cacheKey: string;
}

/**
 * Evict items with the oldest updatedAt first until total cache size is under 50MB.
 * Subtasks are evicted with their parent task.
 */
export function evictIfOverLimit(): void {
    let totalSize = getTotalCacheSize();
    if (totalSize <= MAX_CACHE_SIZE_BYTES) return;

    // Collect all evictable items with their updatedAt timestamps
    const evictableItems: EvictableItem[] = [];

    const notes = getCachedNotes();
    for (const note of notes) {
        evictableItems.push({ recordID: note.recordID, updatedAt: note.updatedAt, cacheKey: CACHE_KEY_NOTES });
    }

    const sharedNotes = getCachedSharedNotes();
    for (const note of sharedNotes) {
        evictableItems.push({ recordID: note.recordID, updatedAt: note.updatedAt, cacheKey: CACHE_KEY_SHARED_NOTES });
    }

    const tasks = getCachedTasks();
    for (const task of tasks) {
        evictableItems.push({ recordID: task.recordID, updatedAt: task.updatedAt, cacheKey: CACHE_KEY_TASKS });
    }

    const projects = getCachedProjects();
    for (const project of projects) {
        evictableItems.push({ recordID: project.recordID, updatedAt: project.updatedAt, cacheKey: CACHE_KEY_PROJECTS });
    }

    // Sort by updatedAt ascending (oldest first = least recently updated)
    evictableItems.sort((a, b) => a.updatedAt - b.updatedAt);

    // Evict items one by one until under limit
    for (const item of evictableItems) {
        if (totalSize <= MAX_CACHE_SIZE_BYTES) break;

        if (item.cacheKey === CACHE_KEY_TASKS) {
            // When evicting a task, also evict its subtasks
            removeCachedItem(CACHE_KEY_SUBTASKS, item.recordID);
        }

        removeCachedItem(item.cacheKey, item.recordID);

        // Recalculate total size after eviction
        totalSize = getTotalCacheSize();
    }
}
