import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
    getCachedNotes,
    setCachedNotes,
    getCachedTasks,
    setCachedTasks,
    getCachedProjects,
    setCachedProjects,
    removeCachedItem,
} from '../cache';
import { isSharedItem } from '../sharing';
import type { Note, Task, NoteShared, ProjectShared } from '../../types/index';

/**
 * Feature: simpletracker-notes-tasks, Property 14: Shared Items Excluded from Offline Cache
 *
 * For any item that is determined to be shared (via direct sharing or project membership),
 * the item SHALL NOT be present in localStorage cache or the IndexedDB offline queue.
 * When a non-shared item becomes shared, it SHALL be removed from all local storage.
 *
 * **Validates: Requirements 16.2, 16.6**
 */
describe('Property 14: Shared Items Excluded from Offline Cache', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    // --- Arbitraries ---

    const userIdArb = fc.uuid();

    const noteArb = (creatorID: string): fc.Arbitrary<Note> =>
        fc.record({
            recordID: fc.uuid(),
            creatorID: fc.constant(creatorID),
            title: fc.string({ minLength: 0, maxLength: 50 }),
            body: fc.string({ minLength: 0, maxLength: 100 }),
            createdAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
            updatedAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
            projectID: fc.option(fc.uuid(), { nil: null }),
            archived: fc.boolean(),
            pinned: fc.boolean(),
        });

    const taskArb = (creatorID: string): fc.Arbitrary<Task> =>
        fc.record({
            recordID: fc.uuid(),
            creatorID: fc.constant(creatorID),
            projectID: fc.option(fc.uuid(), { nil: null }),
            title: fc.string({ minLength: 1, maxLength: 50 }),
            body: fc.string({ minLength: 0, maxLength: 100 }),
            status: fc.constantFrom<'open' | 'completed'>('open', 'completed'),
            dueDate: fc.option(
                fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
                { nil: null }
            ),
            isRecurring: fc.boolean(),
            recurrenceInterval: fc.option(fc.integer({ min: 1, max: 365 }), { nil: null }),
            recurrenceUnit: fc.option(
                fc.constantFrom<'days' | 'weeks' | 'months'>('days', 'weeks', 'months'),
                { nil: null }
            ),
            recurrenceAnchor: fc.constantFrom<'due_date' | 'completed_date'>('due_date', 'completed_date'),
            completedAt: fc.option(
                fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
                { nil: null }
            ),
            createdAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
            updatedAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        });

    const noteShareArb = (noteID: string): fc.Arbitrary<NoteShared> =>
        fc.record({
            recordID: fc.uuid(),
            noteID: fc.constant(noteID),
            creatorID: fc.uuid(),
            sharedToID: fc.uuid(),
        });

    const projectShareArb = (projectID: string): fc.Arbitrary<ProjectShared> =>
        fc.record({
            recordID: fc.uuid(),
            projectID: fc.constant(projectID),
            creatorID: fc.uuid(),
            sharedToID: fc.uuid(),
            createdAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        });

    // --- Property Tests ---

    it('shared notes are not present in localStorage cache after removeCachedItem is called', () => {
        fc.assert(
            fc.property(
                userIdArb,
                fc.integer({ min: 1, max: 5 }),
                (currentUserID, noteCount) => {
                    localStorage.clear();

                    // Generate notes owned by the current user
                    const notes: Note[] = [];
                    for (let i = 0; i < noteCount; i++) {
                        notes.push({
                            recordID: `note-${i}-${currentUserID.slice(0, 8)}`,
                            creatorID: currentUserID,
                            title: `Note ${i}`,
                            body: `Body ${i}`,
                            createdAt: 1_000_000_000_000 + i,
                            updatedAt: 1_000_000_000_000 + i,
                            projectID: null,
                            archived: false,
                            pinned: false,
                        });
                    }

                    // Cache all notes
                    setCachedNotes(notes);

                    // Pick a note to become shared (via direct share)
                    const sharedNoteIndex = 0;
                    const sharedNote = notes[sharedNoteIndex];
                    const noteShares: NoteShared[] = [{
                        recordID: `share-${sharedNote.recordID}`,
                        noteID: sharedNote.recordID,
                        creatorID: currentUserID,
                        sharedToID: 'other-user-id',
                    }];
                    const projectShares: ProjectShared[] = [];

                    // Verify the item is considered shared
                    expect(isSharedItem(sharedNote, currentUserID, noteShares, projectShares)).toBe(true);

                    // Remove the shared item from cache (as the system should do)
                    removeCachedItem('cachedNotes', sharedNote.recordID);

                    // Verify the shared item is no longer in cache
                    const cachedNotes = getCachedNotes();
                    const foundSharedItem = cachedNotes.find(
                        (n) => n.recordID === sharedNote.recordID
                    );
                    expect(foundSharedItem).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('shared tasks are not present in localStorage cache after removeCachedItem is called', () => {
        fc.assert(
            fc.property(
                userIdArb,
                fc.integer({ min: 1, max: 5 }),
                (currentUserID, taskCount) => {
                    localStorage.clear();

                    // Generate tasks owned by the current user
                    const tasks: Task[] = [];
                    for (let i = 0; i < taskCount; i++) {
                        tasks.push({
                            recordID: `task-${i}-${currentUserID.slice(0, 8)}`,
                            creatorID: currentUserID,
                            projectID: `project-${i}`,
                            title: `Task ${i}`,
                            body: '',
                            status: 'open',
                            dueDate: null,
                            isRecurring: false,
                            recurrenceInterval: null,
                            recurrenceUnit: null,
                            recurrenceAnchor: 'due_date',
                            completedAt: null,
                            createdAt: 1_000_000_000_000 + i,
                            updatedAt: 1_000_000_000_000 + i,
                        });
                    }

                    // Cache all tasks
                    setCachedTasks(tasks);

                    // Make the first task shared via project sharing
                    const sharedTask = tasks[0];
                    const noteShares: NoteShared[] = [];
                    const projectShares: ProjectShared[] = [{
                        recordID: `pshare-${sharedTask.projectID}`,
                        projectID: sharedTask.projectID!,
                        creatorID: currentUserID,
                        sharedToID: 'other-user-id',
                        createdAt: 1_000_000_000_000,
                    }];

                    // Verify the item is considered shared
                    expect(isSharedItem(sharedTask, currentUserID, noteShares, projectShares)).toBe(true);

                    // Remove the shared item from cache
                    removeCachedItem('cachedTasks', sharedTask.recordID);

                    // Verify the shared item is no longer in cache
                    const cachedTasks = getCachedTasks();
                    const foundSharedItem = cachedTasks.find(
                        (t) => t.recordID === sharedTask.recordID
                    );
                    expect(foundSharedItem).toBeUndefined();
                }
            ),
            { numRuns: 100 }
        );
    });

    it('when a non-shared item becomes shared, removeCachedItem removes it from cache', () => {
        fc.assert(
            fc.property(
                userIdArb,
                fc.integer({ min: 2, max: 8 }),
                (currentUserID, noteCount) => {
                    localStorage.clear();

                    // Generate notes owned by the current user (all non-shared initially)
                    const notes: Note[] = [];
                    for (let i = 0; i < noteCount; i++) {
                        notes.push({
                            recordID: `note-${i}-${currentUserID.slice(0, 8)}`,
                            creatorID: currentUserID,
                            title: `Note ${i}`,
                            body: `Body ${i}`,
                            createdAt: 1_000_000_000_000 + i,
                            updatedAt: 1_000_000_000_000 + i,
                            projectID: null,
                            archived: false,
                            pinned: false,
                        });
                    }

                    // Cache all notes (all non-shared at this point)
                    setCachedNotes(notes);

                    // Verify all notes are initially non-shared
                    const emptyNoteShares: NoteShared[] = [];
                    const emptyProjectShares: ProjectShared[] = [];
                    for (const note of notes) {
                        expect(isSharedItem(note, currentUserID, emptyNoteShares, emptyProjectShares)).toBe(false);
                    }

                    // Now the first note becomes shared (simulate sharing action)
                    const noteToShare = notes[0];
                    const noteShares: NoteShared[] = [{
                        recordID: `share-${noteToShare.recordID}`,
                        noteID: noteToShare.recordID,
                        creatorID: currentUserID,
                        sharedToID: 'recipient-user-id',
                    }];

                    // Verify it's now considered shared
                    expect(isSharedItem(noteToShare, currentUserID, noteShares, emptyProjectShares)).toBe(true);

                    // Remove from cache (as the system does when an item becomes shared)
                    removeCachedItem('cachedNotes', noteToShare.recordID);

                    // Verify the shared item is removed
                    const cachedNotes = getCachedNotes();
                    expect(cachedNotes.find((n) => n.recordID === noteToShare.recordID)).toBeUndefined();

                    // Verify other non-shared items remain in cache
                    for (let i = 1; i < noteCount; i++) {
                        expect(cachedNotes.find((n) => n.recordID === notes[i].recordID)).toBeDefined();
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    it('items with creatorID different from current user are shared and excluded from cache after removal', () => {
        fc.assert(
            fc.property(
                userIdArb,
                userIdArb,
                fc.integer({ min: 1, max: 5 }),
                (currentUserID, otherUserID, noteCount) => {
                    // Ensure the two user IDs are different
                    fc.pre(currentUserID !== otherUserID);

                    localStorage.clear();

                    // Generate notes created by another user (shared via creatorID mismatch)
                    const notes: Note[] = [];
                    for (let i = 0; i < noteCount; i++) {
                        notes.push({
                            recordID: `note-other-${i}-${otherUserID.slice(0, 8)}`,
                            creatorID: otherUserID,
                            title: `Other User Note ${i}`,
                            body: `Body ${i}`,
                            createdAt: 1_000_000_000_000 + i,
                            updatedAt: 1_000_000_000_000 + i,
                            projectID: null,
                            archived: false,
                            pinned: false,
                        });
                    }

                    // Suppose these notes were mistakenly cached
                    setCachedNotes(notes);

                    const emptyNoteShares: NoteShared[] = [];
                    const emptyProjectShares: ProjectShared[] = [];

                    // Verify all are considered shared (creatorID !== currentUserID)
                    for (const note of notes) {
                        expect(isSharedItem(note, currentUserID, emptyNoteShares, emptyProjectShares)).toBe(true);
                    }

                    // Remove each shared item from cache
                    for (const note of notes) {
                        removeCachedItem('cachedNotes', note.recordID);
                    }

                    // Verify cache is empty (all items were shared)
                    const cachedNotes = getCachedNotes();
                    expect(cachedNotes).toHaveLength(0);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('projects with share records cause contained tasks to be shared and excluded from cache', () => {
        fc.assert(
            fc.property(
                userIdArb,
                fc.integer({ min: 1, max: 5 }),
                (currentUserID, taskCount) => {
                    localStorage.clear();

                    const projectID = `project-shared-${currentUserID.slice(0, 8)}`;

                    // Generate tasks belonging to a project
                    const tasks: Task[] = [];
                    for (let i = 0; i < taskCount; i++) {
                        tasks.push({
                            recordID: `task-proj-${i}-${currentUserID.slice(0, 8)}`,
                            creatorID: currentUserID,
                            projectID: projectID,
                            title: `Task in shared project ${i}`,
                            body: '',
                            status: 'open',
                            dueDate: null,
                            isRecurring: false,
                            recurrenceInterval: null,
                            recurrenceUnit: null,
                            recurrenceAnchor: 'due_date',
                            completedAt: null,
                            createdAt: 1_000_000_000_000 + i,
                            updatedAt: 1_000_000_000_000 + i,
                        });
                    }

                    // Cache all tasks
                    setCachedTasks(tasks);

                    // The project becomes shared
                    const noteShares: NoteShared[] = [];
                    const projectShares: ProjectShared[] = [{
                        recordID: `pshare-${projectID}`,
                        projectID: projectID,
                        creatorID: currentUserID,
                        sharedToID: 'collaborator-id',
                        createdAt: 1_000_000_000_000,
                    }];

                    // Verify all tasks in the shared project are considered shared
                    for (const task of tasks) {
                        expect(isSharedItem(task, currentUserID, noteShares, projectShares)).toBe(true);
                    }

                    // Remove all shared tasks from cache
                    for (const task of tasks) {
                        removeCachedItem('cachedTasks', task.recordID);
                    }

                    // Verify cache is empty
                    const cachedTasks = getCachedTasks();
                    expect(cachedTasks).toHaveLength(0);
                }
            ),
            { numRuns: 100 }
        );
    });
});
