import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../../../components/common/ScreenWrapper';
import { TOKENS } from '../../../constants/tokens';
import { useSettingsStore } from '../../../stores/useSettingsStore';
import { hapticFeedback } from '../../../utils/haptics';
import { PoweredBy } from '../../../components/common/PoweredBy';

const PLANS = [
  {
    id: '1_month',
    tabLabel: '1 Month',
    title: '1 Month Pro',
    duration: '1 Month Access',
    price: 'Rs. 3,500',
    originalPrice: 'Rs. 5,000',
    billing: 'Billed monthly',
    saving: 'Save Rs. 1,500',
    badge: '1 MONTH PRO',
    popular: false,
  },
  {
    id: '3_months',
    tabLabel: '3 Months',
    title: '3 Months Pro',
    duration: '3 Months Access',
    price: 'Rs. 10,000',
    originalPrice: 'Rs. 12,000',
    billing: 'Billed quarterly',
    saving: 'Save Rs. 2,000',
    badge: '3 MONTHS PRO',
    popular: true,
  },
  {
    id: '1_year',
    tabLabel: '1 Year',
    title: '1 Year Pro',
    duration: '12 Months Access',
    price: 'Rs. 36,000',
    originalPrice: 'Rs. 48,000',
    billing: 'Billed annually',
    saving: 'Save Rs. 12,000 (25%)',
    badge: '1 YEAR PRO',
    popular: false,
  },
];

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

export default function PremiumPlansRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const isPremium = useSettingsStore((s) => s.isPremium);
  const setPremium = useSettingsStore((s) => s.setPremium);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('3_months');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const selectedPlan = PLANS.find((p) => p.id === selectedPlanId) || PLANS[1];

  const handleSelectPlan = () => {
    hapticFeedback.impactMedium();
    router.push({
      pathname: '/profile/payment-select',
      params: {
        planId: selectedPlan.id,
        planTitle: selectedPlan.title,
        price: selectedPlan.price,
        billing: selectedPlan.billing,
      },
    });
  };

  const handleDowngrade = () => {
    hapticFeedback.impactMedium();
    Alert.alert(
      'Downgrade to Free',
      'Are you sure you want to cancel your Shopbook POS Pro license? This will restrict access to premium features.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Downgrade',
          style: 'destructive',
          onPress: () => {
            setPremium(false);
            hapticFeedback.notificationWarning();
            triggerToast('Reverted to Free tier');
          },
        },
      ]
    );
  };

  return (
    <ScreenWrapper noPaddingBottom style={styles.container}>
      {/* Toast popup */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header */}
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

      {/* SCROLLABLE content */}
      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Active Status Pass/Warning Card inside ScrollView */}
        {isPremium ? (
          /* Premium VIP Pass Card - Light Theme version of gold/diamond pass */
          <View style={styles.proPassCard}>
            <View style={styles.proPassLeft}>
              <View style={styles.vipBadge}>
                <Text style={styles.vipBadgeText}>ACTIVE MEMBER</Text>
              </View>
              <Text style={styles.proPassTitle}>SHOPBOOK POS PRO LICENSE</Text>
              <Text style={styles.proPassSubtitle}>
                Active Cloud Sync • Multi-Branch Outlets • Printer Support
              </Text>
            </View>
            <View style={styles.proPassRight}>
              <Ionicons name="diamond" size={28} color="#D97706" />
              <TouchableOpacity style={styles.downgradeLink} onPress={handleDowngrade}>
                <Text style={styles.downgradeLinkText}>Downgrade</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Warning/Free Card - Matches warning layout in soft amber */
          <View style={styles.featureBlockWarning}>
            <View style={styles.glowCircleHeader}>
              <Ionicons name="diamond" size={18} color="#D97706" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.warningCardTitle}>Upgrade to Shopbook POS Pro</Text>
              <Text style={styles.alertDesc}>
                Unlock auto cloud sync backups, printing, staff accounts, web terminal, and camera
                barcode scanning.
              </Text>
            </View>
          </View>
        )}

        {/* Tab Selection Bar */}
        <View style={styles.tabSection}>
          <Text style={styles.tabSectionHeader}>Select Subscription Period</Text>
          <View style={styles.tabBarContainer}>
            {PLANS.map((plan) => {
              const isTabSelected = selectedPlanId === plan.id;
              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.8}
                  style={[styles.tabButton, isTabSelected && styles.tabButtonActive]}
                  onPress={() => {
                    hapticFeedback.impactLight();
                    setSelectedPlanId(plan.id);
                  }}
                >
                  <Text style={[styles.tabButtonText, isTabSelected && styles.tabButtonTextActive]}>
                    {plan.tabLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Subscription Plan Detail Card */}
        <View
          style={[
            styles.planDetailCard,
            selectedPlan.popular ? styles.planDetailCardActive : styles.planDetailCardDefault,
          ]}
        >
          {/* Badge Tag */}
          <View
            style={[
              styles.badgeTag,
              selectedPlan.popular ? styles.badgeTagActive : styles.badgeTagDefault,
            ]}
          >
            <Text
              style={[
                styles.badgeTagText,
                selectedPlan.popular ? { color: '#D97706' } : { color: TOKENS.muted },
              ]}
            >
              {selectedPlan.badge}
            </Text>
          </View>

          {/* Card Title Row */}
          <View style={styles.cardHeaderRow}>
            <Text style={styles.planTitleText}>{selectedPlan.title}</Text>
            <Text style={styles.planDurationText}>{selectedPlan.duration}</Text>
          </View>

          {/* Pricing Row */}
          <View style={styles.priceRowContainer}>
            <View style={styles.priceLeftCol}>
              <Text style={styles.priceText}>{selectedPlan.price}</Text>
              <Text style={styles.billingText}>{selectedPlan.billing}</Text>
            </View>
            <View style={styles.priceRightCol}>
              {selectedPlan.originalPrice && (
                <Text style={styles.originalPriceText}>{selectedPlan.originalPrice}</Text>
              )}
              {selectedPlan.saving && (
                <View style={styles.savingBadge}>
                  <Text style={styles.savingBadgeText}>{selectedPlan.saving}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.cardDivider} />

          {/* Features List Header */}
          <Text style={styles.featuresListHeader}>✨ Unlocks all Pro capabilities:</Text>

          {/* Features List with Orange/Gold Ticks */}
          <View style={styles.featuresListContainer}>
            {PRO_FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItemRow}>
                <Ionicons name="checkmark-circle" size={18} color="#D97706" />
                <Text style={styles.featureItemText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* Select Button Action */}
          <TouchableOpacity
            activeOpacity={isPremium ? 1 : 0.85}
            disabled={isPremium}
            onPress={handleSelectPlan}
            style={[
              styles.actionButton,
              isPremium
                ? styles.actionButtonDisabled
                : selectedPlan.popular
                  ? styles.actionButtonActive
                  : styles.actionButtonDefault,
            ]}
          >
            <Text
              style={[
                styles.actionButtonText,
                isPremium
                  ? styles.actionButtonTextDisabled
                  : selectedPlan.popular
                    ? { color: '#FFFFFF' }
                    : { color: TOKENS.primary },
              ]}
            >
              {isPremium ? 'Active & Unlocked' : 'Choose Plan'}
            </Text>
            {!isPremium && (
              <Feather
                name="arrow-right"
                size={16}
                color={selectedPlan.popular ? '#FFFFFF' : TOKENS.primary}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Internet Connection Notice Box */}
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

        {/* Powered by Shopbook */}
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
  downgradeLink: {
    alignSelf: 'center',
  },
  downgradeLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.error,
    textDecorationLine: 'underline',
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
  priceRightCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  originalPriceText: {
    fontSize: 13,
    color: TOKENS.muted,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  savingBadge: {
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  savingBadgeText: {
    color: '#065F46',
    fontSize: 10,
    fontWeight: 'bold',
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
});
