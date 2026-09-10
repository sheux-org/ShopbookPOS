/**
 * Server-backed Pro entitlement store for Web Terminal.
 * Mirroring mobile/stores/useEntitlementStore.ts security architecture.
 *
 * Web access is itself a Pro feature:
 * - Strict Fail-Closed (Default-Deny)
 * - Persisted cache in localStorage so valid subscribers load instantly without layout flash (Zero-FOUC)
 * - Scoped strictly to cachedBusinessId to prevent cross-business entitlement leakage
 * - Automatic background revalidation against Supabase RPC 'get_entitlement'
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../services/supabaseClient';

export type EntitlementStatus = 'INITIALIZING' | 'VERIFIED_PRO' | 'BLOCKED' | 'NETWORK_ERROR';

export interface EntitlementState {
  isPro: boolean;
  isTrial: boolean;
  isOwner: boolean;
  expiresAt: string | null;
  willRenew: boolean;
  productId: string | null;
  store: string | null;
  managementUrl: string | null;
  ownerId: string | null;
  checkedAt: number | null;
  cachedBusinessId: string | null;
  isRefreshing: boolean;
  hasCheckedServer: boolean;
  lastError: string | null;

  refresh: (businessId: string | null) => Promise<void>;
  getStatus: (currentBusinessId: string | null) => EntitlementStatus;
  reset: () => void;
}

const EMPTY = {
  isPro: false,
  isTrial: false,
  isOwner: false,
  expiresAt: null,
  willRenew: false,
  productId: null,
  store: null,
  managementUrl: null,
  ownerId: null,
  checkedAt: null,
  cachedBusinessId: null,
  isRefreshing: false,
  hasCheckedServer: false,
  lastError: null,
};

function stillValid(expiresAt: string | null, isPro: boolean): boolean {
  if (!isPro) return false;
  if (!expiresAt) return true;
  return Date.parse(expiresAt) > Date.now();
}

export const useEntitlementStore = create<EntitlementState>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      refresh: async (businessId: string | null) => {
        if (!businessId || businessId === '0') {
          set({
            isPro: false,
            isTrial: false,
            hasCheckedServer: true,
            isRefreshing: false,
            cachedBusinessId: businessId,
          });
          return;
        }

        // If switching business, invalidate old cache immediately to prevent entitlement leak
        if (get().cachedBusinessId !== businessId) {
          set({
            isPro: false,
            isTrial: false,
            expiresAt: null,
            hasCheckedServer: false,
            checkedAt: null,
            cachedBusinessId: businessId,
            lastError: null,
          });
        }

        if (get().isRefreshing) return;

        set({ isRefreshing: true, lastError: null });
        try {
          const { data, error } = await supabase.rpc('get_entitlement', {
            client_business_id: businessId,
          });

          if (error) {
            console.warn('[Web Entitlement] get_entitlement RPC error:', error.message);
            set({
              lastError: error.message,
              hasCheckedServer: true,
              isRefreshing: false,
            });
            return;
          }

          const row = (data ?? {}) as Record<string, unknown>;
          const serverIsPro = !!row.is_pro;
          const serverExpiresAt = (row.expires_at as string) ?? null;

          set({
            isPro: serverIsPro && stillValid(serverExpiresAt, serverIsPro),
            isTrial: !!row.is_trial,
            isOwner: !!row.is_owner,
            expiresAt: serverExpiresAt,
            willRenew: !!row.will_renew,
            productId: (row.product_id as string) ?? null,
            store: (row.store as string) ?? null,
            managementUrl: (row.management_url as string) ?? null,
            ownerId: (row.owner_id as string) ?? null,
            checkedAt: Date.now(),
            cachedBusinessId: businessId,
            hasCheckedServer: true,
            lastError: null,
            isRefreshing: false,
          });
        } catch (err: any) {
          console.warn('[Web Entitlement] fetch exception:', err?.message);
          set({
            lastError: err?.message || 'Network error',
            hasCheckedServer: true,
            isRefreshing: false,
          });
        }
      },

      getStatus: (currentBusinessId: string | null) => {
        const state = get();
        if (!currentBusinessId || currentBusinessId === '0') {
          return 'BLOCKED';
        }

        // Cache must belong to current business
        const isCurrentBiz = state.cachedBusinessId === currentBusinessId;
        const validCached = isCurrentBiz && state.isPro && stillValid(state.expiresAt, state.isPro);

        if (validCached) {
          return 'VERIFIED_PRO';
        }

        // If server responded and is not Pro
        if (state.hasCheckedServer && !state.isPro && !state.lastError) {
          return 'BLOCKED';
        }

        // If server query failed and we don't have valid cache
        if (state.hasCheckedServer && state.lastError && !validCached) {
          return 'NETWORK_ERROR';
        }

        // Still waiting for server check
        return 'INITIALIZING';
      },

      reset: () => set({ ...EMPTY }),
    }),
    {
      name: 'shopbook-web-entitlement',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        isPro: s.isPro,
        isTrial: s.isTrial,
        isOwner: s.isOwner,
        expiresAt: s.expiresAt,
        willRenew: s.willRenew,
        productId: s.productId,
        store: s.store,
        managementUrl: s.managementUrl,
        ownerId: s.ownerId,
        checkedAt: s.checkedAt,
        cachedBusinessId: s.cachedBusinessId,
      }),
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

export const getWebIsPro = () => useEntitlementStore.getState().isPro;
