import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { BottomTabBar } from "../common/BottomTabBar";
import { cartState } from "../data/cartState";

interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  stockText: string;
  stockType: "normal" | "low" | "out";
  stockCount?: number;
}

interface CategoryItem {
  id: string;
  label: string;
  icon: string;
  count: number;
}

const CATEGORIES: CategoryItem[] = [
  { id: "all", label: "All", icon: "archive-outline", count: 240 },
  { id: "grocery", label: "Grocery", icon: "cart-outline", count: 84 },
  { id: "dairy", label: "Dairy", icon: "water-outline", count: 22 },
  { id: "drinks", label: "Drinks", icon: "wine-outline", count: 31 },
  { id: "snacks", label: "Snacks", icon: "cookie-outline", count: 47 },
  { id: "household", label: "Household", icon: "home-outline", count: 38 },
];

export const CatalogScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Dynamic catalog products synced with cartState
  const [productsList, setProductsList] = useState<CatalogProduct[]>([]);
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

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "all") return productsList;
    return productsList.filter((prod) => prod.category === selectedCategory);
  }, [productsList, selectedCategory]);

  const handleTabPress = (tabId: string) => {
    if (tabId === "home") {
      router.push("/");
    } else if (tabId === "pos") {
      router.push("/pos");
    } else if (tabId === "stocks") {
      router.push("/stocks");
    } else if (tabId === "profile") {
      router.push("/profile");
    } else {
      triggerToast(`${tabId.toUpperCase()} view tab selected`);
    }
  };

  const handleAddProduct = (prod: CatalogProduct) => {
    if (prod.stockType === "out") {
      triggerToast("Product is out of stock!");
      return;
    }
    cartState.addCartItem(prod.name, prod.price, prod.icon, `SKU 23400${prod.id}`, prod.stockCount);
    triggerToast(`Added ${prod.name} to active invoice`);
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
      {/* Toast popup */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header exactly matching Image 1: Catalog */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/")}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Catalog</Text>

        <View style={styles.headerRightActions}>
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
            style={styles.searchHeaderButton}
            activeOpacity={0.7}
            onPress={() => router.push("/search")}
          >
            <Feather name="search" size={22} color={TOKENS.dark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Two Columns Body Area */}
      <View style={styles.bodyWrapper}>
        {/* Left Side: Category Strip */}
        <View style={styles.sidebar}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarScroll}>
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.sidebarTab, isActive && styles.sidebarTabActive]}
                  activeOpacity={0.8}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  {isActive && <View style={styles.activeStrip} />}
                  <Ionicons
                    // @ts-ignore dynamic mapping of Ionicon names is safe here
                    name={cat.icon}
                    size={22}
                    color={isActive ? TOKENS.primary : TOKENS.muted}
                    style={styles.sidebarTabIcon}
                  />
                  <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                    {cat.label}
                  </Text>
                  <Text style={styles.sidebarCount}>{cat.count}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Right Side: Product Card Grid */}
        <View style={styles.gridWrapper}>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.gridColumns}
            renderItem={({ item }) => (
              <View style={styles.productCard}>
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
          />
        </View>
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
    fontSize: 20,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  searchHeaderButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  bodyWrapper: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 96,
    backgroundColor: "#F3F4F6",
    borderRightWidth: 1,
    borderRightColor: TOKENS.border,
  },
  sidebarScroll: {
    paddingVertical: 8,
  },
  sidebarTab: {
    width: "100%",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  sidebarTabActive: {
    backgroundColor: TOKENS.card,
  },
  activeStrip: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    backgroundColor: TOKENS.primary,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  sidebarTabIcon: {
    marginBottom: 4,
  },
  sidebarLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  sidebarLabelActive: {
    color: TOKENS.primary,
    fontWeight: "bold",
  },
  sidebarCount: {
    fontSize: 10,
    color: TOKENS.muted,
    marginTop: 2,
  },
  gridWrapper: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  gridContent: {
    padding: 12,
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
