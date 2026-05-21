import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { useProducts, useToggleFavoriteProduct } from "../../hooks/useProducts";
import { useTabBarVisible } from "../../hooks/useTabBarVisible";
import { BottomSheet } from "../common/BottomSheet";
import { ProductImage } from "../common/ProductImage";
import { ScreenWrapper } from "../common/ScreenWrapper";
import { SearchInput } from "../common/SearchInput";
import { HeaderCartButton } from "../common/HeaderCartButton";
import { Business, cartState } from "../data/cartState";

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
  const { width } = useWindowDimensions();
  const numColumns = width > 768 ? 4 : 2;

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dynamic products list fetched via React Query custom hook
  const { data: productsList = [] } = useProducts(
    selectedCategory,
    searchQuery,
  );
  const toggleFavoriteMutation = useToggleFavoriteProduct();

  // Active Business dropdown states
  const [activeBusiness, setActiveBusiness] = useState<Business>(
    cartState.getActiveBusiness(),
  );
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
    cartState.addCartItem(
      prod.name,
      prod.price,
      prod.icon,
      `SKU 23400${prod.id}`,
      prod.stockCount,
    );
    triggerToast(`Added ${prod.name} to active invoice`);
  };

  // WatermelonDB performs search & filter queries directly
  const filteredProducts = productsList;

  return (
    <ScreenWrapper noPaddingBottom style={styles.container}>
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
            <View style={styles.businessRow}>
              <Ionicons
                name="storefront-outline"
                size={18}
                color={TOKENS.muted}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[styles.headerSubtitle, styles.headerSubtitleDark]}
                numberOfLines={1}
              >
                {activeBusiness.name}
              </Text>
            </View>
            <Feather
              name="chevron-down"
              size={13}
              color={TOKENS.muted}
              style={{ marginLeft: 6 }}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          <HeaderCartButton />

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
      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Quick search products..."
        containerStyle={{ marginHorizontal: 16, marginTop: 12 }}
      />

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
            <Text style={styles.catalogBannerTitle}>
              Browse Catalog (Sidebar Layout)
            </Text>
            <Text style={styles.catalogBannerSubtitle}>
              Switch to vertical splits with category counts
            </Text>
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
                  isActive
                    ? styles.categoryChipActive
                    : styles.categoryChipInactive,
                ]}
                activeOpacity={0.8}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isActive
                      ? styles.categoryTextActive
                      : styles.categoryTextInactive,
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
        key={numColumns}
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.gridContainer,
          { paddingBottom: insets.bottom + 100 },
        ]}
        columnWrapperStyle={styles.gridColumns}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            {/* Image Section */}
            <View style={styles.imageContainer}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => handleAddProduct(item)}
                style={{ width: "100%", height: 110 }}
              >
                <ProductImage
                  icon={item.icon}
                  category={item.category}
                  style={{ width: "100%", height: 110, borderRadius: 0 }}
                />
              </TouchableOpacity>

              {/* Overlay heart button */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleFavoriteMutation.mutate(item.id)}
                style={styles.heartBtnWrapper}
              >
                <Ionicons
                  name={item.isFavorite ? "heart" : "heart-outline"}
                  size={15}
                  color={item.isFavorite ? TOKENS.error : TOKENS.muted}
                />
              </TouchableOpacity>
            </View>

            {/* Bottom details - touchable to add */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleAddProduct(item)}
              style={styles.productDetails}
            >
              <Text style={styles.productName} numberOfLines={1}>
                {item.name}
              </Text>

              <View style={styles.priceStockRow}>
                <Text style={styles.productPrice}>Rs. {item.price}</Text>
                <View style={styles.stockPlusRow}>
                  <Text
                    style={[
                      styles.stockText,
                      item.stockType === "low" && styles.stockTextLow,
                      item.stockType === "out" && styles.stockTextOut,
                    ]}
                  >
                    {item.stockText}
                  </Text>

                  <View
                    style={[
                      styles.plusIconBadge,
                      item.stockType === "out" && styles.plusIconBadgeOut,
                    ]}
                  >
                    <Feather
                      name="plus"
                      size={20}
                      color={
                        item.stockType === "out" ? TOKENS.muted : TOKENS.card
                      }
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
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
          },
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
              },
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
        <ScrollView
          contentContainerStyle={styles.sheetScrollContent}
          style={{ maxHeight: 400 }}
          showsVerticalScrollIndicator={false}
        >
          {cartState.getBusinesses().map((biz) => {
            const isSelected = activeBusiness.id === biz.id;
            return (
              <TouchableOpacity
                key={biz.id}
                style={[styles.bizCard, isSelected && styles.bizCardSelected]}
                activeOpacity={0.8}
                onPress={() => {
                  cartState.setActiveBusiness(biz.id);
                  setIsBusinessSheetOpen(false);
                  triggerToast(`Switched to ${biz.name}`);
                }}
              >
                <View style={styles.bizCardLeft}>
                  <View
                    style={[
                      styles.bizIconBox,
                      isSelected && styles.bizIconBoxActive,
                    ]}
                  >
                    <Feather
                      name="home"
                      size={18}
                      color={isSelected ? TOKENS.card : TOKENS.primary}
                    />
                  </View>
                  <View style={styles.bizDetails}>
                    <Text style={styles.bizName}>{biz.name}</Text>
                    <Text style={styles.bizAddress}>{biz.address}</Text>
                    <Text style={styles.bizPhone}>{biz.phone}</Text>
                  </View>
                </View>
                {isSelected && (
                  <Feather
                    name="check-circle"
                    size={20}
                    color={TOKENS.success}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
    fontSize: 16,
    fontWeight: "600",
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    justifyContent: "space-between",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: 110,
    backgroundColor: "#F3F4F6",
  },
  productCardImage: {
    width: "100%",
    height: 110,
  },
  heartBtnWrapper: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1.5,
  },
  productDetails: {
    padding: 12,
    gap: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.dark,
    lineHeight: 16,
  },
  priceStockRow: {
    marginTop: 4,
    gap: 2,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: "800",
    color: TOKENS.primary,
  },
  stockPlusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  stockText: {
    fontSize: 11,
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
  plusIconBadge: {
    width: 40,
    height: 30,
    borderRadius: 15,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  plusIconBadgeOut: {
    backgroundColor: "#E5E7EB",
    shadowOpacity: 0,
    elevation: 0,
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
  businessSwitcherBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    alignSelf: "flex-start",
  },
  businessRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bizBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  bizBadgeText: {
    color: TOKENS.card,
    fontWeight: "700",
    fontSize: 12,
  },
  headerSubtitleDark: {
    color: TOKENS.dark,
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
