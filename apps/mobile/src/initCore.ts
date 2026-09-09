// Mobile platform initialization for @simpletracker/core.
// Imported first in index.ts (before App / any core store), so configureCore
// runs before the core stores activate their synced observables.
//
// Uses the store-free '@simpletracker/core/runtime' subpath to configure without
// eagerly loading the stores.
import { configureCore } from '@simpletracker/core/runtime';
import { observablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './lib/supabase';
import { useAuthStore } from './store/authStore';

configureCore({
    supabase,
    // AsyncStorage-backed persistence (works in Expo Go). Swap for
    // ObservablePersistMMKV in a dev/prod build for better performance.
    persistPlugin: observablePersistAsyncStorage({ AsyncStorage }),
    getCurrentUserId: () => useAuthStore.getState().userId,
});
