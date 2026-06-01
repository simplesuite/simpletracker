import { supabase } from "../../lib/supabase";

/**
 * Ensures the Supabase session is fresh before making a request.
 * Mobile browsers (especially iOS Safari) throttle/kill timers during idle,
 * which can cause autoRefreshToken to miss a refresh cycle.
 * Call this before any Supabase write operation.
 *
 * Uses a shared promise to prevent concurrent refresh calls from racing
 * and invalidating each other's tokens.
 */

let refreshPromise: Promise<boolean> | null = null;

export async function ensureSession(): Promise<boolean> {
    // If a refresh is already in progress, wait for it instead of starting another
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = doEnsureSession();
    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
}

async function doEnsureSession(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // No session at all — user needs to re-login
        return false;
    }

    // Only refresh if the token is close to expiring (within 60 seconds)
    const expiresAt = session.expires_at; // Unix timestamp in seconds
    if (expiresAt) {
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt - now > 60) {
            // Token still has more than 60 seconds — no need to refresh
            return true;
        }
    }

    // Force a token refresh to ensure we have a valid access token
    const { error } = await supabase.auth.refreshSession();
    if (error) {
        console.warn('Session refresh failed:', error.message);
        // Still return true — the existing token might still be valid
        return true;
    }
    return true;
}
