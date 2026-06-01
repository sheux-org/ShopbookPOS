import { supabase } from "./sync";

export interface AppConfig {
  force_update: boolean;
  min_version: string;
  android_url: string;
  ios_url: string;
}

/**
 * Fetches the global application configuration settings from Supabase.
 * This includes parameters for force updating.
 */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("force_update, min_version, android_url, ios_url")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("Error fetching app configuration:", error.message);
      return null;
    }

    return data as AppConfig;
  } catch (err) {
    console.error("Failed to fetch app config due to connection/unexpected error:", err);
    return null;
  }
}
