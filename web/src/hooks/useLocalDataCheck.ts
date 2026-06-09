import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSyncStore } from '../stores/syncStore';
import database from '../db/database';

export function useLocalDataCheck(): boolean | null {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const syncing = useSyncStore((s) => s.isSyncing);
  const [hasLocalData, setHasLocalData] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoggedIn) {
      database
        .get('products')
        .query()
        .fetch()
        .then((prods) => {
          setHasLocalData(prods.length > 0);
        })
        .catch(() => {
          setHasLocalData(false);
        });
    } else {
      setHasLocalData(null);
    }
  }, [isLoggedIn, syncing]);

  return hasLocalData;
}
