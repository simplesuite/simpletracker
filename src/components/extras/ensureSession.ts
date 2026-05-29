import { supabase } from "../../lib/supabase";

/**
 * Ensures the Supabase session is fresh before making a request.
 * Mobile browsers (especially iOS Safari) throttle/kill timers during idle,
 * which can cause autoRefreshToken to miss a refresh cycle.
 * Call this before any Supabase write operation.
 */
export async function ensureSession(): Promise<boolean> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        // No session at all — user needs to re-login
        return false;
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
