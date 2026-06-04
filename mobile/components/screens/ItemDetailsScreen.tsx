import React, { useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { TOKENS } from '../../constants/tokens';
import { useGetStockHistory, useStockInProduct, useProduct } from '../../hooks/useProducts';
import { ProductImage } from '../common/ProductImage';
import { ScreenWrapper } from '../common/ScreenWrapper';
import { syncDatabase } from '../../services/sync';

export const ItemDetailsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  // Form states
  const [stockInQty, setStockInQty] = useState('');
  const [activeReasonChip, setActiveReasonChip] = useState('Restock');
  const [customReasonText, setCustomReasonText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data: product, isLoading: isProductLoading } = useProduct(id);
  const {
    data: stockHistory = [],
    isLoading: isHistoryLoading,
    fetchNextPage: fetchNextHistory,
    hasNextPage: hasNextHistory,
    isFetchingNextPage: isFetchingNextHistory,
  } = useGetStockHistory(id || '');

  const stockInMutation = useStockInProduct();

  const processedStockHistory = useMemo(() => {
    if (!product || !stockHistory) return [];

    let runningBalance = product.stockCount;
    // Map logs to include calculated running balances (walking backward since history is newest to oldest)
    const logsWithBalances = stockHistory.map((log) => {
      const newBalance = runningBalance;
      let prevBalance = runningBalance;
      if (log.type === 'in') {
        prevBalance = runningBalance - log.quantity;
      } else if (log.type === 'out') {
        prevBalance = runningBalance + log.quantity;
      }
      runningBalance = prevBalance;
      return {
        ...log,
        prevBalance,
        newBalance,
      };
    });

    // If there's remaining running balance > 0 (or no logs at all but positive stockCount),
    // append a virtual Initial Stock log
    if (!hasNextHistory && runningBalance > 0) {
      logsWithBalances.push({
        id: `virtual-initial-stock-${product.id}`,
        productId: product.id,
        type: 'in',
        quantity: runningBalance,
        reason: 'Initial Stock',
        createdAt: product.createdAt
          ? new Date(product.createdAt).getTime()
          : stockHistory.length > 0
            ? stockHistory[stockHistory.length - 1].createdAt - 1000
            : Date.now(),
        prevBalance: 0,
        newBalance: runningBalance,
        isVirtual: true,
      } as any);
    }

    return logsWithBalances;
  }, [product, stockHistory, hasNextHistory]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  };

  const handleStockIn = () => {
    if (!product) return;
    const qtyNum = parseInt(stockInQty, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }

    const finalReason = customReasonText.trim() || activeReasonChip;

    stockInMutation.mutate(
      {
        productId: product.id,
        quantity: qtyNum,
        reason: finalReason,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['product', product.id] });
          triggerToast('Stock updated successfully! 📦');
          setStockInQty('');
          setActiveReasonChip('Restock');
          setCustomReasonText('');
          // Immediately trigger background sync
          syncDatabase().catch((err) => console.error('Sync failed:', err));
        },
        onError: () => {
          Alert.alert('Error', 'Failed to update product stock.');
        },
      }
    );
  };

  if (isProductLoading) {
    return (
      <ScreenWrapper withKeyboard style={styles.container}>
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={TOKENS.primary} />
          <Text style={styles.loaderText}>Loading product details...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  if (!product) {
    return (
      <ScreenWrapper withKeyboard style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            activeOpacity={0.7}
            onPress={() => router.back()}
          >
            <Feather name="chevron-left" size={22} color={TOKENS.dark} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrapper}>
            <Text style={styles.headerTitle}>Item Details</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <Feather name="alert-circle" size={48} color={TOKENS.error} />
          <Text style={styles.emptyTitle}>Product Not Found</Text>
          <Text style={styles.emptySub}>
            The requested product details could not be found or has been deleted.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  const sections = [
    {
      title: 'Inventory Transaction History',
      subtitle: 'History of stock inflows and sales transactions.',
      data: processedStockHistory,
    },
  ];

  return (
    <ScreenWrapper withKeyboard noPaddingBottom style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Main Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Item Details</Text>
          <Text style={styles.headerSubtitle}>Product details & stock history</Text>
        </View>
      </View>

      {/* Main scrollable area structured with SectionList for sticky section headers */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={true}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
        ListHeaderComponent={
          <View style={styles.sheetHeaderWrapper}>
            {/* 1. Product Details Card with 3px Spacing Top/Left/Bottom */}
            <View style={styles.sheetProductCard}>
              <ProductImage
                icon={product.icon}
                category={product.category}
                size={74}
                style={styles.sheetProductImage}
              />
              <View style={styles.sheetProductMeta}>
                <Text style={styles.sheetProductName} numberOfLines={2}>
                  {product.name}
                </Text>
                <View style={styles.sheetProductBadges}>
                  <View style={[styles.codePill, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={[styles.codeText, { color: TOKENS.primary }]}>
                      {product.category.toUpperCase()}
                    </Text>
                  </View>
                  {product.quickCode ? (
                    <View style={styles.codePill}>
                      <Text style={styles.codeText}>Code: {product.quickCode}</Text>
                    </View>
                  ) : null}
                  {product.barcode ? (
                    <View style={[styles.codePill, { backgroundColor: '#F1F5F9' }]}>
                      <Text style={styles.codeText}>Barcode: {product.barcode}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.sheetPricesRow}>
                  <View style={styles.sheetPriceColumn}>
                    <Text style={styles.sheetPriceLabel}>Selling Price</Text>
                    <Text style={styles.sheetPriceVal}>Rs. {product.price.toLocaleString()}</Text>
                  </View>
                  {product.costPrice ? (
                    <View style={styles.sheetPriceColumn}>
                      <Text style={styles.sheetPriceLabel}>Cost Price</Text>
                      <Text style={styles.sheetPriceValSec}>
                        Rs. {product.costPrice.toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* 2. Stock Indicator Status Panel */}
            <View style={styles.sheetStatusPanel}>
              <View style={styles.statusPanelCol}>
                <Text style={styles.statusPanelLabel}>Current Inventory</Text>
                <Text style={styles.statusPanelCount}>
                  {product.stockCount}{' '}
                  <Text style={styles.statusPanelUnit}>{product.unitType || 'pcs'}</Text>
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  product.stockType === 'low' && styles.statusPillWarning,
                  product.stockType === 'out' && styles.statusPillError,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    product.stockType === 'low' && { backgroundColor: TOKENS.warning },
                    product.stockType === 'out' && { backgroundColor: TOKENS.error },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    product.stockType === 'low' && { color: TOKENS.warning },
                    product.stockType === 'out' && { color: TOKENS.error },
                  ]}
                >
                  {product.stockText}
                </Text>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.sectionDivider} />

            {/* 3. Manual Stock In Form */}
            <View style={styles.stockAdjustmentForm}>
              <Text style={styles.sectionTitle}>Manual Stock In (Add Stock)</Text>
              <Text style={styles.sectionSubtitle}>
                Increment the count of this product in your catalog.
              </Text>

              <View style={styles.stockInRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Quantity to Add *</Text>
                  <View style={styles.inputWithSuffix}>
                    <TextInput
                      style={styles.suffixInput}
                      placeholder="e.g. 10"
                      keyboardType="numeric"
                      value={stockInQty}
                      onChangeText={setStockInQty}
                      placeholderTextColor="#A0AEC0"
                    />
                    <View style={styles.suffixContainer}>
                      <Text style={styles.suffixText}>{product.unitType || 'pcs'}</Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.fieldRow, { marginTop: 10 }]}>
                <Text style={styles.fieldLabel}>Reason for Adjustment</Text>

                {/* Adjustment reason chips with emerald highlight states */}
                <View style={styles.suggestionChips}>
                  {[
                    { name: 'Restock', icon: 'refresh-cw' },
                    { name: 'Supplier Order', icon: 'truck' },
                    { name: 'Inventory Correction', icon: 'alert-circle' },
                    { name: 'Customer Return', icon: 'corner-up-left' },
                  ].map((item) => {
                    const isChipSelected = activeReasonChip === item.name;
                    return (
                      <TouchableOpacity
                        key={item.name}
                        style={[
                          styles.suggestionChip,
                          isChipSelected && styles.suggestionChipActive,
                        ]}
                        activeOpacity={0.7}
                        onPress={() => {
                          setActiveReasonChip(item.name);
                          setCustomReasonText('');
                        }}
                      >
                        <Feather
                          name={item.icon as any}
                          size={12}
                          color={isChipSelected ? '#059669' : '#64748B'}
                        />
                        <Text
                          style={[
                            styles.suggestionChipText,
                            isChipSelected && styles.suggestionChipTextActive,
                          ]}
                        >
                          {item.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.formInput}
                  placeholder="Or enter a custom reason..."
                  value={customReasonText}
                  onChangeText={setCustomReasonText}
                  placeholderTextColor="#A0AEC0"
                />
              </View>

              <TouchableOpacity
                style={[styles.stockInSubmitBtn, stockInMutation.isPending && { opacity: 0.7 }]}
                activeOpacity={0.8}
                onPress={handleStockIn}
                disabled={stockInMutation.isPending}
              >
                {stockInMutation.isPending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="plus-circle" size={16} color="#FFFFFF" />
                    <Text style={styles.stockInSubmitBtnText}>Perform Stock In</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.sectionDivider} />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.stickyHeaderContainer}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
          </View>
        )}
        renderItem={({ item: log }) => {
          const isAddition = log.type === 'in';
          const formattedDate = new Date(log.createdAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <View style={styles.logCard}>
              {/* Left Column: Icon Squircle */}
              <View
                style={[
                  styles.logIconContainer,
                  isAddition ? styles.logIconContainerIn : styles.logIconContainerOut,
                ]}
              >
                <Feather
                  name={isAddition ? 'arrow-down-left' : 'arrow-up-right'}
                  size={20}
                  color={isAddition ? '#059669' : '#EF4444'}
                />
              </View>

              {/* Middle Column: Reason + Metadata Inline Row */}
              <View style={styles.logMeta}>
                <Text style={styles.logReasonText} numberOfLines={1}>
                  {log.reason || (isAddition ? 'Manual stock-in' : 'Checkout sale')}
                </Text>
                <View style={styles.logDetailsRow}>
                  <Text
                    style={[
                      styles.logTypeTag,
                      isAddition ? styles.logTypeTagIn : styles.logTypeTagOut,
                    ]}
                  >
                    {isAddition ? 'Stock In' : 'Sale'}
                  </Text>
                  <Text style={styles.logSeparatorDot}>•</Text>
                  <View style={styles.logDateRow}>
                    <Feather name="clock" size={11} color={TOKENS.muted} />
                    <Text style={styles.logDateText}>{formattedDate}</Text>
                  </View>
                </View>
                <View style={styles.logBalanceRow}>
                  <Text style={styles.logBalanceLabel}>Balance: </Text>
                  <Text style={styles.logBalanceValue}>
                    {log.reason === 'Initial Stock'
                      ? `${log.newBalance} ${product.unitType || 'pcs'}`
                      : `${log.prevBalance} → ${log.newBalance} ${product.unitType || 'pcs'}`}
                  </Text>
                </View>
              </View>

              {/* Right Column: Qty and Unit */}
              <View style={styles.logQtyCol}>
                <Text
                  style={[
                    styles.logQtyText,
                    isAddition ? styles.logQtyTextIn : styles.logQtyTextOut,
                  ]}
                >
                  {isAddition ? '+' : '-'}
                  {log.quantity}
                </Text>
                <Text style={styles.logUnitText}>{product.unitType || 'pcs'}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyLogsWrap}>
            {isHistoryLoading ? (
              <ActivityIndicator size="small" color={TOKENS.primary} />
            ) : (
              <>
                <Feather name="file-text" size={32} color="#CBD5E1" />
                <Text style={styles.emptyLogsTitle}>No Transaction History</Text>
                <Text style={styles.emptyLogsSubtitle}>
                  This item has no recorded inventory adjustments or sales transactions yet.
                </Text>
              </>
            )}
          </View>
        }
        onEndReached={() => {
          if (hasNextHistory) {
            fetchNextHistory();
          }
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isFetchingNextHistory ? (
            <ActivityIndicator size="small" color={TOKENS.primary} style={{ marginVertical: 16 }} />
          ) : null
        }
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  toastContainer: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    backgroundColor: TOKENS.success,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.15)',
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
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
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 1,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loaderText: {
    fontSize: 14,
    color: TOKENS.muted,
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  emptySub: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 24,
  },
  sheetHeaderWrapper: {
    gap: 8,
    padding: 16,
    paddingBottom: 0,
  },
  sheetProductCard: {
    flexDirection: 'row',
    backgroundColor: TOKENS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingRight: 16,
    paddingLeft: 3,
    paddingTop: 3,
    paddingBottom: 3,
    gap: 12,
    alignItems: 'center',
  },
  sheetProductImage: {
    width: 74,
    height: 74,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  sheetProductMeta: {
    flex: 1,
    gap: 2,
  },
  sheetProductName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  sheetProductBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 0,
  },
  codePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 10,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  sheetPricesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  sheetPriceColumn: {
    flex: 1,
  },
  sheetPriceLabel: {
    fontSize: 10,
    color: TOKENS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetPriceVal: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.primary,
  },
  sheetPriceValSec: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.dark,
  },
  sheetStatusPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statusPanelCol: {
    gap: 2,
  },
  statusPanelLabel: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  statusPanelCount: {
    fontSize: 18,
    fontWeight: '800',
    color: TOKENS.dark,
  },
  statusPanelUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: TOKENS.muted,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillWarning: {
    backgroundColor: '#FFFBEB',
  },
  statusPillError: {
    backgroundColor: '#FEF2F2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TOKENS.success,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.success,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  stockAdjustmentForm: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginBottom: 6,
  },
  stockInRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldRow: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.dark,
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    height: 38,
    overflow: 'hidden',
  },
  suffixInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 13,
    color: TOKENS.dark,
  },
  suffixContainer: {
    backgroundColor: '#F1F5F9',
    height: '100%',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: TOKENS.border,
  },
  suffixText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  suggestionChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  suggestionChipText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  suggestionChipTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  formInput: {
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 12,
    fontSize: 13,
    color: TOKENS.dark,
  },
  stockInSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: TOKENS.success,
    height: 40,
    borderRadius: 8,
    marginTop: 12,
  },
  stockInSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  stickyHeaderContainer: {
    backgroundColor: TOKENS.background,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 16,
    backgroundColor: TOKENS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginHorizontal: 16,
    marginVertical: 4,
    gap: 12,
    boxShadow: '0px 2px 6px 0px rgba(0, 0, 0, 0.02)',
  },
  logIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logIconContainerIn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#D1FAE5',
  },
  logIconContainerOut: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  logMeta: {
    flex: 1,
    gap: 3,
  },
  logReasonText: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.dark,
    lineHeight: 18,
  },
  logDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logTypeTag: {
    fontSize: 11,
    fontWeight: '600',
  },
  logTypeTagIn: {
    color: '#059669',
  },
  logTypeTagOut: {
    color: '#EF4444',
  },
  logSeparatorDot: {
    fontSize: 10,
    color: TOKENS.muted,
  },
  logDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  logDateText: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  logQtyCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 60,
  },
  logQtyText: {
    fontSize: 15,
    fontWeight: '700',
  },
  logQtyTextIn: {
    color: '#059669',
  },
  logQtyTextOut: {
    color: '#EF4444',
  },
  logUnitText: {
    fontSize: 10,
    color: TOKENS.muted,
    marginTop: 1,
  },
  logBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  logBalanceLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: '500',
  },
  logBalanceValue: {
    fontSize: 11,
    color: TOKENS.dark,
    fontWeight: '600',
  },
  emptyLogsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyLogsTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  emptyLogsSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
  },
});
