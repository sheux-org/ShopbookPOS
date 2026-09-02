/**
 * Keeps the entitlement cache fresh and, for owners only, bridges the
 * RevenueCat SDK into it.
 *
 * Mounted once, high in the tree. Refreshes on mount, on business switch, and
 * on app foreground — the same moments sync runs, since an owner who just paid
 * on another device should unlock here without any further action.
 */

import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '../stores/useAuthStore';
import { useBusinessStore } from '../stores/useBusinessStore';
import { useEntitlementStore } from '../stores/useEntitlementStore';
import {
  addCustomerInfoListener,
  isPurchasesConfigured,
  logoutPurchases,
} from '../services/purchases';
import { isBusinessOwner } from '../utils/business';
import { normalizePhone } from '../utils/phoneUtils';

export function useIsBusinessOwner(): boolean {
  const userPhone = useAuthStore((s) => s.userPhone);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  return isBusinessOwner(userPhone, activeBusiness?.phone, normalizePhone);
}

export function useEntitlementSync() {
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const refresh = useEntitlementStore((s) => s.refresh);
  const setFromSdk = useEntitlementStore((s) => s.setFromSdk);

  useEffect(() => {
    if (!isLoggedIn || !activeBusinessId) return;

    void refresh(activeBusinessId);

    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') void refresh(activeBusinessId);
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [isLoggedIn, activeBusinessId, refresh]);

  // Logout teardown lives here rather than in useAuthStore.logout: the auth
  // store cannot import the entitlement store without a cycle
  // (entitlement -> sync -> auth).
  useEffect(() => {
    if (isLoggedIn) return;
    useEntitlementStore.getState().reset();
    void logoutPurchases();
  }, [isLoggedIn]);

  // Owner devices additionally get instant updates from the store (renewal,
  // cancellation, a purchase made in the App Store app itself).
  useEffect(() => {
    if (!isLoggedIn || !isPurchasesConfigured()) return;
    return addCustomerInfoListener((info) => setFromSdk(info));
  }, [isLoggedIn, setFromSdk]);
}

/** The gate every premium feature reads. */
export function useIsPro(): boolean {
  return useEntitlementStore((s) => s.isPro);
}
