import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { syncDatabase } from '../services/sync';
import { useSettingsStore } from '../stores/useSettingsStore';

export function useWatermelonSync() {
  const isBackupEnabled = useSettingsStore((s) => s.isBackupEnabled);

  useEffect(() => {
    if (!isBackupEnabled) return;

    const runSync = () => {
      syncDatabase().catch((err) => console.error('[WatermelonSync] Sync failed:', err));
    };

    void runSync();

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') void runSync();
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [isBackupEnabled]);
}
