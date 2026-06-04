import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TOKENS } from '../../constants/tokens';
import { hapticFeedback } from '../../utils/haptics';

interface PremiumUpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  featureName?: string;
}

const PREMIUM_FEATURES = [
  {
    icon: 'briefcase',
    color: '#D97706',
    bgColor: '#FEF3C7',
    title: 'Multi-Branch switching',
    desc: 'Create and switch between multiple business branches/stores.',
  },
  {
    icon: 'cloud-lightning',
    color: '#2563EB',
    bgColor: '#DBEAFE',
    title: 'Auto Cloud Sync & Backup',
    desc: 'Real-time sync to cloud. Never lose your business records.',
  },
  {
    icon: 'users',
    color: '#059669',
    bgColor: '#D1FAE5',
    title: 'Staff Management',
    desc: 'Invite and assign roles (Manager, Cashier) to your employees.',
  },
  {
    icon: 'printer',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    title: 'Bluetooth Thermal Printer',
    desc: 'Print physical transaction invoices and receipts on the go.',
  },
  {
    icon: 'qr-code',
    color: '#B45309',
    bgColor: '#FDE68A',
    title: 'In-App Barcode Search Scanning',
    desc: 'Scan barcodes inside POS invoice checkout, search, or stocks.',
  },
  {
    icon: 'file-text',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    title: 'PDF / CSV Statements',
    desc: 'Download ledger reports and export business statements.',
  },
  {
    icon: 'globe',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    title: 'Web Browser Access',
    desc: 'Access your live POS at web.shopbook.lk from any device.',
  },
];

export const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
  visible,
  onClose,
  featureName = 'This feature',
}) => {
  const router = useRouter();
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  const modalHeight = SCREEN_HEIGHT * 0.82; // Set a fixed height (82% of screen height) to prevent collapsing and match spacious layout

  const handleUpgradePress = () => {
    hapticFeedback.impactMedium();
    onClose();
    router.push('/profile/premium-plans');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Backdrop (touches pass properly, fixing ScrollView scrolling issue) */}
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />

        {/* Modal Container */}
        <View style={[styles.modalContainer, { height: modalHeight }]}>
          {/* Close Button */}
          <TouchableOpacity style={styles.absoluteCloseBtn} onPress={onClose}>
            <Feather name="x" size={18} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Fixed Header Section (outside ScrollView) */}
          <View style={styles.headerSection}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="diamond" size={24} color="#D97706" />
              <Text style={styles.alertTitle}>Mini POS Pro</Text>
              <View style={styles.vipBadge}>
                <Text style={styles.vipBadgeText}>PRO</Text>
              </View>
            </View>
          </View>

          {/* Scrollable Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            style={styles.modalScroll}
          >
            {/* Combined Premium Status Card with a glorious Gradient */}
            <LinearGradient
              colors={['#0F172A', '#1E293B']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.proPassCard}
            >
              <View style={styles.proPassHeader}>
                <View style={styles.vipBadgeSmall}>
                  <Text style={styles.vipBadgeTextSmall}>PRO FEATURE</Text>
                </View>
                <Text style={styles.proPassTitle} numberOfLines={1} ellipsizeMode="tail">
                  Upgrade Required
                </Text>
              </View>
              <Text style={styles.proPassSubtitle}>
                <Text style={styles.highlightText}>{featureName}</Text> requires a Pro subscription.
                Upgrade to get unlimited access, Active Sync, Unlimited Outlets, and Priority
                Support.
              </Text>
            </LinearGradient>

            {/* Feature list */}
            <View style={styles.featureGrid}>
              <Text style={styles.sectionTitle}>✨ Premium capabilities included</Text>
              <View style={styles.featuresList}>
                {PREMIUM_FEATURES.map((item, index) => (
                  <View key={index} style={styles.featureRowCard}>
                    <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
                      {item.icon === 'qr-code' ? (
                        <Ionicons name="qr-code-outline" size={18} color={item.color} />
                      ) : (
                        <Feather name={item.icon as any} size={18} color={item.color} />
                      )}
                    </View>
                    <View style={styles.textCol}>
                      <Text style={styles.featureTitle}>{item.title}</Text>
                      <Text style={styles.featureDesc}>{item.desc}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Fixed Bottom Action Buttons */}
          <View style={styles.footerSection}>
            <TouchableOpacity
              style={styles.upgradeBtn}
              activeOpacity={0.85}
              onPress={handleUpgradePress}
            >
              <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
              <Feather name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.8} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Semi-transparent black backdrop (matches Barcode Scanner Popup)
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: TOKENS.card,
    borderRadius: 24,
    boxShadow: '0px 12px 16px 0px rgba(15, 23, 42, 0.25)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: TOKENS.border,
    position: 'relative',
  },
  absoluteCloseBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 20,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TOKENS.dark,
    letterSpacing: -0.5,
  },
  vipBadge: {
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  proPassCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
    width: '100%',
    borderWidth: 1.5,
    borderColor: '#D97706', // Gold/Amber border
    boxShadow: '0px 4px 8px 0px rgba(217, 119, 6, 0.15)',
  },
  proPassHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vipBadgeSmall: {
    backgroundColor: '#D97706',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  vipBadgeTextSmall: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  proPassTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F59E0B', // Gold color
    flex: 1,
  },
  proPassSubtitle: {
    fontSize: 12,
    color: '#E2E8F0', // Slate-200
    lineHeight: 18,
    fontWeight: '500',
  },
  highlightText: {
    color: '#F59E0B',
    fontWeight: '700',
  },
  featureGrid: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TOKENS.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  featuresList: {
    gap: 10,
  },
  featureRowCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 14,
    padding: 12,
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.02)',
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  featureDesc: {
    fontSize: 11.5,
    color: TOKENS.muted,
    lineHeight: 15,
  },
  footerSection: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    backgroundColor: TOKENS.card,
    gap: 8,
  },
  upgradeBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: TOKENS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}33`,
  },
  upgradeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  cancelBtn: {
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: TOKENS.muted,
    fontSize: 13.5,
    fontWeight: 'bold',
  },
});
