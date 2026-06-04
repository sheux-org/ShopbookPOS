import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { syncDatabase } from '../services/sync';
import { useSettingsStore } from '../stores/useSettingsStore';

export function useWatermelonSync() {
  const isBackupEnabled = useSettingsStore((s) => s.isBackupEnabled);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!isBackupEnabled) return;

    const runSync = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        await syncDatabase();
      } finally {
        isSyncingRef.current = false;
      }
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
