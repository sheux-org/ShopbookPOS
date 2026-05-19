import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Platform,
  Modal,
  Alert,
} from "react-native";
import { CameraView } from "expo-camera";
import { usePermission } from "../../hooks/usePermissionHandler";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { cartState, CatalogProduct } from "../data/cartState";
import { useProducts } from "../../hooks/useProducts";

export const SearchScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requestCameraAccess } = usePermission();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeChip, setActiveChip] = useState("All");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Live products catalog list synced via React Query hook
  const { data: productsList = [] } = useProducts(undefined, searchQuery, activeChip);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const syncCart = () => {
      const cart = cartState.getCart();
      setCartCount(cart.reduce((sum, item) => sum + item.quantity, 0));
    };
    syncCart();
    return cartState.subscribe(syncCart);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  };

  const triggerBarcodeScanner = () => {
    requestCameraAccess(() => {
      setIsScanning(true);
    });
  };

  const handleAddProduct = (prod: CatalogProduct) => {
    const skuCode = `SKU 23400${prod.id}`;
    cartState.addCartItem(prod.name, prod.price, prod.icon, skuCode, prod.stockCount);
    triggerToast(`Added ${prod.name} to active invoice`);
  };

  const filterChips = ["All", "In Stock", "Under Rs. 1000", "Low Stock", "Out of Stock"];

  // Direct queries are executed inside WatermelonDB
  const filteredProducts = productsList;

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header matching Image 2 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        {/* Input Bar */}
        <View style={styles.searchInputWrapper}>
          <Feather name="search" size={18} color={TOKENS.muted} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x-circle" size={16} color={TOKENS.muted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={triggerBarcodeScanner}>
              <Ionicons name="qr-code-outline" size={16} color={TOKENS.primary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerRightActions}>
          {cartCount > 0 && (
            <TouchableOpacity
              style={styles.headerCartBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/pos/cart")}
            >
              <Feather name="shopping-cart" size={16} color={TOKENS.primary} />
              <View style={styles.headerCartBadge}>
                <Text style={styles.headerCartBadgeText}>{cartCount}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Horizontal Filtering Chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
        >
          {filterChips.map((chip) => {
            const isActive = activeChip === chip;
            return (
              <TouchableOpacity
                key={chip}
                style={[
                  styles.chip,
                  isActive ? styles.chipActive : styles.chipInactive,
                ]}
                activeOpacity={0.85}
                onPress={() => setActiveChip(chip)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {chip}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Title Count Subheader */}
      <View style={styles.subheader}>
        <Text style={styles.subheaderText}>
          {filteredProducts.length} {filteredProducts.length === 1 ? "RESULT" : "RESULTS"}
        </Text>
      </View>

      {/* Results Scrollable list */}
      <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
        {filteredProducts.map((item) => (
          <View key={item.id} style={styles.resultItemRow}>
            {/* Left Box Icon */}
            <View style={styles.iconBox}>
              <Text style={styles.iconText}>{item.icon}</Text>
            </View>

            {/* Middle Details */}
            <View style={styles.itemDetails}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.skuStockRow}>
                {item.quickCode ? (
                  <>
                    <Text style={styles.skuText}>QC: {item.quickCode}</Text>
                    <Text style={styles.dividerDot}>·</Text>
                  </>
                ) : null}
                {item.stockType === "low" ? (
                  <Text style={styles.stockLowText}>{item.stockText}</Text>
                ) : item.stockType === "out" ? (
                  <Text style={styles.stockOutText}>{item.stockText}</Text>
                ) : (
                  <Text style={styles.stockNormalText}>{item.stockText}</Text>
                )}
              </View>
            </View>

            {/* Right Row Actions & Price */}
            <View style={styles.rightActionsCol}>
              <Text style={styles.itemPrice}>Rs. {item.price.toLocaleString()}</Text>
              
              <TouchableOpacity
                style={[
                  styles.addButton,
                  item.stockType === "out" && styles.addButtonDisabled
                ]}
                activeOpacity={item.stockType === "out" ? 1 : 0.8}
                onPress={() => item.stockType !== "out" && handleAddProduct(item)}
              >
                <Feather
                  name={item.stockType === "out" ? "alert-circle" : "plus"}
                  size={12}
                  color={item.stockType === "out" ? TOKENS.muted : TOKENS.primary}
                  style={styles.plusIcon}
                />
                <Text
                  style={[
                    styles.addButtonText,
                    item.stockType === "out" && styles.addButtonTextDisabled
                  ]}
                >
                  {item.stockType === "out" ? "Out" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {filteredProducts.length === 0 && (
          <View style={styles.emptySearchState}>
            <Feather name="search" size={48} color="#D1D5DB" />
            <Text style={styles.emptySearchTitle}>No items found</Text>
            <Text style={styles.emptySearchSub}>
              Try searching for another product or add a new one to catalog.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* REAL HIGH-PERFORMANCE CAMERA BARCODE SCANNER OVERLAY MODAL */}
      <Modal
        visible={isScanning}
        transparent
        animationType="fade"
        onRequestClose={() => setIsScanning(false)}
      >
        <View style={styles.scannerBg}>
          <View style={styles.scannerCard}>
            <View style={styles.scannerHeaderRow}>
              <Text style={styles.scannerTitle}>📷 Search Barcode Active</Text>
              <TouchableOpacity
                style={styles.closeScannerBtn}
                onPress={() => setIsScanning(false)}
              >
                <Feather name="x" size={20} color={TOKENS.dark} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.scannerInstruction}>
              Align a product barcode within the viewfinder box to search and locate it instantly
            </Text>
            
            {/* Viewfinder area containing live CameraView */}
            <View style={styles.scannerViewfinder}>
              {isScanning ? (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{
                    barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "qr", "code128", "code39"],
                  }}
                  onBarcodeScanned={({ type, data }) => {
                    setSearchQuery(data);
                    setIsScanning(false);
                    triggerToast(`Found Barcode: ${data} 🔍`);
                  }}
                />
              ) : null}

              {/* Viewfinder corners overlay */}
              <View style={[styles.viewfinderCorner, styles.cornerTL]} />
              <View style={[styles.viewfinderCorner, styles.cornerTR]} />
              <View style={[styles.viewfinderCorner, styles.cornerBL]} />
              <View style={[styles.viewfinderCorner, styles.cornerBR]} />
              
              {/* Animated Laser line */}
              <View style={styles.scannerLaserLine} />
              
              <Text style={styles.scanningText}>SCANNING...</Text>
            </View>
            
            {/* Instant mock capture for simulator environments */}
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
                setSearchQuery(randomBarcode);
                setIsScanning(false);
                triggerToast(`Simulated Scan: ${randomBarcode} 🔍`);
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
    backgroundColor: TOKENS.card,
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
    gap: 12,
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
  searchInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TOKENS.dark,
  },
  scanHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  chipsWrapper: {
    height: 52,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
  },
  chipsScrollContent: {
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: TOKENS.primary,
  },
  chipInactive: {
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextActive: {
    color: TOKENS.card,
    fontWeight: "bold",
  },
  chipTextInactive: {
    color: TOKENS.primary,
  },
  subheader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
  },
  subheaderText: {
    fontSize: 11,
    fontWeight: "bold",
    color: TOKENS.muted,
    letterSpacing: 0.5,
  },
  resultsList: {
    flex: 1,
    backgroundColor: TOKENS.card,
  },
  resultItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  iconText: {
    fontSize: 22,
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  skuStockRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  skuText: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  dividerDot: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  stockNormalText: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  stockLowText: {
    fontSize: 12,
    color: TOKENS.warning,
    fontWeight: "bold",
  },
  stockOutText: {
    fontSize: 12,
    color: TOKENS.error,
    fontWeight: "bold",
  },
  rightActionsCol: {
    alignItems: "flex-end",
    gap: 6,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  addButtonDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: TOKENS.border,
  },
  plusIcon: {
    marginTop: 0.5,
  },
  addButtonText: {
    fontSize: 11,
    color: TOKENS.primary,
    fontWeight: "bold",
  },
  addButtonTextDisabled: {
    color: TOKENS.muted,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerCartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  emptySearchState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
    marginTop: 32,
    marginHorizontal: 16,
  },
  emptySearchTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySearchSub: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    lineHeight: 18,
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
