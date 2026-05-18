import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Platform,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { BottomTabBar } from "../common/BottomTabBar";
import { cartState } from "../data/cartState";

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

  // Dynamic products list from cartState
  const [productsList, setProductsList] = useState<HomeProduct[]>([]);
  const [cartItemsCount, setCartItemsCount] = useState(0);

  useEffect(() => {
    const syncState = () => {
      const cart = cartState.getCart();
      setCartItemsCount(cart.reduce((sum, item) => sum + item.quantity, 0));
      setProductsList(cartState.getCatalogProducts());
    };

    syncState();
    return cartState.subscribe(syncState);
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

  // Filter products by search and category
  const filteredProducts = useMemo(() => {
    return productsList.filter((prod) => {
      const matchesCategory = selectedCategory === "all" || prod.category === selectedCategory;
      const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [productsList, selectedCategory, searchQuery]);

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
          <Text style={styles.headerSubtitle}>Product Grid View</Text>
        </View>

        <View style={styles.headerActions}>
          {cartItemsCount > 0 && (
            <TouchableOpacity
              style={styles.headerCartBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/cart")}
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
            onPress={() => router.push("/search")}
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
        onPress={() => router.push("/catalog")}
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
        contentContainerStyle={styles.gridContainer}
        columnWrapperStyle={styles.gridColumns}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            {/* Top row */}
            <View style={styles.cardHeader}>
              <Text style={styles.productIcon}>{item.icon}</Text>
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
            <Feather name="alert-circle" size={40} color={TOKENS.muted} />
            <Text style={styles.emptyGridText}>No products found matching criteria</Text>
          </View>
        }
      />

      {/* Restored Floating Scan FAB in the bottom right! */}
      <TouchableOpacity
        style={styles.floatingScanFab}
        activeOpacity={0.85}
        onPress={() => router.push("/scan")}
      >
        <Ionicons name="barcode-outline" size={24} color={TOKENS.card} />
      </TouchableOpacity>
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
    backgroundColor: TOKENS.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
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
    paddingVertical: 60,
    gap: 8,
  },
  emptyGridText: {
    fontSize: 14,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  floatingScanFab: {
    position: "absolute",
    bottom: 80,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 90,
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
});
