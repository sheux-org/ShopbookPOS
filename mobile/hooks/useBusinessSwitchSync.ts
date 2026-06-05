import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { requestFullPullForBusiness, syncDatabase } from '../services/sync';
import { useAuthStore } from '../stores/useAuthStore';
import { useCart } from '../stores/useCart';
import { useSettingsStore } from '../stores/useSettingsStore';

/**
 * Mirrors web layout behavior: when the active business changes, clear the cart,
 * invalidate cached queries, and pull fresh data for the new branch.
 */
export function useBusinessSwitchSync() {
  const queryClient = useQueryClient();
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const prevBizIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeBusinessId || activeBusinessId === '0') {
      prevBizIdRef.current = activeBusinessId;
      return;
    }

    const prevBizId = prevBizIdRef.current;
    const businessChanged = prevBizId !== null && prevBizId !== activeBusinessId;

    if (businessChanged) {
      useCart.getState().clearCart();
      queryClient.invalidateQueries();
      useSettingsStore.getState().setBackupEnabled(true);
      requestFullPullForBusiness(activeBusinessId);
      syncDatabase().catch((err) => console.error('[BusinessSwitch] Sync failed:', err));
    }

    prevBizIdRef.current = activeBusinessId;
  }, [activeBusinessId, queryClient]);
}
