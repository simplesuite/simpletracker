/**
 * Platform-injection runtime for @simpletracker/core.
 *
 * The core (data model, validation, recurrence, sharing, Legend-State sync
 * config, and the Zustand stores) is platform-agnostic. The few things that
 * differ per platform are injected here at app startup via `configureCore`:
 *
 *   - supabase:        a configured SupabaseClient (web resolves config from
 *                      window/localStorage/env; mobile from app config).
 *   - persistPlugin:   the Legend-State local-persistence plugin
 *                      (ObservablePersistLocalStorage on web,
 *                      ObservablePersistMMKV on React Native).
 *   - getCurrentUserId: returns the current authenticated user's recordID.
 *                      Kept as a getter so core stores don't import the app's
 *                      UI/global store (which pulls in web-only deps like MUI).
 *
 * configureCore MUST be called once, before any store activation (i.e. before
 * the first observable .get()). Apps call it at startup.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface CoreConfig {
    supabase: SupabaseClient;
    /** A Legend-State persist plugin (ObservablePersist* implementation). */
    persistPlugin: unknown;
    /** Returns the current user's recordID, or '' when unauthenticated. */
    getCurrentUserId: () => string;
}

let config: CoreConfig | null = null;

/** Configure the core with platform-specific dependencies. Call once at startup. */
export function configureCore(cfg: CoreConfig): void {
    config = cfg;
}

/** True once configureCore has run. */
export function isCoreConfigured(): boolean {
    return config !== null;
}

function requireConfig(): CoreConfig {
    if (!config) {
        throw new Error(
            '@simpletracker/core: configureCore() must be called before using the core (stores/sync). ' +
                'Call it at app startup with { supabase, persistPlugin, getCurrentUserId }.'
        );
    }
    return config;
}

/** The injected Supabase client. */
export function getSupabase(): SupabaseClient {
    return requireConfig().supabase;
}

/** The injected Legend-State persistence plugin. */
export function getPersistPlugin(): unknown {
    return requireConfig().persistPlugin;
}

/** The current authenticated user's recordID (or '' if none). */
export function getCurrentUserId(): string {
    return requireConfig().getCurrentUserId();
}
