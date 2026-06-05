import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ScreenWrapper } from '../common/ScreenWrapper';
import { HeaderCartButton } from '../common/HeaderCartButton';
import { TOKENS } from '../../constants/tokens';
import { cartState } from '../data/cartState';
import { useProducts } from '../../hooks/useProducts';
import { ProductImage } from '../common/ProductImage';
import { hapticFeedback } from '../../utils/haptics';
import { getBusinessTypeConfig, getCategoryLabel } from '../../utils/businessTypeConfig';
import { useQuery } from '@tanstack/react-query';
import database from '../data/db';
import { Q } from '@nozbe/watermelondb';

interface CatalogProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
  stockText: string;
  stockType: 'normal' | 'low' | 'out';
  stockCount?: number;
}

interface CategoryItem {
  id: string;
  label: string;
  icon: string;
  count: number;
}

function getCategoryIcon(category: string): string {
  const cat = category.toLowerCase().trim();
  if (cat === 'all') return 'archive-outline';
  if (cat.includes('grocer')) return 'cart-outline';
  if (cat.includes('dai')) return 'water-outline';
  if (cat.includes('drink') || cat.includes('bev')) return 'wine-outline';
  if (cat.includes('snack') || cat.includes('dessert') || cat.includes('bake'))
    return 'fast-food-outline';
  if (cat.includes('house') || cat.includes('clean') || cat.includes('personal'))
    return 'home-outline';
  if (cat.includes('cloth') || cat.includes('foot') || cat.includes('bouti'))
    return 'shirt-outline';
  if (
    cat.includes('tool') ||
    cat.includes('hard') ||
    cat.includes('elect') ||
    cat.includes('plumb')
  )
    return 'construct-outline';
  if (cat.includes('med') || cat.includes('phar') || cat.includes('vit')) return 'bandage-outline';
  if (
    cat.includes('salon') ||
    cat.includes('cut') ||
    cat.includes('style') ||
    cat.includes('treat') ||
    cat.includes('mani') ||
    cat.includes('pedi')
  )
    return 'cut-outline';
  if (cat.includes('coffee') || cat.includes('tea')) return 'cafe-outline';
  return 'cube-outline';
}

export const CatalogScreen: React.FC = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width > 768;

  const activeBiz = cartState.getActiveBusiness();
  const config = getBusinessTypeConfig(activeBiz?.category);

  // Fetch all products to compute counts dynamically
  const { data: allProducts = [] } = useQuery({
    queryKey: ['all-products-for-count', activeBiz?.id],
    queryFn: async () => {
      if (!activeBiz?.id) return [];
      return database.get('products').query(Q.where('business_id', activeBiz.id)).fetch();
    },
  });

  const categoryCounts = React.useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    allProducts.forEach((p: any) => {
      const cat = (p.category || '').toLowerCase().trim();
      map[cat] = (map[cat] || 0) + 1;
      total++;
    });
    return { map, total };
  }, [allProducts]);

  const CATEGORIES = React.useMemo(() => {
    const list: CategoryItem[] = [
      { id: 'all', label: 'All', icon: 'archive-outline', count: categoryCounts.total },
    ];
    config.categories.forEach((cat) => {
      list.push({
        id: cat,
        label: getCategoryLabel(cat, activeBiz?.category),
        icon: getCategoryIcon(cat),
        count: categoryCounts.map[cat.toLowerCase().trim()] || 0,
      });
    });
    return list;
  }, [config, categoryCounts, activeBiz]);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    data: productsList = [],
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProducts(selectedCategory);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  }, []);

  const handleAddProduct = useCallback(
    (prod: CatalogProduct) => {
      if (prod.stockType === 'out') {
        hapticFeedback.notificationWarning();
        triggerToast('Product is out of stock!');
        return;
      }

      hapticFeedback.impactLight();
      cartState.addCartItem(
        prod.name,
        prod.price,
        prod.icon,
        `SKU 23400${prod.id}`,
        prod.stockCount
      );
      triggerToast(`Added ${prod.name} to active invoice`);
    },
    [triggerToast]
  );

  return (
    <ScreenWrapper style={styles.container}>
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => {
            hapticFeedback.selection();
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/(tabs)');
            }
          }}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Catalog</Text>

        <View style={styles.headerRightActions}>
          <HeaderCartButton />

          <TouchableOpacity
            style={styles.searchHeaderButton}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              router.push('/pos/search');
            }}
          >
            <Feather name="search" size={22} color={TOKENS.dark} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bodyWrapper}>
        <View style={styles.sidebar}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarScroll}
          >
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.sidebarTab, isActive && styles.sidebarTabActive]}
                  activeOpacity={0.8}
                  onPress={() => {
                    hapticFeedback.selection();
                    setSelectedCategory(cat.id);
                  }}
                >
                  {isActive && <View style={styles.activeStrip} />}
                  <Ionicons
                    // @ts-ignore dynamic mapping of Ionicon names is safe here
                    name={cat.icon}
                    size={22}
                    color={isActive ? TOKENS.primary : TOKENS.muted}
                    style={styles.sidebarTabIcon}
                  />
                  <Text style={[styles.sidebarLabel, isActive && styles.sidebarLabelActive]}>
                    {cat.label}
                  </Text>
                  <Text style={styles.sidebarCount}>{cat.count}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.gridWrapper}>
          <FlashList
            data={productsList}
            keyExtractor={(item) => item.id}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            onEndReached={() => {
              if (hasNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              isFetchingNextPage ? (
                <ActivityIndicator
                  size="small"
                  color={TOKENS.primary}
                  style={{ marginVertical: 16 }}
                />
              ) : null
            }
            contentContainerStyle={styles.gridContent}
            renderItem={({ item }) => {
              return (
                <View style={{ flex: 1, padding: 6 }}>
                  <View style={styles.productCard}>
                    <View style={styles.imageContainer}>
                      <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => handleAddProduct(item)}
                        style={{ width: '100%', height: 100 }}
                      >
                        <ProductImage
                          icon={item.icon}
                          category={item.category}
                          style={{ width: '100%', height: 100, borderRadius: 0 }}
                        />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => handleAddProduct(item)}
                      style={styles.productDetails}
                    >
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
                                item.stockType === 'low' && styles.stockTextLow,
                                item.stockType === 'out' && styles.stockTextOut,
                              ]}
                            >
                              {item.stockText}
                            </Text>

                            <View
                              style={[
                                styles.plusIconBadge,
                                item.stockType === 'out' && styles.plusIconBadgeOut,
                              ]}
                            >
                              <Feather
                                name="plus"
                                size={16}
                                color={item.stockType === 'out' ? TOKENS.muted : TOKENS.card}
                              />
                              <Text
                                style={[
                                  styles.plusIconBadgeText,
                                  item.stockType === 'out' && styles.plusIconBadgeTextOut,
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
                                item.stockType === 'low' && styles.stockTextLow,
                                item.stockType === 'out' && styles.stockTextOut,
                              ]}
                            >
                              {item.stockText}
                            </Text>

                            <View
                              style={[
                                styles.mobilePlusIconBadge,
                                item.stockType === 'out' && styles.mobilePlusIconBadgeOut,
                              ]}
                            >
                              <Feather
                                name="plus"
                                size={15}
                                color={item.stockType === 'out' ? TOKENS.muted : TOKENS.card}
                              />
                              <Text
                                style={[
                                  styles.mobilePlusIconBadgeText,
                                  item.stockType === 'out' && styles.mobilePlusIconBadgeTextOut,
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
            }}
            ListEmptyComponent={
              <View style={styles.emptyGridState}>
                <Feather name="search" size={48} color="#D1D5DB" />
                <Text style={styles.emptyGridTitle}>No items found</Text>
                <Text style={styles.emptyGridSub}>
                  Try searching for another product or add a new one to catalog.
                </Text>
              </View>
            }
          />
        </View>
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
    justifyContent: 'space-between',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  searchHeaderButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyWrapper: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 96,
    backgroundColor: '#F3F4F6',
    borderRightWidth: 1,
    borderRightColor: TOKENS.border,
  },
  sidebarScroll: {
    paddingVertical: 8,
  },
  sidebarTab: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sidebarTabActive: {
    backgroundColor: TOKENS.card,
  },
  activeStrip: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    backgroundColor: TOKENS.primary,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  sidebarTabIcon: {
    marginBottom: 4,
  },
  sidebarLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: '500',
  },
  sidebarLabelActive: {
    color: TOKENS.primary,
    fontWeight: 'bold',
  },
  sidebarCount: {
    fontSize: 10,
    color: TOKENS.muted,
    marginTop: 2,
  },
  gridWrapper: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  gridContent: {
    padding: 6,
  },
  gridColumns: {
    gap: 12,
  },
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
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emptyGridState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 16,
    marginTop: 32,
    marginHorizontal: 8,
  },
  emptyGridTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyGridSub: {
    fontSize: 11,
    color: TOKENS.muted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
