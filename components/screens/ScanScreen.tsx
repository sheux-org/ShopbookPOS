import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenWrapper } from "../common/ScreenWrapper";
import { HeaderCartButton } from "../common/HeaderCartButton";
import { CameraView } from "expo-camera";
import { usePermission } from "../../hooks/usePermissionHandler";
import { TOKENS } from "../../constants/tokens";
import { cartState, CartItem } from "../data/cartState";
import { useProducts } from "../../hooks/useProducts";
import { useUserPermissions } from "../../hooks/useUserPermissions";
import { ProductImage } from "../common/ProductImage";

export const ScanScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requestCameraAccess, hasCameraAccess } = usePermission();
  const { role } = useUserPermissions();

  const [invoiceItems, setInvoiceItems] = useState<CartItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const scanAnim = useRef(new Animated.Value(0)).current;
  const lastScanTime = useRef<number>(0);

  // Real products catalog from WatermelonDB via React Query
  const { data: catalogProducts = [] } = useProducts();

  useEffect(() => {
    const syncInvoice = () => {
      setInvoiceItems(cartState.getCart());
    };
    syncInvoice();
    return cartState.subscribe(syncInvoice);
  }, []);

  const totalInvoiceAmount = useMemo(() => {
    return invoiceItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [invoiceItems]);

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

  const laserTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 174],
  });

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 1500);
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    // 2-second debounce to avoid rapid double-scans
    if (lastScanTime.current && Date.now() - lastScanTime.current < 2000) return;
    lastScanTime.current = Date.now();

    const matched = catalogProducts.find((p) => p.barcode === data);
    if (matched) {
      const skuCode = matched.barcode || `SKU 23400${matched.id}`;
      cartState.addCartItem(matched.name, matched.price, matched.icon, skuCode, matched.stockCount);
      triggerToast(`Added ${matched.name} 🛒`);
    } else {
      triggerToast(`Barcode ${data} not in catalog ⚠️`);
    }
  };

  return (
    <ScreenWrapper noPaddingBottom style={styles.container}>
      {/* Popover feedback toast */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Feather name="chevron-left" size={24} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Scan Products</Text>
          <Text style={styles.headerSubtitle}>Invoice Cart</Text>
        </View>

        <View style={styles.headerRightActions}>
          {role === "admin" && (
            <TouchableOpacity
              style={styles.headerHistoryBtn}
              activeOpacity={0.7}
              onPress={() => router.push("/pos/history")}
            >
              <Feather name="list" size={16} color={TOKENS.primary} />
              <Text style={{ fontSize: 12, fontWeight: "bold", color: TOKENS.primary, marginLeft: 4 }}>Orders</Text>
            </TouchableOpacity>
          )}

          <HeaderCartButton />
        </View>
      </View>

      {/* Scanned Items list */}
      <ScrollView
        style={styles.itemsList}
        contentContainerStyle={styles.itemsListContent}
        showsVerticalScrollIndicator={false}
      >
        {invoiceItems.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <ProductImage
              icon={item.icon}
              size={47}
              style={styles.itemIconBox}
            />
            <View style={styles.itemMainInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemQuantities}>
                {item.quantity} × Rs. {item.price.toLocaleString()}
              </Text>
            </View>

            <View style={styles.itemRightRow}>
              <Text style={styles.itemTotal}>
                Rs. {(item.price * item.quantity).toLocaleString()}
              </Text>

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
            <Ionicons name="barcode-outline" size={48} color={TOKENS.muted} />
            <Text style={styles.emptyInvoiceTitle}>No items scanned yet</Text>
            <Text style={styles.emptyInvoiceSub}>Align product barcode in the scanner below</Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom Panel - Live Camera Viewfinder & Proceed to Checkout Button */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
        <Text style={styles.scannerLabel}>CAMERA VIEWFINDER ACTIVE</Text>

        <View style={styles.mockViewfinder}>
          {hasCameraAccess ? (
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{
                barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "qr", "code128", "code39"],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
          ) : (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
              <Text style={{ color: "#fff", fontSize: 12, textAlign: "center", marginBottom: 10 }}>
                Camera Access Required
              </Text>
              <TouchableOpacity
                onPress={() => requestCameraAccess()}
                style={{ backgroundColor: TOKENS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "bold" }}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Viewfinder corner brackets overlay */}
          <View style={styles.bracketContainer}>
            <View style={[styles.scanCorner, styles.topLeftScan]} />
            <View style={[styles.scanCorner, styles.topRightScan]} />
            <View style={[styles.scanCorner, styles.bottomLeftScan]} />
            <View style={[styles.scanCorner, styles.bottomRightScan]} />

            {/* Animated Laser line */}
            <Animated.View
              style={[styles.scanLaser, { transform: [{ translateY: laserTranslateY }] }]}
            />
          </View>
        </View>

        {/* Proceed to Checkout button placed below the scan view/viewfinder */}
        <TouchableOpacity
          style={[
            styles.summaryBarButton,
            invoiceItems.length === 0 && styles.summaryBarButtonDisabled
          ]}
          disabled={invoiceItems.length === 0}
          activeOpacity={0.85}
          onPress={() => router.push("/pos/cart")}
        >
          <View style={styles.summaryBarLeft}>
            <Feather
              name="shopping-bag"
              size={16}
              color={invoiceItems.length === 0 ? TOKENS.muted : TOKENS.card}
            />
            <Text style={[
              styles.summaryLabelActive,
              invoiceItems.length === 0 && styles.summaryLabelDisabled
            ]}>
              Proceed to Checkout
            </Text>
          </View>
          {invoiceItems.length > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.summaryValueActive}>Rs. {totalInvoiceAmount.toLocaleString()}</Text>
              <Feather name="arrow-right" size={16} color={TOKENS.card} />
            </View>
          ) : (
            <Feather name="arrow-right" size={16} color={TOKENS.muted} />
          )}
        </TouchableOpacity>
      </View>
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
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerHistoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    paddingHorizontal: 12,
  },
  itemsList: {
    flex: 1,
  },
  itemsListContent: {
    padding: 16,
    gap: 12,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingRight: 16,
    paddingLeft: 3,
    paddingTop: 3,
    paddingBottom: 3,
  },
  itemIconBox: {
    width: 58,
    height: 58,
    borderRadius: 10,
    marginRight: 12,
  },
  itemMainInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  itemQuantities: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 4,
  },
  itemRightRow: {
    alignItems: "flex-end",
    gap: 6,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyInvoiceState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    gap: 8,
  },
  emptyInvoiceTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginTop: 12,
  },
  emptyInvoiceSub: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  bottomPanel: {
    backgroundColor: TOKENS.card,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    padding: 16,
    gap: 12,
  },
  scannerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: TOKENS.muted,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  mockViewfinder: {
    width: "100%",
    height: 180,
    backgroundColor: "#111827",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  bracketContainer: {
    width: 200,
    height: 120,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  scanCorner: {
    position: "absolute",
    width: 16,
    height: 16,
    borderColor: TOKENS.yellow,
  },
  topLeftScan: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRightScan: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeftScan: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRightScan: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scanLaser: {
    position: "absolute",
    left: 4,
    right: 4,
    height: 2,
    backgroundColor: TOKENS.yellow,
    shadowColor: TOKENS.yellow,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  summaryBarButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 20,
    height: 48,
    borderRadius: 24,
    width: "100%",
    marginTop: 10,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  summaryBarButtonDisabled: {
    backgroundColor: "#F3F4F6",
    shadowOpacity: 0,
    elevation: 0,
  },
  summaryBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryLabelActive: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 14,
  },
  summaryLabelDisabled: {
    color: TOKENS.muted,
  },
  summaryValueActive: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 14,
  },
});
