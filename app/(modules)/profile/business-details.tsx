import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Business, cartState } from "../../../components/data/cartState";
import { TOKENS } from "../../../constants/tokens";

export default function BusinessDetailsRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeBusiness, setActiveBusiness] = useState<Business>(cartState.getActiveBusiness());

  useEffect(() => {
    const syncState = () => {
      setActiveBusiness(cartState.getActiveBusiness());
    };
    return cartState.subscribe(syncState);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/profile")}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Store Details</Text>
        <View style={styles.placeholderWidth} />
      </View>

      <ScrollView style={styles.scrollWrapper} contentContainerStyle={styles.scrollContent}>
        {/* Business Main Card */}
        <View style={styles.detailCard}>
          <View style={styles.storeIconBox}>
            <Feather name="home" size={28} color={TOKENS.primary} />
          </View>
          <Text style={styles.storeName}>{activeBusiness.name}</Text>
          <Text style={styles.storeStatus}>{activeBusiness.category} POS Terminal</Text>
        </View>

        {/* Info Group */}
        <View style={styles.infoGroup}>
          <Text style={styles.groupLabel}>Store Information</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Business Name</Text>
            <Text style={styles.infoVal}>{activeBusiness.name}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Business Type</Text>
            <Text style={styles.infoVal}>{activeBusiness.category}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            <Text style={styles.infoVal}>{activeBusiness.address}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            <Text style={styles.infoVal}>{activeBusiness.phone}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tax ID (TIN)</Text>
            <Text style={styles.infoVal}>TIN-9948839912</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Operating Hours</Text>
            <Text style={styles.infoVal}>08:00 AM - 10:00 PM</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
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
  detailCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 24,
    alignItems: "center",
  },
  storeIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TOKENS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  storeName: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  storeStatus: {
    fontSize: 12,
    color: TOKENS.success,
    fontWeight: "600",
    marginTop: 4,
  },
  infoGroup: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    gap: 14,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 10,
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  infoVal: {
    fontSize: 14,
    color: TOKENS.dark,
    fontWeight: "600",
  },
});
