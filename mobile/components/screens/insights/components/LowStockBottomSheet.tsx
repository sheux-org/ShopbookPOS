import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from '../../../common/BottomSheet';
import { styles } from '../styles';
import { useTranslation } from '../../../../hooks/useTranslation';

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
  const { t } = useTranslation();

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('insights.lowStockTitle')}>
      <Text style={styles.lowStockModalSubtitle}>{t('insights.lowStockSubtitle')}</Text>

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
                {t('insights.outOfStockHeader', { count: String(outOfStockItems.length) })}
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
                  <Text style={[styles.lowStockCountText, { color: '#FFFFFF' }]}>
                    {t('insights.zeroLeft')}
                  </Text>
                  <Text style={[styles.lowStockLimitText, { color: '#FEE2E2' }]}>
                    {t('insights.outOfStockBadge')}
                  </Text>
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
                {t('insights.lowStockHeader', { count: String(lowStockItems.length) })}
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
                  <Text style={styles.lowStockCountText}>
                    {item.stockCount} {t('insights.leftLabel')}
                  </Text>
                  <Text style={styles.lowStockLimitText}>
                    {t('insights.alertThreshold', { threshold: String(item.lowStockAlert) })}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {isEmpty && (
          <View style={styles.emptyLowStockState}>
            <Feather name="check-circle" size={32} color="#10B981" />
            <Text style={styles.emptyLowStockText}>{t('insights.allStockedText')}</Text>
          </View>
        )}
      </ScrollView>
    </BottomSheet>
  );
};
