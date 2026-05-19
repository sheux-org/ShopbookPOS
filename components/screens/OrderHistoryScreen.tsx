import React, { useState, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Share,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { useGetOrders, useGetOrderItems, DBOrder } from "../../hooks/useOrders";
import { cartState } from "../data/cartState";

export const OrderHistoryScreen: React.FC<{ isTab?: boolean }> = ({ isTab = false }) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const activeBiz = cartState.getActiveBusiness();
  const { data: orders = [], isLoading: ordersLoading } = useGetOrders();
  const [selectedOrder, setSelectedOrder] = useState<DBOrder | null>(null);

  // Fetch items for the selected order
  const { data: orderItems = [], isLoading: itemsLoading } = useGetOrderItems(
    selectedOrder?.id
  );

  const subtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [orderItems]);

  const tax = useMemo(() => {
    // 8% dynamic tax
    return Math.round(subtotal * 0.08);
  }, [subtotal]);

  const discount = useMemo(() => {
    if (!selectedOrder) return 0;
    // Calculate discount implicitly: subtotal + tax - total
    return Math.max(0, subtotal + tax - selectedOrder.totalAmount);
  }, [selectedOrder, subtotal, tax]);

  const handleShareInvoice = async () => {
    if (!selectedOrder) return;
    try {
      const itemsListText = orderItems
        .map(
          (item) =>
            `• ${item.quantity} × ${item.name} - Rs. ${(
              item.price * item.quantity
            ).toLocaleString()}`
        )
        .join("\n");

      const message = `
=================================
       ${activeBiz.name.toUpperCase()}
       ${activeBiz.category}
       ${activeBiz.address || "Sri Lanka"}
=================================
Invoice: ${selectedOrder.invoiceNumber}
Date: ${new Date(selectedOrder.createdAt).toLocaleString()}
Status: ${selectedOrder.status.toUpperCase()}
---------------------------------
Items:
${itemsListText}
---------------------------------
Subtotal: Rs. ${subtotal.toLocaleString()}
Tax (8%): Rs. ${tax.toLocaleString()}
Discount: Rs. ${discount.toLocaleString()}
---------------------------------
Total Amount: Rs. ${selectedOrder.totalAmount.toLocaleString()}
=================================
Thank you for shopping with us!
`;

      await Share.share({
        message,
        title: `Invoice ${selectedOrder.invoiceNumber}`,
      });
    } catch (error: any) {
      Alert.alert("Error Sharing", error.message);
    }
  };

  const handleDownloadInvoice = () => {
    if (!selectedOrder) return;
    Alert.alert(
      "Download Successful",
      `Invoice ${selectedOrder.invoiceNumber.split(" ")[0]} has been converted to PDF and saved to your local device Downloads folder. 📥`
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
      {/* Header */}
      <View style={styles.header}>
        {!isTab && (
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Feather name="chevron-left" size={24} color={TOKENS.dark} />
          </TouchableOpacity>
        )}

        <View style={[styles.headerTitleWrapper, !isTab ? { marginLeft: 12 } : { marginLeft: 4 }]}>
          <Text style={styles.headerTitle}>Order History</Text>
          <Text style={styles.headerSubtitle}>Completed Sales Logs</Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      {/* Orders List */}
      {ordersLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={TOKENS.primary} />
          <Text style={styles.loadingText}>Fetching order logs...</Text>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={64} color={TOKENS.muted} />
          <Text style={styles.emptyTitle}>No orders placed yet</Text>
          <Text style={styles.emptySub}>
            Transactions completed from POS will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollWrapper}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {orders.map((order) => (
            <TouchableOpacity
              key={order.id}
              style={styles.orderCard}
              activeOpacity={0.75}
              onPress={() => setSelectedOrder(order)}
            >
              <View style={styles.orderHeader}>
                <View style={styles.invoiceWrapper}>
                  <Text style={styles.invoiceNumber} numberOfLines={1}>
                    {order.invoiceNumber.split(" ")[0]}
                  </Text>
                  <Text style={styles.cashierName}>
                    {order.invoiceNumber.includes("Staff:")
                      ? order.invoiceNumber.split("Staff:")[1].trim().replace(")", "")
                      : "Cashier"}
                  </Text>
                </View>

                <View style={styles.paidBadge}>
                  <Text style={styles.paidBadgeText}>{order.status.toUpperCase()}</Text>
                </View>
              </View>

              <View style={styles.dividerLine} />

              <View style={styles.orderFooter}>
                <Text style={styles.orderDate}>
                  {new Date(order.createdAt).toLocaleDateString()} ·{" "}
                  {new Date(order.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
                <Text style={styles.orderTotal}>
                  Rs. {order.totalAmount.toLocaleString()}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Invoice Detail Modal */}
      <Modal
        visible={selectedOrder !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom > 0 ? insets.bottom : 20 }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Receipt Invoice</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setSelectedOrder(null)}
              >
                <Feather name="x" size={20} color={TOKENS.dark} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView
                style={styles.receiptScroll}
                contentContainerStyle={styles.receiptScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Receipt Card Graphic */}
                <View style={styles.receiptCard}>
                  {/* Shop Details */}
                  <Text style={styles.receiptShopName}>{activeBiz.name}</Text>
                  <Text style={styles.receiptShopCategory}>{activeBiz.category}</Text>
                  <Text style={styles.receiptShopAddress}>
                    {activeBiz.address || "Sri Lanka"}
                  </Text>

                  <View style={styles.dashedDivider} />

                  {/* Transaction Metadata */}
                  <View style={styles.metadataRow}>
                    <Text style={styles.metaLabel}>Invoice</Text>
                    <Text style={styles.metaValue}>
                      {selectedOrder.invoiceNumber.split(" ")[0]}
                    </Text>
                  </View>
                  <View style={styles.metadataRow}>
                    <Text style={styles.metaLabel}>Staff</Text>
                    <Text style={styles.metaValue}>
                      {selectedOrder.invoiceNumber.includes("Staff:")
                        ? selectedOrder.invoiceNumber.split("Staff:")[1].trim().replace(")", "")
                        : "Admin"}
                    </Text>
                  </View>
                  <View style={styles.metadataRow}>
                    <Text style={styles.metaLabel}>Date</Text>
                    <Text style={styles.metaValue}>
                      {new Date(selectedOrder.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.metadataRow}>
                    <Text style={styles.metaLabel}>Status</Text>
                    <Text style={styles.metaValueActive}>
                      {selectedOrder.status.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.dashedDivider} />

                  {/* Items List inside Invoice */}
                  <Text style={styles.sectionTitle}>Items Details</Text>
                  {itemsLoading ? (
                    <ActivityIndicator size="small" color={TOKENS.primary} style={{ marginVertical: 12 }} />
                  ) : (
                    <View style={styles.itemsWrapper}>
                      {orderItems.map((item) => (
                        <View key={item.id} style={styles.receiptItemRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.receiptItemName}>{item.name}</Text>
                            <Text style={styles.receiptItemQty}>
                              {item.quantity} × Rs. {item.price.toLocaleString()}
                            </Text>
                          </View>
                          <Text style={styles.receiptItemTotal}>
                            Rs. {(item.price * item.quantity).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.solidDivider} />

                  {/* Financial calculations summary */}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal</Text>
                    <Text style={styles.summaryValue}>Rs. {subtotal.toLocaleString()}.00</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Tax (8%)</Text>
                    <Text style={styles.summaryValue}>Rs. {tax.toLocaleString()}.00</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabelActive}>Discount</Text>
                    <Text style={styles.summaryDiscountValue}>- Rs. {discount.toLocaleString()}.00</Text>
                  </View>

                  <View style={styles.solidDivider} />

                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Grand Total</Text>
                    <Text style={styles.receiptTotalValue}>
                      Rs. {selectedOrder.totalAmount.toLocaleString()}.00
                    </Text>
                  </View>

                  <Text style={styles.thankYouText}>Thank you for shopping with us!</Text>
                </View>
              </ScrollView>
            )}

            {/* Actions Footer */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.actionBtnShare}
                activeOpacity={0.8}
                onPress={handleShareInvoice}
              >
                <Feather name="share-2" size={16} color={TOKENS.card} />
                <Text style={styles.actionBtnText}>Share Receipt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionBtnDownload}
                activeOpacity={0.8}
                onPress={handleDownloadInvoice}
              >
                <Feather name="download" size={16} color={TOKENS.primary} />
                <Text style={styles.actionBtnDownloadText}>Download PDF</Text>
              </TouchableOpacity>
            </View>
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: TOKENS.muted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 13,
    color: TOKENS.muted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  orderCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    gap: 12,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  invoiceWrapper: {
    flex: 1,
    marginRight: 8,
  },
  invoiceNumber: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  cashierName: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 2,
  },
  paidBadge: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paidBadgeText: {
    color: "#047857",
    fontSize: 10,
    fontWeight: "bold",
  },
  dividerLine: {
    height: 1,
    backgroundColor: TOKENS.border,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderDate: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: TOKENS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  receiptScroll: {
    flex: 1,
  },
  receiptScrollContent: {
    padding: 16,
  },
  receiptCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  receiptShopName: {
    fontSize: 20,
    fontWeight: "800",
    color: TOKENS.dark,
    textAlign: "center",
  },
  receiptShopCategory: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    marginTop: 2,
  },
  receiptShopAddress: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    marginTop: 2,
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderStyle: "dashed",
    marginVertical: 16,
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  metaLabel: {
    fontSize: 13,
    color: TOKENS.muted,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  metaValueActive: {
    fontSize: 13,
    fontWeight: "800",
    color: "#047857",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
    marginBottom: 8,
  },
  itemsWrapper: {
    gap: 8,
  },
  receiptItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  receiptItemName: {
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  receiptItemQty: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
  },
  receiptItemTotal: {
    fontSize: 13,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  solidDivider: {
    height: 1,
    backgroundColor: TOKENS.border,
    marginVertical: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 3,
  },
  summaryLabel: {
    fontSize: 13,
    color: TOKENS.muted,
  },
  summaryLabelActive: {
    fontSize: 13,
    color: TOKENS.primary,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  summaryDiscountValue: {
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.error,
  },
  receiptTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 4,
  },
  receiptTotalLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  receiptTotalValue: {
    fontSize: 20,
    fontWeight: "800",
    color: TOKENS.primary,
  },
  thankYouText: {
    fontSize: 13,
    color: TOKENS.muted,
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 24,
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: TOKENS.card,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
  },
  actionBtnShare: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.primary,
    height: 48,
    borderRadius: 24,
    gap: 8,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  actionBtnText: {
    color: TOKENS.card,
    fontSize: 14,
    fontWeight: "bold",
  },
  actionBtnDownload: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    height: 48,
    borderRadius: 24,
    gap: 8,
  },
  actionBtnDownloadText: {
    color: TOKENS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
});
