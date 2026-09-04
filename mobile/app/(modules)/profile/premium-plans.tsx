import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { ScreenWrapper } from '../../../components/common/ScreenWrapper';
import { TOKENS } from '../../../constants/tokens';
import { hapticFeedback } from '../../../utils/haptics';
import { PoweredBy } from '../../../components/common/PoweredBy';
import { useTranslation } from '../../../hooks/useTranslation';
import { useIsBusinessOwner } from '../../../hooks/useEntitlement';
import { useEntitlementStore } from '../../../stores/useEntitlementStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useBusinessStore } from '../../../stores/useBusinessStore';
import { fetchAppConfig } from '../../../services/appConfig';
import {
  getProPackages,
  purchasePackage,
  restorePurchases,
  manageSubscription,
  hasProEntitlement,
} from '../../../services/purchases';

/**
 * Period metadata. Prices are NOT here — they come from the store via
 * RevenueCat, localised, so iOS (USD on the Sri Lanka storefront) and Android
 * (LKR) each show what the customer will actually be charged.
 */
const PERIODS = [
  {
    packageId: '$rc_monthly',
    tabLabel: '1 Month',
    title: '1 Month Pro',
    duration: '1 Month Access',
    badge: '1 MONTH PRO',
    billing: 'Billed monthly',
    months: 1,
    popular: false,
  },
  {
    packageId: '$rc_three_month',
    tabLabel: '3 Months',
    title: '3 Months Pro',
    duration: '3 Months Access',
    badge: '3 MONTHS PRO',
    billing: 'Billed quarterly',
    months: 3,
    popular: true,
  },
  {
    packageId: '$rc_annual',
    tabLabel: '1 Year',
    title: '1 Year Pro',
    duration: '12 Months Access',
    badge: '1 YEAR PRO',
    billing: 'Billed annually',
    months: 12,
    popular: false,
  },
] as const;

const PRO_FEATURES = [
  'Unlimited Store Outlets / Branches',
  'Auto Real-time Cloud Backup & Sync',
  'Unlimited Staff Accounts & Permissions',
  'In-App Camera Barcode Searching & Scanning',
  'Bluetooth Thermal Printer Receipt Printing',
  'Web Browser Access (live POS from any device)',
  'PDF & CSV Financial Statement Exports',
  'Priority 24/7 Helpline & Support',
];

const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';

const maskPhone = (phone?: string | null) =>
  phone && phone.length >= 4 ? `••••${phone.slice(-4)}` : '';

/**
 * Apple bills the Sri Lanka storefront in USD; Google Play bills in LKR. Shop
 * owners think in rupees and a dollar figure reads as foreign here, so a
 * non-LKR store price is shown converted. The billing line still names USD:
 * the App Store payment sheet shows dollars, so the screen before it must not
 * imply otherwise.
 *
 * Rate drifts: 1 USD = 328 LKR on 2026-09-04. Update when it moves materially.
 */
const USD_TO_LKR = 328;

/** Rounded to the nearest 500 so the figure matches the price on the website. */
const displayPrice = (pkg?: PurchasesPackage) => {
  if (!pkg) return { main: '—', charged: null };
  const { price, priceString, currencyCode } = pkg.product;
  if (currencyCode === 'LKR') return { main: priceString, charged: null };
  const rupees = Math.round((price * USD_TO_LKR) / 500) * 500;
  return { main: `Rs ${rupees.toLocaleString('en-US')}`, charged: priceString };
};

export default function PremiumPlansRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const isOwner = useIsBusinessOwner();
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);

  const isPro = useEntitlementStore((s) => s.isPro);
  const isTrial = useEntitlementStore((s) => s.isTrial);
  const expiresAt = useEntitlementStore((s) => s.expiresAt);
  const willRenew = useEntitlementStore((s) => s.willRenew);
  const managementUrl = useEntitlementStore((s) => s.managementUrl);
  const refreshEntitlement = useEntitlementStore((s) => s.refresh);
  const setFromSdk = useEntitlementStore((s) => s.setFromSdk);

  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [iapEnabled, setIapEnabled] = useState(false);
  const [legal, setLegal] = useState<{ terms: string; privacy: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>('$rc_three_month');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pkgs, config] = await Promise.all([getProPackages(), fetchAppConfig()]);
      if (cancelled) return;
      setPackages(pkgs);
      setIapEnabled(!!config?.iap_enabled);
      setLegal({
        terms: config?.terms_url ?? 'https://shopbook-pos-website.vercel.app/terms',
        privacy: config?.privacy_url ?? 'https://shopbook-pos-website.vercel.app/privacy',
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const plans = useMemo(() => {
    const byId = new Map(packages.map((p) => [p.identifier, p]));
    return PERIODS.map((period) => ({ ...period, pkg: byId.get(period.packageId) }));
  }, [packages]);

  const selected = plans.find((p) => p.packageId === selectedId) ?? plans[1];
  const price = displayPrice(selected?.pkg);
  const canPurchase = isOwner && iapEnabled && !!selected?.pkg && !isPro;

  const handlePurchase = useCallback(async () => {
    if (!selected?.pkg || busy) return;
    hapticFeedback.impactMedium();
    setBusy(true);
    try {
      const info = await purchasePackage(selected.pkg);
      if (hasProEntitlement(info)) {
        setFromSdk(info);
        hapticFeedback.notificationSuccess();
        triggerToast(t('premium.purchaseSuccess'));
        // The webhook is normally seconds behind; re-read the server so the
        // cache ends up authoritative rather than SDK-sourced.
        setTimeout(() => void refreshEntitlement(activeBusinessId), 5000);
        setTimeout(() => router.back(), 1200);
      }
    } catch (err: any) {
      // Backing out of the store sheet is not an error worth surfacing.
      if (!err?.userCancelled) {
        Alert.alert(t('premium.purchaseFailedTitle'), err?.message ?? String(err));
      }
    } finally {
      setBusy(false);
    }
  }, [selected, busy, setFromSdk, refreshEntitlement, activeBusinessId, router, t]);

  const handleRestore = useCallback(async () => {
    if (busy) return;
    hapticFeedback.impactLight();
    setBusy(true);
    try {
      const info = await restorePurchases();
      if (hasProEntitlement(info)) {
        setFromSdk(info);
        triggerToast(t('premium.restoreSuccess'));
        void refreshEntitlement(activeBusinessId);
      } else {
        triggerToast(t('premium.restoreNothing'));
      }
    } catch (err: any) {
      Alert.alert(t('premium.restoreFailedTitle'), err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }, [busy, setFromSdk, refreshEntitlement, activeBusinessId, t]);

  const handleManage = useCallback(async () => {
    hapticFeedback.impactLight();
    try {
      await manageSubscription(managementUrl);
    } catch (err: any) {
      Alert.alert(t('premium.manageFailedTitle'), err?.message ?? String(err));
    }
  }, [managementUrl, t]);

  return (
    <ScreenWrapper noPaddingBottom style={styles.container}>
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <View style={[styles.header, { paddingTop: 12 }]}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.push('/profile');
            }
          }}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Shopbook POS Pro</Text>
        <View style={styles.placeholderWidth} />
      </View>

      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- Status card ---------- */}
        {isPro && !isTrial ? (
          <View style={styles.proPassCard}>
            <View style={styles.proPassLeft}>
              <View style={styles.vipBadge}>
                <Text style={styles.vipBadgeText}>{t('premium.activeMember')}</Text>
              </View>
              <Text style={styles.proPassTitle}>{t('premium.licenseTitle')}</Text>
              <Text style={styles.proPassSubtitle}>
                {expiresAt
                  ? `${willRenew ? t('premium.renewsOn') : t('premium.expiresOn')} ${formatDate(expiresAt)}`
                  : t('premium.subActiveNotice')}
              </Text>
            </View>
            <View style={styles.proPassRight}>
              <Ionicons name="diamond" size={28} color="#D97706" />
            </View>
          </View>
        ) : isTrial ? (
          <View style={styles.featureBlockWarning}>
            <View style={styles.glowCircleHeader}>
              <Ionicons name="time-outline" size={18} color="#D97706" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.warningCardTitle}>{t('premium.trialTitle')}</Text>
              <Text style={styles.alertDesc}>
                {t('premium.trialEnds')} {formatDate(expiresAt)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.featureBlockWarning}>
            <View style={styles.glowCircleHeader}>
              <Ionicons name="diamond" size={18} color="#D97706" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.warningCardTitle}>{t('premium.upgradeTitle')}</Text>
              <Text style={styles.alertDesc}>
                Unlock auto cloud sync backups, printing, staff accounts, web terminal, and camera
                barcode scanning.
              </Text>
            </View>
          </View>
        )}

        {/* ---------- Staff: cannot purchase ---------- */}
        {!isOwner && (
          <View style={styles.infoBox}>
            <Feather name="info" size={16} color={TOKENS.primary} />
            <Text style={styles.infoBoxText}>
              {t('premium.askOwner')} {activeBusiness?.name}
              {activeBusiness?.phone ? ` (${maskPhone(activeBusiness.phone)})` : ''}
            </Text>
          </View>
        )}

        {/* ---------- Manage (already subscribed) ---------- */}
        {isPro && !isTrial && isOwner && (
          <View style={styles.manageCard}>
            <TouchableOpacity style={styles.manageButton} onPress={handleManage} activeOpacity={0.85}>
              <Feather name="external-link" size={16} color={TOKENS.primary} />
              <Text style={styles.manageButtonText}>{t('premium.manage')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryLink} onPress={handleRestore} disabled={busy}>
              <Text style={styles.secondaryLinkText}>{t('premium.restore')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ---------- Plans ---------- */}
        {!isPro || isTrial ? (
          loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={TOKENS.primary} />
            </View>
          ) : !iapEnabled || plans.every((p) => !p.pkg) ? (
            <View style={styles.infoBox}>
              <Feather name="clock" size={16} color={TOKENS.primary} />
              <Text style={styles.infoBoxText}>{t('premium.comingSoon')}</Text>
            </View>
          ) : (
            <>
              <View style={styles.tabSection}>
                <Text style={styles.tabSectionHeader}>{t('premium.selectPeriod')}</Text>
                <View style={styles.tabBarContainer}>
                  {plans.map((plan) => {
                    const isTabSelected = selectedId === plan.packageId;
                    return (
                      <TouchableOpacity
                        key={plan.packageId}
                        activeOpacity={0.8}
                        disabled={!plan.pkg}
                        style={[
                          styles.tabButton,
                          isTabSelected && styles.tabButtonActive,
                          !plan.pkg && styles.tabButtonDisabled,
                        ]}
                        onPress={() => {
                          hapticFeedback.impactLight();
                          setSelectedId(plan.packageId);
                        }}
                      >
                        <Text
                          style={[
                            styles.tabButtonText,
                            isTabSelected && styles.tabButtonTextActive,
                          ]}
                        >
                          {plan.tabLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View
                style={[
                  styles.planDetailCard,
                  selected?.popular ? styles.planDetailCardActive : styles.planDetailCardDefault,
                ]}
              >
                <View
                  style={[
                    styles.badgeTag,
                    selected?.popular ? styles.badgeTagActive : styles.badgeTagDefault,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeTagText,
                      selected?.popular ? { color: '#D97706' } : { color: TOKENS.muted },
                    ]}
                  >
                    {selected?.badge}
                  </Text>
                </View>

                <View style={styles.cardHeaderRow}>
                  <Text style={styles.planTitleText}>{selected?.title}</Text>
                  <Text style={styles.planDurationText}>{selected?.duration}</Text>
                </View>

                <View style={styles.priceRowContainer}>
                  <View style={styles.priceLeftCol}>
                    <Text style={styles.priceText}>
                      {price.charged ? `≈ ${price.main}` : price.main}
                    </Text>
                    <Text style={styles.billingText}>
                      {selected?.billing}
                      {price.charged ? ' in USD' : ''}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <Text style={styles.featuresListHeader}>✨ Unlocks all Pro capabilities:</Text>

                <View style={styles.featuresListContainer}>
                  {PRO_FEATURES.map((feature, index) => (
                    <View key={index} style={styles.featureItemRow}>
                      <Ionicons name="checkmark-circle" size={18} color="#D97706" />
                      <Text style={styles.featureItemText}>{feature}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  activeOpacity={canPurchase ? 0.85 : 1}
                  disabled={!canPurchase || busy}
                  onPress={handlePurchase}
                  style={[
                    styles.actionButton,
                    !canPurchase
                      ? styles.actionButtonDisabled
                      : selected?.popular
                        ? styles.actionButtonActive
                        : styles.actionButtonDefault,
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={selected?.popular ? '#FFFFFF' : TOKENS.primary} />
                  ) : (
                    <>
                      <Text
                        style={[
                          styles.actionButtonText,
                          !canPurchase
                            ? styles.actionButtonTextDisabled
                            : selected?.popular
                              ? { color: '#FFFFFF' }
                              : { color: TOKENS.primary },
                        ]}
                      >
                        {isOwner
                          ? `${t('premium.subscribe')} · ${price.main}`
                          : t('premium.ownerOnly')}
                      </Text>
                      {canPurchase && (
                        <Feather
                          name="arrow-right"
                          size={16}
                          color={selected?.popular ? '#FFFFFF' : TOKENS.primary}
                        />
                      )}
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )
        ) : null}

        {/* ---------- Store-mandated disclosure. Apple 3.1.2 rejects paywalls
                      without auto-renew terms, Restore, Terms and Privacy. ---------- */}
        <View style={styles.legalBlock}>
          <Text style={styles.autoRenewNotice}>{t('premium.autoRenewNotice')}</Text>
          <View style={styles.legalLinksRow}>
            {isOwner && !isPro && (
              <>
                <TouchableOpacity onPress={handleRestore} disabled={busy}>
                  <Text style={styles.legalLink}>{t('premium.restore')}</Text>
                </TouchableOpacity>
                <Text style={styles.legalDot}>·</Text>
              </>
            )}
            <TouchableOpacity onPress={() => legal && Linking.openURL(legal.terms)}>
              <Text style={styles.legalLink}>{t('premium.terms')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={() => legal && Linking.openURL(legal.privacy)}>
              <Text style={styles.legalLink}>{t('premium.privacy')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.wifiNoticeBox}>
          <View style={styles.wifiIconCircle}>
            <Feather name="wifi" size={16} color={TOKENS.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.wifiNoticeTitle}>Internet Connection Required</Text>
            <Text style={styles.wifiNoticeText}>
              Please ensure your device is connected to the internet to complete your upgrade
              transaction.
            </Text>
          </View>
        </View>

        <PoweredBy />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  toastContainer: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    backgroundColor: TOKENS.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  placeholderWidth: {
    width: 36,
  },
  featureBlockWarning: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7', // Light amber warning background
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  glowCircleHeader: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#78350F',
  },
  alertDesc: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 16,
    fontWeight: '500',
  },
  proPassCard: {
    flexDirection: 'row',
    borderRadius: 16,
    backgroundColor: '#FFFDF5',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#D97706',
    boxShadow: '0px 4px 8px 0px rgba(217, 119, 6, 0.08)',
    marginBottom: 8,
  },
  proPassLeft: {
    flex: 1,
    gap: 6,
  },
  proPassRight: {
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
  },
  vipBadge: {
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  vipBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  proPassTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#78350F',
  },
  proPassSubtitle: {
    fontSize: 11,
    color: '#B45309',
    fontWeight: '500',
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 20,
  },
  tabSection: {
    gap: 8,
  },
  tabSectionHeader: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TOKENS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginLeft: 2,
  },
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 2px 3px 0px rgba(0, 0, 0, 0.08)',
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  tabButtonTextActive: {
    color: TOKENS.dark,
    fontWeight: 'bold',
  },
  planDetailCard: {
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    backgroundColor: TOKENS.card,
    gap: 16,
    boxShadow: '0px 4px 8px 0px rgba(0, 0, 0, 0.03)',
  },
  planDetailCardDefault: {
    borderColor: TOKENS.border,
  },
  planDetailCardActive: {
    borderColor: '#D97706',
  },
  badgeTag: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeTagDefault: {
    backgroundColor: '#F3F4F6',
  },
  badgeTagActive: {
    backgroundColor: '#FEF3C7',
  },
  badgeTagText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  planTitleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  planDurationText: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  priceRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLeftCol: {
    gap: 2,
  },
  priceText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  billingText: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  cardDivider: {
    height: 1,
    backgroundColor: TOKENS.border,
    width: '100%',
  },
  featuresListHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  featuresListContainer: {
    gap: 12,
  },
  featureItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureItemText: {
    fontSize: 13.5,
    color: TOKENS.dark,
    fontWeight: '500',
    flex: 1,
  },
  actionButton: {
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  actionButtonDefault: {
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  actionButtonActive: {
    backgroundColor: TOKENS.primary,
  },
  actionButtonDisabled: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButtonTextDisabled: {
    color: '#94A3B8',
  },
  wifiNoticeBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    alignItems: 'center',
  },
  wifiIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wifiNoticeTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E40AF',
  },
  wifiNoticeText: {
    flex: 1,
    fontSize: 11.5,
    color: '#1E3A8A',
    lineHeight: 16,
    fontWeight: '500',
  },

  footerNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 4,
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  footerNoteText: {
    flex: 1,
    fontSize: 11,
    color: TOKENS.muted,
    lineHeight: 15,
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 8,
    gap: 4,
  },
  madeInText: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.muted,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.muted,
    opacity: 0.7,
  },

  tabButtonDisabled: {
    opacity: 0.4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    padding: 14,
    marginBottom: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: TOKENS.dark,
  },
  manageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  manageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: TOKENS.primary,
    backgroundColor: TOKENS.card,
  },
  manageButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.primary,
  },
  secondaryLink: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  secondaryLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKENS.muted,
    textDecorationLine: 'underline',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalBlock: {
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  autoRenewNotice: {
    fontSize: 11,
    lineHeight: 16,
    color: TOKENS.muted,
    textAlign: 'center',
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.primary,
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontSize: 12,
    color: TOKENS.muted,
  },
});
