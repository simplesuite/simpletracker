import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { spawnRecurringTask } from '../recurrence';
import type { Task, Subtask } from '../../types';

/**
 * Feature: simpletracker-notes-tasks, Property 10: Recurring Task Field Copying
 *
 * For any completed recurring task with arbitrary title, body, projectID,
 * recurrence settings, and subtask titles, the spawned task SHALL have:
 * - status="open"
 * - completedAt=null
 * - identical values for title, body, projectID, isRecurring, recurrenceInterval, recurrenceUnit, recurrenceAnchor
 * - the same set of subtask titles (each with isCompleted=false)
 *
 * **Validates: Requirements 10.5**
 */
describe('Property 10: Recurring Task Field Copying', () => {
    // Arbitraries
    const titleArb = fc.string({ minLength: 1, maxLength: 255 });
    const bodyArb = fc.string({ minLength: 0, maxLength: 1000 });
    const projectIDArb = fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null });
    const intervalArb = fc.integer({ min: 1, max: 365 });
    const unitArb = fc.constantFrom<'days' | 'weeks' | 'months'>('days', 'weeks', 'months');
    const anchorArb = fc.constantFrom<'due_date' | 'completed_date'>('due_date', 'completed_date');
    const timestampArb = fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 });

    const subtaskArb = fc.array(
        fc.record({
            recordID: fc.string({ minLength: 1, maxLength: 36 }),
            taskID: fc.constant('task-parent'),
            title: fc.string({ minLength: 1, maxLength: 255 }),
            isCompleted: fc.boolean(),
            createdAt: timestampArb,
            updatedAt: timestampArb,
        }),
        { minLength: 0, maxLength: 10 }
    );

    const completedTaskArb = fc.record({
        title: titleArb,
        body: bodyArb,
        projectID: projectIDArb,
        recurrenceInterval: intervalArb,
        recurrenceUnit: unitArb,
        recurrenceAnchor: anchorArb,
        completedAt: timestampArb,
        dueDate: fc.option(timestampArb, { nil: null }),
        creatorID: fc.string({ minLength: 1, maxLength: 36 }),
    });

    it('spawned task has status="open" and completedAt=null', () => {
        fc.assert(
            fc.property(completedTaskArb, subtaskArb, (taskFields, subtasks) => {
                const completedTask: Task = {
                    recordID: 'task-123',
                    creatorID: taskFields.creatorID,
                    projectID: taskFields.projectID,
                    title: taskFields.title,
                    body: taskFields.body,
                    status: 'completed',
                    dueDate: taskFields.dueDate,
                    isRecurring: true,
                    recurrenceInterval: taskFields.recurrenceInterval,
                    recurrenceUnit: taskFields.recurrenceUnit,
                    recurrenceAnchor: taskFields.recurrenceAnchor,
                    completedAt: taskFields.completedAt,
                    createdAt: taskFields.completedAt - 100000,
                    updatedAt: taskFields.completedAt,
                };

                const result = spawnRecurringTask(completedTask, subtasks);

                expect(result.task.status).toBe('open');
                expect(result.task.completedAt).toBeNull();
            }),
            { numRuns: 100 }
        );
    });

    it('spawned task copies title, body, and projectID identically', () => {
        fc.assert(
            fc.property(completedTaskArb, subtaskArb, (taskFields, subtasks) => {
                const completedTask: Task = {
                    recordID: 'task-123',
                    creatorID: taskFields.creatorID,
                    projectID: taskFields.projectID,
                    title: taskFields.title,
                    body: taskFields.body,
                    status: 'completed',
                    dueDate: taskFields.dueDate,
                    isRecurring: true,
                    recurrenceInterval: taskFields.recurrenceInterval,
                    recurrenceUnit: taskFields.recurrenceUnit,
                    recurrenceAnchor: taskFields.recurrenceAnchor,
                    completedAt: taskFields.completedAt,
                    createdAt: taskFields.completedAt - 100000,
                    updatedAt: taskFields.completedAt,
                };

                const result = spawnRecurringTask(completedTask, subtasks);

                expect(result.task.title).toBe(completedTask.title);
                expect(result.task.body).toBe(completedTask.body);
                expect(result.task.projectID).toBe(completedTask.projectID);
            }),
            { numRuns: 100 }
        );
    });

    it('spawned task copies recurrence settings identically (isRecurring, recurrenceInterval, recurrenceUnit, recurrenceAnchor)', () => {
        fc.assert(
            fc.property(completedTaskArb, subtaskArb, (taskFields, subtasks) => {
                const completedTask: Task = {
                    recordID: 'task-123',
                    creatorID: taskFields.creatorID,
                    projectID: taskFields.projectID,
                    title: taskFields.title,
                    body: taskFields.body,
                    status: 'completed',
                    dueDate: taskFields.dueDate,
                    isRecurring: true,
                    recurrenceInterval: taskFields.recurrenceInterval,
                    recurrenceUnit: taskFields.recurrenceUnit,
                    recurrenceAnchor: taskFields.recurrenceAnchor,
                    completedAt: taskFields.completedAt,
                    createdAt: taskFields.completedAt - 100000,
                    updatedAt: taskFields.completedAt,
                };

                const result = spawnRecurringTask(completedTask, subtasks);

                expect(result.task.isRecurring).toBe(completedTask.isRecurring);
                expect(result.task.recurrenceInterval).toBe(completedTask.recurrenceInterval);
                expect(result.task.recurrenceUnit).toBe(completedTask.recurrenceUnit);
                expect(result.task.recurrenceAnchor).toBe(completedTask.recurrenceAnchor);
            }),
            { numRuns: 100 }
        );
    });

    it('spawned task has the same set of subtask titles, each with isCompleted=false', () => {
        fc.assert(
            fc.property(completedTaskArb, subtaskArb, (taskFields, subtasks) => {
                const completedTask: Task = {
                    recordID: 'task-123',
                    creatorID: taskFields.creatorID,
                    projectID: taskFields.projectID,
                    title: taskFields.title,
                    body: taskFields.body,
                    status: 'completed',
                    dueDate: taskFields.dueDate,
                    isRecurring: true,
                    recurrenceInterval: taskFields.recurrenceInterval,
                    recurrenceUnit: taskFields.recurrenceUnit,
                    recurrenceAnchor: taskFields.recurrenceAnchor,
                    completedAt: taskFields.completedAt,
                    createdAt: taskFields.completedAt - 100000,
                    updatedAt: taskFields.completedAt,
                };

                const result = spawnRecurringTask(completedTask, subtasks);

                // Same number of subtasks
                expect(result.subtasks).toHaveLength(subtasks.length);

                // Each subtask title matches and isCompleted is false
                for (let i = 0; i < subtasks.length; i++) {
                    expect(result.subtasks[i].title).toBe(subtasks[i].title);
                    expect(result.subtasks[i].isCompleted).toBe(false);
                }
            }),
            { numRuns: 100 }
        );
    });
});
