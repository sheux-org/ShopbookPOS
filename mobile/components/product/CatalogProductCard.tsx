import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ProductImage } from '../common/ProductImage';
import { TOKENS } from '../../constants/tokens';
import { useCartQtyForProduct } from '../../hooks/useCartQtyForProduct';
import { getCartAdjustedStock } from '../../utils/stockDisplay';
import { cartState } from '../data/cartState';
import { hapticFeedback } from '../../utils/haptics';
import type { DBProduct } from '../../hooks/useProducts';

interface CatalogProductCardProps {
  item: DBProduct;
  isTablet: boolean;
  onAdded: (message: string) => void;
}

export const CatalogProductCard = React.memo(function CatalogProductCard({
  item,
  isTablet,
  onAdded,
}: CatalogProductCardProps) {
  const cartQty = useCartQtyForProduct(item.name);
  const { stockType, stockText } = getCartAdjustedStock(item, cartQty);

  const handleAdd = useCallback(() => {
    if (stockType === 'out') {
      hapticFeedback.notificationWarning();
      onAdded('Product is out of stock!');
      return;
    }
    hapticFeedback.impactLight();
    cartState.addCartItem(item.name, item.price, item.icon, `SKU 23400${item.id}`, item.stockCount);
    onAdded(`Added ${item.name} to active invoice`);
  }, [item, stockType, onAdded]);

  return (
    <View style={{ flex: 1, padding: 6 }}>
      <View style={styles.productCard}>
        <View style={styles.imageContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleAdd}
            style={{ width: '100%', height: 100 }}
          >
            <ProductImage
              icon={item.icon}
              category={item.category}
              recyclingKey={item.id}
              style={{ width: '100%', height: 100, borderRadius: 0 }}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={handleAdd} style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.priceStockRow}>
            <Text style={styles.productPrice}>Rs. {item.price}</Text>
            {isTablet ? (
              <View style={styles.stockPlusRow}>
                <Text
                  style={[
                    styles.stockText,
                    stockType === 'low' && styles.stockTextLow,
                    stockType === 'out' && styles.stockTextOut,
                  ]}
                >
                  {stockText}
                </Text>
                <View
                  style={[styles.plusIconBadge, stockType === 'out' && styles.plusIconBadgeOut]}
                >
                  <Feather
                    name="plus"
                    size={16}
                    color={stockType === 'out' ? TOKENS.muted : TOKENS.card}
                  />
                  <Text
                    style={[
                      styles.plusIconBadgeText,
                      stockType === 'out' && styles.plusIconBadgeTextOut,
                    ]}
                  >
                    Add
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.mobileStockPlusColumn}>
                <Text
                  style={[
                    styles.stockText,
                    stockType === 'low' && styles.stockTextLow,
                    stockType === 'out' && styles.stockTextOut,
                  ]}
                >
                  {stockText}
                </Text>
                <View
                  style={[
                    styles.mobilePlusIconBadge,
                    stockType === 'out' && styles.mobilePlusIconBadgeOut,
                  ]}
                >
                  <Feather
                    name="plus"
                    size={15}
                    color={stockType === 'out' ? TOKENS.muted : TOKENS.card}
                  />
                  <Text
                    style={[
                      styles.mobilePlusIconBadgeText,
                      stockType === 'out' && styles.mobilePlusIconBadgeTextOut,
                    ]}
                  >
                    Add
                  </Text>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  productCard: {
    flex: 1,
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    justifyContent: 'space-between',
    overflow: 'hidden',
    boxShadow: '0px 2px 3px 0px rgba(0, 0, 0, 0.04)',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
    backgroundColor: '#F3F4F6',
  },
  productDetails: {
    padding: 10,
    gap: 4,
  },
  productName: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.dark,
    lineHeight: 14,
  },
  priceStockRow: {
    marginTop: 4,
    gap: 2,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.primary,
  },
  stockPlusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  stockText: {
    fontSize: 10,
    color: TOKENS.muted,
  },
  stockTextLow: {
    color: TOKENS.warning,
    fontWeight: '600',
  },
  stockTextOut: {
    color: TOKENS.error,
    fontWeight: '600',
  },
  plusIconBadge: {
    flexDirection: 'row',
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    boxShadow: `0px 2px 4px 0px ${TOKENS.primary}59`,
  },
  plusIconBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: TOKENS.card,
  },
  plusIconBadgeTextOut: {
    color: TOKENS.muted,
  },
  plusIconBadgeOut: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  mobileStockPlusColumn: {
    marginTop: 4,
    gap: 4,
  },
  mobilePlusIconBadge: {
    flexDirection: 'row',
    width: '100%',
    height: 28,
    borderRadius: 14,
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    gap: 4,
    boxShadow: `0px 2px 3px 0px ${TOKENS.primary}33`,
  },
  mobilePlusIconBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TOKENS.card,
  },
  mobilePlusIconBadgeTextOut: {
    color: TOKENS.muted,
  },
  mobilePlusIconBadgeOut: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
});
