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
  Modal,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { cartState } from "../data/cartState";
import { useAddProduct } from "../../hooks/useProducts";

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

  const addProductMutation = useAddProduct();

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
  const [formQuickCode, setFormQuickCode] = useState("");
  const [formBarcode, setFormBarcode] = useState("");
  const [formImage, setFormImage] = useState("🍎");
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

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

  const triggerBarcodeScanner = async () => {
    if (!permission || !permission.granted) {
      const status = await requestPermission();
      if (!status.granted) {
        Alert.alert("Camera Permission Required", "Please allow camera access to scan barcodes.");
        return;
      }
    }
    setIsScanning(true);
  };

  const handleSaveProduct = () => {
    if (!formName || !formSalesPrice || !formStockIn) {
      Alert.alert("Required Fields Missing", "Please enter product name, selling price, and initial stock quantity.");
      return;
    }

    if (!formQuickCode && !formBarcode) {
      Alert.alert("Identification Required", "Please enter at least either a Quick Code or a Barcode to identify this product.");
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

    // Save product dynamically using React Query mutation hook
    addProductMutation.mutate({
      name: formName,
      price: priceNum,
      category: formCategory,
      icon: formImage || CATEGORY_ICONS[formCategory] || "📦",
      stockCount: stockCount,
      unitType: formUnitType,
      costPrice: costNum,
      quickCode: formQuickCode || undefined,
      barcode: formBarcode || undefined,
    });

    triggerToast(`Product "${formName}" saved to catalog!`);

    // Reset form fields
    setFormName("");
    setFormCostPrice("");
    setFormSalesPrice("");
    setFormStockIn("");
    setFormLowStock("");
    setFormQuickCode("");
    setFormBarcode("");
    setFormImage("🍎");
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
              onPress={() => router.push("/pos/cart")}
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
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Search row touching search results */}
        <TouchableOpacity
          style={styles.searchBarTouch}
          activeOpacity={0.9}
          onPress={() => router.push("/pos/search")}
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

            {/* Field: Quick Code & Barcode Row */}
            <View style={styles.fieldColumnsRow}>
              <View style={styles.flexField}>
                <Text style={styles.fieldLabel}>Quick Code</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. QC-302"
                  placeholderTextColor="#9CA3AF"
                  value={formQuickCode}
                  onChangeText={setFormQuickCode}
                />
              </View>

              <View style={styles.flexField}>
                <Text style={styles.fieldLabel}>Barcode</Text>
                <View style={styles.barcodeInputContainer}>
                  <TextInput
                    style={styles.barcodeInput}
                    placeholder="Type or Scan 890..."
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={formBarcode}
                    onChangeText={setFormBarcode}
                  />
                  <TouchableOpacity
                    style={styles.barcodeScanBtn}
                    activeOpacity={0.8}
                    onPress={triggerBarcodeScanner}
                  >
                    <Ionicons name="scan-outline" size={15} color={TOKENS.primary} />
                  </TouchableOpacity>
                </View>
              </View>
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

            {/* Field: Product Image Picker */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Product Image / Icon *</Text>
              <Text style={styles.fieldHelpText}>Select an image/emoji representing the product catalog icon</Text>
              
              <View style={styles.imagePickerContainer}>
                {/* Current Active Preview */}
                <View style={styles.imagePreviewBox}>
                  <Text style={styles.imagePreviewText}>{formImage}</Text>
                </View>
                
                {/* Horizontal Emojis selector list */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imageOptionsScroll}
                >
                  {["🍎", "🥛", "🥤", "🍪", "🧼", "🍞", "🥚", "🌾", "🥣", "🧴", "🍫", "🥦", "🥩", "🧅", "🍌", "🥫", "🔋"].map((emoji) => {
                    const isSelected = formImage === emoji;
                    return (
                      <TouchableOpacity
                        key={emoji}
                        style={[
                          styles.imageOptionChip,
                          isSelected && styles.imageOptionChipActive
                        ]}
                        onPress={() => setFormImage(emoji)}
                      >
                        <Text style={styles.imageOptionText}>{emoji}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  
                  {/* Simulated Gallery custom upload box */}
                  <TouchableOpacity
                    style={styles.imageOptionChipUpload}
                    activeOpacity={0.7}
                    onPress={() => {
                      const mockCustoms = ["🍕", "🍔", "🍟", "🍩", "🍦", "🍗", "🍣", "🍇"];
                      const picked = mockCustoms[Math.floor(Math.random() * mockCustoms.length)];
                      setFormImage(picked);
                      triggerToast("Simulated Photo uploaded successfully! 📸");
                    }}
                  >
                    <Feather name="camera" size={14} color={TOKENS.primary} />
                    <Text style={styles.imageUploadText}>Upload</Text>
                  </TouchableOpacity>
                </ScrollView>
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

      {/* SIMULATED HIGH-FIDELITY BARCODE SCANNER OVERLAY MODAL */}
      <Modal
        visible={isScanning}
        transparent
        animationType="fade"
        onRequestClose={() => setIsScanning(false)}
      >
        <View style={styles.scannerBg}>
          <View style={styles.scannerCard}>
            <View style={styles.scannerHeaderRow}>
              <Text style={styles.scannerTitle}>📷 Barcode Scanner Active</Text>
              <TouchableOpacity
                style={styles.closeScannerBtn}
                onPress={() => setIsScanning(false)}
              >
                <Feather name="x" size={20} color={TOKENS.dark} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.scannerInstruction}>
              Align the retail product barcode within the viewfinder to automatically scan and catalog
            </Text>
            
             {/* Viewfinder area with blinking animation and moving laser line */}
            <View style={styles.scannerViewfinder}>
              {isScanning && permission?.granted ? (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{
                    barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "qr", "code128", "code39"],
                  }}
                  onBarcodeScanned={({ type, data }) => {
                    setFormBarcode(data);
                    setIsScanning(false);
                    triggerToast(`Barcode Scanned: ${data} ✅`);
                  }}
                />
              ) : null}

              {/* Four corners */}
              <View style={[styles.viewfinderCorner, styles.cornerTL]} />
              <View style={[styles.viewfinderCorner, styles.cornerTR]} />
              <View style={[styles.viewfinderCorner, styles.cornerBL]} />
              <View style={[styles.viewfinderCorner, styles.cornerBR]} />
              
              {/* Moving Laser line */}
              <View style={styles.scannerLaserLine} />
              
              <Text style={styles.scanningText}>SCANNING...</Text>
            </View>
            
            <TouchableOpacity
              style={styles.scannerForceScanBtn}
              activeOpacity={0.8}
              onPress={() => {
                const mockBarcodes = [
                  "8901030777551",
                  "501234567890",
                  "4902430582766",
                  "7622300744961",
                ];
                const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
                setFormBarcode(randomBarcode);
                setIsScanning(false);
                triggerToast(`Barcode Scanned: ${randomBarcode} ✅`);
              }}
            >
              <Text style={styles.forceScanText}>⚡ Instant Capture</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  barcodeInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 8,
  },
  barcodeInput: {
    flex: 1,
    fontSize: 13,
    color: TOKENS.dark,
    padding: 0,
  },
  barcodeScanBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: TOKENS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  fieldHelpText: {
    fontSize: 11,
    color: TOKENS.muted,
    marginBottom: 4,
  },
  imagePickerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  imagePreviewBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: TOKENS.accentBlue,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  imagePreviewText: {
    fontSize: 28,
  },
  imageOptionsScroll: {
    alignItems: "center",
    gap: 8,
    paddingRight: 16,
  },
  imageOptionChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  imageOptionChipActive: {
    backgroundColor: TOKENS.lightBlue,
    borderColor: TOKENS.primary,
    borderWidth: 1.5,
  },
  imageOptionText: {
    fontSize: 20,
  },
  imageOptionChipUpload: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  imageUploadText: {
    fontSize: 11,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  scannerBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scannerCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  scannerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  closeScannerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerInstruction: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    lineHeight: 16,
  },
  scannerViewfinder: {
    width: 220,
    height: 140,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.3)",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  viewfinderCorner: {
    position: "absolute",
    width: 16,
    height: 16,
    borderColor: TOKENS.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scannerLaserLine: {
    position: "absolute",
    width: "90%",
    height: 2,
    backgroundColor: "#EF4444",
    top: "50%",
  },
  scanningText: {
    position: "absolute",
    bottom: 10,
    fontSize: 10,
    fontWeight: "bold",
    color: TOKENS.primary,
    letterSpacing: 1.5,
  },
  scannerForceScanBtn: {
    backgroundColor: TOKENS.primary,
    height: 40,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  forceScanText: {
    color: TOKENS.card,
    fontSize: 14,
    fontWeight: "bold",
  },
});
