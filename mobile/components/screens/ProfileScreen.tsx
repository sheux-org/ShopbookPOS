import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../common/ScreenWrapper';
import { TOKENS } from '../../constants/tokens';
import { cartState } from '../data/cartState';
import { useActiveBusiness } from '../../hooks/useActiveBusiness';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { syncDatabase } from '../../services/sync';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { BottomSheet } from '../common/BottomSheet';
import { BusinessAvatar } from '../common/BusinessAvatar';
import { deleteCurrentDeviceSession } from '../../hooks/useActiveDeviceTracker';
import { PremiumUpgradeModal } from '../common/PremiumUpgradeModal';
import { hapticFeedback } from '../../utils/haptics';
import { useTranslation } from '../../hooks/useTranslation';

const FAQS = [
  {
    q: 'Does Shopbook POS work without an internet connection?',
    a: 'Yes! Shopbook POS saves all transactions to a secure local database. You can perform billing, scan barcodes, and manage inventory offline. Cloud backup and synchronization is a premium feature available in the Shopbook POS Pro version.',
  },
  {
    q: "What is a 'Quick Code' and how do cashiers use it?",
    a: "Quick Codes are short numeric shortcuts (e.g., '101' for Bread) assigned to products. Cashiers can type these in the Search bar to add items to the invoice instantly without using a scanner.",
  },
  {
    q: 'How do I scan barcodes to add items in Shopbook POS?',
    a: "Tap 'Scan' in the bottom navigation or tap the search icon in the header and click the camera icon. Line up the product barcode within the viewfinder to search and add it.",
  },
  {
    q: 'How do I connect a Bluetooth thermal printer?',
    a: 'Go to Profile Settings > Bluetooth Thermal Printer. Scan for nearby devices, select your printer, and pair it. Once connected, printing receipts via Bluetooth thermal printers is a premium feature available for Shopbook POS Pro users.',
  },
  {
    q: 'What can Managers and Cashiers access in Shopbook POS?',
    a: 'Cashiers can only perform sales and scan barcodes, while Managers can manage stock. Granting multi-user access for staff (Managers/Cashiers) is a premium feature included in the Shopbook POS Pro plan.',
  },
  {
    q: 'Can I manage multiple store locations or branches?',
    a: 'Yes! Creating and switching between multiple business branches is a premium feature in Shopbook POS Pro. Upgrading lets you manage separate staff, products, and order histories for each branch.',
  },
  {
    q: 'How do Low Stock Alerts work in Shopbook POS?',
    a: "When adding/editing a product, you can set a 'Low Stock Alert' threshold. When the item count drops below this, the stock text turns orange on the Home Screen to warn cashiers.",
  },
];

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'si', name: 'සිංහල (Sinhala)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
] as const;

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pairedPrinter = useSettingsStore((s) => s.pairedPrinter);
  const isPremium = useSettingsStore((s) => s.isPremium);

  const { t, language, setLanguage } = useTranslation();
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<'1_month' | '3_month' | '1_year'>('3_month');
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState('');

  const activeBusiness = useActiveBusiness();

  // Help & Support Modal state
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  };

  const checkPremiumAction = (featureName: string, action: () => void) => {
    if (isPremium) {
      action();
    } else {
      setPremiumFeatureName(featureName);
      setPremiumModalVisible(true);
    }
  };

  const { canPerform, role: userRole } = useUserPermissions();

  return (
    <ScreenWrapper noPaddingBottom style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header exactly matching theme */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push('/')}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Profile Settings</Text>

        <View style={styles.headerRightActions}>
          <View style={styles.placeholderWidth} />
        </View>
      </View>

      {/* Scrollable Settings Panel */}
      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Card Glassmorphic Premium */}
        <View style={styles.avatarCard}>
          <BusinessAvatar
            logoUri={activeBusiness?.logoUri}
            name={activeBusiness?.name || 'SP'}
            size={72}
          />

          <Text style={styles.partnerName}>
            {activeBusiness?.name || t('profile.partnerStore')}
          </Text>
          <Text style={styles.partnerPlan}>
            🛡️{' '}
            {userRole === 'admin'
              ? t('profile.adminPrivilege')
              : userRole === 'manager'
                ? t('profile.managerPrivilege')
                : t('profile.cashierPrivilege')}
          </Text>

          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>
              {userRole === 'admin'
                ? t('profile.adminStatusActive')
                : userRole === 'manager'
                  ? t('profile.managerStatusActive')
                  : t('profile.cashierStatusActive')}
            </Text>
          </View>
        </View>

        {/* Setting options list group */}
        <View style={styles.optionsGroup}>
          <Text style={styles.groupHeader}>{t('profile.groupBusiness')}</Text>

          {/* Option: Shop Details */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              router.push('/profile/business-details');
            }}
          >
            <View style={[styles.optionIconBox, { backgroundColor: '#E8F0FE' }]}>
              <Feather name="home" size={18} color={TOKENS.primary} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>{t('profile.storeDetailsTitle')}</Text>
              <Text style={styles.optionSubtitle}>
                {userRole === 'cashier'
                  ? t('profile.storeDetailsSubStaff')
                  : t('profile.storeDetailsSubAdmin')}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Business Management */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              checkPremiumAction('Multiple branch management', () =>
                router.push('/profile/manage-businesses')
              );
            }}
          >
            <View style={[styles.optionIconBox, { backgroundColor: '#FEF7E0' }]}>
              <Feather name="briefcase" size={18} color="#B06000" />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>{t('profile.businessMgmtTitle')}</Text>
              <Text style={styles.optionSubtitle}>
                {userRole === 'cashier'
                  ? t('profile.businessMgmtSubStaff')
                  : t('profile.businessMgmtSubAdmin')}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Bluetooth Printer Setup */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              checkPremiumAction('Bluetooth thermal printer printing', () =>
                router.push('/profile/bluetooth-printer')
              );
            }}
          >
            <View style={[styles.optionIconBox, { backgroundColor: '#EFF6FF' }]}>
              <Feather name="printer" size={18} color={TOKENS.primary} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>{t('profile.printerTitle')}</Text>
              <Text style={styles.optionSubtitle}>
                {pairedPrinter
                  ? t('profile.printerSubConnected', { printer: pairedPrinter.name })
                  : t('profile.printerSubScan')}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Active Devices */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              checkPremiumAction('Active devices monitoring', () =>
                router.push('/profile/active-devices')
              );
            }}
          >
            <View style={[styles.optionIconBox, { backgroundColor: '#E8F0FE' }]}>
              <Feather name="smartphone" size={18} color={TOKENS.primary} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>{t('profile.devicesTitle')}</Text>
              <Text style={styles.optionSubtitle}>{t('profile.devicesSub')}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Staff Management (Hidden for Manager & Cashier!) */}
          {canPerform('create', 'staff') && (
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => {
                hapticFeedback.selection();
                checkPremiumAction('Staff accounts management', () =>
                  router.push('/profile/manage-staff')
                );
              }}
            >
              <View style={[styles.optionIconBox, { backgroundColor: '#E6F4EA' }]}>
                <Feather name="users" size={18} color="#137333" />
              </View>
              <View style={styles.optionTextWrapper}>
                <Text style={styles.optionTitle}>{t('profile.staffTitle')}</Text>
                <Text style={styles.optionSubtitle}>{t('profile.staffSub')}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={TOKENS.muted} />
            </TouchableOpacity>
          )}

          {/* Option: Premium Plans Setup (Hidden for Manager & Cashier!) */}
          {canPerform('create', 'settings') && (
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => {
                hapticFeedback.selection();
                router.push('/profile/premium-plans');
              }}
            >
              <View style={[styles.optionIconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="diamond" size={18} color="#D97706" />
              </View>
              <View style={styles.optionTextWrapper}>
                <Text style={styles.optionTitle}>{t('profile.premiumTitle')}</Text>
                <Text style={styles.optionSubtitle}>{t('profile.premiumSub')}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={TOKENS.muted} />
            </TouchableOpacity>
          )}

          {/* Option: Language Selector */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              setIsLanguageModalOpen(true);
            }}
          >
            <View style={[styles.optionIconBox, { backgroundColor: '#F1F5F9' }]}>
              <Feather name="globe" size={18} color="#475569" />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>{t('profile.languageTitle')}</Text>
              <Text style={styles.optionSubtitle}>
                {LANGUAGES.find((l) => l.code === language)?.name || 'English'}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>
        </View>

        {/* Option Group: Sync & Backup (Hidden for Cashier!) */}
        {canPerform('read', 'sync') && (
          <View style={styles.optionsGroup}>
            <Text style={styles.groupHeader}>{t('profile.groupSync')}</Text>

            {/* Option: Manual Sync */}
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={async () => {
                hapticFeedback.impactMedium();
                checkPremiumAction('Manual database synchronization', async () => {
                  triggerToast(t('profile.syncing'));
                  const success = await syncDatabase();
                  if (success) {
                    hapticFeedback.notificationSuccess();
                    triggerToast(t('profile.syncSuccess'));
                  } else {
                    hapticFeedback.notificationError();
                    Alert.alert(t('profile.syncFailed'), t('profile.syncFailedMsg'));
                  }
                });
              }}
            >
              <View style={[styles.optionIconBox, { backgroundColor: '#E6F4EA' }]}>
                <Feather name="refresh-cw" size={18} color="#137333" />
              </View>
              <View style={styles.optionTextWrapper}>
                <Text style={styles.optionTitle}>{t('profile.syncTitle')}</Text>
                <Text style={styles.optionSubtitle}>{t('profile.syncSub')}</Text>
              </View>
              <Feather name="chevron-right" size={16} color={TOKENS.muted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.optionsGroup}>
          <Text style={styles.groupHeader}>{t('profile.groupSupport')}</Text>

          {/* Option: Help */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              setIsHelpModalOpen(true);
            }}
          >
            <View style={[styles.optionIconBox, { backgroundColor: '#F3F4F6' }]}>
              <Feather name="help-circle" size={18} color={TOKENS.dark} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>{t('profile.helpTitle')}</Text>
              <Text style={styles.optionSubtitle}>{t('profile.helpSub')}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Disconnect Signout */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.notificationWarning();
              Alert.alert(t('profile.disconnectConfirmTitle'), t('profile.disconnectConfirmMsg'), [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('profile.signOutTitle'),
                  style: 'destructive',
                  onPress: async () => {
                    hapticFeedback.notificationSuccess();
                    await deleteCurrentDeviceSession();
                    cartState.logout();
                    triggerToast(t('profile.profileLoggedOut'));
                    router.replace('/auth/number-input');
                  },
                },
              ]);
            }}
          >
            <View style={[styles.optionIconBox, { backgroundColor: '#FCE8E6' }]}>
              <Feather name="log-out" size={18} color={TOKENS.error} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={[styles.optionTitle, { color: TOKENS.error }]}>
                {t('profile.signOutTitle')}
              </Text>
              <Text style={styles.optionSubtitle}>{t('profile.signOutSub')}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>
        </View>
        {/* Footer info: Made in Sri Lanka & App Version */}
        <View style={styles.footerContainer}>
          <Text style={styles.versionText}>{t('profile.appVersion')}</Text>
          <Text style={styles.madeInText}>Made in 🇱🇰 with ❤️</Text>
        </View>
      </ScrollView>

      {/* Help & Customer Support Bottom Sheet */}
      <BottomSheet
        visible={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        title="Help & Support"
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={[styles.modalHelpScroll, { maxHeight: 500 }]}
        >
          <Text style={styles.supportIntro}>
            Need assistance with your Shopbook POS terminal? Get priority response 24/7.
          </Text>

          {/* Action Buttons as Premium Card Rows */}
          <View style={styles.supportActions}>
            <TouchableOpacity
              style={styles.premiumSupportCard}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('tel:+94782470168')}
            >
              <View style={[styles.supportIconCircle, { backgroundColor: '#EFF6FF' }]}>
                <Feather name="phone" size={18} color={TOKENS.primary} />
              </View>
              <View style={styles.supportCardTextWrapper}>
                <Text style={styles.supportCardTitle}>Call Helpline</Text>
                <Text style={styles.supportCardSubtitle}>Call +94 78 247 0168 · Active 24/7</Text>
              </View>
              <Feather name="chevron-right" size={18} color={TOKENS.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.premiumSupportCard}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('https://wa.me/94782470168')}
            >
              <View style={[styles.supportIconCircle, { backgroundColor: '#E8FDF0' }]}>
                <Feather name="message-circle" size={18} color="#10B981" />
              </View>
              <View style={styles.supportCardTextWrapper}>
                <Text style={styles.supportCardTitle}>WhatsApp Support</Text>
                <Text style={styles.supportCardSubtitle}>Chat immediately & send screenshots</Text>
              </View>
              <Feather name="chevron-right" size={18} color={TOKENS.muted} />
            </TouchableOpacity>
          </View>

          {/* FAQs Section */}
          <Text style={styles.faqHeader}>Frequently Asked Questions</Text>
          <View style={styles.faqList}>
            {FAQS.map((faq, index) => {
              const isExpanded = expandedFaqIndex === index;
              return (
                <View key={index} style={styles.faqCard}>
                  <TouchableOpacity
                    style={styles.faqQuestionRow}
                    activeOpacity={0.7}
                    onPress={() => setExpandedFaqIndex(isExpanded ? null : index)}
                  >
                    <Text style={styles.faqQuestionText}>{faq.q}</Text>
                    <Feather
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={TOKENS.muted}
                    />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View style={styles.faqAnswerWrapper}>
                      <Text style={styles.faqAnswerText}>{faq.a}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </BottomSheet>

      <PremiumUpgradeModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        featureName={premiumFeatureName}
      />

      {/* Language Switcher Bottom Sheet */}
      <BottomSheet
        visible={isLanguageModalOpen}
        onClose={() => setIsLanguageModalOpen(false)}
        title={t('profile.languageTitle')}
      >
        <View style={styles.languageList}>
          {LANGUAGES.map((lang) => {
            const isSelected = language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                style={[styles.languageCard, isSelected && styles.languageCardActive]}
                activeOpacity={0.7}
                onPress={() => {
                  hapticFeedback.notificationSuccess();
                  setLanguage(lang.code);
                  setIsLanguageModalOpen(false);
                  triggerToast(`${lang.name} set successfully!`);
                }}
              >
                <Text
                  style={[styles.languageCardText, isSelected && styles.languageCardTextActive]}
                >
                  {lang.name}
                </Text>
                {isSelected && <Feather name="check" size={18} color={TOKENS.success} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>
    </ScreenWrapper>
  );
};

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
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.15)',
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
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  avatarCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 20,
    alignItems: 'center',
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.02)',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}33`,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: 'bold',
    color: TOKENS.card,
  },
  partnerName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: TOKENS.dark,
    marginTop: 14,
  },
  partnerPlan: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 4,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F4EA',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
    marginTop: 12,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#137333',
  },
  activeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#137333',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.primary,
  },
  statLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: TOKENS.border,
  },
  optionsGroup: {
    gap: 8,
  },
  groupHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TOKENS.muted,
    letterSpacing: 0.5,
    marginLeft: 4,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 12,
  },
  optionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionTextWrapper: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  optionSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 4,
    lineHeight: 14,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  switchButton: {
    width: 46,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchButtonActive: {
    backgroundColor: TOKENS.primary,
  },
  switchButtonInactive: {
    backgroundColor: '#D1D5DB',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    boxShadow: '0px 1px 1.5px 0px rgba(0, 0, 0, 0.2)',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  switchThumbInactive: {
    alignSelf: 'flex-start',
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  modalHelpContent: {
    backgroundColor: TOKENS.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '85%',
    boxShadow: '0px -6px 16px 0px rgba(0, 0, 0, 0.12)',
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  modalHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  premiumSupportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    padding: 14,
    boxShadow: '0px 2px 3px 0px rgba(0, 0, 0, 0.02)',
  },
  supportIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  supportCardTextWrapper: {
    flex: 1,
  },
  supportCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TOKENS.dark,
  },
  supportCardSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
    lineHeight: 14,
  },
  modalHelpTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  modalHelpCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHelpScroll: {
    paddingVertical: 16,
    paddingHorizontal: 0,
  },
  supportIntro: {
    fontSize: 13,
    color: TOKENS.muted,
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  supportActions: {
    gap: 12,
    marginBottom: 24,
  },
  callSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.primary,
    height: 48,
    borderRadius: 12,
    gap: 8,
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}26`,
  },
  callSupportText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    height: 48,
    borderRadius: 12,
    gap: 8,
    boxShadow: '0px 4px 6px 0px rgba(37, 211, 102, 0.15)',
  },
  whatsappText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  supportIcon: {
    marginRight: 4,
  },
  faqHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
    marginBottom: 12,
    marginTop: 8,
  },
  faqList: {
    gap: 10,
    marginBottom: 40,
  },
  faqCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    overflow: 'hidden',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  faqQuestionText: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.dark,
    flex: 1,
    marginRight: 8,
  },
  faqAnswerWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  faqAnswerText: {
    fontSize: 12,
    color: TOKENS.muted,
    lineHeight: 16,
  },
  languageList: {
    paddingVertical: 12,
    gap: 8,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  languageCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: TOKENS.primary,
  },
  languageCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: TOKENS.dark,
  },
  languageCardTextActive: {
    color: TOKENS.primary,
    fontWeight: '600',
  },
});
