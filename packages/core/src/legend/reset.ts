/**
 * Clears all locally-persisted synced data.
 *
 * Called on logout so a subsequent user on the same browser/device does not see
 * the previous user's notes/tasks/projects rendered from local persistence
 * before server reconciliation. Server data is already RLS-scoped per user; this
 * clears the LOCAL copy.
 *
 * Kept separate from config.ts to avoid a circular import (the stores import
 * from config/syncedTable; this module imports the stores' observables).
 */

import { syncState } from '@legendapp/state';
import { setSyncEnabled } from './config';
import { notes$, noteListItems$ } from '../../store/noteStore';
import { tasks$, subtasks$ } from '../../store/taskStore';
import { projects$, projectShares$ } from '../../store/projectStore';

const allSynced = [
    notes$,
    noteListItems$,
    tasks$,
    subtasks$,
    projects$,
    projectShares$,
];

/**
 * Stop syncing and wipe local persistence for every synced collection.
 * Best-effort: clearing failures are swallowed so logout always proceeds.
 */
export async function clearLocalData(): Promise<void> {
    // Stop syncing first so nothing re-populates while we clear.
    setSyncEnabled(false);

    await Promise.all(
        allSynced.map(async (obs$) => {
            try {
                await syncState(obs$).clearPersist();
            } catch {
                /* best-effort */
            }
        })
    );
}
