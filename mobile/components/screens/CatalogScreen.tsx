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
import { useBusinessCategories } from '../../hooks/useBusinessCategories';
import { CatalogProductCard } from '../product/CatalogProductCard';
import { useProducts } from '../../hooks/useProducts';
import { hapticFeedback } from '../../utils/haptics';

export const CatalogScreen: React.FC = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width > 768;

  const categories = useBusinessCategories('All');

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
            {categories.map((cat) => {
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
            drawDistance={500}
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
            renderItem={({ item }) => (
              <CatalogProductCard item={item} isTablet={isTablet} onAdded={triggerToast} />
            )}
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
    boxShadow: 'none',
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
    boxShadow: 'none',
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
