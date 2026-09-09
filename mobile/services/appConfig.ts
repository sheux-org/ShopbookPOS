import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './sync';

export interface AppConfig {
  force_update: boolean;
  min_version: string;
  android_url: string;
  ios_url: string;
  /** Kill switch: hides purchase CTAs until the stores approve the products. */
  iap_enabled: boolean;
  terms_url: string;
  privacy_url: string;
}

const CACHE_KEY = '@shopbook_app_config_cache';

const DEFAULT_CONFIG: AppConfig = {
  force_update: false,
  min_version: '1.0.0',
  android_url: '',
  ios_url: '',
  iap_enabled: true,
  terms_url: 'https://pos.shopbook.lk/terms',
  privacy_url: 'https://pos.shopbook.lk/privacy',
};

let cachedAppConfig: AppConfig = DEFAULT_CONFIG;

// Load persisted config eagerly on module load
AsyncStorage.getItem(CACHE_KEY)
  .then((json) => {
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') {
          cachedAppConfig = { ...DEFAULT_CONFIG, ...parsed };
        }
      } catch {}
    }
  })
  .catch(() => {});

export function getCachedAppConfig(): AppConfig {
  return cachedAppConfig;
}

/**
 * Fetches the global application configuration settings from Supabase.
 * This includes parameters for force updating.
 */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  if (cachedAppConfig) {
    void Promise.resolve(
      supabase
        .from('app_config')
        .select(
          'force_update, min_version, android_url, ios_url, iap_enabled, terms_url, privacy_url'
        )
        .eq('id', 1)
        .single()
    )
      .then(({ data, error }) => {
        if (!error && data) {
          cachedAppConfig = data as AppConfig;
          void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
        }
      })
      .catch(() => {});
    return cachedAppConfig;
  }

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select(
        'force_update, min_version, android_url, ios_url, iap_enabled, terms_url, privacy_url'
      )
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Error fetching app configuration:', error.message);
      return cachedAppConfig;
    }

    cachedAppConfig = data as AppConfig;
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data)).catch(() => {});
    return cachedAppConfig;
  } catch (err) {
    console.error('Failed to fetch app config due to connection/unexpected error:', err);
    return null;
  }
}
