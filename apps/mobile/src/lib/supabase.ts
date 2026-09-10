import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
};

export const PRODUCTION_URL = 'https://psdmjjcvaxejxktqwdcm.supabase.co';
export const PRODUCTION_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzZG1qamN2YXhleGp4a3Rxd2RjbSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjcwMzMwNDgzLCJleHAiOjE5ODU5MDY0ODN9.7Uqw2v3Ny5FvPBRBbbvtcUxJj_ReNDjRBUn6cWlal_o';

const CONFIG_STORAGE_KEY = 'simpletracker.backend.config';
const configuredUrl = extra.supabaseUrl || PRODUCTION_URL;
const configuredKey = extra.supabaseAnonKey || PRODUCTION_KEY;

export let SUPABASE_URL = configuredUrl;
export let SUPABASE_KEY = configuredKey;

function createSupabaseClient(url: string, key: string): SupabaseClient {
    return createClient(url, key, {
        auth: {
            storage: AsyncStorage,
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
        },
    });
}

export let supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);

/** Load a user-selected backend before core stores are imported. */
export async function initializeSupabase(): Promise<void> {
    const raw = await AsyncStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw) as { url?: string; anonKey?: string };
        if (!parsed.url || !parsed.anonKey) return;
        SUPABASE_URL = parsed.url;
        SUPABASE_KEY = parsed.anonKey;
        supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY);
    } catch {
        // Ignore malformed local configuration and retain the build-time backend.
    }
}

export { CONFIG_STORAGE_KEY };
