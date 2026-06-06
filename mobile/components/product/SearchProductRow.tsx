import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ProductImage } from '../common/ProductImage';
import { TOKENS } from '../../constants/tokens';
import { useCartQtyForProduct } from '../../hooks/useCartQtyForProduct';
import { getCartAdjustedStock } from '../../utils/stockDisplay';
import { cartState } from '../data/cartState';
import type { DBProduct } from '../../hooks/useProducts';

interface SearchProductRowProps {
  item: DBProduct;
  onAdded: (message: string) => void;
}

export const SearchProductRow = React.memo(function SearchProductRow({
  item,
  onAdded,
}: SearchProductRowProps) {
  const cartQty = useCartQtyForProduct(item.name);
  const { stockType, stockText } = getCartAdjustedStock(item, cartQty);

  const handleAdd = useCallback(() => {
    if (stockType === 'out') {
      onAdded('Product is out of stock!');
      return;
    }
    cartState.addCartItem(item.name, item.price, item.icon, `SKU 23400${item.id}`, item.stockCount);
    onAdded(`Added ${item.name} to active invoice`);
  }, [item, stockType, onAdded]);

  return (
    <View style={styles.resultItemRow}>
      <ProductImage icon={item.icon} category={item.category} size={42} style={styles.iconBox} />

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
          {stockType === 'low' ? (
            <Text style={styles.stockLowText}>{stockText}</Text>
          ) : stockType === 'out' ? (
            <Text style={styles.stockOutText}>{stockText}</Text>
          ) : (
            <Text style={styles.stockNormalText}>{stockText}</Text>
          )}
        </View>
      </View>

      <View style={styles.rightActionsCol}>
        <Text style={styles.itemPrice}>Rs. {item.price.toLocaleString()}</Text>

        <TouchableOpacity
          style={[styles.addButton, stockType === 'out' && styles.addButtonDisabled]}
          activeOpacity={stockType === 'out' ? 1 : 0.8}
          onPress={handleAdd}
        >
          <Feather
            name={stockType === 'out' ? 'alert-circle' : 'plus'}
            size={12}
            color={stockType === 'out' ? TOKENS.muted : TOKENS.primary}
            style={styles.plusIcon}
          />
          <Text style={[styles.addButtonText, stockType === 'out' && styles.addButtonTextDisabled]}>
            {stockType === 'out' ? 'Out' : 'Add'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  resultItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
  },
  iconBox: {
    borderRadius: 8,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.dark,
    marginBottom: 2,
  },
  skuStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  skuText: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  dividerDot: {
    fontSize: 11,
    color: TOKENS.muted,
    marginHorizontal: 4,
  },
  stockNormalText: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  stockLowText: {
    fontSize: 11,
    color: TOKENS.warning,
    fontWeight: '600',
  },
  stockOutText: {
    fontSize: 11,
    color: TOKENS.error,
    fontWeight: '600',
  },
  rightActionsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: TOKENS.primary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.primary,
    gap: 4,
  },
  addButtonDisabled: {
    borderColor: TOKENS.border,
    backgroundColor: '#F3F4F6',
  },
  plusIcon: {
    marginRight: 2,
  },
  addButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.primary,
  },
  addButtonTextDisabled: {
    color: TOKENS.muted,
  },
});
