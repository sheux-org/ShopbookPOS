import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { useBusinessInsights } from "../../hooks/useInsights";
import { useStockInProduct } from "../../hooks/useProducts";
import { syncDatabase } from "../../services/sync";
import { BottomSheet } from "../common/BottomSheet";
import { ProductImage } from "../common/ProductImage";
import { ScreenWrapper } from "../common/ScreenWrapper";
import { cartState } from "../data/cartState";

export const InsightsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const router = useRouter();
  const activeBusiness = cartState.getActiveBusiness();
  const { height: windowHeight } = useWindowDimensions();

  // Period filters
  const [period, setPeriod] = useState<
    "daily" | "monthly" | "yearly" | "custom"
  >("monthly");
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  // Calendar interactive range selections (May 2026 default)
  const [selectedStartDay, setSelectedStartDay] = useState<number | null>(null);
  const [selectedEndDay, setSelectedEndDay] = useState<number | null>(null);

  // Custom resolved dates
  const [resolvedStartDate, setResolvedStartDate] = useState<Date | null>(null);
  const [resolvedEndDate, setResolvedEndDate] = useState<Date | null>(null);

  // Simulated export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<"PDF" | "CSV" | null>(null);
  const [exportResultModal, setExportResultModal] = useState(false);

  // Low stock details drawer
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);

  // Reports Drawer states
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [reportsActiveTab, setReportsActiveTab] = useState<
    "orders" | "inventory"
  >("orders");
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(
    null,
  );
  const [refillValues, setRefillValues] = useState<Record<string, string>>({});

  // Active business details sync
  const [activeBiz, setActiveBiz] = useState(activeBusiness);

  useEffect(() => {
    const updateBiz = () => {
      setActiveBiz(cartState.getActiveBusiness());
    };
    return cartState.subscribe(updateBiz);
  }, []);

  // Real-time WatermelonDB statistics fetch using custom hook
  const {
    data: stats,
    isLoading,
  } = useBusinessInsights(
    activeBiz.id,
    period,
    resolvedStartDate,
    resolvedEndDate,
  );

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncDatabase = async () => {
    setIsSyncing(true);
    try {
      const result = await syncDatabase();
      if (result) {
        queryClient.invalidateQueries({ queryKey: ["insights"] });
        Alert.alert(
          "Sync Success",
          "Database successfully synchronized with Cloud Storage!",
        );
      } else {
        Alert.alert(
          "Sync Skipped",
          "Backup/sync is disabled or environment is not configured. Please enable it in Settings.",
        );
      }
    } catch (err: any) {
      Alert.alert(
        "Sync Failed",
        err.message || "Failed to synchronize database.",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const stockInMutation = useStockInProduct();

  const handleExport = (type: "PDF" | "CSV") => {
    setExportType(type);
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportResultModal(true);
    }, 2000);
  };

  const handleShare = async () => {
    try {
      const content =
        exportType === "CSV"
          ? `Mini POS - Tabular CSV Statement for ${activeBiz.name}\nGross Revenue: Rs. ${stats?.grossRevenue.toLocaleString()}\nTotal Orders: ${stats?.ordersCount}`
          : `Mini POS - Premium PDF Invoice statement for ${activeBiz.name}\nGenerated on Sri Lanka Helplines.`;
      await Share.share({
        message: content,
      });
      setExportResultModal(false);
    } catch (err: any) {
      Alert.alert("Share Failed", err.message);
    }
  };

  const handleCalendarDayPress = (day: number) => {
    if (!selectedStartDay || (selectedStartDay && selectedEndDay)) {
      setSelectedStartDay(day);
      setSelectedEndDay(null);
    } else if (day < selectedStartDay) {
      setSelectedStartDay(day);
    } else {
      setSelectedEndDay(day);
    }
  };

  const applyCalendarRange = () => {
    if (!selectedStartDay || !selectedEndDay) {
      Alert.alert(
        "Range Selection Needed",
        "Please select both a Start Date and an End Date on the calendar grid first.",
      );
      return;
    }
    const start = new Date(2026, 4, selectedStartDay); // May index is 4
    const end = new Date(2026, 4, selectedEndDay, 23, 59, 59);

    setResolvedStartDate(start);
    setResolvedEndDate(end);
    setIsCustomModalOpen(false);
    setPeriod("custom");
  };

  return (
    <ScreenWrapper noPaddingBottom style={styles.container}>
      {/* Dashboard Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/")}
        >
          <Feather name="chevron-left" size={24} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
            Business Insights
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
            {isSyncing ? "Syncing..." : "Real-time reports"}
          </Text>
        </View>

        <View style={styles.headerActionsWrapper}>
          <TouchableOpacity
            style={styles.headerTextBtn}
            activeOpacity={0.7}
            onPress={() => setIsReportsModalOpen(true)}
          >
            <Feather name="bar-chart-2" size={15} color={TOKENS.primary} />
            <Text style={styles.headerTextBtnLabel}>Reports</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.headerIconBtn, isSyncing && styles.headerTextBtnDisabled]}
            activeOpacity={0.7}
            onPress={handleSyncDatabase}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color={TOKENS.primary} />
            ) : (
              <Feather name="refresh-cw" size={15} color={TOKENS.primary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Insights Panel Scroll */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 90 },
        ]}
      >
        {/* Period Selector pills */}
        <View style={styles.periodPillsRow}>
          <TouchableOpacity
            style={[
              styles.periodPill,
              period === "daily" && styles.periodPillActive,
            ]}
            onPress={() => setPeriod("daily")}
          >
            <Text
              style={[
                styles.periodPillText,
                period === "daily" && styles.periodPillTextActive,
              ]}
            >
              Today
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.periodPill,
              period === "monthly" && styles.periodPillActive,
            ]}
            onPress={() => setPeriod("monthly")}
          >
            <Text
              style={[
                styles.periodPillText,
                period === "monthly" && styles.periodPillTextActive,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.periodPill,
              period === "yearly" && styles.periodPillActive,
            ]}
            onPress={() => setPeriod("yearly")}
          >
            <Text
              style={[
                styles.periodPillText,
                period === "yearly" && styles.periodPillTextActive,
              ]}
            >
              Yearly
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.periodPill,
              period === "custom" && styles.periodPillActive,
            ]}
            onPress={() => setIsCustomModalOpen(true)}
          >
            <Text
              style={[
                styles.periodPillText,
                period === "custom" && styles.periodPillTextActive,
              ]}
            >
              Custom
            </Text>
          </TouchableOpacity>
        </View>

        {/* Loading Spinner */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={TOKENS.primary} />
            <Text style={styles.loadingText}>Computing sales logs...</Text>
          </View>
        ) : (
          <>
            {/* KPI Cards Grid */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <View
                  style={[styles.kpiIconCircle, { backgroundColor: "#E8FDF0" }]}
                >
                  <Feather name="trending-up" size={16} color="#10B981" />
                </View>
                <Text style={styles.kpiLabel}>Gross Sales</Text>
                <Text style={styles.kpiValue}>
                  Rs. {stats?.grossRevenue.toLocaleString()}
                </Text>
              </View>

              <View style={styles.kpiCard}>
                <View
                  style={[styles.kpiIconCircle, { backgroundColor: "#EFF6FF" }]}
                >
                  <Feather name="file-text" size={16} color={TOKENS.primary} />
                </View>
                <Text style={styles.kpiLabel}>Transactions</Text>
                <Text style={styles.kpiValue}>{stats?.ordersCount}</Text>
              </View>

              <View style={styles.kpiCard}>
                <View
                  style={[styles.kpiIconCircle, { backgroundColor: "#FEF7E0" }]}
                >
                  <Feather name="shopping-bag" size={16} color="#B06000" />
                </View>
                <Text style={styles.kpiLabel}>Avg Basket</Text>
                <Text style={styles.kpiValue}>
                  Rs. {Math.round(stats?.avgTicket || 0).toLocaleString()}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.kpiCard}
                activeOpacity={0.7}
                onPress={() => {
                  if (stats?.lowStockCount && stats.lowStockCount > 0) {
                    setIsLowStockModalOpen(true);
                  } else {
                    Alert.alert(
                      "All Stock Normal",
                      "All product stock counts are above the alert threshold! Great job!",
                    );
                  }
                }}
              >
                <View
                  style={[styles.kpiIconCircle, { backgroundColor: "#FCE8E6" }]}
                >
                  <Feather
                    name="alert-triangle"
                    size={16}
                    color={TOKENS.error}
                  />
                </View>
                <Text style={styles.kpiLabel}>Low Stock Items</Text>
                <Text
                  style={[
                    styles.kpiValue,
                    stats?.lowStockCount! > 0 && { color: TOKENS.error },
                  ]}
                >
                  {stats?.lowStockCount}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Simulated Live Bar Chart */}
            <View style={styles.chartWrapper}>
              <Text style={styles.sectionTitle}>Weekly Sales Distribution</Text>
              <View style={styles.barGraphRow}>
                {stats?.chartData.map((item, index) => {
                  const maxVal = Math.max(
                    ...stats.chartData.map((c) => c.value),
                    1000,
                  );
                  const pct = Math.min((item.value / maxVal) * 100, 100);
                  return (
                    <View key={index} style={styles.barGraphCol}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${pct}%` }]} />
                      </View>
                      <Text style={styles.barLabel}>{item.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Sync database helper card if sales count is zero */}
            {stats?.ordersCount === 0 && (
              <View style={styles.seederContainer}>
                <Feather name="refresh-cw" size={24} color={TOKENS.muted} />
                <Text style={styles.seederText}>
                  No sales invoices recorded for this active branch yet.
                </Text>
                <TouchableOpacity
                  style={styles.seederBtn}
                  activeOpacity={0.8}
                  onPress={handleSyncDatabase}
                  disabled={isSyncing}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {isSyncing && (
                      <ActivityIndicator size="small" color="#fff" />
                    )}
                    <Text style={styles.seederBtnText}>
                      {isSyncing ? "Syncing..." : "Sync Database Now"}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {/* Best Sellers Section */}
            {stats?.bestSellers.length! > 0 && (
              <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>
                  🔥 Best Selling Products
                </Text>
                <View style={styles.statsCardList}>
                  {stats?.bestSellers.map((item, index) => (
                    <View key={index} style={styles.statListItem}>
                      <View
                        style={[
                          styles.rankCircle,
                          index === 0 && styles.rankGold,
                          index === 1 && styles.rankSilver,
                          index === 2 && styles.rankBronze,
                        ]}
                      >
                        <Text style={styles.rankText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.statItemName}>{item.name}</Text>
                      <Text style={styles.statItemQty}>
                        {item.quantity} units
                      </Text>
                      <Text style={styles.statItemRevenue}>
                        Rs. {item.revenue.toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Slow Movers Section */}
            {stats?.slowMovers.length! > 0 && (
              <View style={styles.statsSection}>
                <Text style={styles.sectionTitle}>
                  ⏳ Slow Moving Inventory
                </Text>
                <View style={styles.statsCardList}>
                  {stats?.slowMovers.map((item, index) => (
                    <View key={index} style={styles.statListItem}>
                      <View
                        style={[
                          styles.rankCircle,
                          { backgroundColor: "#F3F4F6" },
                        ]}
                      >
                        <Text
                          style={[styles.rankText, { color: TOKENS.muted }]}
                        >
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={styles.statItemName}>{item.name}</Text>
                      <Text style={styles.statItemQty}>
                        {item.quantity} units
                      </Text>
                      <Text style={styles.statItemRevenue}>
                        Rs. {item.revenue.toLocaleString()}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Export Actions Section */}
            {stats?.ordersCount! > 0 && (
              <View style={styles.exportSection}>
                <Text style={styles.sectionTitle}>
                  📄 Export Business Reports
                </Text>
                <View style={styles.exportButtonsRow}>
                  <TouchableOpacity
                    style={[styles.exportCardBtn, styles.exportPdfCard]}
                    activeOpacity={0.8}
                    onPress={() => handleExport("PDF")}
                  >
                    <View style={styles.exportIconBadgePdf}>
                      <Feather name="file-text" size={18} color="#EF4444" />
                    </View>
                    <Text style={styles.exportPdfTextTitle}>PDF Statement</Text>
                    <Text style={styles.exportCardSubtitle}>
                      Formatted store summary
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.exportCardBtn, styles.exportCsvCard]}
                    activeOpacity={0.8}
                    onPress={() => handleExport("CSV")}
                  >
                    <View style={styles.exportIconBadgeCsv}>
                      <Feather name="grid" size={18} color="#10B981" />
                    </View>
                    <Text style={styles.exportCsvTextTitle}>CSV Ledger</Text>
                    <Text style={styles.exportCardSubtitle}>
                      Spreadsheet ledger data
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Manual Sync Database Button at the bottom */}
            <View style={styles.syncDatabaseSection}>
              <TouchableOpacity
                style={styles.syncDatabaseBtn}
                activeOpacity={0.8}
                onPress={handleSyncDatabase}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <ActivityIndicator
                    size="small"
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                ) : (
                  <Feather
                    name="refresh-cw"
                    size={16}
                    color="#fff"
                    style={{ marginRight: 8 }}
                  />
                )}
                <Text style={styles.syncDatabaseBtnText}>
                  {isSyncing ? "Syncing Database..." : "Sync Database Now"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.syncDatabaseHelpText}>
                Pull latest transaction reports and product inventory directly
                from your remote Cloud Storage.
              </Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Date Range Calendar Grid Modal */}
      <Modal
        visible={isCustomModalOpen}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsCustomModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.datePickerContent}>
            <Text style={styles.modalTitle}>
              Select Custom Range (May 2026)
            </Text>

            {/* Weekdays Headers */}
            <View style={styles.weekdaysRow}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day, idx) => (
                <Text key={idx} style={styles.weekdayLabel}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Days Cells Grid */}
            <View style={styles.daysGrid}>
              {(() => {
                const daysInMonth = 31;
                const daysArray = Array.from(
                  { length: daysInMonth },
                  (_, i) => i + 1,
                );
                const startOffset = 5; // May 2026 starts on Friday
                const calendarCells = [
                  ...Array(startOffset).fill(null),
                  ...daysArray,
                ];

                return calendarCells.map((day, idx) => {
                  if (day === null) {
                    return (
                      <View key={`empty-${idx}`} style={styles.emptyDayCell} />
                    );
                  }

                  const isSelectedStart = selectedStartDay === day;
                  const isSelectedEnd = selectedEndDay === day;
                  const isWithinRange = !!(
                    selectedStartDay &&
                    selectedEndDay &&
                    day > selectedStartDay &&
                    day < selectedEndDay
                  );

                  return (
                    <TouchableOpacity
                      key={`day-${day}`}
                      activeOpacity={0.8}
                      style={[
                        styles.dayCell,
                        isWithinRange && styles.dayCellInRange,
                        isSelectedStart && styles.dayCellSelectedStart,
                        isSelectedEnd && styles.dayCellSelectedEnd,
                      ]}
                      onPress={() => handleCalendarDayPress(day)}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isWithinRange && styles.dayTextInRange,
                          (isSelectedStart || isSelectedEnd) &&
                            styles.dayTextSelected,
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>

            {/* Selection Text Summary */}
            <View style={styles.selectedDatesPreview}>
              <Text style={styles.previewLabel}>Selected Period:</Text>
              <Text style={styles.previewValue}>
                {selectedStartDay
                  ? `May ${selectedStartDay}, 2026`
                  : "Start Date"}
                {" ➔ "}
                {selectedEndDay ? `May ${selectedEndDay}, 2026` : "End Date"}
              </Text>
            </View>

            {/* Action buttons */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsCustomModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={applyCalendarRange}
              >
                <Text style={styles.confirmBtnText}>Apply Calendar Range</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Low Stock Items Details Drawer Modal */}
      <BottomSheet
        visible={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        title="Low Stock Products List"
      >
        <Text style={styles.lowStockModalSubtitle}>
          The following inventory items are running critically low (5 units or
          less):
        </Text>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={[styles.lowStockItemsScroll, { maxHeight: 350 }]}
          contentContainerStyle={{ gap: 10, paddingVertical: 10 }}
        >
          {stats?.lowStockItems && stats.lowStockItems.length > 0 ? (
            stats.lowStockItems.map((item: any) => (
              <View key={item.id} style={styles.lowStockItemRow}>
                <View style={styles.lowStockIconWrapper}>
                  <Text style={{ fontSize: 16 }}>{item.icon || "📦"}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lowStockItemName}>{item.name}</Text>
                  <Text style={styles.lowStockItemSku}>SKU: {item.sku}</Text>
                </View>
                <View style={styles.lowStockCountBadge}>
                  <Text style={styles.lowStockCountText}>
                    {item.stockCount} left
                  </Text>
                  <Text style={styles.lowStockLimitText}>
                    Alert Threshold: {item.lowStockAlert}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyLowStockState}>
              <Feather name="check-circle" size={32} color="#10B981" />
              <Text style={styles.emptyLowStockText}>
                All products are sufficiently stocked!
              </Text>
            </View>
          )}
        </ScrollView>
      </BottomSheet>

      {/* Reports & Refills Modal Drawer */}
      <BottomSheet
        visible={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        title="Reports & Management"
        maxHeight={windowHeight * 0.88}
      >
        <View style={{ height: windowHeight * 0.88 - 75 }}>
          {/* Premium Subheader Tabs */}
          <View style={styles.modalTabsRow}>
            <TouchableOpacity
              style={[
                styles.modalTab,
                reportsActiveTab === "orders" && styles.modalTabActive,
              ]}
              onPress={() => setReportsActiveTab("orders")}
            >
              <Feather
                name="list"
                size={14}
                color={
                  reportsActiveTab === "orders" ? TOKENS.primary : TOKENS.muted
                }
              />
              <Text
                style={[
                  styles.modalTabText,
                  reportsActiveTab === "orders" && styles.modalTabTextActive,
                ]}
              >
                Order History
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalTab,
                reportsActiveTab === "inventory" && styles.modalTabActive,
              ]}
              onPress={() => setReportsActiveTab("inventory")}
            >
              <Feather
                name="plus-circle"
                size={14}
                color={
                  reportsActiveTab === "inventory"
                    ? TOKENS.primary
                    : TOKENS.muted
                }
              />
              <Text
                style={[
                  styles.modalTabText,
                  reportsActiveTab === "inventory" && styles.modalTabTextActive,
                ]}
              >
                Stock-In Refills
              </Text>
            </TouchableOpacity>
          </View>

          {/* TAB CONTENT: ORDER HISTORY */}
          {reportsActiveTab === "orders" && (
            <FlatList
              data={stats?.resolvedOrders || []}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, marginTop: 10 }}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
              renderItem={({ item: order }) => {
                const isExpanded = expandedOrderId === order.id;
                const orderDate = new Date(order.createdAt);
                return (
                  <View style={styles.historyOrderCard}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.historyCardHeader}
                      onPress={() =>
                        setExpandedOrderId(isExpanded ? null : order.id)
                      }
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.historyInvoiceNum}>
                          Invoice #{order.invoiceNumber}
                        </Text>
                        <Text style={styles.historyDateText}>
                          {orderDate.toLocaleDateString()} at{" "}
                          {orderDate.toLocaleTimeString()}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text style={styles.historyTotalAmount}>
                          Rs. {order.totalAmount.toLocaleString()}
                        </Text>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          <Text style={styles.historyItemCount}>
                            {order.items.length} items
                          </Text>
                          <Feather
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={14}
                            color={TOKENS.muted}
                          />
                        </View>
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.historyItemsExpandedPanel}>
                        <View style={styles.expandedDivider} />
                        {order.items.map((item: any) => (
                          <View key={item.id} style={styles.expandedItemRow}>
                            <Text style={styles.expandedItemName}>
                              {item.name}
                            </Text>
                            <Text style={styles.expandedItemQty}>
                              {item.quantity} x Rs.{" "}
                              {item.price.toLocaleString()}
                            </Text>
                            <Text style={styles.expandedItemSubtotal}>
                              Rs.{" "}
                              {(item.quantity * item.price).toLocaleString()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyLowStockState}>
                  <Feather name="file-text" size={32} color={TOKENS.muted} />
                  <Text style={styles.emptyLowStockText}>
                    No invoices found for this active period!
                  </Text>
                </View>
              }
            />
          )}

          {/* TAB CONTENT: STOCK-IN INVENTORY REFILL */}
          {reportsActiveTab === "inventory" && (
            <FlatList
              data={stats?.productsList || []}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, marginTop: 10 }}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
              ListHeaderComponent={
                <Text style={styles.refillSectionLabel}>
                  Select a product below to refill / Stock-In units:
                </Text>
              }
              renderItem={({ item: prod }) => {
                const isExpanded = expandedProductId === prod.id;
                const val = refillValues[prod.id] || "";
                return (
                  <View style={styles.historyOrderCard}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.refillCardHeader}
                      onPress={() =>
                        setExpandedProductId(isExpanded ? null : prod.id)
                      }
                    >
                      <ProductImage
                        icon={prod.icon}
                        category={prod.category}
                        size={60}
                        style={styles.refillProductImage}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.refillProductName} numberOfLines={1}>
                          {prod.name}
                        </Text>
                        <Text style={styles.refillProductMeta} numberOfLines={1}>
                          Code: {prod.quickCode || prod.sku || "—"} | Price: Rs. {prod.price}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 4 }}>
                        <Text
                          style={[
                            styles.refillStockCount,
                            prod.stockCount <= 5 && { color: TOKENS.error },
                          ]}
                        >
                          Stock: {prod.stockCount}
                        </Text>
                        <Feather
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={14}
                          color={TOKENS.muted}
                        />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.historyItemsExpandedPanel}>
                        <View style={styles.expandedDivider} />

                        <View style={styles.refillInfoRow}>
                          <Text style={styles.refillCurrentStockLabel}>Current Stock:</Text>
                          <Text
                            style={[
                              styles.refillCurrentStockValue,
                              prod.stockCount <= 5 && { color: TOKENS.error },
                            ]}
                          >
                            {prod.stockCount} units
                          </Text>
                        </View>

                        <View style={styles.refillInputContainer}>
                          <TextInput
                            style={styles.refillInputInline}
                            placeholder="Refill amount (e.g. 10)"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="number-pad"
                            value={val}
                            onChangeText={(text) =>
                              setRefillValues({
                                ...refillValues,
                                [prod.id]: text,
                              })
                            }
                          />
                          <TouchableOpacity
                            style={styles.refillSubmitBtnInline}
                            activeOpacity={0.7}
                            onPress={() => {
                              const refillAmt = parseInt(val, 10);
                              if (isNaN(refillAmt) || refillAmt <= 0) {
                                Alert.alert(
                                  "Invalid Quantity",
                                  "Please enter a valid stock refill quantity!",
                                );
                                return;
                              }
                              stockInMutation.mutate(
                                {
                                  productId: prod.id,
                                  quantity: refillAmt,
                                  reason: "Restock",
                                },
                                {
                                  onSuccess: () => {
                                    queryClient.invalidateQueries({ queryKey: ["insights"] });
                                    Alert.alert("Stock In success", "Product stock refilled successfully!");
                                    // Reset expanded refill values
                                    setRefillValues({});
                                    setExpandedProductId(null);
                                  },
                                  onError: (err: any) => {
                                    Alert.alert("Refill Failed", err.message);
                                  },
                                }
                              );
                            }}
                          >
                            {stockInMutation.isPending ? (
                              <ActivityIndicator size="small" color="#fff" style={{ marginRight: 4 }} />
                            ) : (
                              <>
                                <Feather name="plus-circle" size={14} color="#fff" />
                                <Text style={styles.refillSubmitBtnInlineText}>
                                  Stock-In
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyLowStockState}>
                  <Feather name="package" size={32} color={TOKENS.muted} />
                  <Text style={styles.emptyLowStockText}>
                    No products found for this business!
                  </Text>
                </View>
              }
            />
          )}
        </View>
      </BottomSheet>

      {/* Export Progress Modal */}
      <Modal visible={isExporting} transparent={true} animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.exportProgressCard}>
            <ActivityIndicator size="large" color={TOKENS.primary} />
            <Text style={styles.exportProgressText}>
              Structuring {exportType} statement reports...
            </Text>
          </View>
        </View>
      </Modal>

      {/* Export Result Success Sheet */}
      <BottomSheet
        visible={exportResultModal}
        onClose={() => setExportResultModal(false)}
        title={`${exportType} Export Successful!`}
      >
        <View style={{ alignItems: "center", gap: 16 }}>
          <View style={styles.successIconCircle}>
            <Feather name="check" size={28} color="#fff" />
          </View>

          <Text style={styles.successSubtitle}>
            Your business statement files for {activeBiz.name} are structured
            and ready to distribute.
          </Text>

          <View style={styles.successActions}>
            <TouchableOpacity
              style={styles.shareReportBtn}
              activeOpacity={0.8}
              onPress={handleShare}
            >
              <Feather
                name="share-2"
                size={16}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.shareReportBtnText}>
                Share & Save Statement
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={() => setExportResultModal(false)}
            >
              <Text style={styles.dismissBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    </ScreenWrapper>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
    gap: 12,
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
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
    lineHeight: 20,
  },
  headerSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
    lineHeight: 14,
  },
  headerActionsWrapper: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  headerTextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    paddingHorizontal: 12,
    borderRadius: 19,
    gap: 4,
    height: 38,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBtnDisabled: {
    opacity: 0.8,
  },
  headerTextBtnLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: TOKENS.primary,
    lineHeight: 14,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  periodPillsRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9", // modern light slate background
    borderRadius: 14,
    padding: 4,
    gap: 2,
  },
  periodPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  periodPillActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  periodPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  periodPillTextActive: {
    color: TOKENS.primary,
    fontWeight: "bold",
  },
  loadingContainer: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 12,
    color: TOKENS.muted,
    fontWeight: "600",
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 14,
    gap: 6,
  },
  kpiIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: "600",
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: "800",
    color: TOKENS.dark,
  },
  chartWrapper: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  barGraphRow: {
    flexDirection: "row",
    height: 140,
    alignItems: "flex-end",
    justifyContent: "space-around",
    paddingTop: 10,
  },
  barGraphCol: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  barTrack: {
    width: 14,
    height: 100,
    backgroundColor: "#F3F4F6",
    borderRadius: 7,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    backgroundColor: TOKENS.primary,
    borderRadius: 7,
  },
  barLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: TOKENS.muted,
  },
  seederContainer: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  seederText: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    lineHeight: 16,
  },
  seederBtn: {
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  seederBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  syncDatabaseSection: {
    marginTop: 16,
    gap: 8,
    alignItems: "center",
  },
  syncDatabaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TOKENS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
  },
  syncDatabaseBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  syncDatabaseHelpText: {
    fontSize: 11,
    color: TOKENS.muted,
    textAlign: "center",
    lineHeight: 15,
    paddingHorizontal: 24,
  },
  statsSection: {
    gap: 12,
  },
  statsCardList: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingVertical: 6,
  },
  statListItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  rankCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rankGold: { backgroundColor: "#FBBF24" },
  rankSilver: { backgroundColor: "#9CA3AF" },
  rankBronze: { backgroundColor: "#F59E0B" },
  rankText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#fff",
  },
  statItemName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  statItemQty: {
    fontSize: 11,
    color: TOKENS.muted,
    marginRight: 16,
  },
  statItemRevenue: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.dark,
  },
  exportSection: {
    gap: 12,
  },
  exportButtonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  exportCardBtn: {
    flex: 1,
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 6,
    alignItems: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  exportPdfCard: {
    borderColor: "#FECDD3", // soft red
    backgroundColor: "#FFF5F5",
  },
  exportCsvCard: {
    borderColor: "#A7F3D0", // soft emerald
    backgroundColor: "#F0FDF4",
  },
  exportIconBadgePdf: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFE4E6",
    alignItems: "center",
    justifyContent: "center",
  },
  exportIconBadgeCsv: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
  },
  exportPdfTextTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#991B1B",
  },
  exportCsvTextTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#065F46",
  },
  exportCardSubtitle: {
    fontSize: 10,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  datePickerContent: {
    backgroundColor: TOKENS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: TOKENS.dark,
    textAlign: "center",
    marginBottom: 4,
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  weekdayLabel: {
    width: 38,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "bold",
    color: TOKENS.muted,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  emptyDayCell: {
    width: 38,
    height: 38,
  },
  dayCell: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellInRange: {
    backgroundColor: "#EFF6FF",
    borderRadius: 0,
  },
  dayCellSelectedStart: {
    backgroundColor: TOKENS.primary,
    borderRadius: 19,
  },
  dayCellSelectedEnd: {
    backgroundColor: TOKENS.primary,
    borderRadius: 19,
  },
  dayText: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  dayTextInRange: {
    color: TOKENS.primary,
  },
  dayTextSelected: {
    color: "#fff",
    fontWeight: "bold",
  },
  selectedDatesPreview: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 6,
  },
  previewLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: TOKENS.muted,
  },
  previewValue: {
    fontSize: 11,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  lowStockModalContent: {
    backgroundColor: TOKENS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "80%",
  },
  lowStockModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  lowStockModalTitleWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lowStockModalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  closeLowStockBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  lowStockModalSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    lineHeight: 16,
    marginBottom: 12,
  },
  lowStockItemsScroll: {
    flexGrow: 0,
  },
  lowStockItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 12,
    gap: 12,
  },
  lowStockIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FCE8E6",
    alignItems: "center",
    justifyContent: "center",
  },
  lowStockItemName: {
    fontSize: 13,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  lowStockItemSku: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 1,
  },
  lowStockCountBadge: {
    alignItems: "flex-end",
    gap: 2,
  },
  lowStockCountText: {
    fontSize: 12,
    fontWeight: "bold",
    color: TOKENS.error,
  },
  lowStockLimitText: {
    fontSize: 9,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  emptyLowStockState: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  emptyLowStockText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },
  textInput: {
    height: 46,
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingHorizontal: 14,
    fontSize: 13,
    color: TOKENS.dark,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 13,
    color: TOKENS.muted,
    fontWeight: "bold",
  },
  modalConfirmBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "bold",
  },
  exportProgressCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  exportProgressText: {
    fontSize: 12,
    color: TOKENS.muted,
    fontWeight: "600",
  },
  exportResultCard: {
    backgroundColor: TOKENS.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    alignItems: "center",
    gap: 16,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 8,
  },
  successIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  successSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 16,
  },
  successActions: {
    width: "100%",
    gap: 12,
    marginTop: 10,
  },
  shareReportBtn: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    backgroundColor: TOKENS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  shareReportBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
  },
  dismissBtn: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  dismissBtnText: {
    fontSize: 13,
    color: TOKENS.muted,
    fontWeight: "bold",
  },
  modalTabsRow: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  modalTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  modalTabActive: {
    backgroundColor: TOKENS.card,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modalTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.muted,
  },
  modalTabTextActive: {
    color: TOKENS.primary,
    fontWeight: "bold",
  },
  historyOrderCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  historyCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 8,
  },
  historyInvoiceNum: {
    fontSize: 13,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  historyDateText: {
    fontSize: 10,
    color: TOKENS.muted,
    marginTop: 2,
  },
  historyTotalAmount: {
    fontSize: 13,
    fontWeight: "800",
    color: TOKENS.dark,
  },
  historyItemCount: {
    fontSize: 10,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  historyItemsExpandedPanel: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: "#FAFAFA",
  },
  expandedDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 8,
  },
  expandedItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  expandedItemName: {
    flex: 1.5,
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  expandedItemQty: {
    flex: 1.2,
    fontSize: 11,
    color: TOKENS.muted,
    textAlign: "right",
    paddingRight: 10,
  },
  expandedItemSubtotal: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.dark,
    textAlign: "right",
  },
  refillSectionLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    marginBottom: 10,
    fontWeight: "600",
  },
  refillCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 14,
    paddingLeft: 3,
    paddingTop: 3,
    paddingBottom: 3,
    gap: 12,
  },
  refillProductImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  refillProductName: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  refillProductMeta: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
  },
  refillStockCount: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.dark,
  },
  refillInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 4,
  },
  refillInputInline: {
    flex: 1,
    height: "100%",
    fontSize: 13,
    color: TOKENS.dark,
    padding: 0,
  },
  refillSubmitBtnInline: {
    height: 34,
    backgroundColor: TOKENS.success,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  refillSubmitBtnInlineText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  refillInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  refillCurrentStockLabel: {
    fontSize: 12,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  refillCurrentStockValue: {
    fontSize: 13,
    color: TOKENS.dark,
    fontWeight: "bold",
  },
});
