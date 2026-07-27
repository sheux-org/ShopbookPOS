import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../../../common/BottomSheet';
import { styles } from '../styles';

interface LowStockBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  lowStockItems: any[] | undefined;
  outOfStockItems?: any[] | undefined;
}

export const LowStockBottomSheet: React.FC<LowStockBottomSheetProps> = ({
  visible,
  onClose,
  lowStockItems,
  outOfStockItems,
}) => {
  const hasOutOfStock = outOfStockItems && outOfStockItems.length > 0;
  const hasLowStock = lowStockItems && lowStockItems.length > 0;
  const isEmpty = !hasOutOfStock && !hasLowStock;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Inventory Stock Alerts">
      <Text style={styles.lowStockModalSubtitle}>
        Review items that are completely out of stock or running low on inventory:
      </Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[styles.lowStockItemsScroll, { maxHeight: 380 }]}
        contentContainerStyle={{ gap: 12, paddingVertical: 10 }}
      >
        {/* Out of Stock Section */}
        {hasOutOfStock && (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#EF4444' }}>
                Out of Stock ({outOfStockItems.length})
              </Text>
            </View>
            {outOfStockItems.map((item: any) => (
              <View
                key={item.id}
                style={[
                  styles.lowStockItemRow,
                  { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
                ]}
              >
                <View style={[styles.lowStockIconWrapper, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={{ fontSize: 16 }}>{item.icon || '📦'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lowStockItemName, { color: '#991B1B' }]}>{item.name}</Text>
                  <Text style={styles.lowStockItemSku}>SKU: {item.sku}</Text>
                </View>
                <View style={[styles.lowStockCountBadge, { backgroundColor: '#EF4444' }]}>
                  <Text style={[styles.lowStockCountText, { color: '#FFFFFF' }]}>0 Left</Text>
                  <Text style={[styles.lowStockLimitText, { color: '#FEE2E2' }]}>Out of Stock</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Low Stock Warning Section */}
        {hasLowStock && (
          <View style={{ gap: 8, marginTop: hasOutOfStock ? 6 : 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Feather name="alert-triangle" size={14} color="#F59E0B" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#D97706' }}>
                Low Stock Warnings ({lowStockItems.length})
              </Text>
            </View>
            {lowStockItems.map((item: any) => (
              <View key={item.id} style={styles.lowStockItemRow}>
                <View style={styles.lowStockIconWrapper}>
                  <Text style={{ fontSize: 16 }}>{item.icon || '📦'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lowStockItemName}>{item.name}</Text>
                  <Text style={styles.lowStockItemSku}>SKU: {item.sku}</Text>
                </View>
                <View style={styles.lowStockCountBadge}>
                  <Text style={styles.lowStockCountText}>{item.stockCount} left</Text>
                  <Text style={styles.lowStockLimitText}>
                    Alert Threshold: {item.lowStockAlert}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {isEmpty && (
          <View style={styles.emptyLowStockState}>
            <Feather name="check-circle" size={32} color="#10B981" />
            <Text style={styles.emptyLowStockText}>All products are sufficiently stocked!</Text>
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
};
