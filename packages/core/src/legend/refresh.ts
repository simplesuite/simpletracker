import { syncState } from '@legendapp/state';
import { notes$, noteListItems$, useNoteStore } from '../store/noteStore';
import { tasks$, subtasks$, useTaskStore } from '../store/taskStore';
import { projects$, projectShares$, useProjectStore } from '../store/projectStore';

const allSynced = [
    notes$,
    noteListItems$,
    tasks$,
    subtasks$,
    projects$,
    projectShares$,
];

type SyncController = {
    sync: (options?: { resetLastSync?: boolean }) => Promise<void> | void;
};

/**
 * Force a server reconciliation for every synced collection.
 *
 * The normal fetch actions activate their observables and keep the local state
 * current. A manual refresh also resets each collection's last-sync marker so
 * Legend-State performs a fresh read instead of treating the local cache as
 * already current.
 */
export async function refreshAllData(): Promise<void> {
    await Promise.all([
        useNoteStore.getState().fetchNotes(),
        useTaskStore.getState().fetchTasks(),
        useProjectStore.getState().fetchProjects(),
    ]);

    await Promise.all(
        allSynced.map(async (observable) => {
            await (syncState(observable) as unknown as SyncController).sync({ resetLastSync: true });
        })
    );
}
