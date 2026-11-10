import { describe, it, expect } from 'vitest';
// @ts-expect-error plain ESM script without type declarations
import { findDuplicateRecurringTasks } from '../../../scripts/dedupe-recurring-tasks.mjs';

const ME = 'user-1';

function task(overrides: Record<string, unknown>) {
    return {
        recordID: 'r',
        creatorID: ME,
        projectID: null,
        title: 'Water plants',
        body: '',
        status: 'open',
        dueDate: 1_700_000_000_000,
        isRecurring: true,
        recurrenceInterval: 1,
        recurrenceUnit: 'weeks',
        recurrenceAnchor: 'due_date',
        completedAt: null,
        createdAt: 1000,
        updatedAt: 1000,
        ...overrides,
    };
}

describe('findDuplicateRecurringTasks', () => {
    it('groups identical open occurrences and keeps the most recently edited', () => {
        const groups = findDuplicateRecurringTasks(
            [task({ recordID: 'a', updatedAt: 1000 }), task({ recordID: 'b', updatedAt: 5000 }), task({ recordID: 'c', updatedAt: 2000 })],
            ME
        );
        expect(groups).toHaveLength(1);
        expect(groups[0].keep.recordID).toBe('b');
        expect(groups[0].remove.map((t: { recordID: string }) => t.recordID)).toEqual(['c', 'a']);
        expect(groups[0].bodiesDiffer).toBe(false);
    });

    it('still matches copies with edited bodies, and flags them', () => {
        const groups = findDuplicateRecurringTasks([task({ recordID: 'a' }), task({ recordID: 'b', body: 'edited', updatedAt: 9 })], ME);
        expect(groups).toHaveLength(1);
        expect(groups[0].bodiesDiffer).toBe(true);
    });

    it('does not group different due dates, titles, projects or recurrence', () => {
        const groups = findDuplicateRecurringTasks(
            [
                task({ recordID: 'a' }),
                task({ recordID: 'b', dueDate: 1_800_000_000_000 }),
                task({ recordID: 'c', title: 'Feed cat' }),
                task({ recordID: 'd', projectID: 'p1' }),
                task({ recordID: 'e', recurrenceUnit: 'days' }),
            ],
            ME
        );
        expect(groups).toHaveLength(0);
    });

    it('ignores completed, non-recurring and other users\' tasks', () => {
        const groups = findDuplicateRecurringTasks(
            [
                task({ recordID: 'a' }),
                task({ recordID: 'b', status: 'completed' }),
                task({ recordID: 'c', isRecurring: false }),
                task({ recordID: 'd', creatorID: 'someone-else' }),
            ],
            ME
        );
        expect(groups).toHaveLength(0);
    });
});
