/**
 * Paywall funnel logging.
 *
 * RevenueCat reports everything from purchase intent onward. It cannot see
 * the people who reached the paywall and left — which, on a hard paywall, is
 * the number that decides whether the product works. This fills that gap.
 *
 * Fire-and-forget by design: telemetry must never block or fail a purchase.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './sync';

export type PaywallEvent =
  | 'viewed'
  | 'plan_selected'
  | 'purchase_started'
  | 'purchase_cancelled'
  | 'purchase_failed'
  | 'purchase_succeeded'
  | 'restore_attempted';

export function logPaywallEvent(
  event: PaywallEvent,
  params: {
    businessId?: string | null;
    packageId?: string | null;
    productId?: string | null;
    metadata?: Record<string, unknown>;
  } = {}
): void {
  void supabase
    .rpc('log_paywall_event', {
      input_event: event,
      input_business_id: params.businessId ?? null,
      input_package_id: params.packageId ?? null,
      input_product_id: params.productId ?? null,
      input_platform: Platform.OS,
      input_app_version: Constants.expoConfig?.version ?? null,
      input_metadata: params.metadata ?? {},
    })
    .then(({ error }) => {
      if (error) console.warn('[Paywall] telemetry failed:', error.message);
    });
}
