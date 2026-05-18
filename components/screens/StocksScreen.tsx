import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { BottomTabBar } from "../common/BottomTabBar";
import { cartState, CatalogProduct } from "../data/cartState";

interface FavoriteProduct {
  id: string;
  name: string;
  price: number;
  icon: string;
}

interface RecentAdd {
  id: string;
  name: string;
  timeAgo: string;
  price: number;
  icon: string;
}

const FAVORITES: FavoriteProduct[] = [
  { id: "fav1", name: "Marie Biscuits", price: 180, icon: "🍪" },
  { id: "fav2", name: "Anchor Milk 1L", price: 680, icon: "🥛" },
  { id: "fav3", name: "Cream Soda", price: 320, icon: "🥤" },
  { id: "fav4", name: "Sunlight Soap", price: 130, icon: "🧼" },
  { id: "fav5", name: "Red Rice 1kg", price: 280, icon: "🌾" },
  { id: "fav6", name: "Bread Loaf", price: 110, icon: "🍞" },
  { id: "fav7", name: "Eggs (10)", price: 380, icon: "🥚" },
  { id: "fav8", name: "Ceylon Tea", price: 450, icon: "🍵" },
];

const RECENTS: RecentAdd[] = [
  { id: "rec1", name: "Munchee Lemon Puff", timeAgo: "2 min ago", price: 200, icon: "🍪" },
  { id: "rec2", name: "Elephant Cream Soda 1.5L", timeAgo: "5 min ago", price: 320, icon: "🥤" },
  { id: "rec3", name: "Highland Yogurt", timeAgo: "8 min ago", price: 95, icon: "🥣" },
];

const CATEGORIES_LIST = ["grocery", "dairy", "drinks", "snacks", "household"];
const UNIT_TYPES = ["Pieces", "kg", "Liters", "Packets"];
const CATEGORY_ICONS: Record<string, string> = {
  grocery: "🧼",
  dairy: "🥛",
  drinks: "🥤",
  snacks: "🍪",
  household: "🧹",
};

export const StocksScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);

  // Form states
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("grocery");
  const [formUnitType, setFormUnitType] = useState("Pieces");
  const [formCostPrice, setFormCostPrice] = useState("");
  const [formSalesPrice, setFormSalesPrice] = useState("");
  const [formStockIn, setFormStockIn] = useState("");
  const [formLowStock, setFormLowStock] = useState("");

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

  const handleAddProductToCart = (name: string, price: number, icon: string) => {
    cartState.addCartItem(name, price, icon);
    triggerToast(`Added ${name} to checkout invoice`);
  };

  const handleSaveProduct = () => {
    if (!formName || !formSalesPrice || !formStockIn) {
      Alert.alert("Required Fields Missing", "Please enter product name, selling price, and initial stock quantity.");
      return;
    }

    const priceNum = parseFloat(formSalesPrice);
    const costNum = parseFloat(formCostPrice) || priceNum * 0.8; // default cost
    const stockCount = parseInt(formStockIn, 10);
    const lowStockThreshold = parseInt(formLowStock, 10) || 5;

    if (isNaN(priceNum) || isNaN(stockCount)) {
      Alert.alert("Invalid input type", "Please verify numeric fields.");
      return;
    }

    // Save product dynamically
    cartState.addNewCatalogProduct({
      name: formName,
      price: priceNum,
      category: formCategory,
      icon: CATEGORY_ICONS[formCategory] || "📦",
      stockCount: stockCount,
      unitType: formUnitType,
      costPrice: costNum,
    });

    triggerToast(`Product "${formName}" saved to catalog!`);

    // Reset form fields
    setFormName("");
    setFormCostPrice("");
    setFormSalesPrice("");
    setFormStockIn("");
    setFormLowStock("");
  };

  const handleTabPress = (tabId: string) => {
    if (tabId === "home") {
      router.push("/");
    } else if (tabId === "pos") {
      router.push("/pos");
    } else if (tabId === "profile") {
      router.push("/profile");
    } else if (tabId !== "stocks") {
      triggerToast(`${tabId.toUpperCase()} view tab selected`);
    }
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

      {/* Header matching exact layout of Image 3 but for Stocks */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/")}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Stocks Manager</Text>

        <View style={styles.headerRightActions}>
          {cartCount > 0 ? (
            <TouchableOpacity
              style={styles.headerCartBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/cart")}
            >
              <Feather name="shopping-cart" size={18} color={TOKENS.primary} />
              <View style={styles.headerCartBadge}>
                <Text style={styles.headerCartBadgeText}>{cartCount}</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholderWidth} />
          )}
        </View>
      </View>

      {/* Scrollable Area */}
      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search row touching search results */}
        <TouchableOpacity
          style={styles.searchBarTouch}
          activeOpacity={0.9}
          onPress={() => router.push("/search")}
        >
          <Feather name="search" size={18} color={TOKENS.muted} />
          <Text style={styles.searchPlaceholder}>Search products in stock...</Text>
        </TouchableOpacity>

        {/* ➕ ADD NEW PRODUCT FORM CARD (Sleek and beautiful border card) ➕ */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>➕ Add Product to Catalog</Text>
          <Text style={styles.formSubtitle}>Enter item specifications to dynamically update sales catalog list</Text>
          
          <View style={styles.formGrid}>
            {/* Field: Name */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Product Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Munchee Chocolate Puff"
                placeholderTextColor="#9CA3AF"
                value={formName}
                onChangeText={setFormName}
              />
            </View>

            {/* Field: Category Chips selector */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipsSelector}>
                {CATEGORIES_LIST.map((cat) => {
                  const isSelected = formCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.selectorChip, isSelected && styles.selectorChipActive]}
                      onPress={() => setFormCategory(cat)}
                    >
                      <Text style={[styles.selectorChipText, isSelected && styles.selectorChipTextActive]}>
                        {cat.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Field: Unit Type Chips selector */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Unit Type</Text>
              <View style={styles.chipsSelector}>
                {UNIT_TYPES.map((u) => {
                  const isSelected = formUnitType === u;
                  return (
                    <TouchableOpacity
                      key={u}
                      style={[styles.selectorChip, isSelected && styles.selectorChipActive]}
                      onPress={() => setFormUnitType(u)}
                    >
                      <Text style={[styles.selectorChipText, isSelected && styles.selectorChipTextActive]}>
                        {u}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Field: Cost & Selling Price Row */}
            <View style={styles.fieldColumnsRow}>
              <View style={styles.flexField}>
                <Text style={styles.fieldLabel}>Cost Price (Rs.)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 140"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={formCostPrice}
                  onChangeText={setFormCostPrice}
                />
              </View>

              <View style={styles.flexField}>
                <Text style={styles.fieldLabel}>Selling Price * (Rs.)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 180"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={formSalesPrice}
                  onChangeText={setFormSalesPrice}
                />
              </View>
            </View>

            {/* Field: Initial Stock & Low Threshold Row */}
            <View style={styles.fieldColumnsRow}>
              <View style={styles.flexField}>
                <Text style={styles.fieldLabel}>Stock Quantity *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 50"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={formStockIn}
                  onChangeText={setFormStockIn}
                />
              </View>

              <View style={styles.flexField}>
                <Text style={styles.fieldLabel}>Low Alert Level</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 5"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={formLowStock}
                  onChangeText={setFormLowStock}
                />
              </View>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={styles.submitBtn}
              activeOpacity={0.8}
              onPress={handleSaveProduct}
            >
              <Text style={styles.submitBtnText}>Save Product to Catalog</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Favorites section exactly like Image 3 */}
        <View style={styles.favoritesSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Favorites</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => Alert.alert("Edit Favorites", "Favorites items unlocked.")}
            >
              <Text style={styles.editLink}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.favGrid}>
            {FAVORITES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.favCard}
                activeOpacity={0.75}
                onPress={() => handleAddProductToCart(item.name, item.price, item.icon)}
              >
                <Text style={styles.favIcon}>{item.icon}</Text>
                <Text style={styles.favName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.favPrice}>Rs. {item.price}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recents section exactly like Image 3 */}
        <View style={styles.recentsSection}>
          <View style={styles.recentHeaderRow}>
            <Feather name="clock" size={16} color={TOKENS.dark} />
            <Text style={styles.recentTitle}>Recents</Text>
          </View>

          <View style={styles.recentsList}>
            {RECENTS.map((item) => (
              <View key={item.id} style={styles.recentRow}>
                <View style={styles.recentInfoWrapper}>
                  <Text style={styles.recentItemName}>{item.name}</Text>
                  <Text style={styles.recentTimeAgo}>{item.timeAgo}</Text>
                </View>

                <TouchableOpacity
                  style={styles.addButton}
                  activeOpacity={0.8}
                  onPress={() => handleAddProductToCart(item.name, item.price, item.icon)}
                >
                  <Text style={styles.addButtonText}>+ Add</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
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
  scanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  scanButtonText: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 14,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  searchBarTouch: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: TOKENS.muted,
  },
  formCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TOKENS.accentBlue,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  formSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 4,
    lineHeight: 14,
  },
  formGrid: {
    marginTop: 12,
    gap: 12,
  },
  fieldRow: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  formInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 12,
    fontSize: 13,
    color: TOKENS.dark,
  },
  chipsSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  selectorChip: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  selectorChipActive: {
    backgroundColor: TOKENS.primary,
    borderColor: TOKENS.primary,
  },
  selectorChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: TOKENS.muted,
  },
  selectorChipTextActive: {
    color: TOKENS.card,
  },
  fieldColumnsRow: {
    flexDirection: "row",
    gap: 10,
  },
  flexField: {
    flex: 1,
    gap: 4,
  },
  submitBtn: {
    backgroundColor: TOKENS.primary,
    borderRadius: 8,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 14,
  },
  favoritesSection: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  editLink: {
    fontSize: 14,
    color: TOKENS.primary,
    fontWeight: "bold",
  },
  favGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  favCard: {
    width: "23.5%",
    backgroundColor: TOKENS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 1,
    elevation: 0.5,
  },
  favIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  favName: {
    fontSize: 10,
    fontWeight: "bold",
    color: TOKENS.dark,
    textAlign: "center",
  },
  favPrice: {
    fontSize: 10,
    color: TOKENS.primary,
    fontWeight: "bold",
    marginTop: 2,
  },
  recentsSection: {
    gap: 10,
  },
  recentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  recentsList: {
    gap: 10,
  },
  recentRow: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recentInfoWrapper: {
    flex: 1,
  },
  recentItemName: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  recentTimeAgo: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  addButtonText: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 13,
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
  placeholderWidth: {
    width: 38,
  },
});
