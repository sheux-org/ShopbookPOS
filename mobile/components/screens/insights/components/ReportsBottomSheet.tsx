import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { BottomSheet } from '../../../common/BottomSheet';
import { ProductImage } from '../../../common/ProductImage';
import { useStockInProduct } from '../../../../hooks/useProducts';
import { TOKENS } from '../../../../constants/tokens';
import { styles } from '../styles';
import { OrderItemsList, OrderCardHeaderRight } from './OrderHistoryHelpers';

interface ReportsBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  periodOrdersList: any[];
  hasNextPeriodOrders: boolean;
  fetchNextPeriodOrders: () => void;
  isFetchingNextPeriodOrders: boolean;
  productsList: any[];
  hasNextProducts: boolean;
  fetchNextProducts: () => void;
  isFetchingNextProducts: boolean;
}

export const ReportsBottomSheet: React.FC<ReportsBottomSheetProps> = ({
  visible,
  onClose,
  periodOrdersList,
  hasNextPeriodOrders,
  fetchNextPeriodOrders,
  isFetchingNextPeriodOrders,
  productsList,
  hasNextProducts,
  fetchNextProducts,
  isFetchingNextProducts,
}) => {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { height: windowHeight } = useWindowDimensions();

  const [reportsActiveTab, setReportsActiveTab] = useState<'orders' | 'inventory'>('orders');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [refillValues, setRefillValues] = useState<Record<string, string>>({});

  const stockInMutation = useStockInProduct();

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Reports & Management"
      maxHeight={windowHeight * 0.88}
    >
      <View style={{ height: windowHeight * 0.88 - 75 }}>
        {/* Premium Subheader Tabs */}
        <View style={styles.modalTabsRow}>
          <TouchableOpacity
            style={[styles.modalTab, reportsActiveTab === 'orders' && styles.modalTabActive]}
            onPress={() => setReportsActiveTab('orders')}
          >
            <Feather
              name="list"
              size={14}
              color={reportsActiveTab === 'orders' ? TOKENS.primary : TOKENS.muted}
            />
            <Text
              style={[
                styles.modalTabText,
                reportsActiveTab === 'orders' && styles.modalTabTextActive,
              ]}
            >
              Order History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalTab, reportsActiveTab === 'inventory' && styles.modalTabActive]}
            onPress={() => setReportsActiveTab('inventory')}
          >
            <Feather
              name="plus-circle"
              size={14}
              color={reportsActiveTab === 'inventory' ? TOKENS.primary : TOKENS.muted}
            />
            <Text
              style={[
                styles.modalTabText,
                reportsActiveTab === 'inventory' && styles.modalTabTextActive,
              ]}
            >
              Stock-In Refills
            </Text>
          </TouchableOpacity>
        </View>

        {/* TAB CONTENT: ORDER HISTORY */}
        {reportsActiveTab === 'orders' && (
          <FlashList
            data={periodOrdersList}
            keyExtractor={(item) => item.id}
            onEndReached={() => {
              if (hasNextPeriodOrders) {
                fetchNextPeriodOrders();
              }
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isFetchingNextPeriodOrders ? (
                <ActivityIndicator
                  size="small"
                  color={TOKENS.primary}
                  style={{ marginVertical: 16 }}
                />
              ) : null
            }
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
                    onPress={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyInvoiceNum}>Invoice #{order.invoiceNumber}</Text>
                      <Text style={styles.historyDateText}>
                        {orderDate.toLocaleDateString()} at {orderDate.toLocaleTimeString()}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.historyTotalAmount}>
                        Rs. {order.totalAmount.toLocaleString()}
                      </Text>
                      <OrderCardHeaderRight orderId={order.id} isExpanded={isExpanded} />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.historyItemsExpandedPanel}>
                      <View style={styles.expandedDivider} />
                      <OrderItemsList orderId={order.id} />
                    </View>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={localStyles.emptyStateContainer}>
                <Feather name="file-text" size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
                <Text style={localStyles.emptyStateTitle}>No invoices found</Text>
                <Text style={localStyles.emptyStateSubtitle}>
                  No sales invoices recorded for this active branch during this period.
                </Text>
              </View>
            }
          />
        )}

        {/* TAB CONTENT: STOCK-IN INVENTORY REFILL */}
        {reportsActiveTab === 'inventory' && (
          <FlashList
            data={productsList}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1, marginTop: 10 }}
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 24 }}
            onEndReached={() => {
              if (hasNextProducts) {
                fetchNextProducts();
              }
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isFetchingNextProducts ? (
                <ActivityIndicator
                  size="small"
                  color={TOKENS.primary}
                  style={{ marginVertical: 16 }}
                />
              ) : null
            }
            ListHeaderComponent={
              <Text style={styles.refillSectionLabel}>
                Select a product below to refill / Stock-In units:
              </Text>
            }
            renderItem={({ item: prod }) => {
              const isExpanded = expandedProductId === prod.id;
              const val = refillValues[prod.id] || '';
              return (
                <View style={styles.historyOrderCard}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={styles.refillCardHeader}
                    onPress={() => setExpandedProductId(isExpanded ? null : prod.id)}
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
                        Code: {prod.quickCode || prod.sku || '—'} | Price: Rs. {prod.price}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text
                        style={[
                          styles.refillStockCount,
                          prod.stockCount <= 5 && { color: TOKENS.error },
                        ]}
                      >
                        Stock: {prod.stockCount}
                      </Text>
                      <Feather
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
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
                                'Invalid Quantity',
                                'Please enter a valid stock refill quantity!'
                              );
                              return;
                            }
                            stockInMutation.mutate(
                              {
                                productId: prod.id,
                                quantity: refillAmt,
                                reason: 'Restock',
                              },
                              {
                                onSuccess: () => {
                                  queryClient.invalidateQueries({ queryKey: ['insights'] });
                                  Alert.alert(
                                    'Stock In success',
                                    'Product stock refilled successfully!'
                                  );
                                  // Reset expanded refill values
                                  setRefillValues({});
                                  setExpandedProductId(null);
                                },
                                onError: (err: any) => {
                                  Alert.alert('Refill Failed', err.message);
                                },
                              }
                            );
                          }}
                        >
                          {stockInMutation.isPending ? (
                            <ActivityIndicator
                              size="small"
                              color="#fff"
                              style={{ marginRight: 4 }}
                            />
                          ) : (
                            <>
                              <Feather name="plus-circle" size={14} color="#fff" />
                              <Text style={styles.refillSubmitBtnInlineText}>Stock-In</Text>
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
              <View style={localStyles.emptyStateContainer}>
                <Feather name="package" size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
                <Text style={localStyles.emptyStateTitle}>No products found</Text>
                <Text style={localStyles.emptyStateSubtitle}>
                  Add some products in Catalog or Refill screens first.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </BottomSheet>
  );
};

const localStyles = StyleSheet.create({
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
    marginTop: 32,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.dark,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
