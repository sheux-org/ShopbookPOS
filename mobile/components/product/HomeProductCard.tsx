import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ProductImage } from '../common/ProductImage';
import { TOKENS } from '../../constants/tokens';
import { useCartQtyForProduct } from '../../hooks/useCartQtyForProduct';
import { getCartAdjustedStock } from '../../utils/stockDisplay';
import { cartState } from '../data/cartState';
import { hapticFeedback } from '../../utils/haptics';
import type { DBProduct } from '../../hooks/useProducts';

interface HomeProductCardProps {
  item: DBProduct;
  onAdded: (message: string) => void;
  onFavorite: (id: string) => void;
}

export const HomeProductCard = React.memo(function HomeProductCard({
  item,
  onAdded,
  onFavorite,
}: HomeProductCardProps) {
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
            style={{ width: '100%', height: 110 }}
          >
            <ProductImage
              icon={item.icon}
              category={item.category}
              style={{ width: '100%', height: 110, borderRadius: 0 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.impactLight();
              onFavorite(item.id);
            }}
            style={styles.heartBtnWrapper}
          >
            <Ionicons
              name={item.isFavorite ? 'heart' : 'heart-outline'}
              size={15}
              color={item.isFavorite ? TOKENS.error : TOKENS.muted}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity activeOpacity={0.8} onPress={handleAdd} style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.priceStockRow}>
            <Text style={styles.productPrice}>Rs. {item.price}</Text>
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

              <View style={[styles.plusIconBadge, stockType === 'out' && styles.plusIconBadgeOut]}>
                <Feather
                  name="plus"
                  size={20}
                  color={stockType === 'out' ? TOKENS.muted : TOKENS.card}
                />
              </View>
            </View>
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
    height: 110,
    backgroundColor: '#F3F4F6',
  },
  heartBtnWrapper: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 1px 0px rgba(0, 0, 0, 0.1)',
  },
  productDetails: {
    padding: 12,
    gap: 4,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.dark,
    lineHeight: 16,
  },
  priceStockRow: {
    marginTop: 4,
    gap: 2,
  },
  productPrice: {
    fontSize: 14,
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
    fontSize: 11,
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
    width: 40,
    height: 30,
    borderRadius: 15,
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 2px 4px 0px ${TOKENS.primary}59`,
  },
  plusIconBadgeOut: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
});
