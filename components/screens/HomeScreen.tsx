import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Platform,
  TextInput,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { cartState, Business } from "../data/cartState";
import { useTabBarVisible } from "../../hooks/useTabBarVisible";
import { BottomSheet } from "../common/BottomSheet";
import { useProducts, useToggleFavoriteProduct } from "../../hooks/useProducts";

interface HomeProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  stockText: string;
  stockType: "normal" | "low" | "out";
  stockCount?: number;
}

const CATEGORIES = [
  { id: "all", label: "All Items", count: 240 },
  { id: "grocery", label: "Grocery", count: 84 },
  { id: "dairy", label: "Dairy", count: 22 },
  { id: "drinks", label: "Drinks", count: 31 },
  { id: "snacks", label: "Snacks", count: 47 },
  { id: "household", label: "Household", count: 38 },
];

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic products list fetched via React Query custom hook
  const { data: productsList = [] } = useProducts(selectedCategory, searchQuery);
  const toggleFavoriteMutation = useToggleFavoriteProduct();
  const [cartItemsCount, setCartItemsCount] = useState(0);

  // console.log("productsList", productsList);
  // Active Business dropdown states
  const [activeBusiness, setActiveBusiness] = useState<Business>(cartState.getActiveBusiness());
  const [isBusinessSheetOpen, setIsBusinessSheetOpen] = useState(false);

  const { tabBarVisible, setTabBarVisible } = useTabBarVisible();
  const lastScrollY = useRef(0);

  // Reset tab bar visibility to true on mount/unmount to avoid lingering hidden state
  useEffect(() => {
    setTabBarVisible(true);
    return () => {
      setTabBarVisible(true);
    };
  }, []);

  // Synchronized FAB animation values
  const fabWidthAnim = useRef(new Animated.Value(115)).current;
  const fabTextOpacityAnim = useRef(new Animated.Value(1)).current;
  const fabTextScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(fabWidthAnim, {
        toValue: tabBarVisible ? 115 : 48,
        useNativeDriver: false,
        friction: 8,
        tension: 50,
      }),
      Animated.spring(fabTextOpacityAnim, {
        toValue: tabBarVisible ? 1 : 0,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }),
      Animated.spring(fabTextScaleAnim, {
        toValue: tabBarVisible ? 1 : 0.5,
        useNativeDriver: true,
        friction: 8,
        tension: 50,
      }),
    ]).start();
  }, [tabBarVisible]);

  // Scroll handler for hiding/showing tab bar dynamically
  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    
    // Scrolling down (with threshold)
    if (currentY > 50 && currentY > lastScrollY.current) {
      if (tabBarVisible) {
        setTabBarVisible(false);
      }
    } 
    // Scrolling up or at the absolute top
    else if (currentY < lastScrollY.current || currentY <= 10) {
      if (!tabBarVisible) {
        setTabBarVisible(true);
      }
    }
    
    lastScrollY.current = currentY;
  };

  useEffect(() => {
    const syncCart = () => {
      const cart = cartState.getCart();
      setCartItemsCount(cart.reduce((sum, item) => sum + item.quantity, 0));
      setActiveBusiness(cartState.getActiveBusiness());
    };

    syncCart();
    return cartState.subscribe(syncCart);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  };

  const handleAddProduct = (prod: HomeProduct) => {
    if (prod.stockType === "out") {
      triggerToast("Product is out of stock!");
      return;
    }
    cartState.addCartItem(prod.name, prod.price, prod.icon, `SKU 23400${prod.id}`, prod.stockCount);
    triggerToast(`Added ${prod.name} to active invoice`);
  };

  const handleTabPress = (tabId: string) => {
    if (tabId === "pos") {
      router.push("/pos");
    } else if (tabId === "stocks") {
      router.push("/stocks");
    } else if (tabId === "profile") {
      router.push("/profile");
    } else if (tabId !== "home") {
      triggerToast(`${tabId.toUpperCase()} view tab selected`);
    }
  };

  // WatermelonDB performs search & filter queries directly
  const filteredProducts = productsList;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
      {/* Toast popup */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header section with Search bar built-in */}
      <View style={styles.header}>
        <View style={styles.headerTextWrapper}>
          <Text style={styles.headerTitle}>Mini POS</Text>
          <TouchableOpacity
            style={styles.businessSwitcherBtn}
            activeOpacity={0.7}
            onPress={() => setIsBusinessSheetOpen(true)}
          >
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              🏢 {activeBusiness.name}
            </Text>
            <Feather name="chevron-down" size={13} color={TOKENS.muted} style={{ marginLeft: 3 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          {cartItemsCount > 0 && (
            <TouchableOpacity
              style={styles.headerCartBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/(modules)/pos/cart")}
            >
              <Feather name="shopping-cart" size={18} color={TOKENS.primary} />
              <View style={styles.headerCartBadge}>
                <Text style={styles.headerCartBadgeText}>{cartItemsCount}</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.searchIconBtn}
            activeOpacity={0.7}
            onPress={() => router.push("/(modules)/pos/search")}
          >
            <Feather name="search" size={20} color={TOKENS.dark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Box */}
      <View style={styles.searchRow}>
        <Feather name="search" size={16} color={TOKENS.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Quick search products..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
      </View>

      {/* 🌟 GORGEOUS HIGH-FIDELITY REDIRECT BANNER TO SIDEBAR CATALOG SCREEN as requested 🌟 */}
      <TouchableOpacity
        style={styles.catalogBanner}
        activeOpacity={0.85}
        onPress={() => router.push("/(modules)/pos/catalog")}
      >
        <View style={styles.catalogBannerLeft}>
          <View style={styles.bannerIconWrapper}>
            <Feather name="grid" size={16} color={TOKENS.primary} />
          </View>
          <View>
            <Text style={styles.catalogBannerTitle}>Browse Catalog (Sidebar Layout)</Text>
            <Text style={styles.catalogBannerSubtitle}>Switch to vertical splits with category counts</Text>
          </View>
        </View>
        <Feather name="arrow-right" size={18} color={TOKENS.primary} />
      </TouchableOpacity>

      {/* Horizontal Category Scroll */}
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isActive ? styles.categoryChipActive : styles.categoryChipInactive,
                ]}
                activeOpacity={0.8}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isActive ? styles.categoryTextActive : styles.categoryTextInactive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Product List Grid */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.gridContainer,
          { paddingBottom: insets.bottom + 100 }
        ]}
        columnWrapperStyle={styles.gridColumns}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            {/* Top row */}
            <View style={styles.cardHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.productIcon}>{item.icon}</Text>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => toggleFavoriteMutation.mutate(item.id)}
                  style={{ padding: 4 }}
                >
                  <Ionicons
                    name={item.isFavorite ? "heart" : "heart-outline"}
                    size={16}
                    color={item.isFavorite ? TOKENS.error : TOKENS.muted}
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[
                  styles.plusBtn,
                  item.stockType === "out" && styles.plusBtnOut,
                ]}
                activeOpacity={0.8}
                onPress={() => handleAddProduct(item)}
              >
                <Feather
                  name="plus"
                  size={14}
                  color={item.stockType === "out" ? TOKENS.muted : TOKENS.card}
                />
              </TouchableOpacity>
            </View>

            {/* Bottom details */}
            <View style={styles.productDetails}>
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>
              
              <View style={styles.priceStockRow}>
                <Text style={styles.productPrice}>Rs. {item.price}</Text>
                <Text
                  style={[
                    styles.stockText,
                    item.stockType === "low" && styles.stockTextLow,
                    item.stockType === "out" && styles.stockTextOut,
                  ]}
                >
                  {item.stockText}
                </Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyGridState}>
            <Feather name="search" size={48} color="#D1D5DB" />
            <Text style={styles.emptyGridTitle}>No items found</Text>
            <Text style={styles.emptyGridSub}>
              Try searching for another product or add a new one to catalog.
            </Text>
          </View>
        }
      />

      {/* Synchronized Animated FAB */}
      <Animated.View
        style={[
          styles.animatedFabContainer,
          {
            bottom: insets.bottom + 75,
            width: fabWidthAnim,
          }
        ]}
      >
        <TouchableOpacity
          style={styles.fabTouchable}
          activeOpacity={0.85}
          onPress={() => router.push("/(modules)/stocks/scan")}
        >
          <View style={styles.fabIconWrapper}>
            <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
          </View>
          <Animated.View
            style={[
              styles.fabTextWrapper,
              {
                opacity: fabTextOpacityAnim,
                transform: [{ scale: fabTextScaleAnim }],
              }
            ]}
          >
            <Text style={styles.fabText}>Scan</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {/* Premium Business Swapping Bottom Sheet */}
      <BottomSheet
        visible={isBusinessSheetOpen}
        onClose={() => setIsBusinessSheetOpen(false)}
        title="Select Active Business"
      >
        <ScrollView contentContainerStyle={styles.sheetScrollContent} style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
          {cartState.getBusinesses().map((biz) => {
            const isSelected = activeBusiness.id === biz.id;
            return (
              <TouchableOpacity
                key={biz.id}
                style={[
                  styles.bizCard,
                  isSelected && styles.bizCardSelected
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  cartState.setActiveBusiness(biz.id);
                  setIsBusinessSheetOpen(false);
                  triggerToast(`Switched to ${biz.name}`);
                }}
              >
                <View style={styles.bizCardLeft}>
                  <View style={[styles.bizIconBox, isSelected && styles.bizIconBoxActive]}>
                    <Feather name="home" size={18} color={isSelected ? TOKENS.card : TOKENS.primary} />
                  </View>
                  <View style={styles.bizDetails}>
                    <Text style={styles.bizName}>{biz.name}</Text>
                    <Text style={styles.bizAddress}>{biz.address}</Text>
                    <Text style={styles.bizPhone}>{biz.phone}</Text>
                  </View>
                </View>
                {isSelected && (
                  <Feather name="check-circle" size={20} color={TOKENS.success} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>
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
    backgroundColor: TOKENS.card,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 1,
  },
  searchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TOKENS.dark,
  },
  catalogBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
  },
  catalogBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bannerIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#E0E7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  catalogBannerTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  catalogBannerSubtitle: {
    fontSize: 10,
    color: "#6366F1",
    marginTop: 1,
  },
  categoriesWrapper: {
    height: 48,
    marginTop: 8,
    backgroundColor: TOKENS.background,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryChipActive: {
    backgroundColor: TOKENS.primary,
  },
  categoryChipInactive: {
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  categoryTextActive: {
    color: TOKENS.card,
    fontWeight: "bold",
  },
  categoryTextInactive: {
    color: TOKENS.muted,
  },
  gridContainer: {
    padding: 16,
    gap: 12,
  },
  gridColumns: {
    gap: 12,
  },
  productCard: {
    flex: 1,
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 12,
    justifyContent: "space-between",
    minHeight: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  productIcon: {
    fontSize: 28,
  },
  plusBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  plusBtnOut: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  productDetails: {
    marginTop: 10,
    gap: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: "bold",
    color: TOKENS.dark,
    lineHeight: 16,
  },
  priceStockRow: {
    marginTop: 4,
    gap: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  stockText: {
    fontSize: 10,
    color: TOKENS.muted,
  },
  stockTextLow: {
    color: TOKENS.warning,
    fontWeight: "600",
  },
  stockTextOut: {
    color: TOKENS.error,
    fontWeight: "600",
  },
  emptyGridState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
    marginTop: 32,
    marginHorizontal: 16,
  },
  emptyGridTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyGridSub: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    lineHeight: 18,
  },
  animatedFabContainer: {
    position: "absolute",
    right: 20,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#2563EB", // Vibrant POS Blue (matches UI brand perfectly)
    borderWidth: 1,
    borderColor: "#3B82F6", // Electric Blue Border
    shadowColor: "#2563EB", // Glowing Blue Shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 100,
    overflow: "hidden",
  },
  fabTouchable: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  fabIconWrapper: {
    position: "absolute",
    left: 15,
    top: 0,
    bottom: 0,
    width: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  fabTextWrapper: {
    position: "absolute",
    left: 44,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  fabText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  headerActions: {
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
  businessSwitcherBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    alignSelf: "flex-start",
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheetContent: {
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: TOKENS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  sheetScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 0,
    gap: 12,
  },
  bizCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 14,
  },
  bizCardSelected: {
    borderColor: TOKENS.primary,
    backgroundColor: "#F4F7FF",
  },
  bizCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  bizIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: TOKENS.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bizIconBoxActive: {
    backgroundColor: TOKENS.primary,
  },
  bizDetails: {
    flex: 1,
    gap: 2,
  },
  bizName: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  bizAddress: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  bizPhone: {
    fontSize: 11,
    color: TOKENS.muted,
  },
});
