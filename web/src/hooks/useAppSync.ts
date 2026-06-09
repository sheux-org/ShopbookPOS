import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSyncStore } from '../stores/syncStore';
import { syncDatabase, supabase, getClientId } from '../services/sync';

export function useAppSync(hydrated: boolean) {
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const loadBusinessesFromDb = useBusinessStore((s) => s.loadBusinessesFromDb);
  const { syncSuccess } = useSyncStore();

  const handleSync = async () => {
    try {
      await syncDatabase();
    } catch {
      // Handled inside syncDatabase
    }
  };

  // Sync Success cache invalidator
  useEffect(() => {
    if (syncSuccess === true) {
      loadBusinessesFromDb();
      queryClient.invalidateQueries();
      const timer = setTimeout(() => {
        useSyncStore.getState().setSyncSuccess(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [syncSuccess, queryClient, loadBusinessesFromDb]);

  // Trigger immediate sync when connection state is restored
  useEffect(() => {
    if (!hydrated || !isLoggedIn) return;

    const handleOnline = () => {
      console.log('Device is back online, triggering sync...');
      handleSync();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [hydrated, isLoggedIn]);

  // Auto trigger sync on mount, login, or when changing active business
  useEffect(() => {
    if (hydrated && isLoggedIn) {
      const targetBizId =
        activeBusinessId || (activeBusiness?.id !== '0' ? activeBusiness?.id : null);
      if (targetBizId && targetBizId !== '0') {
        useSettingsStore.getState().setBackupEnabled(true);
        handleSync();
      }
    }
  }, [hydrated, isLoggedIn, activeBusiness?.id, activeBusinessId]);

  // Real-time Supabase Broadcast listener for reactive sync
  useEffect(() => {
    if (!isLoggedIn || !activeBusinessId) return;

    const clientId = getClientId();
    const channel = supabase
      .channel(`sync:${activeBusinessId}`)
      .on('broadcast', { event: 'sync_trigger' }, (payload) => {
        const data = payload.payload;
        if (data && data.senderId !== clientId && data.businessId === activeBusinessId) {
          console.log(
            `[Sync Broadcast] Received mutation trigger from device: ${data.senderId}. Syncing...`
          );
          handleSync();
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(
            `[Sync Broadcast] Subscribed to realtime sync channel: sync:${activeBusinessId}`
          );
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLoggedIn, activeBusinessId]);

  return { handleSync };
}
