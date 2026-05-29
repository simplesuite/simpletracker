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
 * Looks up a user by email address in the Supabase `users` table.
 * Returns the user's recordID if found, or null if no matching user exists.
 *
 * Validates: Requirements 7.1, 14.1
 */
export async function lookupUserByEmail(
    email: string
): Promise<{ recordID: string } | null> {
    const { data, error } = await supabase
        .from('users')
        .select('recordID')
        .eq('email', email)
        .single();

    if (error || !data) {
        return null;
    }

    return { recordID: data.recordID };
}
