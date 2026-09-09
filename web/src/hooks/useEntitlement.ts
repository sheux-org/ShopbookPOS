'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useEntitlementStore, EntitlementStatus } from '../stores/useEntitlementStore';

export interface Entitlement {
  is_pro: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  expires_at: string | null;
  will_renew: boolean;
  product_id: string | null;
  store: string | null;
  management_url: string | null;
  owner_id: string | null;
}

/**
 * Web consumes entitlement, it never sells it. RevenueCat Web Billing requires
 * Stripe, and Stripe does not onboard Sri Lankan entities — so the subscription
 * is always bought in the mobile app, and this only reads the result.
 *
 * Uses useEntitlementStore with persistent localStorage caching to eliminate
 * UI flash (FOUC) and strictly enforce fail-closed security.
 */
export function useEntitlement() {
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const isPro = useEntitlementStore((s) => s.isPro);
  const isTrial = useEntitlementStore((s) => s.isTrial);
  const expiresAt = useEntitlementStore((s) => s.expiresAt);
  const willRenew = useEntitlementStore((s) => s.willRenew);
  const productId = useEntitlementStore((s) => s.productId);
  const store = useEntitlementStore((s) => s.store);
  const managementUrl = useEntitlementStore((s) => s.managementUrl);
  const ownerId = useEntitlementStore((s) => s.ownerId);
  const isRefreshing = useEntitlementStore((s) => s.isRefreshing);
  const hasCheckedServer = useEntitlementStore((s) => s.hasCheckedServer);
  const lastError = useEntitlementStore((s) => s.lastError);
  const refresh = useEntitlementStore((s) => s.refresh);
  const getStatus = useEntitlementStore((s) => s.getStatus);

  const status: EntitlementStatus = getStatus(activeBusinessId);

  // Trigger server check on mount or when active business changes
  useEffect(() => {
    if (!isLoggedIn || !activeBusinessId || activeBusinessId === '0') {
      return;
    }

    void refresh(activeBusinessId);

    // Refetch when window regains focus to keep entitlement synced
    const handleFocus = () => {
      void refresh(activeBusinessId);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [isLoggedIn, activeBusinessId, refresh]);

  const refetch = useCallback(async () => {
    if (activeBusinessId && activeBusinessId !== '0') {
      await refresh(activeBusinessId);
    }
  }, [activeBusinessId, refresh]);

  const entitlement: Entitlement = {
    is_pro: isPro,
    is_trial: isTrial,
    trial_ends_at: null,
    expires_at: expiresAt,
    will_renew: willRenew,
    product_id: productId,
    store: store,
    management_url: managementUrl,
    owner_id: ownerId,
  };

  return {
    entitlement,
    isPro,
    status,
    // isResolved indicates that a definitive check has been performed
    isResolved: hasCheckedServer,
    isLoading: status === 'INITIALIZING' || isRefreshing,
    lastError,
    refetch,
  };
}
