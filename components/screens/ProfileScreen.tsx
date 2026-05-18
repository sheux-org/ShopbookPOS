import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { BottomTabBar } from "../common/BottomTabBar";
import { cartState } from "../data/cartState";

export const ProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      const cart = cartState.getCart();
      setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    };
    updateCount();
    return cartState.subscribe(updateCount);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
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
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar Card Glassmorphic Premium */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>SP</Text>
          </View>

          <Text style={styles.partnerName}>Shopbook Partner Store</Text>
          <Text style={styles.partnerPlan}>Pro Retailer Plan</Text>

          <View style={styles.activeBadge}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>Connected Partner</Text>
          </View>
        </View>

        {/* Setting options list group */}
        <View style={styles.optionsGroup}>
          <Text style={styles.groupHeader}>Business Settings</Text>

          {/* Option: Shop Details */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => router.push("/business-details")}
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#E8F0FE" }]}>
              <Feather name="home" size={18} color={TOKENS.primary} />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Store Details</Text>
              <Text style={styles.optionSubtitle}>Configure business logo, receipt details & addresses</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Business Management */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => router.push("/manage-businesses")}
          >
            <View style={[styles.optionIconBox, { backgroundColor: "#FEF7E0" }]}>
              <Feather name="briefcase" size={18} color="#B06000" />
            </View>
            <View style={styles.optionTextWrapper}>
              <Text style={styles.optionTitle}>Business Management</Text>
              <Text style={styles.optionSubtitle}>Create and manage multiple businesses or branches</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          {/* Option: Staff Management */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => router.push("/manage-staff")}
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
        </View>

        <View style={styles.optionsGroup}>
          <Text style={styles.groupHeader}>Support</Text>

          {/* Option: Help */}
          <TouchableOpacity
            style={styles.optionRow}
            activeOpacity={0.7}
            onPress={() => Alert.alert("Help & Support", "Priority customer care is active 24/7. Call us at +94 11 234 5678.")}
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
                  onPress: () => {
                    cartState.logout();
                    triggerToast("Profile logged out");
                    router.push("/");
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
              <Text style={styles.optionSubtitle}>Disconnect POS session safely from this iPad</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>
        </View>
      </ScrollView>




    </View>
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
  headerCartBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerCartBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: TOKENS.error,
    borderRadius: 9,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCartBadgeText: {
    color: TOKENS.card,
    fontSize: 9,
    fontWeight: "bold",
  },
});
