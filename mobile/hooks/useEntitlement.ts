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
import { useEntitlementStore } from '../stores/useEntitlementStore';
import {
  addCustomerInfoListener,
  isPurchasesConfigured,
  logoutPurchases,
} from '../services/purchases';

/**
 * Whether this session owns the active business.
 *
 * Answered by get_entitlement, not derived here. The previous version
 * compared the session's phone against the active business's phone, which
 * silently returned false whenever the local database had not been populated
 * yet — the state every fresh install is in, and the one the hard paywall
 * prevents the app from leaving.
 */
export function useIsBusinessOwner(): boolean {
  return useEntitlementStore((s) => s.isOwner);
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

/**
 * Which plan a store product id represents.
 *
 * Matched loosely because the three stores name the same plan differently:
 * `lk.shopbook.pos.pro.annual` on the App Store, `pro:annual-1y` on Play,
 * `yearly` on the Test Store. Order matters — "three_month" contains "month",
 * so the longer periods are tested first.
 */
export function planNameFromProductId(productId: string | null): string | null {
  if (!productId) return null;
  const id = productId.toLowerCase();
  if (id.includes('annual') || id.includes('year')) return '1 Year';
  if (id.includes('quarter') || id.includes('three') || id.includes('3m')) return '3 Months';
  if (id.includes('month')) return '1 Month';
  return null;
}

/**
 * Everything a screen needs to describe the current subscription in one read.
 * Used by the manage screen and by the Profile row that links to it, so the
 * two can never disagree about what the customer is paying for.
 */
export function useSubscriptionSummary() {
  const isPro = useEntitlementStore((s) => s.isPro);
  const isTrial = useEntitlementStore((s) => s.isTrial);
  const expiresAt = useEntitlementStore((s) => s.expiresAt);
  const willRenew = useEntitlementStore((s) => s.willRenew);
  const productId = useEntitlementStore((s) => s.productId);

  return { isPro, isTrial, expiresAt, willRenew, planName: planNameFromProductId(productId) };
}
