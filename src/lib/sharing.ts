import { supabase } from './supabase';
import type { Note, Task, NoteShared, ProjectShared } from '../types/index';

/**
 * Determines whether an item (Note or Task) is considered "shared".
 *
 * An item is shared if any of these conditions are true:
 * - The item has a direct share record (noteShares for notes, projectShares for project-based sharing)
 * - The item belongs to a project that has share records
 * - The item's creatorID differs from the current user (i.e., the user sees it via sharing)
 *
 * Validates: Requirements 7.1, 14.1, 16.2, 16.6
 */
export function isSharedItem(
    item: Note | Task,
    currentUserID: string,
    noteShares: NoteShared[],
    projectShares: ProjectShared[]
): boolean {
    // Condition 3: The item's creatorID differs from the current user
    if (item.creatorID !== currentUserID) {
        return true;
    }

    // Condition 1: The item has a direct share record (notes_shared)
    if ('archived' in item) {
        // It's a Note — check if there's a direct share record for this note
        const hasDirectShare = noteShares.some(
            (share) => share.noteID === item.recordID
        );
        if (hasDirectShare) {
            return true;
        }
    }

    // Condition 2: The item belongs to a project that has share records
    if (item.projectID) {
        const projectHasShares = projectShares.some(
            (share) => share.projectID === item.projectID
        );
        if (projectHasShares) {
            return true;
        }
    }

    return false;
}

/**
 * Determines whether a note is shared using LOCAL state only (no network calls).
 *
 * Uses the sharedNotes list from the note store to check if the note appears there,
 * and checks the project store for shared project membership.
 *
 * This allows the shared/non-shared decision to work offline.
 */
export function isNoteSharedLocally(
    noteID: string,
    noteCreatorID: string,
    noteProjectID: string | null,
    currentUserID: string,
    sharedNoteIDs: Set<string>,
    sharedProjectIDs: Set<string>
): boolean {
    // If the creator is someone else, it's shared
    if (noteCreatorID !== currentUserID) {
        return true;
    }

    // If the note appears in the shared notes list
    if (sharedNoteIDs.has(noteID)) {
        return true;
    }

    // If the note belongs to a shared project
    if (noteProjectID && sharedProjectIDs.has(noteProjectID)) {
        return true;
    }

    return false;
}

/**
 * Determines whether a task is shared using LOCAL state only (no network calls).
 *
 * Checks creator ownership and shared project membership from local state.
 */
export function isTaskSharedLocally(
    taskCreatorID: string,
    taskProjectID: string | null,
    currentUserID: string,
    sharedProjectIDs: Set<string>
): boolean {
    // If the creator is someone else, it's shared
    if (taskCreatorID !== currentUserID) {
        return true;
    }

    // If the task belongs to a shared project
    if (taskProjectID && sharedProjectIDs.has(taskProjectID)) {
        return true;
    }

    return false;
}

/**
 * Determines whether a project is shared using LOCAL state only (no network calls).
 *
 * A project is shared if:
 * - Its creator is someone else (the user sees it via sharing)
 * - It appears in the set of known shared project IDs
 */
export function isProjectSharedLocally(
    projectCreatorID: string,
    projectID: string,
    currentUserID: string,
    sharedProjectIDs: Set<string>
): boolean {
    // If the creator is someone else, it's shared
    if (projectCreatorID !== currentUserID) {
        return true;
    }

    // If the project is in the shared set
    if (sharedProjectIDs.has(projectID)) {
        return true;
    }

    return false;
}

/**
 * Looks up a user by their recordID in the Supabase `users` table.
 * Returns the user's recordID and fullName if found, or null if no matching user exists.
 *
 * Validates: Requirements 7.1, 14.1
 */
export async function lookupUserByID(
    userID: string
): Promise<{ recordID: string; fullName: string } | null> {
    const trimmedID = userID.trim();
    if (!trimmedID) return null;

    const { data, error } = await supabase
        .from('users')
        .select('recordID, fullName')
        .eq('recordID', trimmedID)
        .single();

    if (error || !data) {
        return null;
    }

    return { recordID: data.recordID, fullName: data.fullName };
}
