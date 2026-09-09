import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useSyncStore } from '../stores/syncStore';
import { syncDatabase, supabase, getClientId } from '../services/sync';

export function useAppSync(hydrated: boolean, isPro: boolean = false) {
  const queryClient = useQueryClient();
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const loadBusinessesFromDb = useBusinessStore((s) => s.loadBusinessesFromDb);
  const { syncSuccess } = useSyncStore();

  const handleSync = async () => {
    if (!isPro) return;
    try {
      await syncDatabase();
    } catch {
      // Handled inside syncDatabase
    }
  };

  // A zustand session without a Supabase session (an install that predates
  // Supabase Auth, or one revoked server-side) goes back to login.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const lost = event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session);
      if (lost && useAuthStore.getState().isLoggedIn) useAuthStore.getState().logout();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Sync Success cache invalidator
  useEffect(() => {
    if (syncSuccess === true && isPro) {
      loadBusinessesFromDb();
      queryClient.invalidateQueries();
      const timer = setTimeout(() => {
        useSyncStore.getState().setSyncSuccess(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [syncSuccess, isPro, queryClient, loadBusinessesFromDb]);

  // Trigger immediate sync when connection state is restored (Pro sessions only)
  useEffect(() => {
    if (!hydrated || !isLoggedIn || !isPro) return;

    const handleOnline = () => {
      console.log('Device is back online, triggering sync...');
      handleSync();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [hydrated, isLoggedIn, isPro]);

  // Auto trigger sync on mount, login, or when changing active business (Pro sessions only)
  useEffect(() => {
    if (hydrated && isLoggedIn && isPro) {
      const targetBizId =
        activeBusinessId || (activeBusiness?.id !== '0' ? activeBusiness?.id : null);
      if (targetBizId && targetBizId !== '0') {
        useSettingsStore.getState().setBackupEnabled(true);
        handleSync();
      }
    }
  }, [hydrated, isLoggedIn, isPro, activeBusiness?.id, activeBusinessId]);

  // Real-time Supabase Broadcast listener for reactive sync (Pro sessions only)
  useEffect(() => {
    if (!isLoggedIn || !activeBusinessId || !isPro) return;

    const clientId = getClientId();
    const channel = supabase
      .channel(`sync:${activeBusinessId}`, { config: { private: true } })
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
  }, [isLoggedIn, activeBusinessId, isPro]);

  return { handleSync };
}
