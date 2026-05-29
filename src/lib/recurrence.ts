import dayjs from 'dayjs';
import type { Task, Subtask } from '../types';

/**
 * Calculates the next due date for a recurring task based on the recurrence anchor.
 *
 * Rules:
 * - If anchor is "due_date" and originalDueDate is set: add duration to originalDueDate
 * - If anchor is "due_date" and originalDueDate is null: add duration to completedAt (fallback)
 * - If anchor is "completed_date": add duration to completedAt
 */
export function calculateNextDueDate(
    anchor: 'due_date' | 'completed_date',
    originalDueDate: number | null,
    completedAt: number,
    interval: number,
    unit: 'days' | 'weeks' | 'months'
): number {
    let baseDate: number;

    if (anchor === 'due_date' && originalDueDate !== null) {
        baseDate = originalDueDate;
    } else {
        // anchor is "completed_date", or anchor is "due_date" but dueDate is null (fallback)
        baseDate = completedAt;
    }

    return dayjs(baseDate).add(interval, unit).valueOf();
}

/**
 * Spawns a new recurring task from a completed task.
 *
 * The new task:
 * - Has status="open" and completedAt=null
 * - Copies title, body, projectID, and all recurrence settings from the completed task
 * - Gets a new dueDate calculated via calculateNextDueDate
 * - Copies subtask titles with isCompleted=false
 */
export function spawnRecurringTask(
    completedTask: Task,
    subtasks: Subtask[]
): {
    task: Omit<Task, 'recordID' | 'createdAt' | 'updatedAt'>;
    subtasks: Omit<Subtask, 'recordID' | 'taskID' | 'createdAt' | 'updatedAt'>[];
} {
    const nextDueDate = calculateNextDueDate(
        completedTask.recurrenceAnchor,
        completedTask.dueDate,
        completedTask.completedAt!,
        completedTask.recurrenceInterval!,
        completedTask.recurrenceUnit!
    );

    const newTask: Omit<Task, 'recordID' | 'createdAt' | 'updatedAt'> = {
        creatorID: completedTask.creatorID,
        projectID: completedTask.projectID,
        title: completedTask.title,
        body: completedTask.body,
        status: 'open',
        dueDate: nextDueDate,
        isRecurring: completedTask.isRecurring,
        recurrenceInterval: completedTask.recurrenceInterval,
        recurrenceUnit: completedTask.recurrenceUnit,
        recurrenceAnchor: completedTask.recurrenceAnchor,
        completedAt: null,
    };

    const newSubtasks: Omit<Subtask, 'recordID' | 'taskID' | 'createdAt' | 'updatedAt'>[] =
        subtasks.map((subtask) => ({
            title: subtask.title,
            isCompleted: false,
        }));

    return { task: newTask, subtasks: newSubtasks };
}
