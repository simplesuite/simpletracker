import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';
import { calculateNextDueDate, spawnRecurringTask } from '../recurrence';
import type { Task, Subtask } from '../../types';

describe('calculateNextDueDate', () => {
    const baseTimestamp = dayjs('2024-01-15T12:00:00.000Z').valueOf();
    const completedTimestamp = dayjs('2024-01-20T10:00:00.000Z').valueOf();

    it('adds interval to originalDueDate when anchor is "due_date" and dueDate is set', () => {
        const result = calculateNextDueDate('due_date', baseTimestamp, completedTimestamp, 7, 'days');
        const expected = dayjs(baseTimestamp).add(7, 'days').valueOf();
        expect(result).toBe(expected);
    });

    it('falls back to completedAt when anchor is "due_date" but dueDate is null', () => {
        const result = calculateNextDueDate('due_date', null, completedTimestamp, 7, 'days');
        const expected = dayjs(completedTimestamp).add(7, 'days').valueOf();
        expect(result).toBe(expected);
    });

    it('uses completedAt when anchor is "completed_date"', () => {
        const result = calculateNextDueDate('completed_date', baseTimestamp, completedTimestamp, 7, 'days');
        const expected = dayjs(completedTimestamp).add(7, 'days').valueOf();
        expect(result).toBe(expected);
    });

    it('handles weeks unit correctly', () => {
        const result = calculateNextDueDate('due_date', baseTimestamp, completedTimestamp, 2, 'weeks');
        const expected = dayjs(baseTimestamp).add(2, 'weeks').valueOf();
        expect(result).toBe(expected);
    });

    it('handles months unit correctly', () => {
        const result = calculateNextDueDate('due_date', baseTimestamp, completedTimestamp, 1, 'months');
        const expected = dayjs(baseTimestamp).add(1, 'months').valueOf();
        expect(result).toBe(expected);
    });

    it('handles large intervals', () => {
        const result = calculateNextDueDate('completed_date', null, completedTimestamp, 365, 'days');
        const expected = dayjs(completedTimestamp).add(365, 'days').valueOf();
        expect(result).toBe(expected);
    });
});

describe('spawnRecurringTask', () => {
    const now = Date.now();

    const completedTask: Task = {
        recordID: 'task-123',
        creatorID: 'user-456',
        projectID: 'project-789',
        title: 'Weekly Review',
        body: 'Review all open items',
        status: 'completed',
        dueDate: dayjs('2024-01-15').valueOf(),
        isRecurring: true,
        recurrenceInterval: 1,
        recurrenceUnit: 'weeks',
        recurrenceAnchor: 'due_date',
        completedAt: now,
        createdAt: now - 100000,
        updatedAt: now,
    };

    const subtasks: Subtask[] = [
        {
            recordID: 'sub-1',
            taskID: 'task-123',
            title: 'Check emails',
            isCompleted: true,
            createdAt: now - 50000,
            updatedAt: now - 10000,
        },
        {
            recordID: 'sub-2',
            taskID: 'task-123',
            title: 'Update tracker',
            isCompleted: false,
            createdAt: now - 40000,
            updatedAt: now - 40000,
        },
    ];

    it('creates a new task with status "open" and completedAt null', () => {
        const result = spawnRecurringTask(completedTask, subtasks);
        expect(result.task.status).toBe('open');
        expect(result.task.completedAt).toBeNull();
    });

    it('copies title, body, and projectID from the completed task', () => {
        const result = spawnRecurringTask(completedTask, subtasks);
        expect(result.task.title).toBe(completedTask.title);
        expect(result.task.body).toBe(completedTask.body);
        expect(result.task.projectID).toBe(completedTask.projectID);
    });

    it('copies recurrence settings from the completed task', () => {
        const result = spawnRecurringTask(completedTask, subtasks);
        expect(result.task.isRecurring).toBe(completedTask.isRecurring);
        expect(result.task.recurrenceInterval).toBe(completedTask.recurrenceInterval);
        expect(result.task.recurrenceUnit).toBe(completedTask.recurrenceUnit);
        expect(result.task.recurrenceAnchor).toBe(completedTask.recurrenceAnchor);
    });

    it('calculates the correct next due date based on anchor', () => {
        const result = spawnRecurringTask(completedTask, subtasks);
        const expectedDueDate = dayjs(completedTask.dueDate!).add(1, 'weeks').valueOf();
        expect(result.task.dueDate).toBe(expectedDueDate);
    });

    it('copies subtask titles with isCompleted set to false', () => {
        const result = spawnRecurringTask(completedTask, subtasks);
        expect(result.subtasks).toHaveLength(2);
        expect(result.subtasks[0].title).toBe('Check emails');
        expect(result.subtasks[0].isCompleted).toBe(false);
        expect(result.subtasks[1].title).toBe('Update tracker');
        expect(result.subtasks[1].isCompleted).toBe(false);
    });

    it('handles empty subtasks array', () => {
        const result = spawnRecurringTask(completedTask, []);
        expect(result.subtasks).toHaveLength(0);
    });

    it('uses completedAt as fallback when anchor is "due_date" but dueDate is null', () => {
        const taskNoDueDate: Task = {
            ...completedTask,
            dueDate: null,
        };
        const result = spawnRecurringTask(taskNoDueDate, subtasks);
        const expectedDueDate = dayjs(taskNoDueDate.completedAt!).add(1, 'weeks').valueOf();
        expect(result.task.dueDate).toBe(expectedDueDate);
    });

    it('copies creatorID from the completed task', () => {
        const result = spawnRecurringTask(completedTask, subtasks);
        expect(result.task.creatorID).toBe(completedTask.creatorID);
    });
});
