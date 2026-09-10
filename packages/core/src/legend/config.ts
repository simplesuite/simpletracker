/**
 * Legend-State sync configuration for simpleTracker.
 *
 * This is the single place where we describe HOW our data syncs with Supabase.
 * The stores (noteStore/taskStore/projectStore) build their observables on top
 * of `syncedTable` below and never talk to the sync engine directly.
 *
 * Design decisions (see migration notes):
 * - Full-list sync (changesSince: 'all'), NOT 'last-sync'. We keep hard deletes
 *   and the DB-level ON DELETE CASCADE for child rows, so there is no soft-delete
 *   `deleted` column for the diff-based sync to rely on. Realtime is OFF for now
 *   (matches current app behavior; additive to enable later).
 * - Our schema uses `recordID` as the primary key. We intentionally do not pass
 *   fieldCreatedAt/fieldUpdatedAt here: with full-list sync, Legend-State uses
 *   those fields to classify local writes as creates versus updates. Our stores
 *   populate both timestamps before an optimistic create, so configuring them
 *   would incorrectly send a new row through UPDATE. Full-list mode does not
 *   need timestamp mappings for reconciliation.
 * - retrySync + infinite retry: validated in the spike as the setting that makes
 *   offline multi-mutation queues drain reliably on reconnect.
 *
 * NOTE: We're on @legendapp/state v3 (currently beta). The syncedSupabase types
 * assume a remote row shaped `{ id: string }`; because our PK column is
 * `recordID`, a few calls are cast to satisfy the generic constraint while the
 * runtime honors `fieldId` (confirmed in the spike).
 */

import { observable, type Observable } from '@legendapp/state';
import { configureSyncedSupabase } from '@legendapp/state/sync-plugins/supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Reactive gate for syncing. Sync only runs while the user is authenticated.
 * App.tsx / auth flow flips this via setSyncEnabled on login/logout so that
 * observables don't attempt to read/write before there's a session (and stop
 * cleanly on logout).
 */
export const syncEnabled$: Observable<boolean> = observable<boolean>(false);

/**
 * Global Supabase-sync configuration applied to every synced collection.
 * - generateId: local id generation for optimistic creates (matches uuidv4 used
 *   throughout the stores).
 * - fieldId: map Legend-State's expected primary-key field onto `recordID`.
 * - changesSince 'all': full-list reconciliation (see file header).
 * - enabled: the plugin's global gate; the per-observable `enabled` option is
 *   not sufficient because syncedSupabase uses this global value for waitFor.
 */
configureSyncedSupabase({
    enabled: syncEnabled$,
    generateId: () => uuidv4(),
    fieldId: 'recordID',
    changesSince: 'all',
});

export function setSyncEnabled(enabled: boolean): void {
    syncEnabled$.set(enabled);
}
