'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/sync';
import { useAuthStore } from '../stores/authStore';

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

const EMPTY: Entitlement = {
  is_pro: false,
  is_trial: false,
  trial_ends_at: null,
  expires_at: null,
  will_renew: false,
  product_id: null,
  store: null,
  management_url: null,
  owner_id: null,
};

/**
 * Web consumes entitlement, it never sells it. RevenueCat Web Billing requires
 * Stripe, and Stripe does not onboard Sri Lankan entities — so the subscription
 * is always bought in the mobile app, and this only reads the result.
 */
export function useEntitlement() {
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const query = useQuery({
    queryKey: ['entitlement', activeBusinessId],
    enabled: !!isLoggedIn && !!activeBusinessId && activeBusinessId !== '0',
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async (): Promise<Entitlement> => {
      const { data, error } = await supabase.rpc('get_entitlement', {
        client_business_id: activeBusinessId,
      });
      if (error) throw new Error(error.message);
      return { ...EMPTY, ...(data as Partial<Entitlement>) };
    },
  });

  return {
    entitlement: query.data ?? EMPTY,
    isPro: query.data?.is_pro ?? false,
    // Never block on a network hiccup — an unreachable RPC must not lock a till
    // out of the terminal it already paid for.
    isResolved: query.isSuccess,
    isLoading: query.isLoading,
  };
}
