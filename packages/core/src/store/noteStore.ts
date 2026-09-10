import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { observe } from '@legendapp/state';
import { getSupabase, getCurrentUserId } from '../runtime';
import { syncedTable } from '../legend/syncedTable';
import { isNoteSharedLocally, lookupUserByID } from '../lib/sharing';
import { validateNoteTitle } from '../lib/validation';
import { useOfflineStore } from './offlineStore';
import { useProjectStore } from './projectStore';
import { ensureSession } from '../lib/ensureSession';
import type { Note, NoteShared, NoteListItem } from '../types/index';

// ─── Synced observables (Legend-State) ──────────────────────────────────────
// RLS returns own notes + directly-shared notes + shared-project notes, so we sync the whole visible set
// into one observable and derive the notes/sharedNotes/archivedNotes buckets in
// the bridge below. List items are their own collection.

export const notes$ = syncedTable<Note>({
    collection: 'notes',
    persistName: 'st_notes',
});

export const noteListItems$ = syncedTable<NoteListItem>({
    collection: 'notes_listitems',
    persistName: 'st_note_listitems',
});

interface NoteStore {
    notes: Note[];
    archivedNotes: Note[];
    sharedNotes: Note[];
    listItems: Record<string, NoteListItem[]>; // keyed by noteID
    loading: boolean;
    error: string | null;

    fetchNotes: () => Promise<void>;
    fetchArchivedNotes: () => Promise<void>;
    createNote: (projectID?: string | null, noteType?: 'text' | 'list') => Promise<Note | null>;
    updateNote: (id: string, fields: Partial<Pick<Note, 'title' | 'body' | 'projectID' | 'noteType'>>) => Promise<boolean>;
    togglePinNote: (id: string) => Promise<boolean>;
    archiveNote: (id: string) => Promise<boolean>;
    unarchiveNote: (id: string) => Promise<boolean>;
    deleteNote: (id: string) => Promise<boolean>;
    shareNote: (noteID: string, userID: string) => Promise<boolean>;
    unshareNote: (noteID: string, sharedToID: string) => Promise<boolean>;
    getSharesForNote: (noteID: string) => Promise<NoteShared[]>;

    // List item operations
    fetchListItems: (noteID: string) => Promise<void>;
    addListItem: (noteID: string, title: string) => Promise<NoteListItem | null>;
    toggleListItem: (itemID: string) => Promise<boolean>;
    updateListItemTitle: (itemID: string, title: string) => Promise<boolean>;
    deleteListItem: (itemID: string) => Promise<boolean>;
    reorderListItems: (noteID: string, reorderedItems: NoteListItem[]) => Promise<boolean>;
}

/** Helper: current user's recordID. */
function currentUserID(): string {
    return getCurrentUserId();
}

/** Helper: is this note shared (needs connectivity to write)? */
function noteIsShared(note: Note): boolean {
    const uid = currentUserID();
    const sharedNoteIDs = new Set(useNoteStore.getState().sharedNotes.map((n) => n.recordID));
    const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
    return isNoteSharedLocally(
        note.recordID,
        note.creatorID,
        note.projectID,
        uid,
        sharedNoteIDs,
        sharedProjectIDs
    );
}

/** Find a note across all local buckets. */
function findNote(id: string): Note | undefined {
    const s = useNoteStore.getState();
    return [...s.notes, ...s.sharedNotes, ...s.archivedNotes].find((n) => n.recordID === id);
}

export const useNoteStore = create<NoteStore>((set, get) => ({
    notes: [],
    archivedNotes: [],
    sharedNotes: [],
    listItems: {},
    loading: false,
    error: null,

    // Reads are now driven by the synced observable + the observe() bridge below.
    // fetchNotes simply activates syncing (get()) — the bridge keeps state fresh.
    fetchNotes: async () => {
        notes$.get();
    },

    fetchArchivedNotes: async () => {
        notes$.get();
    },

    createNote: async (projectID, noteType) => {
        const uid = currentUserID();
        const now = Date.now();
        const newNote: Note = {
            recordID: uuidv4(),
            creatorID: uid,
            title: '',
            body: '',
            createdAt: now,
            updatedAt: now,
            projectID: projectID || null,
            archived: false,
            pinned: false,
            noteType: noteType || 'text',
        };

        // Shared project creation still requires connectivity (multi-user state).
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = projectID ? sharedProjectIDs.has(projectID) : false;
        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return null;
        }

        // Single local write — Legend-State persists + uploads (offline-safe).
        notes$[newNote.recordID].set(newNote as any);
        set({ error: null });
        return newNote;
    },

    updateNote: async (id, fields) => {
        if (fields.title !== undefined) {
            const validation = validateNoteTitle(fields.title);
            if (!validation.valid) {
                set({ error: validation.error || 'Invalid title' });
                return false;
            }
        }

        const note = findNote(id);
        if (!note) {
            set({ error: 'Note not found' });
            return false;
        }

        if (noteIsShared(note) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        const payload = { ...fields, updatedAt: Date.now() };
        notes$[id].set({ ...note, ...payload } as any);
        set({ error: null });
        return true;
    },

    togglePinNote: async (id) => {
        const note = findNote(id);
        if (!note) {
            set({ error: 'Note not found' });
            return false;
        }

        if (noteIsShared(note) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        notes$[id].set({ ...note, pinned: !note.pinned, updatedAt: Date.now() } as any);
        set({ error: null });
        return true;
    },

    archiveNote: async (id) => {
        const note = findNote(id);
        if (!note) {
            set({ error: 'Note not found' });
            return false;
        }

        if (noteIsShared(note) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        notes$[id].set({ ...note, archived: true, updatedAt: Date.now() } as any);
        set({ error: null });
        return true;
    },

    unarchiveNote: async (id) => {
        const note = findNote(id);
        if (!note) {
            set({ error: 'Note not found' });
            return false;
        }

        if (noteIsShared(note) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        notes$[id].set({ ...note, archived: false, updatedAt: Date.now() } as any);
        set({ error: null });
        return true;
    },

    deleteNote: async (id) => {
        const note = findNote(id);

        if (note && noteIsShared(note) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        // Single delete. The DB ON DELETE CASCADE removes notes_listitems rows,
        // and those deletions replicate back down — no per-child delete loop.
        notes$[id].delete();

        // Drop any locally-synced list items for this note from their observable
        // so they don't linger in local persistence before the cascade round-trips.
        const items = noteListItems$.get() || {};
        for (const itemID of Object.keys(items)) {
            if (items[itemID]?.noteID === id) {
                noteListItems$[itemID].delete();
            }
        }

        set({ error: null });
        return true;
    },

    // ─── Sharing (multi-user; requires connectivity — direct Supabase) ──────

    shareNote: async (noteID, userID) => {
        try {
            await ensureSession();
            const uid = currentUserID();

            const user = await lookupUserByID(userID);
            if (!user) {
                set({ error: 'User not found' });
                return false;
            }
            if (user.recordID === uid) {
                set({ error: 'Cannot share with yourself' });
                return false;
            }

            const { data: existing } = await getSupabase()
                .from('notes_shared')
                .select('recordID')
                .eq('noteID', noteID)
                .eq('sharedToID', user.recordID);

            if (existing && existing.length > 0) {
                set({ error: 'Already shared with this user' });
                return false;
            }

            const shareRecord: NoteShared = {
                recordID: uuidv4(),
                noteID,
                creatorID: uid,
                sharedToID: user.recordID,
            };

            const { error } = await getSupabase().from('notes_shared').insert(shareRecord);
            if (error) {
                set({ error: error.message });
                return false;
            }

            set({ error: null });
            return true;
        } catch (err: any) {
            set({ error: err.message || 'Failed to share note' });
            return false;
        }
    },

    unshareNote: async (noteID, sharedToID) => {
        try {
            await ensureSession();
            const { error } = await getSupabase()
                .from('notes_shared')
                .delete()
                .eq('noteID', noteID)
                .eq('sharedToID', sharedToID);

            if (error) {
                set({ error: error.message });
                return false;
            }

            set({ error: null });
            return true;
        } catch (err: any) {
            set({ error: err.message || 'Failed to unshare note' });
            return false;
        }
    },

    getSharesForNote: async (noteID) => {
        try {
            await ensureSession();
            const { data, error } = await getSupabase()
                .from('notes_shared')
                .select('*')
                .eq('noteID', noteID);

            if (error) {
                set({ error: error.message });
                return [];
            }
            return (data || []) as NoteShared[];
        } catch (err: any) {
            set({ error: err.message || 'Failed to get shares' });
            return [];
        }
    },

    // ─── List item operations ───────────────────────────────────────────────
    // List items sync via noteListItems$. fetchListItems just activates syncing;
    // the bridge groups them by noteID into the store's listItems map.

    fetchListItems: async (_noteID) => {
        noteListItems$.get();
    },

    addListItem: async (noteID, title) => {
        if (title.length > 255) {
            set({ error: 'List item must not exceed 255 characters' });
            return null;
        }

        const existing = get().listItems[noteID] || [];
        if (existing.length >= 100) {
            set({ error: 'Maximum of 100 items per list reached' });
            return null;
        }

        const parentNote = findNote(noteID);
        if (parentNote && noteIsShared(parentNote) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return null;
        }

        const now = Date.now();
        const maxOrder = existing.reduce((max, item) => Math.max(max, item.indexOrder), 0);
        const newItem: NoteListItem = {
            recordID: uuidv4(),
            noteID,
            title: title.trim(),
            isCompleted: false,
            indexOrder: maxOrder + 1,
            createdAt: now,
            updatedAt: now,
        };

        noteListItems$[newItem.recordID].set(newItem as any);

        // Bump parent note's updatedAt
        if (parentNote) {
            notes$[noteID].set({ ...parentNote, updatedAt: now } as any);
        }

        set({ error: null });
        return newItem;
    },

    toggleListItem: async (itemID) => {
        const item = (noteListItems$.get() || {})[itemID];
        if (!item) {
            set({ error: 'List item not found' });
            return false;
        }

        const parentNote = findNote(item.noteID);
        if (parentNote && noteIsShared(parentNote) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        noteListItems$[itemID].set({
            ...item,
            isCompleted: !item.isCompleted,
            updatedAt: Date.now(),
        } as any);
        set({ error: null });
        return true;
    },

    updateListItemTitle: async (itemID, title) => {
        if (title.length > 255) {
            set({ error: 'List item must not exceed 255 characters' });
            return false;
        }

        const item = (noteListItems$.get() || {})[itemID];
        if (!item) {
            set({ error: 'List item not found' });
            return false;
        }

        const parentNote = findNote(item.noteID);
        if (parentNote && noteIsShared(parentNote) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        noteListItems$[itemID].set({ ...item, title, updatedAt: Date.now() } as any);
        set({ error: null });
        return true;
    },

    deleteListItem: async (itemID) => {
        const item = (noteListItems$.get() || {})[itemID];
        if (!item) {
            set({ error: 'List item not found' });
            return false;
        }

        const parentNote = findNote(item.noteID);
        if (parentNote && noteIsShared(parentNote) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        noteListItems$[itemID].delete();
        set({ error: null });
        return true;
    },

    reorderListItems: async (noteID, reorderedItems) => {
        const parentNote = findNote(noteID);
        if (parentNote && noteIsShared(parentNote) && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        const now = Date.now();
        reorderedItems.forEach((item, index) => {
            const existing = (noteListItems$.get() || {})[item.recordID];
            if (existing) {
                noteListItems$[item.recordID].set({
                    ...existing,
                    indexOrder: index + 1,
                    updatedAt: now,
                } as any);
            }
        });

        set({ error: null });
        return true;
    },
}));

// ─── Bridge: synced observables → Zustand state ─────────────────────────────
// Keeps the existing `useNoteStore(s => s.notes)` selector contract working by
// projecting the observable data into the store's arrays whenever it changes.
// Derives the three buckets from a single synced `notes$` set:
//   - notes:         own, non-archived
//   - sharedNotes:   creator != me, non-archived
//   - archivedNotes: own, archived
// Pinned-first then most-recent sort mirrors the previous behavior.

function sortNotes(a: Note, b: Note): number {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
}

// Use rAF batching to prevent rapid re-execution during React render cycles
let notesBatchPending = false;
let listItemsBatchPending = false;

function processNotesUpdate() {
    notesBatchPending = false;
    const byId = notes$.get() || {};
    const all = Object.values(byId).filter(Boolean) as Note[];
    const uid = getCurrentUserId();

    const notes: Note[] = [];
    const sharedNotes: Note[] = [];
    const archivedNotes: Note[] = [];

    for (const n of all) {
        const mine = n.creatorID === uid;
        if (mine && n.archived) {
            archivedNotes.push(n);
        } else if (mine) {
            notes.push(n);
        } else if (!n.archived) {
            // Shared with me (creator is someone else), non-archived
            sharedNotes.push(n);
        }
    }

    notes.sort(sortNotes);
    sharedNotes.sort(sortNotes);
    archivedNotes.sort((a, b) => b.updatedAt - a.updatedAt);

    useNoteStore.setState({ notes, sharedNotes, archivedNotes });
}

function processListItemsUpdate() {
    listItemsBatchPending = false;
    const byId = noteListItems$.get() || {};
    const items = Object.values(byId).filter(Boolean) as NoteListItem[];

    const grouped: Record<string, NoteListItem[]> = {};
    for (const item of items) {
        (grouped[item.noteID] ||= []).push(item);
    }
    for (const noteID of Object.keys(grouped)) {
        grouped[noteID].sort((a, b) => a.indexOrder - b.indexOrder);
    }

    useNoteStore.setState({ listItems: grouped });
}

observe(() => {
    // Read the observable here so Legend-State tracks remote/local changes.
    void notes$.get();
    if (!notesBatchPending) {
        notesBatchPending = true;
        requestAnimationFrame(processNotesUpdate);
    }
});

observe(() => {
    // Read the observable here so Legend-State tracks remote/local changes.
    void noteListItems$.get();
    if (!listItemsBatchPending) {
        listItemsBatchPending = true;
        requestAnimationFrame(processListItemsUpdate);
    }
});
