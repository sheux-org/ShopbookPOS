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
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  const storeKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  });

  // Local development runs against the RevenueCat Test Store: a simulator has
  // no App Store account, so the store keys drop it into an Apple sign-in that
  // never completes. A release build never reads the test key, even if the
  // variable is present in its environment.
  const apiKey =
    __DEV__ && process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY
      ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY
      : storeKey;

  if (!apiKey) return false;

  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
    Purchases.configure({ apiKey });
    configured = true;
    void prefetchProPackages();
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

export const FALLBACK_PACKAGES: PurchasesPackage[] = [
  {
    identifier: '$rc_annual',
    packageType: 'ANNUAL' as any,
    product: {
      identifier: 'shopbook_pro_annual_36000',
      description: 'Shopbook POS Pro - 1 Year',
      title: '1 Year Pro',
      price: 36000,
      priceString: 'Rs 36,000',
      currencyCode: 'LKR',
    } as any,
    offeringIdentifier: 'default',
  } as unknown as PurchasesPackage,
  {
    identifier: '$rc_three_month',
    packageType: 'THREE_MONTH' as any,
    product: {
      identifier: 'shopbook_pro_quarterly_10500',
      description: 'Shopbook POS Pro - 3 Months',
      title: '3 Months Pro',
      price: 10500,
      priceString: 'Rs 10,500',
      currencyCode: 'LKR',
    } as any,
    offeringIdentifier: 'default',
  } as unknown as PurchasesPackage,
  {
    identifier: '$rc_monthly',
    packageType: 'MONTHLY' as any,
    product: {
      identifier: 'shopbook_pro_monthly_4000',
      description: 'Shopbook POS Pro - 1 Month',
      title: '1 Month Pro',
      price: 4000,
      priceString: 'Rs 4,000',
      currencyCode: 'LKR',
    } as any,
    offeringIdentifier: 'default',
  } as unknown as PurchasesPackage,
];

const PACKAGES_CACHE_KEY = '@shopbook_pro_packages_cache';

let cachedPackages: PurchasesPackage[] = FALLBACK_PACKAGES;
let isPackagesLoaded = false;
let packageListeners: Array<() => void> = [];

// Hydrate from persistent disk cache immediately
AsyncStorage.getItem(PACKAGES_CACHE_KEY)
  .then((json) => {
    if (json) {
      try {
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedPackages = parsed;
          isPackagesLoaded = true;
          packageListeners.forEach((cb) => cb());
        }
      } catch {}
    }
  })
  .catch(() => {});

export function isProPackagesReady(): boolean {
  return isPackagesLoaded;
}

export function onProPackagesReady(callback: () => void): () => void {
  if (isPackagesLoaded) {
    callback();
    return () => {};
  }
  packageListeners.push(callback);
  return () => {
    packageListeners = packageListeners.filter((cb) => cb !== callback);
  };
}

export function getCachedProPackages(): PurchasesPackage[] {
  return cachedPackages;
}

export async function prefetchProPackages(): Promise<PurchasesPackage[]> {
  if (!configured) {
    isPackagesLoaded = true;
    packageListeners.forEach((cb) => cb());
    return cachedPackages;
  }
  try {
    const offerings = await Purchases.getOfferings();
    const livePackages = offerings.current?.availablePackages;
    if (livePackages && livePackages.length > 0) {
      cachedPackages = livePackages;
      void AsyncStorage.setItem(PACKAGES_CACHE_KEY, JSON.stringify(livePackages)).catch(() => {});
    }
    isPackagesLoaded = true;
    packageListeners.forEach((cb) => cb());
    return cachedPackages;
  } catch (err) {
    console.warn('[Purchases] prefetchProPackages failed:', err);
    isPackagesLoaded = true;
    packageListeners.forEach((cb) => cb());
    return cachedPackages;
  }
}

export async function getProPackages(): Promise<PurchasesPackage[]> {
  if (!configured) return cachedPackages;
  if (isPackagesLoaded && cachedPackages.length > 0) {
    // Return cached immediately; refresh in background
    Purchases.getOfferings()
      .then((offerings) => {
        const livePackages = offerings.current?.availablePackages;
        if (livePackages && livePackages.length > 0) {
          cachedPackages = livePackages;
          void AsyncStorage.setItem(PACKAGES_CACHE_KEY, JSON.stringify(livePackages)).catch(
            () => {}
          );
        }
      })
      .catch(() => {});
    return cachedPackages;
  }
  return prefetchProPackages();
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  let packageToPurchase = pkg;
  if (configured) {
    try {
      const offerings = await Purchases.getOfferings();
      const live = offerings.current?.availablePackages?.find(
        (p) => p.identifier === pkg.identifier
      );
      if (live) packageToPurchase = live;
    } catch {}
  }
  const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
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
