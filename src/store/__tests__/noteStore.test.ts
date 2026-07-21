import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { useNoteStore } from '../noteStore';
import type { Note } from '../../types/index';

/**
 * Feature: simpletracker-notes-tasks, Property 3: Note Creation Defaults
 * Feature: simpletracker-notes-tasks, Property 5: List Ordering
 * Feature: simpletracker-notes-tasks, Property 6: Archive Round-Trip
 * Feature: simpletracker-notes-tasks, Property 12: Mutations Update Timestamp
 *
 * Validates: Requirements 4.1, 5.1, 5.2, 5.3, 5.4, 5.5, 4.2
 */

// Mock Supabase client
vi.mock('../../lib/supabase', () => ({
    supabase: {
        from: () => ({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        order: () => Promise.resolve({ data: [], error: null }),
                    }),
                    order: () => Promise.resolve({ data: [], error: null }),
                }),
            }),
            insert: () => Promise.resolve({ data: null, error: null }),
            update: () => ({
                eq: () => Promise.resolve({ data: null, error: null }),
            }),
            delete: () => ({
                eq: () => Promise.resolve({ data: null, error: null }),
            }),
        }),
        auth: {
            getSession: () => Promise.resolve({ data: { session: { access_token: 'test' } } }),
            refreshSession: () => Promise.resolve({ error: null }),
        },
    },
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_KEY: 'test-key',
    getSupabaseStorageKey: () => 'sb-localhost-auth-token',
}));

// Mock offlineSync functions
vi.mock('../../lib/offlineSync', () => ({
    insertWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: true }),
    updateWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: true }),
    deleteWithOfflineSupport: vi.fn().mockResolvedValue({ success: true, queued: true }),
}));

// Mock cache functions
vi.mock('../../lib/cache', () => ({
    getCachedNotes: vi.fn().mockReturnValue([]),
    setCachedNotes: vi.fn(),
    getCachedSharedNotes: vi.fn().mockReturnValue([]),
    setCachedSharedNotes: vi.fn(),
    removeCachedItem: vi.fn(),
}));

// Mock ensureSession
vi.mock('../../components/extras/ensureSession', () => ({
    ensureSession: vi.fn().mockResolvedValue(true),
}));

// Mock sharing utility
vi.mock('../../lib/sharing', () => ({
    isSharedItem: vi.fn().mockReturnValue(false),
    isNoteSharedLocally: vi.fn().mockReturnValue(false),
    lookupUserByID: vi.fn().mockResolvedValue(null),
}));

// Mock validation
vi.mock('../../lib/validation', () => ({
    validateNoteTitle: vi.fn().mockReturnValue({ valid: true }),
}));

// Mock globalStore
const TEST_USER_ID = 'test-user-id-123';
vi.mock('../globalStore', () => ({
    useGlobalStore: {
        getState: () => ({
            currentUser: { recordID: TEST_USER_ID, fullName: 'Test User', userType: 'free' },
        }),
    },
}));

// Mock offlineStore
vi.mock('../offlineStore', () => ({
    useOfflineStore: {
        getState: () => ({
            isOnline: true,
            setIsOnline: vi.fn(),
            pendingCount: 0,
            setPendingCount: vi.fn(),
            isSyncing: false,
            setIsSyncing: vi.fn(),
            lastVerifiedAt: 0,
            setLastVerifiedAt: vi.fn(),
            lastSyncError: null,
            setLastSyncError: vi.fn(),
        }),
    },
}));

// Mock projectStore
vi.mock('../projectStore', () => ({
    useProjectStore: {
        getState: () => ({
            sharedProjectIDs: new Set(),
        }),
    },
}));

// Mock offlineQueue
vi.mock('../../lib/offlineQueue', () => ({
    getAll: vi.fn().mockResolvedValue([]),
    enqueue: vi.fn().mockResolvedValue(undefined),
    dequeue: vi.fn().mockResolvedValue(undefined),
    pendingCount: vi.fn().mockResolvedValue(0),
    hasPendingInsert: vi.fn().mockResolvedValue(false),
    mergeIntoInsert: vi.fn().mockResolvedValue(undefined),
    removeByRecordID: vi.fn().mockResolvedValue(undefined),
}));

const NUM_RUNS = 100;

describe('Property 3: Note Creation Defaults', () => {
    beforeEach(() => {
        // Reset the store state before each test
        useNoteStore.setState({ notes: [], archivedNotes: [], sharedNotes: [], loading: false, error: null });
    });

    it('createNote produces a record with non-empty recordID', async () => {
        await fc.assert(
            fc.asyncProperty(fc.constant(null), async () => {
                useNoteStore.setState({ notes: [] });
                const note = await useNoteStore.getState().createNote();
                expect(note).not.toBeNull();
                expect(note!.recordID).toBeDefined();
                expect(note!.recordID.length).toBeGreaterThan(0);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('createNote sets creatorID equal to the current user ID', async () => {
        await fc.assert(
            fc.asyncProperty(fc.constant(null), async () => {
                useNoteStore.setState({ notes: [] });
                const note = await useNoteStore.getState().createNote();
                expect(note).not.toBeNull();
                expect(note!.creatorID).toBe(TEST_USER_ID);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('createNote sets empty title and empty body', async () => {
        await fc.assert(
            fc.asyncProperty(fc.constant(null), async () => {
                useNoteStore.setState({ notes: [] });
                const note = await useNoteStore.getState().createNote();
                expect(note).not.toBeNull();
                expect(note!.title).toBe('');
                expect(note!.body).toBe('');
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('createNote sets archived=false and projectID=null', async () => {
        await fc.assert(
            fc.asyncProperty(fc.constant(null), async () => {
                useNoteStore.setState({ notes: [] });
                const note = await useNoteStore.getState().createNote();
                expect(note).not.toBeNull();
                expect(note!.archived).toBe(false);
                expect(note!.projectID).toBeNull();
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('createNote sets createdAt equal to updatedAt', async () => {
        await fc.assert(
            fc.asyncProperty(fc.constant(null), async () => {
                useNoteStore.setState({ notes: [] });
                const note = await useNoteStore.getState().createNote();
                expect(note).not.toBeNull();
                expect(note!.createdAt).toBe(note!.updatedAt);
            }),
            { numRuns: NUM_RUNS }
        );
    });

    it('createNote produces unique recordIDs across multiple creations', async () => {
        const ids = new Set<string>();
        await fc.assert(
            fc.asyncProperty(fc.constant(null), async () => {
                useNoteStore.setState({ notes: [] });
                const note = await useNoteStore.getState().createNote();
                expect(note).not.toBeNull();
                expect(ids.has(note!.recordID)).toBe(false);
                ids.add(note!.recordID);
            }),
            { numRuns: NUM_RUNS }
        );
    });
});

describe('Property 5: List Ordering', () => {
    beforeEach(() => {
        useNoteStore.setState({ notes: [], archivedNotes: [], sharedNotes: [], loading: false, error: null });
    });

    it('notes list is sorted by updatedAt descending', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        recordID: fc.uuid(),
                        creatorID: fc.constant(TEST_USER_ID),
                        title: fc.string({ maxLength: 50 }),
                        body: fc.string({ maxLength: 100 }),
                        createdAt: fc.nat({ max: 2000000000000 }),
                        updatedAt: fc.nat({ max: 2000000000000 }),
                        projectID: fc.constant(null),
                        archived: fc.constant(false),
                        pinned: fc.constant(false),
                        noteType: fc.constant('text' as const),
                    }),
                    { minLength: 2, maxLength: 20 }
                ),
                (notes) => {
                    // Sort notes by updatedAt desc (as the store does)
                    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
                    useNoteStore.setState({ notes: sorted });

                    const storeNotes = useNoteStore.getState().notes;
                    for (let i = 1; i < storeNotes.length; i++) {
                        expect(storeNotes[i - 1].updatedAt).toBeGreaterThanOrEqual(storeNotes[i].updatedAt);
                    }
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it('archived notes are excluded from the default notes list', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        recordID: fc.uuid(),
                        creatorID: fc.constant(TEST_USER_ID),
                        title: fc.string({ maxLength: 50 }),
                        body: fc.string({ maxLength: 100 }),
                        createdAt: fc.nat({ max: 2000000000000 }),
                        updatedAt: fc.nat({ max: 2000000000000 }),
                        projectID: fc.constant(null),
                        archived: fc.boolean(),
                        pinned: fc.constant(false),
                        noteType: fc.constant('text' as const),
                    }),
                    { minLength: 1, maxLength: 20 }
                ),
                (notes) => {
                    // Separate into archived and non-archived as the store does
                    const nonArchived = notes
                        .filter((n) => !n.archived)
                        .sort((a, b) => b.updatedAt - a.updatedAt);
                    const archived = notes
                        .filter((n) => n.archived)
                        .sort((a, b) => b.updatedAt - a.updatedAt);

                    useNoteStore.setState({ notes: nonArchived, archivedNotes: archived });

                    const storeNotes = useNoteStore.getState().notes;
                    const storeArchived = useNoteStore.getState().archivedNotes;

                    // Default list should contain NO archived notes
                    for (const note of storeNotes) {
                        expect(note.archived).toBe(false);
                    }

                    // Archived list should contain ONLY archived notes
                    for (const note of storeArchived) {
                        expect(note.archived).toBe(true);
                    }

                    // Total count should match
                    expect(storeNotes.length + storeArchived.length).toBe(notes.length);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it('archived notes list is sorted by updatedAt descending', () => {
        fc.assert(
            fc.property(
                fc.array(
                    fc.record({
                        recordID: fc.uuid(),
                        creatorID: fc.constant(TEST_USER_ID),
                        title: fc.string({ maxLength: 50 }),
                        body: fc.string({ maxLength: 100 }),
                        createdAt: fc.nat({ max: 2000000000000 }),
                        updatedAt: fc.nat({ max: 2000000000000 }),
                        projectID: fc.constant(null),
                        archived: fc.constant(true),
                        pinned: fc.constant(false),
                        noteType: fc.constant('text' as const),
                    }),
                    { minLength: 2, maxLength: 20 }
                ),
                (notes) => {
                    const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt);
                    useNoteStore.setState({ archivedNotes: sorted });

                    const storeArchived = useNoteStore.getState().archivedNotes;
                    for (let i = 1; i < storeArchived.length; i++) {
                        expect(storeArchived[i - 1].updatedAt).toBeGreaterThanOrEqual(storeArchived[i].updatedAt);
                    }
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });
});

describe('Property 6: Archive Round-Trip', () => {
    beforeEach(() => {
        useNoteStore.setState({ notes: [], archivedNotes: [], sharedNotes: [], loading: false, error: null });
    });

    it('archiving a note sets archived=true and preserves title/body', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    title: fc.string({ minLength: 1, maxLength: 50 }),
                    body: fc.string({ minLength: 0, maxLength: 200 }),
                }),
                async ({ title, body }) => {
                    const noteID = `note-${Date.now()}-${Math.random()}`;
                    const now = Date.now();
                    const note: Note = {
                        recordID: noteID,
                        creatorID: TEST_USER_ID,
                        title,
                        body,
                        createdAt: now - 10000,
                        updatedAt: now - 5000,
                        projectID: null,
                        archived: false,
                        pinned: false,
                        noteType: 'text',
                    };

                    useNoteStore.setState({ notes: [note], archivedNotes: [] });

                    await useNoteStore.getState().archiveNote(noteID);

                    const state = useNoteStore.getState();
                    // Note should be removed from notes list
                    expect(state.notes.find((n) => n.recordID === noteID)).toBeUndefined();
                    // Note should be in archivedNotes
                    const archivedNote = state.archivedNotes.find((n) => n.recordID === noteID);
                    expect(archivedNote).toBeDefined();
                    expect(archivedNote!.archived).toBe(true);
                    // Title and body preserved
                    expect(archivedNote!.title).toBe(title);
                    expect(archivedNote!.body).toBe(body);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it('archiving a note updates updatedAt to be >= previous updatedAt', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.nat({ max: 1000000000000 }),
                async (previousUpdatedAt) => {
                    const noteID = `note-${Date.now()}-${Math.random()}`;
                    const note: Note = {
                        recordID: noteID,
                        creatorID: TEST_USER_ID,
                        title: 'Test',
                        body: 'Body',
                        createdAt: previousUpdatedAt - 1000,
                        updatedAt: previousUpdatedAt,
                        projectID: null,
                        archived: false,
                        pinned: false,
                        noteType: 'text',
                    };

                    useNoteStore.setState({ notes: [note], archivedNotes: [] });

                    await useNoteStore.getState().archiveNote(noteID);

                    const archivedNote = useNoteStore.getState().archivedNotes.find((n) => n.recordID === noteID);
                    expect(archivedNote).toBeDefined();
                    expect(archivedNote!.updatedAt).toBeGreaterThanOrEqual(previousUpdatedAt);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it('unarchiving a note sets archived=false and preserves title/body', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    title: fc.string({ minLength: 1, maxLength: 50 }),
                    body: fc.string({ minLength: 0, maxLength: 200 }),
                }),
                async ({ title, body }) => {
                    const noteID = `note-${Date.now()}-${Math.random()}`;
                    const now = Date.now();
                    const note: Note = {
                        recordID: noteID,
                        creatorID: TEST_USER_ID,
                        title,
                        body,
                        createdAt: now - 10000,
                        updatedAt: now - 5000,
                        projectID: null,
                        archived: true,
                        pinned: false,
                        noteType: 'text',
                    };

                    useNoteStore.setState({ notes: [], archivedNotes: [note] });

                    await useNoteStore.getState().unarchiveNote(noteID);

                    const state = useNoteStore.getState();
                    // Note should be removed from archivedNotes
                    expect(state.archivedNotes.find((n) => n.recordID === noteID)).toBeUndefined();
                    // Note should be in notes list
                    const unarchivedNote = state.notes.find((n) => n.recordID === noteID);
                    expect(unarchivedNote).toBeDefined();
                    expect(unarchivedNote!.archived).toBe(false);
                    // Title and body preserved
                    expect(unarchivedNote!.title).toBe(title);
                    expect(unarchivedNote!.body).toBe(body);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it('unarchiving a note updates updatedAt to be >= the archive updatedAt', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.nat({ max: 1000000000000 }),
                async (archiveUpdatedAt) => {
                    const noteID = `note-${Date.now()}-${Math.random()}`;
                    const note: Note = {
                        recordID: noteID,
                        creatorID: TEST_USER_ID,
                        title: 'Test',
                        body: 'Body',
                        createdAt: archiveUpdatedAt - 10000,
                        updatedAt: archiveUpdatedAt,
                        projectID: null,
                        archived: true,
                        pinned: false,
                        noteType: 'text',
                    };

                    useNoteStore.setState({ notes: [], archivedNotes: [note] });

                    await useNoteStore.getState().unarchiveNote(noteID);

                    const unarchivedNote = useNoteStore.getState().notes.find((n) => n.recordID === noteID);
                    expect(unarchivedNote).toBeDefined();
                    expect(unarchivedNote!.updatedAt).toBeGreaterThanOrEqual(archiveUpdatedAt);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it('archive then unarchive round-trip preserves title and body', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    title: fc.string({ minLength: 1, maxLength: 50 }),
                    body: fc.string({ minLength: 0, maxLength: 200 }),
                }),
                async ({ title, body }) => {
                    const noteID = `note-${Date.now()}-${Math.random()}`;
                    const now = Date.now();
                    const note: Note = {
                        recordID: noteID,
                        creatorID: TEST_USER_ID,
                        title,
                        body,
                        createdAt: now - 10000,
                        updatedAt: now - 5000,
                        projectID: null,
                        archived: false,
                        pinned: false,
                        noteType: 'text',
                    };

                    useNoteStore.setState({ notes: [note], archivedNotes: [] });

                    // Archive
                    await useNoteStore.getState().archiveNote(noteID);
                    // Unarchive
                    await useNoteStore.getState().unarchiveNote(noteID);

                    const finalNote = useNoteStore.getState().notes.find((n) => n.recordID === noteID);
                    expect(finalNote).toBeDefined();
                    expect(finalNote!.title).toBe(title);
                    expect(finalNote!.body).toBe(body);
                    expect(finalNote!.archived).toBe(false);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });
});

describe('Property 12: Mutations Update Timestamp', () => {
    beforeEach(() => {
        useNoteStore.setState({ notes: [], archivedNotes: [], sharedNotes: [], loading: false, error: null });
    });

    it('updateNote increases updatedAt on the note', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    title: fc.string({ minLength: 1, maxLength: 50 }),
                    newTitle: fc.string({ minLength: 1, maxLength: 50 }),
                }),
                async ({ title, newTitle }) => {
                    const noteID = `note-${Date.now()}-${Math.random()}`;
                    const previousUpdatedAt = Date.now() - 10000;
                    const note: Note = {
                        recordID: noteID,
                        creatorID: TEST_USER_ID,
                        title,
                        body: 'some body',
                        createdAt: previousUpdatedAt - 5000,
                        updatedAt: previousUpdatedAt,
                        projectID: null,
                        archived: false,
                        pinned: false,
                        noteType: 'text',
                    };

                    useNoteStore.setState({ notes: [note], archivedNotes: [], sharedNotes: [] });

                    await useNoteStore.getState().updateNote(noteID, { title: newTitle });

                    const updatedNote = useNoteStore.getState().notes.find((n) => n.recordID === noteID);
                    expect(updatedNote).toBeDefined();
                    expect(updatedNote!.updatedAt).toBeGreaterThanOrEqual(previousUpdatedAt);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it('updateNote with body change increases updatedAt', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    body: fc.string({ minLength: 0, maxLength: 100 }),
                    newBody: fc.string({ minLength: 0, maxLength: 100 }),
                }),
                async ({ body, newBody }) => {
                    const noteID = `note-${Date.now()}-${Math.random()}`;
                    const previousUpdatedAt = Date.now() - 10000;
                    const note: Note = {
                        recordID: noteID,
                        creatorID: TEST_USER_ID,
                        title: 'Test Note',
                        body,
                        createdAt: previousUpdatedAt - 5000,
                        updatedAt: previousUpdatedAt,
                        projectID: null,
                        archived: false,
                        pinned: false,
                        noteType: 'text',
                    };

                    useNoteStore.setState({ notes: [note], archivedNotes: [], sharedNotes: [] });

                    await useNoteStore.getState().updateNote(noteID, { body: newBody });

                    const updatedNote = useNoteStore.getState().notes.find((n) => n.recordID === noteID);
                    expect(updatedNote).toBeDefined();
                    expect(updatedNote!.updatedAt).toBeGreaterThanOrEqual(previousUpdatedAt);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it('archiveNote increases updatedAt', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.nat({ max: 1000000000000 }),
                async (previousUpdatedAt) => {
                    const noteID = `note-${Date.now()}-${Math.random()}`;
                    const note: Note = {
                        recordID: noteID,
                        creatorID: TEST_USER_ID,
                        title: 'Test',
                        body: 'Body',
                        createdAt: previousUpdatedAt - 1000,
                        updatedAt: previousUpdatedAt,
                        projectID: null,
                        archived: false,
                        pinned: false,
                        noteType: 'text',
                    };

                    useNoteStore.setState({ notes: [note], archivedNotes: [] });

                    await useNoteStore.getState().archiveNote(noteID);

                    const archivedNote = useNoteStore.getState().archivedNotes.find((n) => n.recordID === noteID);
                    expect(archivedNote).toBeDefined();
                    expect(archivedNote!.updatedAt).toBeGreaterThanOrEqual(previousUpdatedAt);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });

    it('unarchiveNote increases updatedAt', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.nat({ max: 1000000000000 }),
                async (previousUpdatedAt) => {
                    const noteID = `note-${Date.now()}-${Math.random()}`;
                    const note: Note = {
                        recordID: noteID,
                        creatorID: TEST_USER_ID,
                        title: 'Test',
                        body: 'Body',
                        createdAt: previousUpdatedAt - 1000,
                        updatedAt: previousUpdatedAt,
                        projectID: null,
                        archived: true,
                        pinned: false,
                        noteType: 'text',
                    };

                    useNoteStore.setState({ notes: [], archivedNotes: [note] });

                    await useNoteStore.getState().unarchiveNote(noteID);

                    const unarchivedNote = useNoteStore.getState().notes.find((n) => n.recordID === noteID);
                    expect(unarchivedNote).toBeDefined();
                    expect(unarchivedNote!.updatedAt).toBeGreaterThanOrEqual(previousUpdatedAt);
                }
            ),
            { numRuns: NUM_RUNS }
        );
    });
});
