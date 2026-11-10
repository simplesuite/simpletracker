import dayjs from 'dayjs';
import { v5 as uuidv5 } from 'uuid';
import type { Task, Subtask } from '../types';

/**
 * Fixed namespace for deriving recurring-occurrence recordIDs. Deterministic
 * UUIDs let two offline clients that each complete the SAME parent task
 * independently compute the IDENTICAL child recordID, so the Supabase upsert
 * collapses them into one row instead of creating a duplicate per device.
 * Never change this value — doing so would make already-synced clients disagree
 * on the id of an occurrence they both still have queued.
 */
const RECURRENCE_NAMESPACE = 'b4e8a6d2-7c3f-4a1b-9e5d-2f6c8a0b1d3e';

/**
 * Deterministic recordID for the occurrence spawned when `parentRecordID` is
 * completed. One completion of a given parent always yields the same child id,
 * which is what makes cross-device completion idempotent. (A parent is marked
 * completed exactly once — the store's status guard enforces that — so one
 * parent maps to exactly one spawned occurrence id.)
 */
export function recurringChildRecordID(parentRecordID: string): string {
    return uuidv5(`task:${parentRecordID}`, RECURRENCE_NAMESPACE);
}

/**
 * Deterministic recordID for a copied subtask on a spawned occurrence, keyed off
 * the child task id and the subtask's position so both devices agree.
 */
export function recurringChildSubtaskRecordID(childRecordID: string, index: number): string {
    return uuidv5(`subtask:${childRecordID}:${index}`, RECURRENCE_NAMESPACE);
}

/**
 * Human-readable confirmation message for a spawned recurring occurrence, shared
 * by web and mobile so both read identically, e.g.
 *   "Next occurrence scheduled for Jan 22, 2024".
 * When the occurrence has no due date (anchor fallback produced none) it still
 * confirms creation without a date.
 */
export function recurringSpawnConfirmation(dueDate: number | null): string {
    if (dueDate == null) return 'Next occurrence created';
    const label = dayjs(dueDate).format('MMM D, YYYY');
    return `Next occurrence scheduled for ${label}`;
}

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
    unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months'
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
 * - Carries DETERMINISTIC recordIDs (derived from the parent) so two clients
 *   that each complete the same parent spawn ONE shared occurrence, not a
 *   duplicate per device. Callers MUST use these ids rather than minting fresh
 *   uuids.
 */
export function spawnRecurringTask(
    completedTask: Task,
    subtasks: Subtask[]
): {
    task: Omit<Task, 'createdAt' | 'updatedAt'>;
    subtasks: Omit<Subtask, 'createdAt' | 'updatedAt'>[];
} {
    const nextDueDate = calculateNextDueDate(
        completedTask.recurrenceAnchor,
        completedTask.dueDate,
        completedTask.completedAt!,
        completedTask.recurrenceInterval!,
        completedTask.recurrenceUnit!
    );

    const childRecordID = recurringChildRecordID(completedTask.recordID);

    const newTask: Omit<Task, 'createdAt' | 'updatedAt'> = {
        recordID: childRecordID,
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

    const newSubtasks: Omit<Subtask, 'createdAt' | 'updatedAt'>[] =
        subtasks.map((subtask, index) => ({
            recordID: recurringChildSubtaskRecordID(childRecordID, index),
            taskID: childRecordID,
            title: subtask.title,
            isCompleted: false,
        }));

    return { task: newTask, subtasks: newSubtasks };
}
