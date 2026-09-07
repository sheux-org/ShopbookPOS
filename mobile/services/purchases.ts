/**
 * RevenueCat SDK wrapper.
 *
 * Only the OWNER's device ever talks to this. Staff sessions and the web
 * client read entitlement from the server (get_entitlement RPC) and never
 * configure the SDK — a cashier has nothing to buy and must not be able to.
 *
 * In Expo Go the native module is absent and the SDK falls back to Preview
 * API Mode, so every call here is safe but inert. Real purchases need a
 * development build.
 */

import { Linking, Platform } from 'react-native';
import Purchases, {
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

export const ENTITLEMENT_ID = 'shopbook_pos_pro';

const PLAY_SUBSCRIPTIONS_URL = 'https://play.google.com/store/account/subscriptions';

let configured = false;

export function isPurchasesConfigured(): boolean {
  return configured;
}

/**
 * Called once at app start. Returns false when no key is present, which is the
 * normal state until the RevenueCat project exists — callers must treat a
 * false return as "purchases unavailable", never as an error.
 */
export function configurePurchases(): boolean {
  if (configured) return true;

  const apiKey =
    Platform.select({
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    }) || process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY;

  if (!apiKey) return false;

  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });
    configured = true;
    return true;
  } catch (err) {
    console.warn('[Purchases] configure failed:', err);
    return false;
  }
}

/** Identify the owner to RevenueCat. `ownerId` is owners.id (uuid), never a phone. */
export async function loginPurchases(ownerId: string): Promise<CustomerInfo | null> {
  if (!configured) return null;
  try {
    const { customerInfo } = await Purchases.logIn(ownerId);
    return customerInfo;
  } catch (err) {
    console.warn('[Purchases] logIn failed:', err);
    return null;
  }
}

export async function logoutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch {
    // Logging out an anonymous user throws; nothing to do about it.
  }
}

export async function getProPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return [];
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current?.availablePackages ?? [];
  } catch (err) {
    console.warn('[Purchases] getOfferings failed:', err);
    return [];
  }
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases(): Promise<CustomerInfo> {
  return await Purchases.restorePurchases();
}

/**
 * Open the store's subscription management UI. showManageSubscriptions() is
 * iOS-only in react-native-purchases; Android uses CustomerInfo.managementURL.
 */
export async function manageSubscription(managementUrl?: string | null): Promise<void> {
  if (Platform.OS === 'ios' && configured) {
    await Purchases.showManageSubscriptions();
    return;
  }
  await Linking.openURL(managementUrl ?? PLAY_SUBSCRIPTIONS_URL);
}

/**
 * Whether the store will apply the introductory free trial to this customer.
 *
 * Android ALWAYS reports UNKNOWN — the Play SDK cannot answer this — so the
 * default of true is not merely defensive, it is the only usable behaviour
 * there. Both stores apply the offer automatically to eligible customers and
 * charge everyone else, so a false negative would hide the trial from people
 * entitled to it, while a false positive only overstates the button copy and
 * the store's own sheet states the real terms before anything is charged.
 */
export async function isTrialEligible(productId: string): Promise<boolean> {
  if (!configured) return true;
  try {
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([productId]);
    const status = result[productId]?.status;
    // Only an explicit no counts as a no. UNKNOWN means the platform could not
    // answer — always the case on Android, and on iOS without a sandbox
    // account — and treating that as ineligible would hide the trial from
    // everyone on Play.
    return (
      status !== INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE &&
      status !== INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS
    );
  } catch {
    return true;
  }
}

export function hasProEntitlement(info: CustomerInfo): boolean {
  return ENTITLEMENT_ID in info.entitlements.active;
}

export function proExpiryFromCustomerInfo(info: CustomerInfo): string | null {
  return info.entitlements.active[ENTITLEMENT_ID]?.expirationDate ?? null;
}

export function addCustomerInfoListener(cb: (info: CustomerInfo) => void): () => void {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(cb);
  return () => Purchases.removeCustomerInfoUpdateListener(cb);
}
