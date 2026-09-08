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

let cachedAppConfig: AppConfig | null = null;

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
        if (!error && data) cachedAppConfig = data as AppConfig;
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
      return null;
    }

    cachedAppConfig = data as AppConfig;
    return cachedAppConfig;
  } catch (err) {
    console.error('Failed to fetch app config due to connection/unexpected error:', err);
    return null;
  }
}
