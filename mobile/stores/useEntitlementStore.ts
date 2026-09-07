/**
 * Server-backed Pro entitlement. Replaces useSettingsStore.isPremium.
 *
 * Two writers:
 *   'rpc' — get_entitlement(business_id). The source of truth. Works for
 *           owners, staff and web alike, because entitlement is scoped to the
 *           business's owner rather than to the device.
 *   'sdk' — RevenueCat CustomerInfo on the owner's device. Only used to unlock
 *           instantly after a purchase, before the webhook has landed.
 *
 * Persisted so a till that opens with no connectivity keeps working. The cache
 * is trusted until expiresAt and no further — grace periods are expressed
 * server-side by the webhook extending expires_at, not by the client.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CustomerInfo } from 'react-native-purchases';
import { supabase } from '../services/sync';
import { ENTITLEMENT_ID } from '../services/purchases';

type Source = 'rpc' | 'sdk' | 'none';

interface EntitlementState {
  isPro: boolean;
  isTrial: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  productId: string | null;
  store: string | null;
  managementUrl: string | null;
  ownerId: string | null;
  checkedAt: number | null;
  source: Source;
  isRefreshing: boolean;

  refresh: (businessId: string | null) => Promise<void>;
  setFromSdk: (info: CustomerInfo) => void;
  reset: () => void;
}

const EMPTY = {
  isPro: false,
  isTrial: false,
  expiresAt: null,
  willRenew: false,
  productId: null,
  store: null,
  managementUrl: null,
  ownerId: null,
  checkedAt: null,
  source: 'none' as Source,
  isRefreshing: false,
};

/**
 * A cached positive result stays valid until its own expiry. Without this, a
 * device that has been offline past the subscription's end date would keep
 * unlocking Pro forever.
 */
function stillValid(expiresAt: string | null, isPro: boolean): boolean {
  if (!isPro) return false;
  if (!expiresAt) return true;
  return Date.parse(expiresAt) > Date.now();
}

export const useEntitlementStore = create<EntitlementState>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      refresh: async (businessId) => {
        if (!businessId) return;
        if (get().isRefreshing) return;

        set({ isRefreshing: true });
        try {
          const { data, error } = await supabase.rpc('get_entitlement', {
            client_business_id: businessId,
          });

          if (error) {
            // Offline or RPC failure: keep the cached value, expiry still applies.
            console.warn('[Entitlement] refresh failed:', error.message);
            return;
          }

          const row = (data ?? {}) as Record<string, unknown>;
          set({
            isPro: !!row.is_pro,
            isTrial: !!row.is_trial,
            expiresAt: (row.expires_at as string) ?? null,
            willRenew: !!row.will_renew,
            productId: (row.product_id as string) ?? null,
            store: (row.store as string) ?? null,
            managementUrl: (row.management_url as string) ?? null,
            ownerId: (row.owner_id as string) ?? null,
            checkedAt: Date.now(),
            source: 'rpc',
          });
        } finally {
          set({ isRefreshing: false });
        }
      },

      /**
       * Optimistic unlock straight after a purchase. Deliberately only ever
       * turns Pro ON — a missing entitlement in CustomerInfo can mean the
       * store sheet was cancelled, not that the subscription ended, and the
       * RPC is what is allowed to revoke.
       */
      setFromSdk: (info) => {
        const active = info.entitlements.active[ENTITLEMENT_ID];
        if (!active) return;

        set({
          isPro: true,
          isTrial: active.periodType === 'TRIAL',
          expiresAt: active.expirationDate ?? null,
          willRenew: active.willRenew,
          productId: active.productIdentifier ?? null,
          store: active.store ?? null,
          managementUrl: info.managementURL ?? null,
          checkedAt: Date.now(),
          source: 'sdk',
        });
      },

      reset: () => set({ ...EMPTY }),
    }),
    {
      name: 'entitlement-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        isPro: s.isPro,
        isTrial: s.isTrial,
        expiresAt: s.expiresAt,
        willRenew: s.willRenew,
        productId: s.productId,
        store: s.store,
        managementUrl: s.managementUrl,
        ownerId: s.ownerId,
        checkedAt: s.checkedAt,
        source: s.source,
      }),
      // Re-evaluate the cached expiry at hydration rather than trusting the
      // stored boolean.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!stillValid(state.expiresAt, state.isPro)) {
          state.isPro = false;
          state.isTrial = false;
        }
      },
    }
  )
);

/** Non-hook read for use inside services and event handlers. */
export const getIsPro = () => useEntitlementStore.getState().isPro;
