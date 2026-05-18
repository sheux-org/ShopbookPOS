import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Platform,
  Alert,
  Animated,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { BottomTabBar } from "../common/BottomTabBar";
import { INITIAL_PRODUCTS, Product } from "../data/products";
import { cartState } from "../data/cartState";

// Specific Quick Codes list matching the UI & products
const QUICK_CODES: Record<string, { name: string; price: number; icon: string }> = {
  "1024": { name: "Munchee Puff", price: 180, icon: "🍪" },
  "1001": { name: "Anchor Milk 1L", price: 680, icon: "🥛" },
  "1002": { name: "Marie Biscuits", price: 180, icon: "🍪" },
  "1003": { name: "Cream Soda 1.5L", price: 320, icon: "🥤" },
  "1004": { name: "Lemon Puff", price: 250, icon: "🥮" },
  "1005": { name: "Sunlight Soap", price: 130, icon: "🧼" },
  "1006": { name: "Red Rice 1kg", price: 280, icon: "🌾" },
  "1007": { name: "Ceylon Tea", price: 450, icon: "☕" },
};

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  icon?: string;
}

export const PosScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Mode Selection: 'quick_code' | 'scan' | 'search'
  const [activeMode, setActiveMode] = useState<"quick_code" | "scan" | "search">("quick_code");

  // Sync state with shared cartState store
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    const syncCart = () => {
      setInvoiceItems(cartState.getCart());
    };
    syncCart();
    return cartState.subscribe(syncCart);
  }, []);

  // Quick code state
  const [quickCode, setQuickCode] = useState("1024");
  const [cursorVisible, setCursorVisible] = useState(true);

  // Search query for search mode
  const [searchQuery, setSearchQuery] = useState("");

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Laser animation for mockup scanner inside the panel
  const laserAnim = useRef(new Animated.Value(0)).current;

  // Blinking cursor effect for Quick Code input
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorVisible((prev) => !prev);
    }, 600);
    return () => clearInterval(interval);
  }, []);

  // Mockup scanner animation loop
  useEffect(() => {
    if (activeMode === "scan") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [activeMode, laserAnim]);

  const laserTranslateY = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 96],
  });

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 1500);
  };

  // Helper to add item to invoice using cartState
  const addItemToInvoice = (name: string, price: number, icon?: string) => {
    cartState.addCartItem(name, price, icon);
    showToast(`Added ${name} to invoice`);
  };

  // Total invoice calculation
  const totalInvoiceAmount = useMemo(() => {
    return invoiceItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [invoiceItems]);

  const matchedProduct = useMemo(() => {
    return QUICK_CODES[quickCode] || null;
  }, [quickCode]);

  // Handle numpad key presses
  const handleNumPress = (val: string) => {
    if (val === "backspace") {
      setQuickCode((prev) => prev.slice(0, -1));
    } else if (val === ".") {
      if (!quickCode.includes(".")) {
        setQuickCode((prev) => prev + ".");
      }
    } else {
      if (quickCode.length < 6) {
        setQuickCode((prev) => prev + val);
      }
    }
  };

  // Auto-add product if fully typed valid quick code
  useEffect(() => {
    if (QUICK_CODES[quickCode]) {
      // Auto-add delay of 1s
      const timer = setTimeout(() => {
        const prod = QUICK_CODES[quickCode];
        addItemToInvoice(prod.name, prod.price, prod.icon);
        setQuickCode(""); // Reset after adding
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [quickCode]);

  // Search filtered products
  const filteredSearchProducts = useMemo(() => {
    if (!searchQuery) return INITIAL_PRODUCTS.slice(0, 4);
    return INITIAL_PRODUCTS.filter((prod) =>
      prod.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleTabPress = (tabId: string) => {
    if (tabId === "home") {
      router.push("/");
    } else if (tabId === "stocks") {
      router.push("/stocks");
    } else if (tabId === "profile") {
      router.push("/profile");
    } else if (tabId !== "pos") {
      showToast(`${tabId.toUpperCase()} view tab selected`);
    }
  };

  // Simulate scanning a random item
  const handleSimulatedScan = () => {
    const productsKeys = Object.keys(QUICK_CODES);
    const randomKey = productsKeys[Math.floor(Math.random() * productsKeys.length)];
    const prod = QUICK_CODES[randomKey];
    addItemToInvoice(prod.name, prod.price, prod.icon);
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

      {/* Header matching exact layout of user upload */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/")}
        >
          <Feather name="chevron-left" size={24} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Mini POS</Text>
          <Text style={styles.headerSubtitle}>Invoice ##2041</Text>
        </View>

        <View style={styles.headerRightActions}>
          {invoiceItems.length > 0 && (
            <TouchableOpacity
              style={styles.headerCartBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/cart")}
            >
              <Feather name="shopping-cart" size={18} color={TOKENS.primary} />
              <View style={styles.headerCartBadge}>
                <Text style={styles.headerCartBadgeText}>
                  {invoiceItems.reduce((sum, item) => sum + item.quantity, 0)}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.holdButton}
            activeOpacity={0.8}
            onPress={() =>
              Alert.alert("Invoice Put On Hold", "Invoice ##2041 has been saved to hold queue.", [
                { text: "Okay" },
              ])
            }
          >
            <Text style={styles.holdButtonText}>Hold</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Items Scrollable List */}
      <ScrollView
        style={styles.itemsList}
        contentContainerStyle={styles.itemsListContent}
        showsVerticalScrollIndicator={false}
      >
        {invoiceItems.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemMainInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemQuantities}>
                {item.quantity} × Rs. {item.price.toLocaleString()}
              </Text>
            </View>

            <View style={styles.itemRightRow}>
              <Text style={styles.itemTotal}>
                Rs. {(item.price * item.quantity).toLocaleString()}
              </Text>

              {/* Quick quantity modifiers for high fidelity interactiveness */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.smallActionBtn}
                  onPress={() => cartState.updateQuantity(item.id, -1)}
                >
                  <Feather name="minus" size={12} color={TOKENS.muted} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.smallActionBtn}
                  onPress={() => cartState.updateQuantity(item.id, 1)}
                >
                  <Feather name="plus" size={12} color={TOKENS.muted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {invoiceItems.length === 0 && (
          <View style={styles.emptyInvoiceState}>
            <Feather name="shopping-bag" size={40} color={TOKENS.muted} />
            <Text style={styles.emptyInvoiceTitle}>No items in invoice</Text>
            <Text style={styles.emptyInvoiceSub}>Use quick codes or search below to add items.</Text>
          </View>
        )}
      </ScrollView>

      {/* Dynamic Summary Bar before control panel */}
      {invoiceItems.length > 0 && (
        <TouchableOpacity
          style={styles.summaryBarButton}
          activeOpacity={0.85}
          onPress={() => router.push("/cart")}
        >
          <View style={styles.summaryBarLeft}>
            <Feather name="shopping-bag" size={16} color={TOKENS.card} style={styles.bagIcon} />
            <Text style={styles.summaryLabelActive}>Proceed to Checkout</Text>
          </View>
          <Text style={styles.summaryValueActive}>Rs. {totalInvoiceAmount.toLocaleString()} ➡️</Text>
        </TouchableOpacity>
      )}

      {/* Bottom Panel - Segmented Control, Input Mode View, Numpad */}
      <View style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, 60) }]}>
        {/* Three-column Mode Buttons */}
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              activeMode === "quick_code" && styles.segmentButtonActive,
            ]}
            onPress={() => setActiveMode("quick_code")}
            activeOpacity={0.8}
          >
            <Feather
              name="edit"
              size={15}
              color={activeMode === "quick_code" ? TOKENS.card : TOKENS.dark}
            />
            <Text
              style={[
                styles.segmentText,
                activeMode === "quick_code" && styles.segmentTextActive,
              ]}
            >
              Quick code
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentButton, activeMode === "scan" && styles.segmentButtonActive]}
            onPress={() => setActiveMode("scan")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="barcode-outline"
              size={16}
              color={activeMode === "scan" ? TOKENS.card : TOKENS.dark}
            />
            <Text
              style={[styles.segmentText, activeMode === "scan" && styles.segmentTextActive]}
            >
              Scan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.segmentButton}
            onPress={() => router.push("/add-item")}
            activeOpacity={0.8}
          >
            <Feather
              name="search"
              size={15}
              color={TOKENS.dark}
            />
            <Text
              style={styles.segmentText}
            >
              Search products...
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Mode Area */}
        <View style={styles.modeContentWrapper}>
          {activeMode === "quick_code" && (
            <View>
              {/* Quick Code box styled exactly as image */}
              <View style={styles.quickCodeBox}>
                <View style={styles.quickCodeTextCol}>
                  <Text style={styles.quickCodeBoxLabel}>Quick code</Text>
                  <View style={styles.codeTextRow}>
                    <Text style={styles.quickCodeVal}>{quickCode}</Text>
                    {cursorVisible && <View style={styles.blueCursor} />}
                  </View>
                </View>

                {/* Right side matches or action indicators */}
                <View style={styles.quickCodeMatchCol}>
                  {matchedProduct ? (
                    <TouchableOpacity
                      style={styles.matchBadgeClickable}
                      activeOpacity={0.7}
                      onPress={() => {
                        addItemToInvoice(matchedProduct.name, matchedProduct.price, matchedProduct.icon);
                        setQuickCode("");
                      }}
                    >
                      <Text style={styles.matchedText}>{matchedProduct.name}</Text>
                      <View style={styles.addSmallBadge}>
                        <Feather name="plus" size={12} color={TOKENS.card} />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    quickCode.length >= 4 && <Text style={styles.noMatchText}>No match</Text>
                  )}
                </View>
              </View>

              {/* Numpad Block */}
              <View style={styles.numpadContainer}>
                <View style={styles.numpadRow}>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("1")}>
                    <Text style={styles.numpadBtnText}>1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("2")}>
                    <Text style={styles.numpadBtnText}>2</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("3")}>
                    <Text style={styles.numpadBtnText}>3</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.numpadRow}>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("4")}>
                    <Text style={styles.numpadBtnText}>4</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("5")}>
                    <Text style={styles.numpadBtnText}>5</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("6")}>
                    <Text style={styles.numpadBtnText}>6</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.numpadRow}>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("7")}>
                    <Text style={styles.numpadBtnText}>7</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("8")}>
                    <Text style={styles.numpadBtnText}>8</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("9")}>
                    <Text style={styles.numpadBtnText}>9</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.numpadRow}>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress(".")}>
                    <Text style={styles.numpadBtnText}>.</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.numpadBtn} onPress={() => handleNumPress("0")}>
                    <Text style={styles.numpadBtnText}>0</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.numpadBtn, styles.deleteBtn]}
                    onPress={() => handleNumPress("backspace")}
                  >
                    <Ionicons name="backspace-outline" size={22} color={TOKENS.dark} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {activeMode === "scan" && (
            <View style={styles.scanWrapper}>
              <Text style={styles.scanLabel}>INTERACTIVE VIEWPORT SIMULATOR</Text>

              {/* Viewfinder Mockup */}
              <View style={styles.mockViewfinder}>
                <View style={styles.bracketContainer}>
                  <View style={[styles.scanCorner, styles.topLeftScan]} />
                  <View style={[styles.scanCorner, styles.topRightScan]} />
                  <View style={[styles.scanCorner, styles.bottomLeftScan]} />
                  <View style={[styles.scanCorner, styles.bottomRightScan]} />

                  {/* Dummy barcode bars */}
                  <View style={styles.dummyBarcode}>
                    <View style={[styles.dummyBar, { width: 2 }]} />
                    <View style={[styles.dummyBar, { width: 5 }]} />
                    <View style={[styles.dummyBar, { width: 1 }]} />
                    <View style={[styles.dummyBar, { width: 3 }]} />
                    <View style={[styles.dummyBar, { width: 2 }]} />
                    <View style={[styles.dummyBar, { width: 6 }]} />
                    <View style={[styles.dummyBar, { width: 2 }]} />
                    <View style={[styles.dummyBar, { width: 4 }]} />
                  </View>

                  {/* Moving animated sweep laser */}
                  <Animated.View
                    style={[styles.scanLaser, { transform: [{ translateY: laserTranslateY }] }]}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.scanActionBtn}
                activeOpacity={0.8}
                onPress={handleSimulatedScan}
              >
                <Ionicons name="barcode-outline" size={18} color={TOKENS.card} />
                <Text style={styles.scanActionBtnText}>Simulate Camera Scan</Text>
              </TouchableOpacity>
            </View>
          )}

          {activeMode === "search" && (
            <View style={styles.searchWrapper}>
              {/* Search text input */}
              <View style={styles.searchRow}>
                <Feather name="search" size={16} color={TOKENS.muted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search products by name..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  clearButtonMode="while-editing"
                />
              </View>

              <Text style={styles.searchResultLabel}>TAP PRODUCT TO ADD</Text>

              {/* Mini Grid / List of matches */}
              <ScrollView
                style={styles.searchResultsContainer}
                contentContainerStyle={styles.searchResultsGrid}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {filteredSearchProducts.map((prod) => (
                  <TouchableOpacity
                    key={prod.id}
                    style={styles.searchResultCard}
                    activeOpacity={0.7}
                    onPress={() => addItemToInvoice(prod.name, prod.price, prod.icon)}
                  >
                    <Text style={styles.searchProdIcon}>{prod.icon}</Text>
                    <Text style={styles.searchProdName} numberOfLines={1}>
                      {prod.name}
                    </Text>
                    <Text style={styles.searchProdPrice}>Rs. {prod.price}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* Shared bottom multi-module navigation bar */}
      <BottomTabBar activeTab="pos" onTabPress={handleTabPress} />
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
  headerTitleWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 1,
  },
  holdButton: {
    backgroundColor: TOKENS.lightBlue,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  holdButtonText: {
    color: TOKENS.primary,
    fontWeight: "bold",
    fontSize: 14,
  },
  itemsList: {
    flex: 1,
  },
  itemsListContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  itemMainInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  itemQuantities: {
    fontSize: 13,
    color: TOKENS.muted,
    marginTop: 4,
  },
  itemRightRow: {
    alignItems: "flex-end",
    gap: 6,
  },
  itemTotal: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  smallActionBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyInvoiceState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  emptyInvoiceTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  emptyInvoiceSub: {
    fontSize: 13,
    color: TOKENS.muted,
    textAlign: "center",
  },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: TOKENS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
  },
  summaryBarButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 10,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bagIcon: {
    marginTop: -1,
  },
  summaryLabelActive: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.card,
  },
  summaryValueActive: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.card,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: TOKENS.muted,
  },
  summaryValue: {
    fontSize: 17,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  bottomPanel: {
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingTop: 12,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    marginHorizontal: 16,
    borderRadius: 10,
    padding: 3,
    height: 40,
    gap: 2,
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: TOKENS.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.muted,
  },
  segmentTextActive: {
    color: TOKENS.card,
    fontWeight: "700",
  },
  modeContentWrapper: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  quickCodeBox: {
    backgroundColor: TOKENS.card,
    borderWidth: 1.5,
    borderColor: TOKENS.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 68,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  quickCodeTextCol: {
    flexDirection: "column",
  },
  quickCodeBoxLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  codeTextRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    height: 28,
  },
  quickCodeVal: {
    fontSize: 22,
    fontWeight: "bold",
    color: TOKENS.dark,
    letterSpacing: 1.5,
  },
  blueCursor: {
    width: 2,
    height: 22,
    backgroundColor: TOKENS.primary,
    marginLeft: 4,
  },
  quickCodeMatchCol: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  matchBadgeClickable: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  matchedText: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.primary,
  },
  addSmallBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  noMatchText: {
    fontSize: 13,
    color: TOKENS.error,
    fontWeight: "600",
  },
  numpadContainer: {
    marginTop: 10,
    gap: 8,
  },
  numpadRow: {
    flexDirection: "row",
    gap: 8,
  },
  numpadBtn: {
    flex: 1,
    height: 48,
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 1,
    elevation: 0.5,
  },
  deleteBtn: {
    backgroundColor: "#F9FAFB",
  },
  numpadBtnText: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  scanWrapper: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 4,
  },
  scanLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: TOKENS.muted,
    letterSpacing: 0.5,
  },
  mockViewfinder: {
    width: "100%",
    height: 104,
    backgroundColor: "#111827",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  bracketContainer: {
    width: 140,
    height: 72,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  scanCorner: {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: TOKENS.yellow,
  },
  topLeftScan: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  topRightScan: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  bottomLeftScan: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  bottomRightScan: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
  dummyBarcode: {
    flexDirection: "row",
    gap: 3,
    height: 32,
    alignItems: "center",
  },
  dummyBar: {
    height: "100%",
    backgroundColor: TOKENS.card,
    borderRadius: 0.5,
  },
  scanLaser: {
    position: "absolute",
    left: 2,
    right: 2,
    height: 2,
    backgroundColor: TOKENS.yellow,
    shadowColor: TOKENS.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  scanActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.primary,
    width: "100%",
    height: 42,
    borderRadius: 10,
    gap: 8,
  },
  scanActionBtnText: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 14,
  },
  searchWrapper: {
    gap: 10,
    height: 236,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TOKENS.dark,
  },
  searchResultLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: TOKENS.muted,
    letterSpacing: 0.5,
  },
  searchResultsContainer: {
    flex: 1,
  },
  searchResultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 8,
  },
  searchResultCard: {
    width: "48%",
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    padding: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchProdIcon: {
    fontSize: 18,
  },
  searchProdName: {
    flex: 1,
    fontSize: 11,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  searchProdPrice: {
    fontSize: 11,
    fontWeight: "700",
    color: TOKENS.primary,
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
