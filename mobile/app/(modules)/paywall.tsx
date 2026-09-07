/**
 * Hard paywall. The only screen between a logged-in user and the app.
 *
 * There is deliberately no dismiss and no skip: entitlement is required to
 * reach the tabs, and app/index.tsx routes here whenever it is missing. The
 * one exit that is not a purchase is logging out, which staff need because a
 * cashier has no card and no authority to buy for the shop.
 *
 * The trial is granted by the STORE as an introductory offer, so "start free
 * trial" is a real purchase with a payment method attached that the store
 * bills automatically when the trial ends. Nothing here grants access on its
 * own — the entitlement still has to come back from the server.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesPackage } from 'react-native-purchases';
import { TOKENS } from '../../constants/tokens';
import { hapticFeedback } from '../../utils/haptics';
import { useAuthStore } from '../../stores/useAuthStore';
import { useBusinessStore } from '../../stores/useBusinessStore';
import { useEntitlementStore } from '../../stores/useEntitlementStore';
import { useIsBusinessOwner } from '../../hooks/useEntitlement';
import { fetchAppConfig } from '../../services/appConfig';
import { logPaywallEvent } from '../../services/paywallTelemetry';
import {
  getProPackages,
  purchasePackage,
  restorePurchases,
  hasProEntitlement,
  isTrialEligible,
} from '../../services/purchases';

const TRIAL_DAYS = 14;

/**
 * Apple bills the Sri Lanka storefront in USD, Google Play in LKR. Shop
 * owners think in rupees, so a non-LKR store price is converted for display
 * and rounded to the nearest 500 to match the published pricing.
 *
 * Rate drifts: 1 USD = 328 LKR on 2026-09-04. Update when it moves.
 */
const USD_TO_LKR = 328;

/**
 * The headline figure in rupees. Rounded to the nearest 500 so it matches the
 * price published on the website; a Play price is already in rupees and is
 * shown exactly as the store gives it.
 */
const rupeeAmount = (pkg: PurchasesPackage) =>
  pkg.product.currencyCode === 'LKR'
    ? pkg.product.price
    : Math.round((pkg.product.price * USD_TO_LKR) / 500) * 500;

const asRupees = (amount: number) => `Rs ${Math.round(amount).toLocaleString('en-US')}`;

const priceOf = (pkg: PurchasesPackage) =>
  pkg.product.currencyCode === 'LKR' ? pkg.product.priceString : asRupees(rupeeAmount(pkg));

/**
 * Per-month equivalent — Rs 3,000/month reads very differently to Rs 36,000/year.
 *
 * Derived from the rounded headline rather than the raw store price, so the
 * two figures on the card agree: 36,000 / 12 is exactly the 3,000 shown. Off
 * the raw price the rounding pulled quarterly and monthly to the same number
 * and the comparison between plans disappeared.
 */
const perMonthOf = (pkg: PurchasesPackage, months: number) =>
  asRupees(rupeeAmount(pkg) / months);

const PLANS = [
  { packageId: '$rc_annual', label: '1 Year', months: 12, billing: 'billed yearly' },
  { packageId: '$rc_three_month', label: '3 Months', months: 3, billing: 'billed quarterly' },
  { packageId: '$rc_monthly', label: '1 Month', months: 1, billing: 'billed monthly' },
] as const;

/** Outcomes, not feature names — what the shop owner gets, in their words. */
const COMPARISON = [
  { label: 'Billing & receipts on this phone', free: true },
  { label: 'Your data backed up to the cloud', free: false },
  { label: 'Print receipts on a thermal printer', free: false },
  { label: 'Scan barcodes with the camera', free: false },
  { label: 'Staff accounts with their own PINs', free: false },
  { label: 'More than one shop or branch', free: false },
  { label: 'Open your shop on a computer', free: false },
  { label: 'Profit & sales reports as PDF or Excel', free: false },
];

export default function PaywallRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isOwner = useIsBusinessOwner();
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const logout = useAuthStore((s) => s.logout);

  const setFromSdk = useEntitlementStore((s) => s.setFromSdk);
  const refreshEntitlement = useEntitlementStore((s) => s.refresh);

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [iapEnabled, setIapEnabled] = useState(false);
  const [trialEligible, setTrialEligible] = useState(true);
  const [legal, setLegal] = useState({
    terms: 'https://pos.shopbook.lk/terms',
    privacy: 'https://pos.shopbook.lk/privacy',
  });
  const [selectedId, setSelectedId] = useState<string>('$rc_annual');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pkgs, config] = await Promise.all([getProPackages(), fetchAppConfig()]);
      if (cancelled) return;

      setPackages(pkgs);
      setIapEnabled(!!config?.iap_enabled);
      if (config?.terms_url && config?.privacy_url) {
        setLegal({ terms: config.terms_url, privacy: config.privacy_url });
      }

      const annual = pkgs.find((p) => p.identifier === '$rc_annual');
      if (annual) setTrialEligible(await isTrialEligible(annual.product.identifier));

      setLoading(false);
      logPaywallEvent('viewed', {
        businessId: activeBusinessId,
        metadata: { isOwner, packages: pkgs.length },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeBusinessId, isOwner]);

  const plans = useMemo(() => {
    const byId = new Map(packages.map((p) => [p.identifier, p]));
    return PLANS.map((plan) => ({ ...plan, pkg: byId.get(plan.packageId) }));
  }, [packages]);

  const selected = plans.find((p) => p.packageId === selectedId) ?? plans[0];
  const canPurchase = isOwner && iapEnabled && !!selected?.pkg;

  const selectPlan = (packageId: string, pkg?: PurchasesPackage) => {
    hapticFeedback.impactLight();
    setSelectedId(packageId);
    logPaywallEvent('plan_selected', {
      businessId: activeBusinessId,
      packageId,
      productId: pkg?.product.identifier,
    });
  };

  const handlePurchase = useCallback(async () => {
    if (!selected?.pkg || busy) return;
    hapticFeedback.impactMedium();
    setBusy(true);

    logPaywallEvent('purchase_started', {
      businessId: activeBusinessId,
      packageId: selected.packageId,
      productId: selected.pkg.product.identifier,
      metadata: { trialEligible },
    });

    try {
      const info = await purchasePackage(selected.pkg);
      if (hasProEntitlement(info)) {
        setFromSdk(info);
        hapticFeedback.notificationSuccess();
        logPaywallEvent('purchase_succeeded', {
          businessId: activeBusinessId,
          packageId: selected.packageId,
          productId: selected.pkg.product.identifier,
        });
        // The webhook lands within seconds; re-read so the server becomes
        // authoritative rather than leaving the SDK's optimistic unlock.
        setTimeout(() => void refreshEntitlement(activeBusinessId), 5000);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      const cancelled = !!err?.userCancelled;
      logPaywallEvent(cancelled ? 'purchase_cancelled' : 'purchase_failed', {
        businessId: activeBusinessId,
        packageId: selected.packageId,
        productId: selected.pkg.product.identifier,
        metadata: cancelled ? {} : { message: String(err?.message ?? err).slice(0, 300) },
      });
      if (!cancelled) Alert.alert('Purchase failed', err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }, [selected, busy, activeBusinessId, trialEligible, setFromSdk, refreshEntitlement, router]);

  const handleRestore = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    logPaywallEvent('restore_attempted', { businessId: activeBusinessId });
    try {
      const info = await restorePurchases();
      if (hasProEntitlement(info)) {
        setFromSdk(info);
        void refreshEntitlement(activeBusinessId);
        router.replace('/(tabs)');
      } else {
        Alert.alert('Nothing to restore', 'No previous subscription was found for this account.');
      }
    } catch (err: any) {
      Alert.alert('Restore failed', err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, activeBusinessId, setFromSdk, refreshEntitlement, router]);

  const confirmLogout = () => {
    Alert.alert('Log out?', 'You can sign back in at any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/auth/number-input');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={TOKENS.primary} />
      </View>
    );
  }

  const price = selected?.pkg ? priceOf(selected.pkg) : '—';
  const perMonth = selected?.pkg ? perMonthOf(selected.pkg, selected.months) : null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="diamond" size={22} color="#D97706" />
          </View>
          <Text style={styles.heroTitle}>Everything your shop needs, in one place</Text>
          <Text style={styles.heroSub}>
            Shopbook POS Pro keeps your sales safe in the cloud, prints receipts, and lets your
            staff work while you watch the numbers from anywhere.
          </Text>
        </View>

        <View style={styles.compareCard}>
          <View style={styles.compareHead}>
            <Text style={styles.compareHeadLabel}>What you get</Text>
            <View style={styles.compareHeadCols}>
              <Text style={styles.compareColFree}>Free</Text>
              <Text style={styles.compareColPro}>Pro</Text>
            </View>
          </View>

          {COMPARISON.map((row) => (
            <View key={row.label} style={styles.compareRow}>
              <Text style={styles.compareLabel}>{row.label}</Text>
              <View style={styles.compareHeadCols}>
                <View style={styles.compareCell}>
                  {row.free ? (
                    <Ionicons name="checkmark" size={16} color={TOKENS.muted} />
                  ) : (
                    <Text style={styles.compareDash}>—</Text>
                  )}
                </View>
                <View style={styles.compareCell}>
                  <Ionicons name="checkmark-circle" size={18} color="#D97706" />
                </View>
              </View>
            </View>
          ))}
        </View>

        {!isOwner && (
          <View style={styles.staffBox}>
            <Feather name="info" size={16} color={TOKENS.primary} />
            <Text style={styles.staffText}>
              Only the shop owner can subscribe. Please ask the owner of{' '}
              {activeBusiness?.name ?? 'your shop'} to activate Shopbook POS Pro.
            </Text>
          </View>
        )}

        {!iapEnabled || plans.every((p) => !p.pkg) ? (
          <View style={styles.staffBox}>
            <Feather name="clock" size={16} color={TOKENS.primary} />
            <Text style={styles.staffText}>
              Subscriptions are opening soon. Please check back shortly.
            </Text>
          </View>
        ) : (
          <View style={styles.plans}>
            {plans.map((plan) => {
              const active = plan.packageId === selectedId;
              if (!plan.pkg) return null;
              return (
                <TouchableOpacity
                  key={plan.packageId}
                  activeOpacity={0.85}
                  onPress={() => selectPlan(plan.packageId, plan.pkg)}
                  style={[styles.planCard, active && styles.planCardActive]}
                >
                  <View style={styles.planRadio}>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color={TOKENS.primary} />
                    ) : (
                      <View style={styles.planRadioEmpty} />
                    )}
                  </View>

                  <View style={styles.planBody}>
                    <Text style={styles.planLabel}>{plan.label}</Text>
                    <Text style={styles.planBilling}>
                      {priceOf(plan.pkg)} {plan.billing}
                    </Text>
                  </View>

                  <View style={styles.planRight}>
                    <Text style={styles.planPerMonth}>{perMonthOf(plan.pkg, plan.months)}</Text>
                    <Text style={styles.planPerMonthUnit}>per month</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          activeOpacity={canPurchase ? 0.85 : 1}
          disabled={!canPurchase || busy}
          onPress={handlePurchase}
          style={[styles.cta, !canPurchase && styles.ctaDisabled]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.ctaText, !canPurchase && styles.ctaTextDisabled]}>
              {!isOwner
                ? 'Owner account required'
                : trialEligible
                  ? `Start ${TRIAL_DAYS}-day free trial`
                  : `Subscribe · ${price}`}
            </Text>
          )}
        </TouchableOpacity>

        {canPurchase && (
          <Text style={styles.finePrint}>
            {trialEligible
              ? `Free for ${TRIAL_DAYS} days, then ${price} ${selected?.billing}`
              : `${price} ${selected?.billing}`}
            {perMonth ? ` · about ${perMonth} a month` : ''}. Cancel any time in your store
            account; renews automatically until you do.
          </Text>
        )}

        <View style={styles.footerLinks}>
          {isOwner && (
            <>
              <TouchableOpacity onPress={handleRestore} disabled={busy}>
                <Text style={styles.footerLink}>Restore purchase</Text>
              </TouchableOpacity>
              <Text style={styles.footerDot}>·</Text>
            </>
          )}
          <TouchableOpacity onPress={() => Linking.openURL(legal.terms)}>
            <Text style={styles.footerLink}>Terms</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL(legal.privacy)}>
            <Text style={styles.footerLink}>Privacy</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <TouchableOpacity onPress={confirmLogout}>
            <Text style={styles.footerLink}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: TOKENS.background },
  loadingRoot: {
    flex: 1,
    backgroundColor: TOKENS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20, gap: 20 },

  hero: { alignItems: 'center', gap: 10 },
  heroBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TOKENS.dark,
    textAlign: 'center',
    lineHeight: 30,
  },
  heroSub: {
    fontSize: 14,
    color: TOKENS.muted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 4,
  },

  compareCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  compareHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  compareHeadLabel: { flex: 1, fontSize: 11, fontWeight: 'bold', color: TOKENS.muted },
  compareHeadCols: { flexDirection: 'row', width: 96 },
  compareColFree: { flex: 1, fontSize: 11, fontWeight: 'bold', color: TOKENS.muted, textAlign: 'center' },
  compareColPro: { flex: 1, fontSize: 11, fontWeight: 'bold', color: '#D97706', textAlign: 'center' },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  compareLabel: { flex: 1, fontSize: 13, color: TOKENS.dark, paddingRight: 10 },
  compareCell: { flex: 1, alignItems: 'center' },
  compareDash: { color: TOKENS.border, fontSize: 14, fontWeight: 'bold' },

  plans: { gap: 10 },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    padding: 14,
    gap: 12,
  },
  planCardActive: { borderColor: TOKENS.primary, backgroundColor: TOKENS.lightBlue },
  planRadio: { width: 22, alignItems: 'center' },
  planRadioEmpty: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
  },
  planBody: { flex: 1, gap: 2 },
  planLabel: { fontSize: 16, fontWeight: 'bold', color: TOKENS.dark },
  planBilling: { fontSize: 12, color: TOKENS.muted },
  planRight: { alignItems: 'flex-end' },
  planPerMonth: { fontSize: 17, fontWeight: 'bold', color: TOKENS.dark },
  planPerMonthUnit: { fontSize: 11, color: TOKENS.muted },

  staffBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: TOKENS.lightBlue,
    borderRadius: 12,
    padding: 14,
  },
  staffText: { flex: 1, fontSize: 13, color: TOKENS.dark, lineHeight: 19 },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 10,
    backgroundColor: TOKENS.card,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
  },
  cta: {
    backgroundColor: TOKENS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: TOKENS.border },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  ctaTextDisabled: { color: TOKENS.muted },
  finePrint: { fontSize: 11, color: TOKENS.muted, textAlign: 'center', lineHeight: 16 },
  footerLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  footerLink: { fontSize: 12, color: TOKENS.primary, fontWeight: '600' },
  footerDot: { fontSize: 12, color: TOKENS.border },
});
