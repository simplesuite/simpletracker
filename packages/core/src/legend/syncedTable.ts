/**
 * Factory for a synced Supabase-backed collection observable.
 *
 * Wraps `syncedSupabase` with simpleTracker's standard options so store code
 * only expresses what's specific to a collection: the table name, which rows to
 * pull (the `filter`), and which actions are allowed. Everything else — id/date
 * field mapping, local persistence, retry behavior, the auth gate — comes from
 * the shared config here and in ./config.
 *
 * The returned observable is in 'object' mode: keyed by recordID. So:
 *   - create: table$[recordID].set({ ...row })
 *   - update: table$[recordID].someField.set(value)   (or .set(partial))
 *   - delete: table$[recordID].delete()
 *   - read:   table$.get()  (activates syncing; returns Record<recordID, row>)
 */

import { observable, type Observable } from '@legendapp/state';
import { syncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import { syncEnabled$ } from './config';
import { getSupabase, getPersistPlugin } from '../runtime';

export type SyncedActions = ('create' | 'read' | 'update' | 'delete')[];

export interface SyncedTableOptions {
    /** Supabase table name, e.g. 'notes', 'tasks', 'task_subtasks'. */
    collection: string;
    /**
     * Unique local persistence key for this collection. Must be stable and
     * distinct per table so IndexedDB/localStorage buckets don't collide.
     */
    persistName: string;
    /**
     * Restrict which server rows sync down to this client. Mirrors the RLS
     * SELECT policy but runs client-side to avoid pulling rows we don't want
     * cached locally. Receives the Supabase filter builder.
     */
    filter?: (select: any) => any;
    /**
     * Which CRUD actions this collection supports. Defaults to all four.
     * Shared/read-only collections can narrow this.
     */
    actions?: SyncedActions;
}

/**
 * Create a synced, persisted, auth-gated observable for a Supabase table.
 * Generic <TRow> is the row shape (e.g. Note, Task). The plugin's own types
 * assume an `id` PK; since ours is `recordID` we cast the props — the runtime
 * honors the globally-configured fieldId: 'recordID' (verified in the spike).
 */
export function syncedTable<TRow extends Record<string, any>>(
    options: SyncedTableOptions
): Observable<Record<string, TRow>> {
    const { collection, persistName, filter, actions } = options;

    // Build the synced config lazily. Legend evaluates this function when the
    // observable is first activated (.get()), NOT at module load — so the
    // injected deps (getSupabase/getPersistPlugin) are read after configureCore,
    // regardless of import order.
    const makeSynced = () =>
        syncedSupabase({
            supabase: getSupabase(),
            collection,
            // Only sync while authenticated; flipped by the auth flow.
            enabled: syncEnabled$,
            actions: actions ?? ['read', 'create', 'update', 'delete'],
            ...(filter
                ? {
                      // `select` is a Supabase PostgrestFilterBuilder; typed
                      // loosely to avoid depending on @supabase/postgrest-js
                      // internals (keeps this portable for the shared core).
                      filter: (select: any) => filter(select),
                  }
                : {}),
            persist: {
                name: persistName,
                plugin: getPersistPlugin() as any,
                // Persist pending changes and retry them on reconnect — the
                // setting that made the offline queue drain reliably in the spike.
                retrySync: true,
            },
            // Retry failed uploads indefinitely with backoff so a transient
            // failure never silently drops a mutation (the old engine's #1 bug).
            retry: {
                infinite: true,
                delay: 1000,
                backoff: 'exponential',
                maxDelay: 30000,
            },
        } as any);

    // observable(() => syncedFn) defers construction to first activation.
    return observable<Record<string, TRow>>(
        (() => makeSynced()) as any
    ) as Observable<Record<string, TRow>>;
}
