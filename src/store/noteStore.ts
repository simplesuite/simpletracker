import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { getCachedNotes, setCachedNotes, getCachedSharedNotes, setCachedSharedNotes, removeCachedItem } from '../lib/cache';
import {
    insertWithOfflineSupport,
    updateWithOfflineSupport,
    deleteWithOfflineSupport,
} from '../lib/offlineSync';
import { isNoteSharedLocally, lookupUserByID } from '../lib/sharing';
import { validateNoteTitle } from '../lib/validation';
import { useGlobalStore } from './globalStore';
import { useOfflineStore } from './offlineStore';
import { useProjectStore } from './projectStore';
import { ensureSession } from '../components/extras/ensureSession';
import type { Note, NoteShared, NoteListItem } from '../types/index';

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

export const useNoteStore = create<NoteStore>((set, get) => ({
    notes: [],
    archivedNotes: [],
    sharedNotes: [],
    listItems: {},
    loading: false,
    error: null,

    fetchNotes: async () => {
        set({ loading: true, error: null });

        // Load from cache first for instant render (< 200ms)
        const cached = getCachedNotes();
        if (cached.length > 0) {
            const nonArchived = cached
                .filter((n) => !n.archived)
                .sort((a, b) => b.updatedAt - a.updatedAt);
            set({ notes: nonArchived });
        }

        const cachedShared = getCachedSharedNotes();
        if (cachedShared.length > 0) {
            set({ sharedNotes: cachedShared });
        }

        try {
            await ensureSession();
            const currentUserID = useGlobalStore.getState().currentUser.recordID;

            // Fetch notes created by the user (non-archived)
            const { data: ownNotes, error: ownError } = await supabase
                .from('notes')
                .select('*')
                .eq('creatorID', currentUserID)
                .eq('archived', false)
                .order('updatedAt', { ascending: false });

            if (ownError) {
                set({ error: ownError.message, loading: false });
                return;
            }

            // Fetch notes shared directly with the user
            const { data: sharedRecords, error: sharedError } = await supabase
                .from('notes_shared')
                .select('noteID')
                .eq('sharedToID', currentUserID);

            if (sharedError) {
                set({ error: sharedError.message, loading: false });
                return;
            }

            let sharedNotes: Note[] = [];
            if (sharedRecords && sharedRecords.length > 0) {
                const sharedNoteIDs = sharedRecords.map((r) => r.noteID);
                const { data: sharedData, error: sharedDataError } = await supabase
                    .from('notes')
                    .select('*')
                    .in('recordID', sharedNoteIDs)
                    .eq('archived', false)
                    .order('updatedAt', { ascending: false });

                if (sharedDataError) {
                    set({ error: sharedDataError.message, loading: false });
                    return;
                }
                sharedNotes = sharedData || [];
            }

            // Fetch notes from shared projects
            const { data: projectShares, error: projShareError } = await supabase
                .from('task_projects_shared')
                .select('projectID')
                .eq('sharedToID', currentUserID);

            if (projShareError) {
                set({ error: projShareError.message, loading: false });
                return;
            }

            let projectNotes: Note[] = [];
            if (projectShares && projectShares.length > 0) {
                const projectIDs = projectShares.map((p) => p.projectID);
                const { data: projNotesData, error: projNotesError } = await supabase
                    .from('notes')
                    .select('*')
                    .in('projectID', projectIDs)
                    .neq('creatorID', currentUserID)
                    .eq('archived', false)
                    .order('updatedAt', { ascending: false });

                if (projNotesError) {
                    set({ error: projNotesError.message, loading: false });
                    return;
                }
                projectNotes = projNotesData || [];
            }

            // Combine shared notes (direct + project), deduplicate
            const allShared = [...sharedNotes, ...projectNotes];
            const sharedMap = new Map<string, Note>();
            for (const note of allShared) {
                sharedMap.set(note.recordID, note);
            }
            const uniqueSharedNotes = Array.from(sharedMap.values())
                .sort((a, b) => b.updatedAt - a.updatedAt);

            // Own non-shared notes go to cache
            const nonSharedOwn = (ownNotes || []).filter((note) => {
                return !sharedMap.has(note.recordID);
            });
            setCachedNotes(nonSharedOwn);
            setCachedSharedNotes(uniqueSharedNotes);

            // Set state: notes = own non-archived, sharedNotes = shared non-archived
            const allNotes = [...(ownNotes || [])].sort((a, b) => b.updatedAt - a.updatedAt);
            set({
                notes: allNotes,
                sharedNotes: uniqueSharedNotes,
                loading: false,
                error: null,
            });
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch notes', loading: false });
        }
    },

    fetchArchivedNotes: async () => {
        set({ loading: true, error: null });

        try {
            await ensureSession();
            const currentUserID = useGlobalStore.getState().currentUser.recordID;

            const { data, error } = await supabase
                .from('notes')
                .select('*')
                .eq('creatorID', currentUserID)
                .eq('archived', true)
                .order('updatedAt', { ascending: false });

            if (error) {
                set({ error: error.message, loading: false });
                return;
            }

            set({ archivedNotes: data || [], loading: false, error: null });
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch archived notes', loading: false });
        }
    },

    createNote: async (projectID?: string | null, noteType?: 'text' | 'list') => {
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const now = Date.now();
        const newNote: Note = {
            recordID: uuidv4(),
            creatorID: currentUserID,
            title: '',
            body: '',
            createdAt: now,
            updatedAt: now,
            projectID: projectID || null,
            archived: false,
            pinned: false,
            noteType: noteType || 'text',
        };

        // Check if this note is being created in a shared project
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = projectID ? sharedProjectIDs.has(projectID) : false;

        // Optimistically add to local state
        set((state) => ({
            notes: [newNote, ...state.notes],
        }));

        if (shared) {
            // Shared project: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                // Remove the optimistic note
                set((state) => ({ notes: state.notes.filter((n) => n.recordID !== newNote.recordID) }));
                return null;
            }

            // Write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('notes')
                    .insert({
                        recordID: newNote.recordID,
                        creatorID: newNote.creatorID,
                        title: newNote.title,
                        body: newNote.body,
                        createdAt: newNote.createdAt,
                        updatedAt: newNote.updatedAt,
                        projectID: newNote.projectID,
                        archived: newNote.archived,
                        pinned: newNote.pinned,
                        noteType: newNote.noteType,
                    });

                if (error) {
                    set({ error: error.message });
                    set((state) => ({ notes: state.notes.filter((n) => n.recordID !== newNote.recordID) }));
                    return null;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to create note' });
                set((state) => ({ notes: state.notes.filter((n) => n.recordID !== newNote.recordID) }));
                return null;
            }
        } else {
            // Non-shared: use offline support for insert
            await insertWithOfflineSupport('note', 'notes', {
                recordID: newNote.recordID,
                creatorID: newNote.creatorID,
                title: newNote.title,
                body: newNote.body,
                createdAt: newNote.createdAt,
                updatedAt: newNote.updatedAt,
                projectID: newNote.projectID,
                archived: newNote.archived,
                pinned: newNote.pinned,
                noteType: newNote.noteType,
            });

            // Update cache
            const cached = getCachedNotes();
            setCachedNotes([newNote, ...cached]);
        }

        return newNote;
    },

    updateNote: async (id, fields) => {
        // Validate title if provided
        if (fields.title !== undefined) {
            const validation = validateNoteTitle(fields.title);
            if (!validation.valid) {
                set({ error: validation.error || 'Invalid title' });
                return false;
            }
        }

        const now = Date.now();
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const updatePayload = { ...fields, updatedAt: now };

        // Check if this is a shared item
        const currentNotes = [...get().notes, ...get().sharedNotes, ...get().archivedNotes];
        const note = currentNotes.find((n) => n.recordID === id);

        if (!note) {
            set({ error: 'Note not found' });
            return false;
        }

        // Determine if shared using LOCAL state (no network calls)
        const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = isNoteSharedLocally(
            note.recordID,
            note.creatorID,
            note.projectID,
            currentUserID,
            sharedNoteIDs,
            sharedProjectIDs
        );

        if (shared) {
            // Shared items: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Shared items: write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('notes')
                    .update(updatePayload)
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to update note' });
                return false;
            }
        } else {
            // Non-shared items: use offline support
            await updateWithOfflineSupport('note', 'notes', id, updatePayload);
        }

        // Optimistically update local state
        const updateInList = (notes: Note[]) =>
            notes.map((n) => (n.recordID === id ? { ...n, ...updatePayload } : n));

        set((state) => ({
            notes: updateInList(state.notes),
            sharedNotes: updateInList(state.sharedNotes),
            archivedNotes: updateInList(state.archivedNotes),
            error: null,
        }));

        // Update cache for non-shared items
        if (!shared) {
            const cached = getCachedNotes();
            const updatedCache = cached.map((n) =>
                n.recordID === id ? { ...n, ...updatePayload } : n
            );
            setCachedNotes(updatedCache);
        }

        return true;
    },

    togglePinNote: async (id) => {
        const currentNotes = [...get().notes, ...get().sharedNotes];
        const note = currentNotes.find((n) => n.recordID === id);

        if (!note) {
            set({ error: 'Note not found' });
            return false;
        }

        const newPinned = !note.pinned;
        const now = Date.now();
        const updatePayload = { pinned: newPinned, updatedAt: now };

        const currentUserID = useGlobalStore.getState().currentUser.recordID;

        // Check if this is a shared item using LOCAL state
        const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = isNoteSharedLocally(
            note.recordID,
            note.creatorID,
            note.projectID,
            currentUserID,
            sharedNoteIDs,
            sharedProjectIDs
        );

        if (shared) {
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            try {
                await ensureSession();
                const { error } = await supabase
                    .from('notes')
                    .update(updatePayload)
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to pin note' });
                return false;
            }
        } else {
            await updateWithOfflineSupport('note', 'notes', id, updatePayload);
        }

        // Optimistically update local state
        const updateInList = (notes: Note[]) =>
            notes.map((n) => (n.recordID === id ? { ...n, ...updatePayload } : n));

        set((state) => ({
            notes: updateInList(state.notes),
            sharedNotes: updateInList(state.sharedNotes),
            error: null,
        }));

        // Update cache for non-shared items
        if (!shared) {
            const cached = getCachedNotes();
            const updatedCache = cached.map((n) =>
                n.recordID === id ? { ...n, ...updatePayload } : n
            );
            setCachedNotes(updatedCache);
        }

        return true;
    },

    archiveNote: async (id) => {
        const now = Date.now();
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const updatePayload = { archived: true, updatedAt: now };

        // Find the note to check if shared
        const currentNotes = [...get().notes, ...get().sharedNotes, ...get().archivedNotes];
        const note = currentNotes.find((n) => n.recordID === id);

        let shared = false;
        if (note) {
            const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
            const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
            shared = isNoteSharedLocally(
                note.recordID,
                note.creatorID,
                note.projectID,
                currentUserID,
                sharedNoteIDs,
                sharedProjectIDs
            );
        }

        if (shared) {
            // Shared items: check connectivity
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('notes')
                    .update(updatePayload)
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to archive note' });
                return false;
            }
        } else {
            // Non-shared: use offline support
            await updateWithOfflineSupport('note', 'notes', id, updatePayload);
        }

        // Optimistically update state
        set((state) => {
            const noteInList = state.notes.find((n) => n.recordID === id);
            if (!noteInList) return state;
            const updatedNote = { ...noteInList, ...updatePayload };
            return {
                notes: state.notes.filter((n) => n.recordID !== id),
                archivedNotes: [updatedNote, ...state.archivedNotes].sort(
                    (a, b) => b.updatedAt - a.updatedAt
                ),
            };
        });

        // Update cache for non-shared items
        if (!shared) {
            const cached = getCachedNotes();
            const updatedCache = cached.filter((n) => n.recordID !== id);
            setCachedNotes(updatedCache);
        }

        return true;
    },

    unarchiveNote: async (id) => {
        const now = Date.now();
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const updatePayload = { archived: false, updatedAt: now };

        // Find the note to check if shared
        const currentNotes = [...get().notes, ...get().sharedNotes, ...get().archivedNotes];
        const note = currentNotes.find((n) => n.recordID === id);

        let shared = false;
        if (note) {
            const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
            const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
            shared = isNoteSharedLocally(
                note.recordID,
                note.creatorID,
                note.projectID,
                currentUserID,
                sharedNoteIDs,
                sharedProjectIDs
            );
        }

        if (shared) {
            // Shared items: check connectivity
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('notes')
                    .update(updatePayload)
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to unarchive note' });
                return false;
            }
        } else {
            // Non-shared: use offline support
            await updateWithOfflineSupport('note', 'notes', id, updatePayload);
        }

        // Optimistically update state
        set((state) => {
            const noteInList = state.archivedNotes.find((n) => n.recordID === id);
            if (!noteInList) return state;
            const updatedNote = { ...noteInList, ...updatePayload };
            return {
                archivedNotes: state.archivedNotes.filter((n) => n.recordID !== id),
                notes: [updatedNote, ...state.notes].sort(
                    (a, b) => b.updatedAt - a.updatedAt
                ),
            };
        });

        // Update cache for non-shared items
        if (!shared) {
            const cached = getCachedNotes();
            const noteObj = get().notes.find((n) => n.recordID === id);
            if (noteObj) {
                setCachedNotes([noteObj, ...cached]);
            }
        }

        return true;
    },

    deleteNote: async (id) => {
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const currentNotes = [...get().notes, ...get().sharedNotes, ...get().archivedNotes];
        const note = currentNotes.find((n) => n.recordID === id);

        // Determine if shared using LOCAL state
        const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = note
            ? isNoteSharedLocally(note.recordID, note.creatorID, note.projectID, currentUserID, sharedNoteIDs, sharedProjectIDs)
            : false;

        // Capture list items before optimistic removal
        const noteListItems = get().listItems[id] || [];

        // Optimistically remove from local state immediately
        set((state) => {
            const { [id]: _, ...remainingListItems } = state.listItems;
            return {
                notes: state.notes.filter((n) => n.recordID !== id),
                archivedNotes: state.archivedNotes.filter((n) => n.recordID !== id),
                sharedNotes: state.sharedNotes.filter((n) => n.recordID !== id),
                listItems: remainingListItems,
                error: null,
            };
        });

        // Remove from cache immediately so fetchNotes won't restore it from stale cache
        removeCachedItem('cachedNotes', id);
        removeCachedItem('cachedSharedNotes', id);

        if (shared) {
            // Shared items: check connectivity first
            if (!useOfflineStore.getState().isOnline) {
                set({ error: 'Shared items require an internet connection' });
                return false;
            }

            // Delete directly from server
            try {
                await ensureSession();

                // Delete associated notes_shared records first
                const { error: shareError } = await supabase
                    .from('notes_shared')
                    .delete()
                    .eq('noteID', id);

                if (shareError) {
                    set({ error: shareError.message });
                    return false;
                }

                // Delete associated list items
                await supabase
                    .from('notes_listitems')
                    .delete()
                    .eq('noteID', id);

                // Delete the note itself
                const { error } = await supabase
                    .from('notes')
                    .delete()
                    .eq('recordID', id);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to delete note' });
                return false;
            }
        } else {
            // Non-shared: use offline support
            // Delete list items first, then the note
            for (const item of noteListItems) {
                await deleteWithOfflineSupport('noteListItem', 'notes_listitems', item.recordID);
            }
            await deleteWithOfflineSupport('note', 'notes', id);
        }



        return true;
    },

    shareNote: async (noteID, userID) => {
        try {
            await ensureSession();
            const currentUserID = useGlobalStore.getState().currentUser.recordID;

            // Look up user by ID
            const user = await lookupUserByID(userID);
            if (!user) {
                set({ error: 'User not found' });
                return false;
            }

            // Prevent self-share
            if (user.recordID === currentUserID) {
                set({ error: 'Cannot share with yourself' });
                return false;
            }

            // Check for duplicate share
            const { data: existing } = await supabase
                .from('notes_shared')
                .select('recordID')
                .eq('noteID', noteID)
                .eq('sharedToID', user.recordID);

            if (existing && existing.length > 0) {
                set({ error: 'Already shared with this user' });
                return false;
            }

            // Create share record
            const shareRecord: NoteShared = {
                recordID: uuidv4(),
                noteID,
                creatorID: currentUserID,
                sharedToID: user.recordID,
            };

            const { error } = await supabase
                .from('notes_shared')
                .insert(shareRecord);

            if (error) {
                set({ error: error.message });
                return false;
            }

            // Remove from local cache since it's now shared
            removeCachedItem('cachedNotes', noteID);

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

            const { error } = await supabase
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

            const { data, error } = await supabase
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

    // ─── List Item Operations ───────────────────────────────────────────

    fetchListItems: async (noteID) => {
        try {
            await ensureSession();
            const { data, error } = await supabase
                .from('notes_listitems')
                .select('*')
                .eq('noteID', noteID)
                .order('indexOrder', { ascending: true });

            if (error) {
                set({ error: error.message });
                return;
            }

            const items = (data || []) as NoteListItem[];
            set((state) => ({
                listItems: { ...state.listItems, [noteID]: items },
            }));
        } catch (err: any) {
            set({ error: err.message || 'Failed to fetch list items' });
        }
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

        // Check if the parent note is shared
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const allNotes = [...get().notes, ...get().sharedNotes];
        const parentNote = allNotes.find((n) => n.recordID === noteID);
        const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = parentNote
            ? isNoteSharedLocally(parentNote.recordID, parentNote.creatorID, parentNote.projectID, currentUserID, sharedNoteIDs, sharedProjectIDs)
            : false;

        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return null;
        }

        const now = Date.now();
        const recordID = uuidv4();

        const newItem: NoteListItem = {
            recordID,
            noteID,
            title: title.trim(),
            isCompleted: false,
            indexOrder: existing.length + 1,
            createdAt: now,
            updatedAt: now,
        };

        // Optimistically update local state
        set((state) => ({
            listItems: {
                ...state.listItems,
                [noteID]: [...(state.listItems[noteID] || []), newItem],
            },
            error: null,
        }));

        if (shared) {
            // Shared: insert directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('notes_listitems')
                    .insert(newItem);

                if (error) {
                    // Rollback optimistic update
                    set((state) => ({
                        listItems: {
                            ...state.listItems,
                            [noteID]: (state.listItems[noteID] || []).filter((i) => i.recordID !== recordID),
                        },
                        error: error.message,
                    }));
                    return null;
                }

                // Update parent note's updatedAt on server
                await supabase
                    .from('notes')
                    .update({ updatedAt: now })
                    .eq('recordID', noteID);
            } catch (err: any) {
                set({ error: err.message || 'Failed to add list item' });
                return null;
            }
        } else {
            // Non-shared: use offline support
            await insertWithOfflineSupport('noteListItem', 'notes_listitems', newItem as unknown as Record<string, unknown>);
            await updateWithOfflineSupport('note', 'notes', noteID, { updatedAt: now });
        }

        // Update parent note's updatedAt in local state
        const updateInList = (notes: Note[]) =>
            notes.map((n) => (n.recordID === noteID ? { ...n, updatedAt: now } : n));
        set((state) => ({
            notes: updateInList(state.notes),
            sharedNotes: updateInList(state.sharedNotes),
        }));

        return newItem;
    },

    toggleListItem: async (itemID) => {
        // Find the item
        let foundNoteID: string | null = null;
        let foundItem: NoteListItem | null = null;
        const allListItems = get().listItems;

        for (const [noteID, items] of Object.entries(allListItems)) {
            const item = items.find((i) => i.recordID === itemID);
            if (item) {
                foundNoteID = noteID;
                foundItem = item;
                break;
            }
        }

        if (!foundItem || !foundNoteID) {
            set({ error: 'List item not found' });
            return false;
        }

        // Check if the parent note is shared
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const allNotes = [...get().notes, ...get().sharedNotes];
        const parentNote = allNotes.find((n) => n.recordID === foundNoteID);
        const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = parentNote
            ? isNoteSharedLocally(parentNote.recordID, parentNote.creatorID, parentNote.projectID, currentUserID, sharedNoteIDs, sharedProjectIDs)
            : false;

        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        const now = Date.now();
        const newCompleted = !foundItem.isCompleted;
        const updatePayload = { isCompleted: newCompleted, updatedAt: now };

        // Optimistically update local state
        set((state) => ({
            listItems: {
                ...state.listItems,
                [foundNoteID!]: (state.listItems[foundNoteID!] || []).map((i) =>
                    i.recordID === itemID ? { ...i, ...updatePayload } : i
                ),
            },
            error: null,
        }));

        if (shared) {
            // Shared: write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('notes_listitems')
                    .update(updatePayload)
                    .eq('recordID', itemID);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to toggle list item' });
                return false;
            }
        } else {
            // Non-shared: use offline support
            await updateWithOfflineSupport('noteListItem', 'notes_listitems', itemID, updatePayload);
        }

        return true;
    },

    updateListItemTitle: async (itemID, title) => {
        if (title.length > 255) {
            set({ error: 'List item must not exceed 255 characters' });
            return false;
        }

        // Find the item
        let foundNoteID: string | null = null;
        const allListItems = get().listItems;

        for (const [noteID, items] of Object.entries(allListItems)) {
            const item = items.find((i) => i.recordID === itemID);
            if (item) {
                foundNoteID = noteID;
                break;
            }
        }

        if (!foundNoteID) {
            set({ error: 'List item not found' });
            return false;
        }

        // Check if the parent note is shared
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const allNotes = [...get().notes, ...get().sharedNotes];
        const parentNote = allNotes.find((n) => n.recordID === foundNoteID);
        const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = parentNote
            ? isNoteSharedLocally(parentNote.recordID, parentNote.creatorID, parentNote.projectID, currentUserID, sharedNoteIDs, sharedProjectIDs)
            : false;

        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        const now = Date.now();
        const updatePayload = { title, updatedAt: now };

        // Optimistically update local state
        set((state) => ({
            listItems: {
                ...state.listItems,
                [foundNoteID!]: (state.listItems[foundNoteID!] || []).map((i) =>
                    i.recordID === itemID ? { ...i, ...updatePayload } : i
                ),
            },
            error: null,
        }));

        if (shared) {
            // Shared: write directly to server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('notes_listitems')
                    .update(updatePayload)
                    .eq('recordID', itemID);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to update list item' });
                return false;
            }
        } else {
            // Non-shared: use offline support
            await updateWithOfflineSupport('noteListItem', 'notes_listitems', itemID, updatePayload);
        }

        return true;
    },

    deleteListItem: async (itemID) => {
        // Find the item
        let foundNoteID: string | null = null;
        const allListItems = get().listItems;

        for (const [noteID, items] of Object.entries(allListItems)) {
            const item = items.find((i) => i.recordID === itemID);
            if (item) {
                foundNoteID = noteID;
                break;
            }
        }

        if (!foundNoteID) {
            set({ error: 'List item not found' });
            return false;
        }

        // Check if the parent note is shared
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const allNotes = [...get().notes, ...get().sharedNotes];
        const parentNote = allNotes.find((n) => n.recordID === foundNoteID);
        const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = parentNote
            ? isNoteSharedLocally(parentNote.recordID, parentNote.creatorID, parentNote.projectID, currentUserID, sharedNoteIDs, sharedProjectIDs)
            : false;

        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        // Optimistically update local state
        set((state) => ({
            listItems: {
                ...state.listItems,
                [foundNoteID!]: (state.listItems[foundNoteID!] || []).filter((i) => i.recordID !== itemID),
            },
            error: null,
        }));

        if (shared) {
            // Shared: delete directly from server
            try {
                await ensureSession();
                const { error } = await supabase
                    .from('notes_listitems')
                    .delete()
                    .eq('recordID', itemID);

                if (error) {
                    set({ error: error.message });
                    return false;
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to delete list item' });
                return false;
            }
        } else {
            // Non-shared: use offline support
            await deleteWithOfflineSupport('noteListItem', 'notes_listitems', itemID);
        }

        return true;
    },

    reorderListItems: async (noteID, reorderedItems) => {
        // Check if the parent note is shared
        const currentUserID = useGlobalStore.getState().currentUser.recordID;
        const allNotes = [...get().notes, ...get().sharedNotes];
        const parentNote = allNotes.find((n) => n.recordID === noteID);
        const sharedNoteIDs = new Set(get().sharedNotes.map((n) => n.recordID));
        const sharedProjectIDs = useProjectStore.getState().sharedProjectIDs;
        const shared = parentNote
            ? isNoteSharedLocally(parentNote.recordID, parentNote.creatorID, parentNote.projectID, currentUserID, sharedNoteIDs, sharedProjectIDs)
            : false;

        if (shared && !useOfflineStore.getState().isOnline) {
            set({ error: 'Shared items require an internet connection' });
            return false;
        }

        // Assign new indexOrder values based on array position
        const updatedItems = reorderedItems.map((item, index) => ({
            ...item,
            indexOrder: index + 1,
        }));

        // Optimistically update local state
        set((state) => ({
            listItems: {
                ...state.listItems,
                [noteID]: updatedItems,
            },
            error: null,
        }));

        // Persist each item's new indexOrder
        const now = Date.now();
        if (shared) {
            try {
                await ensureSession();
                for (const item of updatedItems) {
                    const { error } = await supabase
                        .from('notes_listitems')
                        .update({ indexOrder: item.indexOrder, updatedAt: now })
                        .eq('recordID', item.recordID);

                    if (error) {
                        set({ error: error.message });
                        return false;
                    }
                }
            } catch (err: any) {
                set({ error: err.message || 'Failed to reorder items' });
                return false;
            }
        } else {
            for (const item of updatedItems) {
                await updateWithOfflineSupport('noteListItem', 'notes_listitems', item.recordID, {
                    indexOrder: item.indexOrder,
                    updatedAt: now,
                });
            }
        }

        return true;
    },
}));
