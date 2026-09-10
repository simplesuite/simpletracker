import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { observe } from '@legendapp/state';
import { getCurrentUserId } from '../runtime';
import { syncedTable } from '../legend/syncedTable';
import { validateTaskTitle, validateSubtaskTitle } from '../lib/validation';
import { spawnRecurringTask } from '../lib/recurrence';
import { isTaskSharedLocally } from '../lib/sharing';
import { useOfflineStore } from './offlineStore';
import { useProjectStore } from './projectStore';
import type { Task, Subtask } from '../types';

// ─── Synced observables (Legend-State) ──────────────────────────────────────
// RLS returns own tasks + shared-project tasks, synced into tasks$. Subtasks are
// their own collection. The bridge below projects these into Zustand state.

export const tasks$ = syncedTable<Task>({
    collection: 'tasks',
    persistName: 'st_tasks',
});

export const subtasks$ = syncedTable<Subtask>({
    collection: 'task_subtasks',
    persistName: 'st_subtasks',
});

interface TaskStore {
    tasks: Task[];
    subtasks: Record<string, Subtask[]>; // keyed by taskID
    statusFilter: 'open' | 'completed' | 'all';
    loading: boolean;
    error: string | null;

    setStatusFilter: (filter: 'open' | 'completed' | 'all') => void;
    fetchTasks: () => Promise<void>;
    createTask: (title: string, projectID?: string | null) => Promise<Task | null>;
    createBlankTask: (projectID?: string | null) => Promise<Task>;
    updateTask: (id: string, fields: Partial<Pick<Task, 'title' | 'body' | 'dueDate' | 'projectID' | 'isRecurring' | 'recurrenceInterval' | 'recurrenceUnit' | 'recurrenceAnchor'>>) => Promise<boolean>;
    completeTask: (id: string) => Promise<boolean>;
    reopenTask: (id: string) => Promise<boolean>;
    deleteTask: (id: string) => Promise<boolean>;

    fetchSubtasks: (taskID: string) => Promise<void>;
    addSubtask: (taskID: string, title: string) => Promise<Subtask | null>;
    toggleSubtask: (subtaskID: string) => Promise<boolean>;
    updateSubtaskTitle: (subtaskID: string, title: string) => Promise<boolean>;
    deleteSubtask: (subtaskID: string) => Promise<boolean>;
}

/** Determine if a task is shared using LOCAL state only. */
function checkTaskIsShared(task: Task, uid: string): boolean {
    const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
    return isTaskSharedLocally(task.creatorID, task.projectID, uid, sharedProjectIDs);
}

function currentUserID(): string {
    return getCurrentUserId();
}

function findTask(id: string): Task | undefined {
    return useTaskStore.getState().tasks.find((t) => t.recordID === id);
}

/** Find a subtask's parent taskID from the store. */
function findSubtaskParent(subtaskID: string): { taskID: string; subtask: Subtask } | null {
    const all = useTaskStore.getState().subtasks;
    for (const taskID of Object.keys(all)) {
        const st = all[taskID].find((s) => s.recordID === subtaskID);
        if (st) return { taskID, subtask: st };
    }
    return null;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
    tasks: [],
    subtasks: {},
    statusFilter: 'open',
    loading: false,
    error: null,

    setStatusFilter: (filter) => {
        set({ statusFilter: filter });
    },

    fetchTasks: async () => {
        tasks$.get();
    },

    createTask: async (title, projectID) => {
        const validation = validateTaskTitle(title);
        if (!validation.valid) {
            set({ error: validation.error || 'Invalid task title' });
            return null;
        }

        const uid = currentUserID();
        const now = Date.now();
        const newTask: Task = {
            recordID: uuidv4(),
            creatorID: uid,
            projectID: projectID || null,
            title: title.trim(),
            body: '',
            status: 'open',
            dueDate: null,
            isRecurring: false,
            recurrenceInterval: null,
            recurrenceUnit: null,
            recurrenceAnchor: 'due_date',
            completedAt: null,
            createdAt: now,
            updatedAt: now,
        };

        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = isTaskSharedLocally(uid, newTask.projectID, uid, sharedProjectIDs);
        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return null;
        }

        tasks$[newTask.recordID].set(newTask as any);
        set({ error: null });
        return newTask;
    },

    createBlankTask: async (projectID) => {
        const uid = currentUserID();
        const now = Date.now();
        const newTask: Task = {
            recordID: uuidv4(),
            creatorID: uid,
            projectID: projectID || null,
            title: '',
            body: '',
            status: 'open',
            dueDate: null,
            isRecurring: false,
            recurrenceInterval: null,
            recurrenceUnit: null,
            recurrenceAnchor: 'due_date',
            completedAt: null,
            createdAt: now,
            updatedAt: now,
        };

        // Even for shared projects offline, createBlankTask always returns a task
        // (matches previous contract). Only writes if allowed.
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = isTaskSharedLocally(uid, newTask.projectID, uid, sharedProjectIDs);
        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return newTask;
        }

        tasks$[newTask.recordID].set(newTask as any);
        set({ error: null });
        return newTask;
    },

    updateTask: async (id, fields) => {
        if (fields.title !== undefined) {
            const validation = validateTaskTitle(fields.title);
            if (!validation.valid) {
                set({ error: validation.error || 'Invalid task title' });
                return false;
            }
            fields.title = fields.title.trim();
        }

        const task = findTask(id);
        if (!task) {
            set({ error: 'Task not found' });
            return false;
        }

        if (checkTaskIsShared(task, currentUserID()) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        tasks$[id].set({ ...task, ...fields, updatedAt: Date.now() } as any);
        set({ error: null });
        return true;
    },

    completeTask: async (id) => {
        const task = findTask(id);
        if (!task) {
            set({ error: 'Task not found' });
            return false;
        }

        // Idempotency guard: only an OPEN task can be completed. Prevents a
        // double-tap / double-invoke from spawning duplicate recurring children.
        if (task.status !== 'open') {
            return true;
        }

        if (checkTaskIsShared(task, currentUserID()) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        const now = Date.now();
        tasks$[id].set({ ...task, status: 'completed', completedAt: now, updatedAt: now } as any);
        set({ error: null });

        // Spawn the next occurrence for a recurring task.
        if (task.isRecurring && task.recurrenceInterval && task.recurrenceUnit) {
            const completedTask: Task = { ...task, status: 'completed', completedAt: now, updatedAt: now };
            const subtasks = get().subtasks[id] || [];
            const spawned = spawnRecurringTask(completedTask, subtasks);

            const spawnedNow = Date.now();
            const newRecordID = uuidv4();
            const newTask: Task = {
                ...spawned.task,
                recordID: newRecordID,
                createdAt: spawnedNow,
                updatedAt: spawnedNow,
            };

            tasks$[newRecordID].set(newTask as any);

            if (spawned.subtasks.length > 0) {
                for (const st of spawned.subtasks) {
                    const subRecordID = uuidv4();
                    subtasks$[subRecordID].set({
                        ...st,
                        recordID: subRecordID,
                        taskID: newRecordID,
                        createdAt: spawnedNow,
                        updatedAt: spawnedNow,
                    } as any);
                }
            }
        }

        return true;
    },

    reopenTask: async (id) => {
        const task = findTask(id);
        if (!task) {
            set({ error: 'Task not found' });
            return false;
        }

        if (checkTaskIsShared(task, currentUserID()) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        tasks$[id].set({ ...task, status: 'open', completedAt: null, updatedAt: Date.now() } as any);
        set({ error: null });
        return true;
    },

    deleteTask: async (id) => {
        const task = findTask(id);

        if (task && checkTaskIsShared(task, currentUserID()) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        // Single delete. DB ON DELETE CASCADE removes task_subtasks rows.
        tasks$[id].delete();

        // Clear locally-synced subtasks for this task from their observable.
        const allSubs = subtasks$.get() || {};
        for (const subID of Object.keys(allSubs)) {
            if (allSubs[subID]?.taskID === id) {
                subtasks$[subID].delete();
            }
        }

        set({ error: null });
        return true;
    },

    // ─── Subtasks ─────────────────────────────────────────────────────────

    fetchSubtasks: async (_taskID) => {
        subtasks$.get();
    },

    addSubtask: async (taskID, title) => {
        if (title.trim().length > 0) {
            const validation = validateSubtaskTitle(title);
            if (!validation.valid) {
                set({ error: validation.error || 'Invalid subtask title' });
                return null;
            }
        }

        const existing = get().subtasks[taskID] || [];
        if (existing.length >= 50) {
            set({ error: 'Maximum of 50 subtasks per task reached' });
            return null;
        }

        const task = findTask(taskID);
        if (task && checkTaskIsShared(task, currentUserID()) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return null;
        }

        const now = Date.now();
        const newSubtask: Subtask = {
            recordID: uuidv4(),
            taskID,
            title: title.trim(),
            isCompleted: false,
            createdAt: now,
            updatedAt: now,
        };

        subtasks$[newSubtask.recordID].set(newSubtask as any);
        set({ error: null });
        return newSubtask;
    },

    toggleSubtask: async (subtaskID) => {
        const found = findSubtaskParent(subtaskID);
        if (!found) {
            set({ error: 'Subtask not found' });
            return false;
        }

        const task = findTask(found.taskID);
        if (task && checkTaskIsShared(task, currentUserID()) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        subtasks$[subtaskID].set({
            ...found.subtask,
            isCompleted: !found.subtask.isCompleted,
            updatedAt: Date.now(),
        } as any);
        set({ error: null });
        return true;
    },

    updateSubtaskTitle: async (subtaskID, title) => {
        const validation = validateSubtaskTitle(title);
        if (!validation.valid) {
            set({ error: validation.error || 'Invalid subtask title' });
            return false;
        }

        const found = findSubtaskParent(subtaskID);
        if (!found) {
            set({ error: 'Subtask not found' });
            return false;
        }

        const task = findTask(found.taskID);
        if (task && checkTaskIsShared(task, currentUserID()) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        subtasks$[subtaskID].set({ ...found.subtask, title, updatedAt: Date.now() } as any);
        set({ error: null });
        return true;
    },

    deleteSubtask: async (subtaskID) => {
        const found = findSubtaskParent(subtaskID);

        if (found) {
            const task = findTask(found.taskID);
            if (task && checkTaskIsShared(task, currentUserID()) && !useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }
        }

        subtasks$[subtaskID].delete();
        set({ error: null });
        return true;
    },
}));

// ─── Bridge: synced observables → Zustand state ─────────────────────────────
// Use rAF batching to prevent rapid re-execution during React render cycles
let tasksBatchPending = false;
let subtasksBatchPending = false;

function processTasksUpdate() {
    tasksBatchPending = false;
    const byId = tasks$.get() || {};
    const tasks = (Object.values(byId).filter(Boolean) as Task[]).sort(
        (a, b) => b.updatedAt - a.updatedAt
    );
    useTaskStore.setState({ tasks });
}

function processSubtasksUpdate() {
    subtasksBatchPending = false;
    const byId = subtasks$.get() || {};
    const items = Object.values(byId).filter(Boolean) as Subtask[];

    const grouped: Record<string, Subtask[]> = {};
    for (const st of items) {
        (grouped[st.taskID] ||= []).push(st);
    }
    for (const taskID of Object.keys(grouped)) {
        grouped[taskID].sort((a, b) => a.createdAt - b.createdAt);
    }

    useTaskStore.setState({ subtasks: grouped });
}

observe(() => {
    // Read the observable here so Legend-State tracks remote/local changes.
    void tasks$.get();
    if (!tasksBatchPending) {
        tasksBatchPending = true;
        requestAnimationFrame(processTasksUpdate);
    }
});

observe(() => {
    // Read the observable here so Legend-State tracks remote/local changes.
    void subtasks$.get();
    if (!subtasksBatchPending) {
        subtasksBatchPending = true;
        requestAnimationFrame(processSubtasksUpdate);
    }
});
