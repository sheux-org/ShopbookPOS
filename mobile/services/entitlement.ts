/**
 * Post-login entitlement bootstrap.
 *
 * Called once per successful login/registration. Two jobs:
 *   1. If this session is the business OWNER, mint/fetch owners.id and hand it
 *      to RevenueCat as the App User ID. Staff never reach this branch, so no
 *      RevenueCat customer is ever created for a cashier.
 *   2. Refresh the entitlement cache from the server for everyone.
 *
 * Every step is best-effort: a failure here must never block login. The worst
 * outcome is that Pro stays locked until the next foreground refresh.
 */

import { supabase } from './sync';
import { loginPurchases, isPurchasesConfigured } from './purchases';
import { useEntitlementStore } from '../stores/useEntitlementStore';

export async function bootstrapEntitlement(params: {
  businessId: string;
  isOwner: boolean;
}): Promise<void> {
  const { businessId, isOwner } = params;

  if (isOwner) {
    try {
      // Minting the owners row is NOT conditional on the RevenueCat SDK being
      // configured. get_entitlement inner-joins businesses -> owners, and the
      // free trial is derived from owners.created_at, so skipping this before
      // the SDK keys exist would resolve every user to is_pro=false forever.
      const { data: ownerId, error } = await supabase.rpc('get_or_create_owner');
      if (error) throw new Error(error.message);

      if (ownerId && isPurchasesConfigured()) {
        await loginPurchases(ownerId as string);
      }
    } catch (err) {
      console.warn('[Entitlement] owner identification failed:', err);
    }
  }

  await useEntitlementStore.getState().refresh(businessId);
}
