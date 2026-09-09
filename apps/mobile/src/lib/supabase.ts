import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Config resolution: app.json extra (or EAS secrets) with a production fallback.
// Mirrors the web app's ability to point at a self-hosted Supabase.
const extra = (Constants.expoConfig?.extra ?? {}) as {
    supabaseUrl?: string;
    supabaseAnonKey?: string;
};

const PRODUCTION_URL = 'https://psdmjjcvaxejxktqwdcm.supabase.co';
const PRODUCTION_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzZG1qamN2YXhlanhrdHF3ZGNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzAzMzA0ODMsImV4cCI6MTk4NTkwNjQ4M30.7Uqw2v3Ny5FvPBRBbbvtcUxJj_ReNDjRBUn6cWlal_o';

const SUPABASE_URL = extra.supabaseUrl || PRODUCTION_URL;
const SUPABASE_KEY = extra.supabaseAnonKey || PRODUCTION_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // No URL-based session detection on native.
        detectSessionInUrl: false,
    },
});

export { SUPABASE_URL, SUPABASE_KEY };
