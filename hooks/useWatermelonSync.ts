import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { syncDatabase } from '../services/sync';
import { useSettingsStore } from '../stores/useSettingsStore';

const SYNC_INTERVAL_MS = 60_000;

export function useWatermelonSync() {
  const isBackupEnabled = useSettingsStore((s) => s.isBackupEnabled);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!isBackupEnabled) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;

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

    intervalId = setInterval(() => {
      void runSync();
    }, SYNC_INTERVAL_MS);

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') void runSync();
    };

    const subscription = AppState.addEventListener('change', onAppStateChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      subscription.remove();
    };
  }, [isBackupEnabled]);
}
