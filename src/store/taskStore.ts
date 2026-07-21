import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { validateTaskTitle, validateSubtaskTitle } from '../lib/validation';
import { getCachedTasks, setCachedTasks, getCachedSubtasks, setCachedSubtasks } from '../lib/cache';
import { insertWithOfflineSupport, updateWithOfflineSupport, deleteWithOfflineSupport } from '../lib/offlineSync';
import { getAll as getAllPendingMutations } from '../lib/offlineQueue';
import { spawnRecurringTask } from '../lib/recurrence';
import { isTaskSharedLocally } from '../lib/sharing';
import { useGlobalStore } from './globalStore';
import { useOfflineStore } from './offlineStore';
import { useProjectStore } from './projectStore';
import { ensureSession } from '../components/extras/ensureSession';
import type { Task, Subtask } from '../types';

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

/**
 * Helper to determine if a task is shared using LOCAL state only (no network calls).
 * Uses the project store's sharedProjectIDs set to check project-based sharing.
 */
function checkTaskIsShared(task: Task, currentUserID: string): boolean {
    const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
    return isTaskSharedLocally(task.creatorID, task.projectID, currentUserID, sharedProjectIDs);
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
        set({ loading: true, error: null });

        // Load from cache first for instant render (non-shared items only)
        const cached = getCachedTasks();
        if (cached.length > 0) {
            set({ tasks: cached });
        }

        try {
            await ensureSession();
            const currentUserID = useGlobalStore.getState().currentUser.recordID;

            // Fetch tasks created by the user (paginate to avoid Supabase default 1000-row limit)
            let ownTasks: Task[] = [];
            let ownOffset = 0;
            const PAGE_SIZE = 1000;
            while (true) {
                const { data: page, error: pageError } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('creatorID', currentUserID)
                    .order('updatedAt', { ascending: false })
                    .range(ownOffset, ownOffset + PAGE_SIZE - 1);

                if (pageError) {
                    set({ error: pageError.message, loading: false });
                    return;
                }
                ownTasks = ownTasks.concat((page || []) as Task[]);
                if (!page || page.length < PAGE_SIZE) break;
                ownOffset += PAGE_SIZE;
            }

            // Fetch tasks from shared projects
            const { data: projectShares, error: projShareError } = await supabase
                .from('task_projects_shared')
                .select('projectID')
                .eq('sharedToID', currentUserID);

            if (projShareError) {
                set({ error: projShareError.message, loading: false });
                return;
            }

            let sharedProjectTasks: Task[] = [];
            if (projectShares && projectShares.length > 0) {
                const projectIDs = projectShares.map((p) => p.projectID);
                let sharedOffset = 0;
                while (true) {
                    const { data: page, error: pageError } = await supabase
                        .from('tasks')
                        .select('*')
                        .in('projectID', projectIDs)
                        .neq('creatorID', currentUserID)
                        .order('updatedAt', { ascending: false })
                        .range(sharedOffset, sharedOffset + PAGE_SIZE - 1);

                    if (pageError) {
                        set({ error: pageError.message, loading: false });
                        return;
                    }
                    sharedProjectTasks = sharedProjectTasks.concat((page || []) as Task[]);
                    if (!page || page.length < PAGE_SIZE) break;
                    sharedOffset += PAGE_SIZE;
                }
            }

            // Combine all tasks, deduplicate
            const allTasksMap = new Map<string, Task>();
            for (const task of (ownTasks || [])) {
                allTasksMap.set(task.recordID, task);
            }
            for (const task of sharedProjectTasks) {
                allTasksMap.set(task.recordID, task);
            }

            const allTasks = Array.from(allTasksMap.values())
                .sort((a, b) => b.updatedAt - a.updatedAt);

            // Filter out tasks that have a pending delete in the offline queue
            // to prevent re-adding tasks the user already deleted locally
            // Also preserve tasks that have a pending insert (not yet on server)
            let filteredTasks = allTasks;
            try {
                const pendingMutations = await getAllPendingMutations();
                const pendingDeleteIDs = new Set(
                    pendingMutations
                        .filter((m) => m.entityType === 'task' && m.operation === 'delete')
                        .map((m) => m.recordID)
                );
                const pendingUpdateIDs = new Set(
                    pendingMutations
                        .filter((m) => m.entityType === 'task' && (m.operation === 'update' || m.operation === 'insert'))
                        .map((m) => m.recordID)
                );
                if (pendingDeleteIDs.size > 0) {
                    filteredTasks = allTasks.filter((t) => !pendingDeleteIDs.has(t.recordID));
                }

                // For tasks with pending updates/inserts, prefer the local version
                // over the stale server data to avoid overwriting offline edits
                if (pendingUpdateIDs.size > 0) {
                    const currentTasks = get().tasks;
                    const localTaskMap = new Map(currentTasks.map((t) => [t.recordID, t]));
                    filteredTasks = filteredTasks.map((t) => {
                        if (pendingUpdateIDs.has(t.recordID) && localTaskMap.has(t.recordID)) {
                            return localTaskMap.get(t.recordID)!;
                        }
                        return t;
                    });
                }

                // Merge in any locally-created tasks not present in the server response.
                // This covers both:
                // 1. Tasks with a pending insert still in the queue
                // 2. Tasks whose insert synced but the server response was captured before it arrived
                const currentTasks = get().tasks;
                const serverTaskIDs = new Set(filteredTasks.map((t) => t.recordID));
                const localOnlyTasks = currentTasks.filter(
                    (t) => t.creatorID === currentUserID
                        && !serverTaskIDs.has(t.recordID)
                        && !pendingDeleteIDs.has(t.recordID)
                );
                if (localOnlyTasks.length > 0) {
                    filteredTasks = [...localOnlyTasks, ...filteredTasks];
                }
            } catch {
                // If we can't read the queue, proceed without filtering
            }

            // Cache only non-shared tasks (own tasks not in shared projects)
            const sharedProjectIDs = new Set((projectShares || []).map((p) => p.projectID));
            const nonSharedTasks = (ownTasks || []).filter((task) => {
                // A task is non-shared if it doesn't belong to a shared project
                return !task.projectID || !sharedProjectIDs.has(task.projectID);
            });
            setCachedTasks(nonSharedTasks);

            set({ tasks: filteredTasks, loading: false, error: null });
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch tasks', loading: false });
        }
    },

    createTask: async (title: string, projectID?: string | null) => {
        const validation = validateTaskTitle(title);
        if (!validation.valid) {
            set({ error: validation.error || 'Invalid task title' });
            return null;
        }

        const currentUser = useGlobalStore.getState().currentUser;
        const now = Date.now();
        const recordID = uuidv4();

        const newTask: Task = {
            recordID,
            creatorID: currentUser.recordID,
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

        // Check if this task is in a shared project
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = isTaskSharedLocally(currentUser.recordID, newTask.projectID, currentUser.recordID, sharedProjectIDs);

        // Optimistically update local state
        set((state) => ({ tasks: [newTask, ...state.tasks], error: null }));

        if (shared) {
            // Shared project: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                // Remove the optimistic task
                set((state) => ({ tasks: state.tasks.filter((t) => t.recordID !== recordID) }));
                return null;
            }

            // Write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('tasks')
                    .insert(newTask);

                if (error) {
                    set({ error: error.message });
                    set((state) => ({ tasks: state.tasks.filter((t) => t.recordID !== recordID) }));
                    return null;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to create task' });
                set((state) => ({ tasks: state.tasks.filter((t) => t.recordID !== recordID) }));
                return null;
            }
        } else {
            // Non-shared: cache and use offline support
            const nonSharedTasks = get().tasks.filter((t) => {
                return !isTaskSharedLocally(t.creatorID, t.projectID, currentUser.recordID, sharedProjectIDs);
            });
            setCachedTasks(nonSharedTasks);
            await insertWithOfflineSupport('task', 'tasks', newTask as unknown as Record<string, unknown>);
        }

        return newTask;
    },

    createBlankTask: async (projectID?: string | null) => {
        const currentUser = useGlobalStore.getState().currentUser;
        const now = Date.now();
        const recordID = uuidv4();

        const newTask: Task = {
            recordID,
            creatorID: currentUser.recordID,
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

        // Check if this task is in a shared project
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = isTaskSharedLocally(currentUser.recordID, newTask.projectID, currentUser.recordID, sharedProjectIDs);

        // Optimistically update local state
        set((state) => ({ tasks: [newTask, ...state.tasks], error: null }));

        if (shared) {
            // Shared project: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                set((state) => ({ tasks: state.tasks.filter((t) => t.recordID !== recordID) }));
                return newTask; // createBlankTask always returns a task
            }

            // Write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('tasks')
                    .insert(newTask);

                if (error) {
                    console.error('Failed to insert blank task to server:', error.message);
                }
            } catch (err: any) {
                console.error('Failed to insert blank task:', err.message);
            }
        } else {
            // Non-shared: cache and use offline support
            const nonSharedTasks = get().tasks.filter((t) => {
                return !isTaskSharedLocally(t.creatorID, t.projectID, currentUser.recordID, sharedProjectIDs);
            });
            setCachedTasks(nonSharedTasks);
            await insertWithOfflineSupport('task', 'tasks', newTask as unknown as Record<string, unknown>);
        }

        return newTask;
    },

    updateTask: async (id, fields) => {
        // Validate title if provided
        if (fields.title !== undefined) {
            const validation = validateTaskTitle(fields.title);
            if (!validation.valid) {
                set({ error: validation.error || 'Invalid task title' });
                return false;
            }
            fields.title = fields.title.trim();
        }

        const now = Date.now();
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const payload = { ...fields, updatedAt: now };

        // Find the task to check if it's shared
        const task = get().tasks.find((t) => t.recordID === id);
        if (!task) {
            set({ error: 'Task not found' });
            return false;
        }

        const shared = checkTaskIsShared(task, currentUserID);

        if (shared) {
            // Shared items: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('tasks')
                    .update(payload)
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to update task' });
                return false;
            }
        } else {
            // Non-shared items: use offline support
            await updateWithOfflineSupport('task', 'tasks', id, payload as Record<string, unknown>);
        }

        // Optimistically update local state
        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.recordID === id ? { ...t, ...payload } : t
            ),
            error: null,
        }));

        // Persist to cache only for non-shared items
        if (!shared) {
            setCachedTasks(get().tasks);
        }

        return true;
    },

    completeTask: async (id) => {
        const task = get().tasks.find((t) => t.recordID === id);
        if (!task) {
            set({ error: 'Task not found' });
            return false;
        }

        const now = Date.now();
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const payload = {
            status: 'completed' as const,
            completedAt: now,
            updatedAt: now,
        };

        const shared = checkTaskIsShared(task, currentUserID);

        if (shared) {
            // Shared items: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('tasks')
                    .update(payload)
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to complete task' });
                return false;
            }
        } else {
            // Non-shared items: use offline support
            await updateWithOfflineSupport('task', 'tasks', id, payload as Record<string, unknown>);
        }

        // Optimistically update local state
        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.recordID === id ? { ...t, ...payload } : t
            ),
            error: null,
        }));

        // Persist to cache for non-shared items
        if (!shared) {
            setCachedTasks(get().tasks);
        }

        // If recurring, spawn a new task
        if (task.isRecurring && task.recurrenceInterval && task.recurrenceUnit) {
            const completedTask: Task = { ...task, ...payload };
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

            // Add spawned task to state
            set((state) => ({ tasks: [newTask, ...state.tasks] }));

            if (shared) {
                // Shared: insert directly to server
                try {
                    await ensureSession();
                    const { error } = await supabase
                        .from('tasks')
                        .insert(newTask);

                    if (error) {
                        console.error('Failed to insert recurring task to server:', error.message);
                    }
                } catch (err: any) {
                    console.error('Failed to insert recurring task:', err.message);
                }
            } else {
                setCachedTasks(get().tasks);
                await insertWithOfflineSupport('task', 'tasks', newTask as unknown as Record<string, unknown>);
            }

            // Spawn subtasks for the new task
            if (spawned.subtasks.length > 0) {
                const newSubtasks: Subtask[] = spawned.subtasks.map((st) => ({
                    ...st,
                    recordID: uuidv4(),
                    taskID: newRecordID,
                    createdAt: spawnedNow,
                    updatedAt: spawnedNow,
                }));

                // Add subtasks to state
                set((state) => ({
                    subtasks: {
                        ...state.subtasks,
                        [newRecordID]: newSubtasks,
                    },
                }));

                if (shared) {
                    // Shared: insert subtasks directly to server
                    try {
                        for (const subtask of newSubtasks) {
                            const { error } = await supabase
                                .from('task_subtasks')
                                .insert(subtask);
                            if (error) {
                                console.error('Failed to insert subtask to server:', error.message);
                            }
                        }
                    } catch (err: any) {
                        console.error('Failed to insert subtasks:', err.message);
                    }
                } else {
                    // Cache subtasks
                    setCachedSubtasks(get().subtasks);

                    // Enqueue each subtask insert
                    for (const subtask of newSubtasks) {
                        await insertWithOfflineSupport('subtask', 'task_subtasks', subtask as unknown as Record<string, unknown>);
                    }
                }
            }
        }

        return true;
    },

    reopenTask: async (id) => {
        const task = get().tasks.find((t) => t.recordID === id);
        if (!task) {
            set({ error: 'Task not found' });
            return false;
        }

        const now = Date.now();
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const payload = {
            status: 'open' as const,
            completedAt: null,
            updatedAt: now,
        };

        const shared = checkTaskIsShared(task, currentUserID);

        if (shared) {
            // Shared items: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('tasks')
                    .update(payload)
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to reopen task' });
                return false;
            }
        } else {
            // Non-shared items: use offline support
            await updateWithOfflineSupport('task', 'tasks', id, payload as Record<string, unknown>);
        }

        // Optimistically update local state
        set((state) => ({
            tasks: state.tasks.map((t) =>
                t.recordID === id ? { ...t, ...payload } : t
            ),
            error: null,
        }));

        // Persist to cache for non-shared items
        if (!shared) {
            setCachedTasks(get().tasks);
        }

        return true;
    },

    deleteTask: async (id) => {
        const task = get().tasks.find((t) => t.recordID === id);
        if (!task) {
            set({ error: 'Task not found' });
            return false;
        }

        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const shared = checkTaskIsShared(task, currentUserID);

        if (shared) {
            // Shared items: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Delete directly from server
            try {
                await ensureSession();

                // Delete subtasks first
                const { error: subtaskError } = await supabase
                    .from('task_subtasks')
                    .delete()
                    .eq('taskID', id);

                if (subtaskError) {
                    set({ error: subtaskError.message });
                    return false;
                }

                const { error } = await supabase
                    .from('tasks')
                    .delete()
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to delete task' });
                return false;
            }
        }

        // Optimistically remove from state immediately
        set((state) => ({
            tasks: state.tasks.filter((t) => t.recordID !== id),
            subtasks: (() => {
                const copy = { ...state.subtasks };
                delete copy[id];
                return copy;
            })(),
            error: null,
        }));

        // Persist to cache for non-shared items
        if (!shared) {
            setCachedTasks(get().tasks);
            setCachedSubtasks(get().subtasks);

            // Queue the delete for server sync (fire-and-forget, state already updated)
            deleteWithOfflineSupport('task', 'tasks', id);
        }

        return true;
    },

    fetchSubtasks: async (taskID) => {
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const task = get().tasks.find((t) => t.recordID === taskID);
        const shared = task ? checkTaskIsShared(task, currentUserID) : false;

        // Load from cache first for non-shared items
        if (!shared) {
            const cached = getCachedSubtasks();
            if (cached[taskID]) {
                set((state) => ({
                    subtasks: { ...state.subtasks, [taskID]: cached[taskID] },
                }));
            }
        }

        try {
            await ensureSession();
            const { data, error } = await supabase
                .from('task_subtasks')
                .select('*')
                .eq('taskID', taskID)
                .order('createdAt', { ascending: true });

            if (error) {
                set({ error: error.message });
                return;
            }

            const subtasks = (data || []) as Subtask[];
            set((state) => ({
                subtasks: { ...state.subtasks, [taskID]: subtasks },
            }));

            // Update cache only for non-shared items
            if (!shared) {
                const allSubtasks = get().subtasks;
                setCachedSubtasks(allSubtasks);
            }
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch subtasks' });
        }
    },

    addSubtask: async (taskID, title) => {
        // Skip validation for empty titles (inline creation flow — user types afterward)
        if (title.trim().length > 0) {
            const validation = validateSubtaskTitle(title);
            if (!validation.valid) {
                set({ error: validation.error || 'Invalid subtask title' });
                return null;
            }
        }

        // Enforce max 50 subtasks per task
        const existing = get().subtasks[taskID] || [];
        if (existing.length >= 50) {
            set({ error: 'Maximum of 50 subtasks per task reached' });
            return null;
        }

        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const task = get().tasks.find((t) => t.recordID === taskID);
        const shared = task ? checkTaskIsShared(task, currentUserID) : false;

        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return null;
        }

        const now = Date.now();
        const recordID = uuidv4();

        const newSubtask: Subtask = {
            recordID,
            taskID,
            title: title.trim(),
            isCompleted: false,
            createdAt: now,
            updatedAt: now,
        };

        // Optimistically update local state
        set((state) => ({
            subtasks: {
                ...state.subtasks,
                [taskID]: [...(state.subtasks[taskID] || []), newSubtask],
            },
            error: null,
        }));

        if (shared) {
            // Shared: insert directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('task_subtasks')
                    .insert(newSubtask);

                if (error) {
                    // Rollback optimistic update
                    set((state) => ({
                        subtasks: {
                            ...state.subtasks,
                            [taskID]: (state.subtasks[taskID] || []).filter((s) => s.recordID !== recordID),
                        },
                        error: error.message,
                    }));
                    return null;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to add subtask' });
                return null;
            }
        } else {
            // Non-shared: persist to cache and use offline support
            setCachedSubtasks(get().subtasks);
            await insertWithOfflineSupport('subtask', 'task_subtasks', newSubtask as unknown as Record<string, unknown>);
        }

        return newSubtask;
    },

    toggleSubtask: async (subtaskID) => {
        const now = Date.now();
        let foundTaskID: string | null = null;
        let newIsCompleted: boolean | null = null;

        // Find the subtask and its parent task
        const allSubtasks = get().subtasks;
        for (const taskID of Object.keys(allSubtasks)) {
            const subtasks = allSubtasks[taskID];
            const idx = subtasks.findIndex((s) => s.recordID === subtaskID);
            if (idx !== -1) {
                foundTaskID = taskID;
                newIsCompleted = !subtasks[idx].isCompleted;
                break;
            }
        }

        if (foundTaskID === null || newIsCompleted === null) {
            set({ error: 'Subtask not found' });
            return false;
        }

        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const task = get().tasks.find((t) => t.recordID === foundTaskID);
        const shared = task ? checkTaskIsShared(task, currentUserID) : false;

        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        // Optimistically update local state
        set((state) => {
            const updatedSubtasks = { ...state.subtasks };
            if (foundTaskID && updatedSubtasks[foundTaskID]) {
                updatedSubtasks[foundTaskID] = updatedSubtasks[foundTaskID].map((s) =>
                    s.recordID === subtaskID
                        ? { ...s, isCompleted: newIsCompleted!, updatedAt: now }
                        : s
                );
            }
            return { subtasks: updatedSubtasks, error: null };
        });

        if (shared) {
            // Shared: write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('task_subtasks')
                    .update({ isCompleted: newIsCompleted, updatedAt: now })
                    .eq('recordID', subtaskID);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to toggle subtask' });
                return false;
            }
        } else {
            // Non-shared: persist to cache and use offline support
            setCachedSubtasks(get().subtasks);
            await updateWithOfflineSupport('subtask', 'task_subtasks', subtaskID, {
                isCompleted: newIsCompleted,
                updatedAt: now,
            });
        }

        return true;
    },

    updateSubtaskTitle: async (subtaskID, title) => {
        const validation = validateSubtaskTitle(title);
        if (!validation.valid) {
            set({ error: validation.error || 'Invalid subtask title' });
            return false;
        }

        const now = Date.now();
        let foundTaskID: string | null = null;

        // Find the subtask and its parent task
        const allSubtasks = get().subtasks;
        for (const taskID of Object.keys(allSubtasks)) {
            const subtasks = allSubtasks[taskID];
            if (subtasks.some((s) => s.recordID === subtaskID)) {
                foundTaskID = taskID;
                break;
            }
        }

        if (foundTaskID === null) {
            set({ error: 'Subtask not found' });
            return false;
        }

        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const task = get().tasks.find((t) => t.recordID === foundTaskID);
        const shared = task ? checkTaskIsShared(task, currentUserID) : false;

        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        // Optimistically update local state
        set((state) => {
            const updatedSubtasks = { ...state.subtasks };
            if (foundTaskID && updatedSubtasks[foundTaskID]) {
                updatedSubtasks[foundTaskID] = updatedSubtasks[foundTaskID].map((s) =>
                    s.recordID === subtaskID
                        ? { ...s, title, updatedAt: now }
                        : s
                );
            }
            return { subtasks: updatedSubtasks, error: null };
        });

        if (shared) {
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('task_subtasks')
                    .update({ title, updatedAt: now })
                    .eq('recordID', subtaskID);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to update subtask' });
                return false;
            }
        } else {
            setCachedSubtasks(get().subtasks);
            await updateWithOfflineSupport('subtask', 'task_subtasks', subtaskID, {
                title,
                updatedAt: now,
            });
        }

        return true;
    },

    deleteSubtask: async (subtaskID) => {
        // Find the parent task for this subtask
        let foundTaskID: string | null = null;
        const allSubtasks = get().subtasks;
        for (const taskID of Object.keys(allSubtasks)) {
            const subtasks = allSubtasks[taskID];
            if (subtasks.some((s) => s.recordID === subtaskID)) {
                foundTaskID = taskID;
                break;
            }
        }

        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const task = foundTaskID ? get().tasks.find((t) => t.recordID === foundTaskID) : null;
        const shared = task ? checkTaskIsShared(task, currentUserID) : false;

        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        if (shared) {
            // Shared: delete directly from server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('task_subtasks')
                    .delete()
                    .eq('recordID', subtaskID);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to delete subtask' });
                return false;
            }
        } else {
            // Non-shared: use offline support
            await deleteWithOfflineSupport('subtask', 'task_subtasks', subtaskID);
        }

        // Remove from state
        set((state) => {
            const updatedSubtasks = { ...state.subtasks };
            for (const taskID of Object.keys(updatedSubtasks)) {
                const subtasks = updatedSubtasks[taskID];
                const idx = subtasks.findIndex((s) => s.recordID === subtaskID);
                if (idx !== -1) {
                    updatedSubtasks[taskID] = subtasks.filter((s) => s.recordID !== subtaskID);
                    break;
                }
            }
            return { subtasks: updatedSubtasks, error: null };
        });

        // Persist to cache for non-shared items
        if (!shared) {
            setCachedSubtasks(get().subtasks);
        }

        return true;
    },
}));
