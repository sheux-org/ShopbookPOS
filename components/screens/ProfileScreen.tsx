import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenWrapper } from "../common/ScreenWrapper";
import { TOKENS } from "../../constants/tokens";
import { cartState } from "../data/cartState";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { syncDatabase } from "../../services/sync";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { BottomSheet } from "../common/BottomSheet";
import { BusinessAvatar } from "../common/BusinessAvatar";
import { deleteCurrentDeviceSession } from "../../hooks/useActiveDeviceTracker";
import { PremiumUpgradeModal } from "../common/PremiumUpgradeModal";

const FAQS = [
  {
    q: "Does Shopbook Mini POS work without an internet connection?",
    a: "Yes! Shopbook Mini POS saves all transactions to a secure local database. You can perform billing, scan barcodes, and manage inventory offline. Cloud backup and synchronization is a premium feature available in the Shopbook Mini POS Pro version.",
  },
  {
    q: "What is a 'Quick Code' and how do cashiers use it?",
    a: "Quick Codes are short numeric shortcuts (e.g., '101' for Bread) assigned to products. Cashiers can type these in the Search bar to add items to the invoice instantly without using a scanner.",
  },
  {
    q: "How do I scan barcodes to add items in Shopbook Mini POS?",
    a: "Tap 'Scan' in the bottom navigation or tap the search icon in the header and click the camera icon. Line up the product barcode within the viewfinder to search and add it.",
  },
  {
    q: "How do I connect a Bluetooth thermal printer?",
    a: "Go to Profile Settings > Bluetooth Thermal Printer. Scan for nearby devices, select your printer, and pair it. Once connected, printing receipts via Bluetooth thermal printers is a premium feature available for Shopbook Mini POS Pro users.",
  },
  {
    q: "What can Managers and Cashiers access in Shopbook Mini POS?",
    a: "Cashiers can only perform sales and scan barcodes, while Managers can manage stock. Granting multi-user access for staff (Managers/Cashiers) is a premium feature included in the Shopbook Mini POS Pro plan.",
  },
  {
    q: "Can I manage multiple store locations or branches?",
    a: "Yes! Creating and switching between multiple business branches is a premium feature in Shopbook Mini POS Pro. Upgrading lets you manage separate staff, products, and order histories for each branch.",
  },
  {
    q: "How do Low Stock Alerts work in Shopbook Mini POS?",
    a: "When adding/editing a product, you can set a 'Low Stock Alert' threshold. When the item count drops below this, the stock text turns orange on the Home Screen to warn cashiers.",
  },
];

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isBackupEnabled = useSettingsStore((s) => s.isBackupEnabled);
  const toggleBackup = useSettingsStore((s) => s.toggleBackup);
  const pairedPrinter = useSettingsStore((s) => s.pairedPrinter);
  const isPremium = useSettingsStore((s) => s.isPremium);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<"1_month" | "3_month" | "1_year">("3_month");
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);
  const [premiumFeatureName, setPremiumFeatureName] = useState("");

  // Real business details from local SQLite database
  const [activeBusiness, setActiveBusiness] = useState(cartState.getActiveBusiness());

  // Help & Support Modal state
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    const updateBusiness = () => {
      setActiveBusiness(cartState.getActiveBusiness());
    };
    updateBusiness();
    return cartState.subscribe(updateBusiness);
  }, []);

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
          onPress={() => router.push("/")}
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Card Glassmorphic Premium */}
        <View style={styles.avatarCard}>
          <BusinessAvatar
            logoUri={activeBusiness?.logoUri}
            name={activeBusiness?.name || "SP"}
            size={72}
          />

          <Text style={styles.partnerName}>{activeBusiness?.name || "Shopbook Partner Store"}</Text>
          <Text style={styles.partnerPlan}>🛡️ {userRole === "admin" ? "Administrator / Store Owner" : userRole === "manager" ? "Store Manager" : "Store Cashier"}</Text>

          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>System {userRole.toUpperCase()} Active</Text>
          </View>
        </View>

        {/* Setting options list group */}
        <View style={styles.optionsGroup}>
          <Text style={styles.groupHeader}>Business Settings</Text>

          {/* Option: Shop Details */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => router.push("/profile/business-details")}
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#E8F0FE" }]}>
              <Feather name="home" size={18} color={TOKENS.primary} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Store Details</Text>
              <Text style={styles.optionSubtitle}>{userRole === "cashier" ? "View business details and addresses" : "Configure business logo, receipt details & addresses"}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Business Management */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => checkPremiumAction("Multiple branch management", () => router.push("/profile/manage-businesses"))}
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#FEF7E0" }]}>
              <Feather name="briefcase" size={18} color="#B06000" />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Business Management</Text>
              <Text style={styles.optionSubtitle}>{userRole === "cashier" ? "View registered businesses and branches" : "Create and manage multiple businesses or branches"}</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Bluetooth Printer Setup */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => checkPremiumAction("Bluetooth thermal printer printing", () => router.push("/profile/bluetooth-printer"))}
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#EFF6FF" }]}>
              <Feather name="printer" size={18} color={TOKENS.primary} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Bluetooth Thermal Printer</Text>
              <Text style={styles.optionSubtitle}>
                {pairedPrinter ? `Connected: ${pairedPrinter} ✅` : "Scan and connect to receipt printers"}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Active Devices */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => checkPremiumAction("Active devices monitoring", () => router.push("/profile/active-devices"))}
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#E8F0FE" }]}>
              <Feather name="smartphone" size={18} color={TOKENS.primary} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Active Devices</Text>
              <Text style={styles.optionSubtitle}>Monitor and manage active devices logged into your account</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Staff Management (Hidden for Manager & Cashier!) */}
          {canPerform("create", "staff") && (
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => checkPremiumAction("Staff accounts management", () => router.push("/profile/manage-staff"))}
            >
              <View style={[styles.optionIconBox, { backgroundColor: "#E6F4EA" }]}>
                <Feather name="users" size={18} color="#137333" />
              </View>
              <View style={styles.optionTextWrapper}>
                <Text style={styles.optionTitle}>Staff Management</Text>
                <Text style={styles.optionSubtitle}>Add and configure Admins, Managers & Cashiers</Text>
              </View>
              <Feather name="chevron-right" size={16} color={TOKENS.muted} />
            </TouchableOpacity>
          )}

          {/* Option: Premium Plans Setup (Hidden for Manager & Cashier!) */}
          {canPerform("create", "settings") && (
            <TouchableOpacity
              style={styles.optionRow}
              activeOpacity={0.7}
              onPress={() => router.push("/profile/premium-plans")}
            >
              <View style={[styles.optionIconBox, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="diamond" size={18} color="#D97706" />
              </View>
              <View style={styles.optionTextWrapper}>
                <Text style={styles.optionTitle}>Premium Plans</Text>
                <Text style={styles.optionSubtitle}>Manage subscriptions, billing cycles, and feature access</Text>
              </View>
              <Feather name="chevron-right" size={16} color={TOKENS.muted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Option Group: Sync & Backup (Hidden for Cashier!) */}
        {canPerform("read", "sync") && (
          <View style={styles.optionsGroup}>
            <Text style={styles.groupHeader}>Data Sync & Backup</Text>

            {/* Option: Cloud Backup Toggle */}
            <View style={styles.optionRow}>
              <View style={[styles.optionIconBox, { backgroundColor: "#E8F0FE" }]}>
                <Feather name="cloud-lightning" size={18} color={TOKENS.primary} />
              </View>
              <View style={styles.optionTextWrapper}>
                <Text style={styles.optionTitle}>Auto Backup to Cloud</Text>
                <Text style={styles.optionSubtitle}>
                  {isBackupEnabled
                    ? "Real-time sync to Supabase is active"
                    : "Enable real-time cloud backup to Supabase"}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  checkPremiumAction("Cloud backup and database synchronization", () => {
                    toggleBackup();
                    triggerToast(isBackupEnabled ? "Cloud backup disabled" : "Cloud backup enabled! ☁️");
                  });
                }}
                style={[
                  styles.switchButton,
                  isBackupEnabled ? styles.switchButtonActive : styles.switchButtonInactive
                ]}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.switchThumb,
                  isBackupEnabled ? styles.switchThumbActive : styles.switchThumbInactive
                ]} />
              </TouchableOpacity>
            </View>

            {/* Option: Manual Sync */}
            {isBackupEnabled && (
              <TouchableOpacity
                style={styles.optionRow}
                activeOpacity={0.7}
                onPress={async () => {
                  checkPremiumAction("Manual database synchronization", async () => {
                    triggerToast("Syncing database... 🔄");
                    const success = await syncDatabase();
                    if (success) {
                      triggerToast("Database synced successfully! ✅");
                    } else {
                      Alert.alert("Sync Failed", "Check your internet connection and Supabase environment configuration.");
                    }
                  });
                }}
              >
                <View style={[styles.optionIconBox, { backgroundColor: "#E6F4EA" }]}>
                  <Feather name="refresh-cw" size={18} color="#137333" />
                </View>
                <View style={styles.optionTextWrapper}>
                  <Text style={styles.optionTitle}>Sync Database Now</Text>
                  <Text style={styles.optionSubtitle}>Trigger manual synchronization of offline data</Text>
                </View>
                <Feather name="chevron-right" size={16} color={TOKENS.muted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.optionsGroup}>
          <Text style={styles.groupHeader}>Support</Text>

          {/* Option: Help */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => setIsHelpModalOpen(true)}
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#F3F4F6" }]}>
              <Feather name="help-circle" size={18} color={TOKENS.dark} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Help & Customer Support</Text>
              <Text style={styles.optionSubtitle}>Get priority live assistance immediately</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Disconnect Signout */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() =>
              Alert.alert("Disconnect Profile", "Are you sure you want to log out from this Shopbook POS terminal?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign Out",
                  style: "destructive",
                  onPress: async () => {
                    await deleteCurrentDeviceSession();
                    cartState.logout();
                    triggerToast("Profile logged out");
                    router.replace("/auth/number-input");
                  },
                },
              ])
            }
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#FCE8E6" }]}>
              <Feather name="log-out" size={18} color={TOKENS.error} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={[styles.optionTitle, { color: TOKENS.error }]}>Sign Out</Text>
              <Text style={styles.optionSubtitle}>Disconnect POS session safely</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>
        </View>
        {/* Footer info: Made in Sri Lanka & App Version */}
        <View style={styles.footerContainer}>
          <Text style={styles.versionText}>Version: 1.0.4</Text>
          <Text style={styles.madeInText}>Made in 🇱🇰 with ❤️</Text>
        </View>
      </ScrollView>

      {/* Help & Customer Support Bottom Sheet */}
      <BottomSheet
        visible={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        title="Help & Support"
      >
        <ScrollView showsVerticalScrollIndicator={false} style={[styles.modalHelpScroll, { maxHeight: 500 }]}>
          <Text style={styles.supportIntro}>
            Need assistance with your Shopbook POS terminal? Get priority response 24/7.
          </Text>

          {/* Action Buttons as Premium Card Rows */}
          <View style={styles.supportActions}>
            <TouchableOpacity
              style={styles.premiumSupportCard}
              activeOpacity={0.7}
              onPress={() => Linking.openURL("tel:+94782470168")}
            >
              <View style={[styles.supportIconCircle, { backgroundColor: "#EFF6FF" }]}>
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
              onPress={() => Linking.openURL("https://wa.me/94782470168")}
            >
              <View style={[styles.supportIconCircle, { backgroundColor: "#E8FDF0" }]}>
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
                      name={isExpanded ? "chevron-up" : "chevron-down"}
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

    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  toastContainer: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    backgroundColor: TOKENS.success,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
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
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: "bold",
    color: TOKENS.card,
  },
  partnerName: {
    fontSize: 17,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginTop: 14,
  },
  partnerPlan: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 4,
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E6F4EA",
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
    backgroundColor: "#137333",
  },
  activeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#137333",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingVertical: 14,
    alignItems: "center",
  },
  statCol: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statVal: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  statLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: "600",
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
    fontWeight: "bold",
    color: TOKENS.muted,
    letterSpacing: 0.5,
    marginLeft: 4,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
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
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  optionTextWrapper: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  optionSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 4,
    lineHeight: 14,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  switchButton: {
    width: 46,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
  },
  switchButtonActive: {
    backgroundColor: TOKENS.primary,
  },
  switchButtonInactive: {
    backgroundColor: "#D1D5DB",
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  switchThumbActive: {
    alignSelf: "flex-end",
  },
  switchThumbInactive: {
    alignSelf: "flex-start",
  },
  footerContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    marginBottom: 8,
    gap: 4,
  },
  madeInText: {
    fontSize: 14,
    fontWeight: "700",
    color: TOKENS.muted,
  },
  versionText: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.muted,
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalHelpContent: {
    backgroundColor: TOKENS.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 6,
  },
  modalHelpHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  supportIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  supportCardTextWrapper: {
    flex: 1,
  },
  supportCardTitle: {
    fontSize: 14,
    fontWeight: "800",
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
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  modalHelpCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
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
    textAlign: "center",
  },
  supportActions: {
    gap: 12,
    marginBottom: 24,
  },
  callSupportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.primary,
    height: 48,
    borderRadius: 12,
    gap: 8,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  callSupportText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  whatsappBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#25D366",
    height: 48,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#25D366",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  whatsappText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  supportIcon: {
    marginRight: 4,
  },
  faqHeader: {
    fontSize: 14,
    fontWeight: "bold",
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
    overflow: "hidden",
  },
  faqQuestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  faqQuestionText: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.dark,
    flex: 1,
    marginRight: 8,
  },
  faqAnswerWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
  },
  faqAnswerText: {
    fontSize: 12,
    color: TOKENS.muted,
    lineHeight: 16,
  },
});
