import AsyncStorage from '@react-native-async-storage/async-storage';
import { PRODUCTION_KEY, PRODUCTION_URL } from './supabase';

const STORAGE_KEY = 'simpletracker.backend.config';

export interface BackendConfig {
    url: string;
    anonKey: string;
}

export async function getStoredBackendConfig(): Promise<BackendConfig | null> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<BackendConfig>;
        if (typeof parsed.url === 'string' && typeof parsed.anonKey === 'string' && parsed.url && parsed.anonKey) {
            return { url: parsed.url, anonKey: parsed.anonKey };
        }
    } catch {
        // Ignore malformed local configuration.
    }
    return null;
}

export async function saveBackendConfig(config: BackendConfig): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function resetBackendConfig(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
}

export function getProductionBackendConfig(): BackendConfig {
    return {
        url: PRODUCTION_URL,
        anonKey: PRODUCTION_KEY,
    };
}
