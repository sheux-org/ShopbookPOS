import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { Header } from "../common/Header";
import { BottomTabBar } from "../common/BottomTabBar";
import { RECENT_ITEMS, RecentItem } from "../data/products";

export const ScanScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const [addedItemsCount, setAddedItemsCount] = useState(8);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => loop.stop();
  }, [scanAnim]);

  const translateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 134],
  });

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 1500);
  };

  const handlePlusAction = (item: RecentItem) => {
    setAddedItemsCount((prev) => prev + 1);
    triggerToast(`Scanned & added ${item.name}`);
  };

  const handleTabPress = (tabId: string) => {
    if (tabId === "home") {
      router.push("/");
    } else if (tabId === "pos") {
      router.push("/pos");
    } else {
      triggerToast(`${tabId.toUpperCase()} view tab selected`);
    }
  };

  const filteredRecents = useMemo(() => {
    if (!searchQuery) return RECENT_ITEMS;
    return RECENT_ITEMS.filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <View style={styles.container}>
      {/* Primary Blue Top Header */}
      <View style={{ paddingTop: Platform.OS === "android" ? insets.top : 10, backgroundColor: TOKENS.primary }}>
        <Header
          variant="primary"
          title="Mini POS"
          subtitle={`Cart · ${addedItemsCount} items`}
          onBackPress={() => router.back()}
        />
      </View>

      {/* Popover feedback toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Camera Viewfinder Area */}
      <View style={styles.viewfinderContainer}>
        <View style={styles.bracketFrame}>
          <View style={[styles.cornerBracket, styles.topLeftBracket]} />
          <View style={[styles.cornerBracket, styles.topRightBracket]} />
          <View style={[styles.cornerBracket, styles.bottomLeftBracket]} />
          <View style={[styles.cornerBracket, styles.bottomRightBracket]} />

          {/* Static barcode graphic representation */}
          <View style={styles.barcodeGraphic}>
            <View style={[styles.bar, { width: 3 }]} />
            <View style={[styles.bar, { width: 6 }]} />
            <View style={[styles.bar, { width: 2 }]} />
            <View style={[styles.bar, { width: 4 }]} />
            <View style={[styles.bar, { width: 2 }]} />
            <View style={[styles.bar, { width: 5 }]} />
            <View style={[styles.bar, { width: 2 }]} />
            <View style={[styles.bar, { width: 8 }]} />
            <View style={[styles.bar, { width: 3 }]} />
            <View style={[styles.bar, { width: 2 }]} />
            <View style={[styles.bar, { width: 5 }]} />
            <View style={[styles.bar, { width: 3 }]} />
          </View>

          {/* Animated looped sweep laser line */}
          <Animated.View style={[styles.laserLine, { transform: [{ translateY }] }]} />
        </View>

        <Text style={styles.viewfinderText}>Scan · Hold steady</Text>
      </View>

      {/* Below Viewfinder Recents Layout */}
      <View style={styles.contentSection}>
        {/* Search input paired with manual trigger edit icon */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Feather name="search" size={18} color={TOKENS.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Feather name="x-circle" size={18} color={TOKENS.muted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.editButton}
            activeOpacity={0.75}
            onPress={() => triggerToast("Manual input lookup mode")}
          >
            <Feather name="edit" size={18} color={TOKENS.dark} />
          </TouchableOpacity>
        </View>

        <Text style={styles.recentsLabel}>RECENTS</Text>

        <ScrollView style={styles.recentsList} showsVerticalScrollIndicator={false}>
          {filteredRecents.map((item) => (
            <View key={item.id} style={styles.recentItemRow}>
              <View style={styles.itemIconBox}>
                <Ionicons name="barcode-outline" size={20} color={TOKENS.primary} />
              </View>

              <View style={styles.itemDetails}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemSku}>{item.sku}</Text>
              </View>

              <Text style={styles.itemPrice}>Rs. {item.price}</Text>

              <TouchableOpacity
                style={styles.plusButton}
                activeOpacity={0.75}
                onPress={() => handlePlusAction(item)}
              >
                <Feather name="plus" size={18} color={TOKENS.card} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>


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
    top: 110,
    alignSelf: "center",
    backgroundColor: TOKENS.success,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: "600",
  },
  viewfinderContainer: {
    width: "100%",
    height: 280,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
  },
  bracketFrame: {
    width: 220,
    height: 144,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  cornerBracket: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: TOKENS.yellow,
  },
  topLeftBracket: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 4,
  },
  topRightBracket: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 4,
  },
  bottomLeftBracket: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 4,
  },
  bottomRightBracket: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 4,
  },
  barcodeGraphic: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 64,
    gap: 3,
    opacity: 0.9,
  },
  bar: {
    height: "100%",
    backgroundColor: TOKENS.card,
    borderRadius: 1,
  },
  laserLine: {
    position: "absolute",
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: TOKENS.yellow,
    shadowColor: TOKENS.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  viewfinderText: {
    marginTop: 24,
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  contentSection: {
    flex: 1,
    backgroundColor: TOKENS.card,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: TOKENS.dark,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.card,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  recentsLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: TOKENS.muted,
    marginTop: 20,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  recentsList: {
    flex: 1,
  },
  recentItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: TOKENS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    justifyContent: "center",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  itemSku: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.primary,
    marginRight: 12,
  },
  plusButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
