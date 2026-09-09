/**
 * @simpletracker/core — platform-agnostic data layer shared by the web and
 * mobile apps. Call configureCore({ supabase, persistPlugin, getCurrentUserId })
 * once at app startup before using the stores.
 */

// Platform-injection seam
export {
    configureCore,
    isCoreConfigured,
    getSupabase,
    getPersistPlugin,
    getCurrentUserId,
    type CoreConfig,
} from './runtime';

// Data model
export type {
    Note,
    NoteListItem,
    NoteShared,
    Task,
    Subtask,
    Project,
    ProjectShared,
    PendingMutation,
} from './types/index';

// Pure logic
export * from './lib/validation';
export * from './lib/recurrence';
export * from './lib/networkUtils';
export * from './lib/sharing';
export { ensureSession } from './lib/ensureSession';

// Legend-State sync layer
export { syncEnabled$, setSyncEnabled } from './legend/config';
export { syncedTable, type SyncedTableOptions, type SyncedActions } from './legend/syncedTable';
export { clearLocalData } from './legend/reset';

// Stores (Zustand facades over synced observables) + the observables themselves
export { useNoteStore, notes$, noteListItems$ } from './store/noteStore';
export { useTaskStore, tasks$, subtasks$ } from './store/taskStore';
export { useProjectStore, projects$, projectShares$ } from './store/projectStore';
export { useOfflineStore } from './store/offlineStore';
