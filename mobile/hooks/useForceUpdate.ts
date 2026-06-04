import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { fetchAppConfig, type AppConfig } from '../services/appConfig';

const CACHE_KEY = '@shopbook_app_config_cache';
const DEFAULT_VERSION = '1.0.0';

/**
 * Compares two semantic version strings (e.g., '1.0.0' and '1.1.2').
 * Returns true if current version is less than the minimum version.
 */
export function isVersionLessThan(current: string, min: string): boolean {
  try {
    // Strip suffixes like -beta or +build
    const cleanCurrent = current.split('-')[0].split('+')[0];
    const cleanMin = min.split('-')[0].split('+')[0];

    const currentParts = cleanCurrent.split('.').map((num) => parseInt(num, 10) || 0);
    const minParts = cleanMin.split('.').map((num) => parseInt(num, 10) || 0);

    for (let i = 0; i < Math.max(currentParts.length, minParts.length); i++) {
      const currentVal = currentParts[i] ?? 0;
      const minVal = minParts[i] ?? 0;

      if (currentVal < minVal) return true;
      if (currentVal > minVal) return false;
    }
    return false;
  } catch (err) {
    console.error('Error comparing versions:', err);
    return false;
  }
}

export function useForceUpdate() {
  const currentVersion = Constants.expoConfig?.version ?? DEFAULT_VERSION;
  const [cachedConfig, setCachedConfig] = useState<AppConfig | null>(null);
  const [isCacheLoaded, setIsCacheLoaded] = useState(false);

  // 1. Load cached config from AsyncStorage on mount
  useEffect(() => {
    async function loadCache() {
      try {
        const json = await AsyncStorage.getItem(CACHE_KEY);
        if (json) {
          setCachedConfig(JSON.parse(json));
        }
      } catch (err) {
        console.error('Failed to load app config cache:', err);
      } finally {
        setIsCacheLoaded(true);
      }
    }
    loadCache();
  }, []);

  // 2. Fetch the fresh config from Supabase using React Query
  const {
    data: freshConfig,
    isLoading: isFetching,
    error,
    refetch,
  } = useQuery<AppConfig | null>({
    queryKey: ['appConfig'],
    queryFn: fetchAppConfig,
    staleTime: 1000 * 60 * 5, // 5 minutes cache duration
  });

  // 3. Write fresh config to AsyncStorage cache when fetched successfully
  useEffect(() => {
    if (freshConfig) {
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshConfig)).catch((err) => {
        console.error('Failed to save app config cache:', err);
      });
    }
  }, [freshConfig]);

  // Determine configuration to use: prefer fresh config, fallback to cache
  const activeConfig = freshConfig || cachedConfig;

  // We are loading if we haven't read from AsyncStorage cache yet,
  // AND the network query is currently fetching for the first time without cached data.
  const isLoading = !isCacheLoaded || (isFetching && !activeConfig);

  // Evaluate if update is required
  let isUpdateRequired = false;
  if (activeConfig) {
    const isOutdated = isVersionLessThan(currentVersion, activeConfig.min_version);
    isUpdateRequired = activeConfig.force_update || isOutdated;
  }

  return {
    isLoading,
    isUpdateRequired,
    config: activeConfig,
    currentVersion,
    refetch,
    error,
  };
}
