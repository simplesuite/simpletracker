/**
 * Web platform initialization for @simpletracker/core.
 *
 * MUST be imported before any core store module is used, because the stores
 * create their synced observables at module load (which reads the injected
 * supabase client + persist plugin). index.tsx imports this first.
 *
 * Injects the web-specific dependencies:
 *   - supabase:         the web Supabase client (config resolved from
 *                       window.__SUPABASE_CONFIG__ / localStorage / env / prod).
 *   - persistPlugin:    ObservablePersistLocalStorage (IndexedDB/localStorage).
 *   - getCurrentUserId: reads the current user's recordID from the web global
 *                       store (which owns MUI theming and stays web-only).
 */

// Import from the store-free /runtime subpath so configureCore runs WITHOUT
// eagerly loading the core stores (which build synced observables at import and
// would otherwise read the injected deps before this call).
import { configureCore } from '@simpletracker/core/runtime';
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage';
import { supabase } from './lib/supabase';
import { useGlobalStore } from './store/globalStore';

configureCore({
    supabase,
    persistPlugin: ObservablePersistLocalStorage,
    getCurrentUserId: () => useGlobalStore.getState().currentUser.recordID,
});
