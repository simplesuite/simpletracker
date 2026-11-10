/**
 * Poison-write detection for the sync engine.
 *
 * Failed uploads retry forever, which is right for transient failures
 * (offline, timeouts, 5xx, expired tokens) and wrong for writes the server
 * rejects on every attempt (constraint violation, RLS denial, malformed row).
 * Those used to retry silently forever: the pending counter stayed stuck, the
 * device kept showing a change the server never accepted, and nobody was told.
 *
 * The Supabase plugin keeps only `error.message` (the Postgres code is
 * dropped), so classification works from the message text. Anything not
 * recognized is treated as transient and keeps retrying, so an unknown error
 * can never cause local work to be discarded.
 */

const CONSTRAINT_PATTERNS: RegExp[] = [
    /violates (foreign key|unique|check|not-null|exclusion) constraint/i,
    /duplicate key value/i,
    /null value in column/i,
    /invalid input (syntax|value)/i,
    /value too long/i,
    /out of range/i,
    /column .* does not exist/i,
    /could not find the .* column/i,
];

// An RLS denial is permanent only while signed in: with a lapsed session the
// request runs as anon and trips the same policy, and that heals on re-auth.
const RLS_PATTERNS: RegExp[] = [/violates row-level security/i, /permission denied/i];

export type SyncErrorKind = 'constraint' | 'access-denied' | 'transient';

export function classifySyncError(message: string): SyncErrorKind {
    if (CONSTRAINT_PATTERNS.some((p) => p.test(message))) return 'constraint';
    if (RLS_PATTERNS.some((p) => p.test(message))) return 'access-denied';
    return 'transient';
}

/**
 * Should a failed WRITE stop retrying and be rolled back to the server's
 * state? Reads are never given up on (they hold no local work).
 */
export function shouldAbandonWrite(params: {
    message: string;
    type: 'get' | 'set' | undefined;
    isAuthenticated: boolean;
}): boolean {
    if (params.type !== 'set') return false;
    const kind = classifySyncError(params.message);
    if (kind === 'constraint') return true;
    if (kind === 'access-denied') return params.isAuthenticated;
    return false;
}
