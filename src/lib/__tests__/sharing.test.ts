import { describe, it, expect } from 'vitest';
import { isSharedItem } from '../sharing';
import type { Note, Task, NoteShared, ProjectShared } from '../../types/index';

const now = Date.now();

function makeNote(overrides: Partial<Note> = {}): Note {
    return {
        recordID: 'note-1',
        creatorID: 'user-1',
        title: 'Test Note',
        body: '',
        createdAt: now,
        updatedAt: now,
        projectID: null,
        archived: false,
        pinned: false,
        ...overrides,
    };
}

function makeTask(overrides: Partial<Task> = {}): Task {
    return {
        recordID: 'task-1',
        creatorID: 'user-1',
        projectID: null,
        title: 'Test Task',
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
        ...overrides,
    };
}

describe('isSharedItem', () => {
    it('returns false for an item owned by the current user with no shares', () => {
        const note = makeNote();
        expect(isSharedItem(note, 'user-1', [], [])).toBe(false);
    });

    it('returns true when creatorID differs from currentUserID', () => {
        const note = makeNote({ creatorID: 'other-user' });
        expect(isSharedItem(note, 'user-1', [], [])).toBe(true);
    });

    it('returns true when a note has a direct share record', () => {
        const note = makeNote();
        const noteShares: NoteShared[] = [
            { recordID: 'share-1', noteID: 'note-1', creatorID: 'user-1', sharedToID: 'user-2' },
        ];
        expect(isSharedItem(note, 'user-1', noteShares, [])).toBe(true);
    });

    it('returns false when noteShares exist but for a different note', () => {
        const note = makeNote();
        const noteShares: NoteShared[] = [
            { recordID: 'share-1', noteID: 'note-other', creatorID: 'user-1', sharedToID: 'user-2' },
        ];
        expect(isSharedItem(note, 'user-1', noteShares, [])).toBe(false);
    });

    it('returns true when item belongs to a project with shares', () => {
        const note = makeNote({ projectID: 'proj-1' });
        const projectShares: ProjectShared[] = [
            { recordID: 'ps-1', projectID: 'proj-1', creatorID: 'user-1', sharedToID: 'user-2', createdAt: now },
        ];
        expect(isSharedItem(note, 'user-1', [], projectShares)).toBe(true);
    });

    it('returns false when item belongs to a project without shares', () => {
        const note = makeNote({ projectID: 'proj-1' });
        const projectShares: ProjectShared[] = [
            { recordID: 'ps-1', projectID: 'proj-other', creatorID: 'user-1', sharedToID: 'user-2', createdAt: now },
        ];
        expect(isSharedItem(note, 'user-1', [], projectShares)).toBe(false);
    });

    it('returns true for a task in a shared project', () => {
        const task = makeTask({ projectID: 'proj-1' });
        const projectShares: ProjectShared[] = [
            { recordID: 'ps-1', projectID: 'proj-1', creatorID: 'user-1', sharedToID: 'user-2', createdAt: now },
        ];
        expect(isSharedItem(task, 'user-1', [], projectShares)).toBe(true);
    });

    it('returns false for a task not in any shared project', () => {
        const task = makeTask();
        expect(isSharedItem(task, 'user-1', [], [])).toBe(false);
    });

    it('does not check noteShares for tasks (tasks use project shares)', () => {
        const task = makeTask();
        const noteShares: NoteShared[] = [
            { recordID: 'share-1', noteID: 'task-1', creatorID: 'user-1', sharedToID: 'user-2' },
        ];
        // A task with the same recordID as a noteShare's noteID should not match
        expect(isSharedItem(task, 'user-1', noteShares, [])).toBe(false);
    });
});
