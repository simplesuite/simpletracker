/**
 * Generalized offline sync engine.
 * Handles insert/update/delete operations across notes, tasks, subtasks, and projects.
 * Listens for online/offline events, performs periodic connectivity checks,
 * and drains the pending mutation queue when connectivity returns.
 */

import { supabase, SUPABASE_URL, SUPABASE_KEY } from './supabase';
import { getAll, dequeue, pendingCount, enqueue, hasPendingInsert } from './offlineQueue';
import { withNetworkTimeout } from './networkUtils';
import { useOfflineStore } from '../store/offlineStore';
import { ensureSession } from '../components/extras/ensureSession';
import type { PendingMutation } from '../types';

let syncInProgress = false;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/** How long to wait for a network request before assuming we're offline (ms) */
const NETWORK_TIMEOUT = 8000;

/** How often to verify connectivity with a real network request (ms) */
const HEARTBEAT_INTERVAL = 30_000; // 30 seconds

/** Map entity types to Supabase table names */
const ENTITY_TABLE_MAP: Record<string, string> = {
    note: 'notes',
    task: 'tasks',
    subtask: 'task_subtasks',
    project: 'task_projects',
    noteListItem: 'notes_listitems',
};

/**
 * Performs a lightweight network check to verify actual internet connectivity.
 * navigator.onLine only checks if there's a network adapter — it doesn't detect
 * "lie-fi" (connected to WiFi but no internet). This pings Supabase's REST endpoint
 * with a tiny request to confirm real connectivity.
 */
export async function verifyConnectivity(): Promise<boolean> {
    // If the browser says we're offline, trust it immediately
    if (!navigator.onLine) {
        useOfflineStore.getState().setIsOnline(false);
        return false;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        // Ping Supabase auth health endpoint with apikey header
        await fetch(
            `${SUPABASE_URL}/auth/v1/health`,
            {
                method: 'GET',
                headers: { 'apikey': SUPABASE_KEY },
                signal: controller.signal,
            }
        );
        clearTimeout(timeout);

        // Any HTTP response (even 4xx/5xx) means the server is reachable
        useOfflineStore.getState().setIsOnline(true);
        useOfflineStore.getState().setLastVerifiedAt(Date.now());
        return true;
    } catch {
        // Network error, timeout, or abort — we're effectively offline
        useOfflineStore.getState().setIsOnline(false);
        return false;
    }
}

/** Start periodic heartbeat checks */
function startHeartbeat(): void {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(async () => {
        const wasOnline = useOfflineStore.getState().isOnline;
        const isNowOnline = await verifyConnectivity();

        // If we just came back online, trigger a sync
        if (!wasOnline && isNowOnline) {
            syncPendingMutations();
        } else if (navigator.onLine && useOfflineStore.getState().pendingCount > 0) {
            // Browser says online and we have pending items — attempt sync
            // regardless of verifyConnectivity result (it may falsely fail)
            syncPendingMutations();
        }
    }, HEARTBEAT_INTERVAL);
}

/** Stop periodic heartbeat checks */
function stopHeartbeat(): void {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

/**
 * Execute a single mutation against Supabase based on its operation type.
 * Returns { error } where error is null on success.
 */
async function executeMutation(mutation: PendingMutation): Promise<{ error: any }> {
    const table = ENTITY_TABLE_MAP[mutation.entityType] || mutation.entityType;

    switch (mutation.operation) {
        case 'insert': {
            const { error } = await withNetworkTimeout(
                supabase.from(table).insert(mutation.payload),
                NETWORK_TIMEOUT
            );
            return { error };
        }
        case 'update': {
            const { error } = await withNetworkTimeout(
                supabase.from(table).update(mutation.payload).eq('recordID', mutation.recordID),
                NETWORK_TIMEOUT
            );
            return { error };
        }
        case 'delete': {
            const { error } = await withNetworkTimeout(
                supabase.from(table).delete().eq('recordID', mutation.recordID),
                NETWORK_TIMEOUT
            );
            return { error };
        }
        default:
            return { error: { message: `Unknown operation: ${mutation.operation}` } };
    }
}

/** Attempt to sync all pending mutations to Supabase in FIFO order */
export async function syncPendingMutations(): Promise<{ synced: number; failed: number }> {
    if (syncInProgress) return { synced: 0, failed: 0 };
    if (!navigator.onLine) return { synced: 0, failed: 0 };

    syncInProgress = true;
    useOfflineStore.getState().setIsSyncing(true);

    let synced = 0;
    let failed = 0;

    try {
        const pending = await getAll(); // Already sorted by _queuedAt ascending (FIFO)

        for (const mutation of pending) {
            try {
                // Ensure session is valid before each mutation
                const sessionValid = await ensureSession();
                if (!sessionValid) {
                    useOfflineStore.getState().setLastSyncError('No valid session — please log in again');
                    failed++;
                    break; // No point trying more if session is invalid
                }

                const { error } = await executeMutation(mutation);

                if (error) {
                    // Duplicate key conflict (PostgreSQL error code 23505):
                    // Server already has this record — remove from queue and notify user
                    if (error.code === '23505') {
                        await dequeue(mutation.id);
                        synced++;
                        console.warn(
                            `Sync conflict resolved for ${mutation.entityType} ${mutation.recordID}: server record is authoritative`
                        );
                    } else if (error.code === '42501' || error.code === '23503' || error.code === '23502' || error.code === '42P17') {
                        // RLS violation (42501), foreign key violation (23503), or NOT NULL violation (23502):
                        // These are permanent failures — retrying won't help. Remove from queue.
                        await dequeue(mutation.id);
                        synced++; // Count as processed so we don't falsely mark offline
                        console.error(
                            `Permanent sync failure for ${mutation.entityType} ${mutation.recordID} (${error.code}):`,
                            error.message
                        );
                    } else {
                        // Other error (possibly transient): retain in queue for retry
                        failed++;
                        console.error(
                            'Offline sync failed for',
                            mutation.entityType,
                            mutation.recordID,
                            error.message
                        );
                    }
                } else {
                    await dequeue(mutation.id);
                    synced++;
                }
            } catch (err) {
                // Timeout or network error for this specific mutation — skip and continue
                failed++;
                console.error(`Sync timeout for ${mutation.entityType} ${mutation.recordID}`);
            }
        }
    } catch (err: any) {
        const msg = err?.message || 'Unknown sync error';
        useOfflineStore.getState().setLastSyncError(`Sync failed: ${msg}`);
        console.error('Offline sync error:', err);
    } finally {
        syncInProgress = false;
        useOfflineStore.getState().setIsSyncing(false);
        // Update pending count
        const count = await pendingCount();
        useOfflineStore.getState().setPendingCount(count);
        // Only mark offline if browser also thinks we're offline
        if (count > 0 && failed > 0 && synced === 0 && !navigator.onLine) {
            useOfflineStore.getState().setIsOnline(false);
        }
    }

    return { synced, failed };
}

/**
 * Insert a record with offline support.
 * Enqueues the mutation for instant local response, then attempts background sync.
 */
export async function insertWithOfflineSupport(
    entityType: string,
    table: string,
    payload: Record<string, unknown>
): Promise<{ success: boolean; queued: boolean }> {
    const recordID = (payload.recordID as string) || '';
    const mutation: PendingMutation = {
        id: `${entityType}-insert-${recordID}-${Date.now()}`,
        entityType: entityType as PendingMutation['entityType'],
        operation: 'insert',
        recordID,
        payload,
        _queuedAt: Date.now(),
    };

    // Always enqueue first — guarantees the mutation is persisted locally
    await enqueue(mutation);
    const count = await pendingCount();
    useOfflineStore.getState().setPendingCount(count);

    // If clearly offline, don't even try the network
    if (!navigator.onLine) {
        return { success: true, queued: true };
    }

    // Fire-and-forget background sync attempt
    syncSingleMutation(mutation);

    return { success: true, queued: true };
}

/**
 * Update a record with offline support.
 * Enqueues the mutation for instant local response, then attempts background sync.
 */
export async function updateWithOfflineSupport(
    entityType: string,
    table: string,
    recordID: string,
    payload: Record<string, unknown>
): Promise<{ success: boolean; queued: boolean }> {
    const mutation: PendingMutation = {
        id: `${entityType}-update-${recordID}-${Date.now()}`,
        entityType: entityType as PendingMutation['entityType'],
        operation: 'update',
        recordID,
        payload,
        _queuedAt: Date.now(),
    };

    await enqueue(mutation);
    const count = await pendingCount();
    useOfflineStore.getState().setPendingCount(count);

    if (!navigator.onLine) {
        return { success: true, queued: true };
    }

    // If there's a pending insert for this record, don't fire the update independently.
    // The batch syncPendingMutations will process them in FIFO order ensuring
    // the insert completes before the update.
    const insertPending = await hasPendingInsert(recordID);
    if (insertPending) {
        // Trigger a full queue sync instead, which processes in order
        syncPendingMutations();
    } else {
        syncSingleMutation(mutation);
    }

    return { success: true, queued: true };
}

/**
 * Delete a record with offline support.
 * Enqueues the mutation for instant local response, then attempts background sync.
 */
export async function deleteWithOfflineSupport(
    entityType: string,
    table: string,
    recordID: string
): Promise<{ success: boolean; queued: boolean }> {
    const mutation: PendingMutation = {
        id: `${entityType}-delete-${recordID}-${Date.now()}`,
        entityType: entityType as PendingMutation['entityType'],
        operation: 'delete',
        recordID,
        payload: {},
        _queuedAt: Date.now(),
    };

    await enqueue(mutation);
    const count = await pendingCount();
    useOfflineStore.getState().setPendingCount(count);

    if (!navigator.onLine) {
        return { success: true, queued: true };
    }

    syncSingleMutation(mutation);

    return { success: true, queued: true };
}

/** Background attempt to sync a single mutation, removing it from the queue on success */
async function syncSingleMutation(mutation: PendingMutation): Promise<void> {
    try {
        const sessionValid = await ensureSession();
        if (!sessionValid) {
            // No valid session — can't sync, leave in queue
            useOfflineStore.getState().setLastSyncError('No valid session — please log in again');
            return;
        }

        const { error } = await executeMutation(mutation);

        if (!error || error.code === '23505') {
            // Success or duplicate — remove from queue
            await dequeue(mutation.id);
            const count = await pendingCount();
            useOfflineStore.getState().setPendingCount(count);
            useOfflineStore.getState().setLastSyncError(null);

            if (error?.code === '23505') {
                console.warn(
                    `Sync conflict resolved for ${mutation.entityType} ${mutation.recordID}: server record is authoritative`
                );
            }
        } else if (error.code === '42501' || error.code === '23503' || error.code === '23502' || error.code === '42P17') {
            // Permanent failure (RLS, FK, NOT NULL) — remove from queue, retrying won't help
            await dequeue(mutation.id);
            const count = await pendingCount();
            useOfflineStore.getState().setPendingCount(count);
            const msg = `Sync failed (${error.code}): ${error.message}`;
            useOfflineStore.getState().setLastSyncError(msg);
            console.error(
                `Permanent sync failure for ${mutation.entityType} ${mutation.recordID} (${error.code}):`,
                error.message
            );
        } else {
            // Other error — leave in queue for batch retry
            const msg = `Sync error [${mutation.entityType} ${mutation.operation}]: ${error.code || ''} ${error.message || JSON.stringify(error)}`;
            useOfflineStore.getState().setLastSyncError(msg);
            console.error(
                `Sync error for ${mutation.entityType} ${mutation.operation} ${mutation.recordID}:`,
                error.message || error
            );
        }
    } catch (err: any) {
        // Timeout or network failure — don't mark as offline from a single failure,
        // leave mutation in queue for batch retry
        const msg = err?.message || 'network failure';
        useOfflineStore.getState().setLastSyncError(`Sync timeout: ${msg}`);
        console.error(`syncSingleMutation failed for ${mutation.entityType} ${mutation.recordID}:`, msg);
    }
}

/** Initialize online/offline listeners, heartbeat, and kick off initial sync */
export function initOfflineSync(): () => void {
    const handleOnline = () => {
        // Don't immediately trust navigator.onLine — verify with a real request
        verifyConnectivity().then((reallyOnline) => {
            if (reallyOnline) {
                syncPendingMutations();
            }
        });
    };

    const handleOffline = () => {
        useOfflineStore.getState().setIsOnline(false);
    };

    // Listen for visibility changes — when the app comes back to foreground,
    // re-verify connectivity (important for mobile where the OS suspends the app)
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            verifyConnectivity().then((online) => {
                if (online) {
                    syncPendingMutations();
                }
            });
        }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set initial state with a real connectivity check
    verifyConnectivity();

    // Start periodic heartbeat
    startHeartbeat();

    // Check for any pending items on startup
    pendingCount().then(async (count) => {
        useOfflineStore.getState().setPendingCount(count);
        // If we're online and have pending items, sync them
        if (navigator.onLine && count > 0) {
            syncPendingMutations();
        }
    });

    // Cleanup function
    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        stopHeartbeat();
    };
}
