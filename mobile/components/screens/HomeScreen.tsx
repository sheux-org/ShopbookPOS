import { Feather, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TOKENS } from '../../constants/tokens';
import { useBusinessCategories } from '../../hooks/useBusinessCategories';
import { HomeProductCard } from '../product/HomeProductCard';
import { useProducts, useToggleFavoriteProduct } from '../../hooks/useProducts';
import { useTabBarVisible } from '../../hooks/useTabBarVisible';
import { BottomSheet } from '../common/BottomSheet';
import { ScreenWrapper } from '../common/ScreenWrapper';
import { SearchInput } from '../common/SearchInput';
import { BarcodeScannerModal } from '../common/BarcodeScannerModal';
import { HeaderCartButton } from '../common/HeaderCartButton';
import { cartState } from '../data/cartState';
import { useActiveBusiness } from '../../hooks/useActiveBusiness';
import { useBusinessStore } from '../../stores/useBusinessStore';
import { hapticFeedback } from '../../utils/haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { PremiumUpgradeModal } from '../common/PremiumUpgradeModal';

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const numColumns = width > 768 ? 4 : 2;

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isPremium = useSettingsStore((s) => s.isPremium);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);

  const {
    data: productsList = [],
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProducts(selectedCategory, searchQuery);
  const toggleFavoriteMutation = useToggleFavoriteProduct();

  const activeBusiness = useActiveBusiness();
  const categories = useBusinessCategories('All Items');
  const businesses = useBusinessStore((s) => s.businesses);
  const [isBusinessSheetOpen, setIsBusinessSheetOpen] = useState(false);

  const { tabBarVisible, setTabBarVisible } = useTabBarVisible();
  const lastScrollY = useRef(0);

  // Reset tab bar visibility to true on mount/unmount to avoid lingering hidden state
  useEffect(() => {
    setTabBarVisible(true);
    return () => {
      setTabBarVisible(true);
    };
  }, []);

  useEffect(() => {
    setSelectedCategory('all');
  }, [activeBusiness.id]);

  const fabWidth = useSharedValue(115);
  const fabTextOpacity = useSharedValue(1);
  const fabTextScale = useSharedValue(1);

  useEffect(() => {
    const springConfig = { damping: 15, stiffness: 120 };
    fabWidth.value = withSpring(tabBarVisible ? 115 : 48, springConfig);
    fabTextOpacity.value = withSpring(tabBarVisible ? 1 : 0, springConfig);
    fabTextScale.value = withSpring(tabBarVisible ? 1 : 0.5, springConfig);
  }, [tabBarVisible, fabWidth, fabTextOpacity, fabTextScale]);

  const fabContainerStyle = useAnimatedStyle(() => ({
    width: fabWidth.value,
  }));

  const fabTextStyle = useAnimatedStyle(() => ({
    opacity: fabTextOpacity.value,
    transform: [{ scale: fabTextScale.value }],
  }));

  // Scroll handler for hiding/showing tab bar dynamically
  const handleScroll = (event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;

    // Scrolling down (with threshold)
    if (currentY > 50 && currentY > lastScrollY.current) {
      if (tabBarVisible) {
        setTabBarVisible(false);
      }
    }
    // Scrolling up or at the absolute top
    else if (currentY < lastScrollY.current || currentY <= 10) {
      if (!tabBarVisible) {
        setTabBarVisible(true);
      }
    }

    lastScrollY.current = currentY;
  };

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  }, []);

  const handleFavorite = useCallback(
    (id: string) => {
      hapticFeedback.impactLight();
      toggleFavoriteMutation.mutate(id);
    },
    [toggleFavoriteMutation]
  );

  return (
    <ScreenWrapper noPaddingBottom style={styles.container}>
      {/* Toast popup */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header section with Search bar built-in */}
      <View style={styles.header}>
        <View style={styles.headerTextWrapper}>
          <Text style={styles.headerTitle}>Shopbook POS</Text>
          <TouchableOpacity
            style={styles.businessSwitcherBtn}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.impactMedium();
              setIsBusinessSheetOpen(true);
            }}
          >
            <View style={styles.businessRow}>
              <Ionicons
                name="storefront-outline"
                size={18}
                color={TOKENS.muted}
                style={{ marginRight: 8 }}
              />
              <Text style={[styles.headerSubtitle, styles.headerSubtitleDark]} numberOfLines={1}>
                {activeBusiness.name}
              </Text>
            </View>
            <Feather name="chevron-down" size={13} color={TOKENS.muted} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          <HeaderCartButton />

          <TouchableOpacity
            style={styles.searchIconBtn}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              router.push('/(modules)/pos/search');
            }}
          >
            <Feather name="search" size={20} color={TOKENS.dark} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input Box */}
      <SearchInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Quick search products..."
        onScanPress={() => {
          if (isPremium) {
            setIsScanning(true);
          } else {
            setPremiumModalVisible(true);
          }
        }}
        containerStyle={{ marginHorizontal: 16, marginTop: 12 }}
      />

      {/* 🌟 GORGEOUS HIGH-FIDELITY REDIRECT BANNER TO SIDEBAR CATALOG SCREEN as requested 🌟 */}
      <TouchableOpacity
        style={styles.catalogBanner}
        activeOpacity={0.85}
        onPress={() => {
          hapticFeedback.impactLight();
          router.push('/(modules)/pos/catalog');
        }}
      >
        <View style={styles.catalogBannerLeft}>
          <View style={styles.bannerIconWrapper}>
            <Feather name="grid" size={16} color={TOKENS.primary} />
          </View>
          <View>
            <Text style={styles.catalogBannerTitle}>Browse Catalog (Sidebar Layout)</Text>
            <Text style={styles.catalogBannerSubtitle}>
              Switch to vertical splits with category counts
            </Text>
          </View>
        </View>
        <Feather name="arrow-right" size={18} color={TOKENS.primary} />
      </TouchableOpacity>

      {/* Horizontal Category Scroll */}
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScroll}
        >
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isActive ? styles.categoryChipActive : styles.categoryChipInactive,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  setSelectedCategory(cat.id);
                }}
              >
                <Text
                  style={[
                    styles.categoryText,
                    isActive ? styles.categoryTextActive : styles.categoryTextInactive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Product List Grid */}
      <FlashList
        key={numColumns}
        data={productsList}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
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
            <ActivityIndicator size="small" color={TOKENS.primary} style={{ marginVertical: 16 }} />
          ) : null
        }
        contentContainerStyle={[styles.gridContainer, { paddingBottom: insets.bottom + 100 }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <HomeProductCard item={item} onAdded={triggerToast} onFavorite={handleFavorite} />
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

      {/* Synchronized Animated FAB */}
      <Animated.View
        style={[styles.animatedFabContainer, { bottom: insets.bottom + 75 }, fabContainerStyle]}
      >
        <TouchableOpacity
          style={styles.fabTouchable}
          activeOpacity={0.85}
          onPress={() => {
            hapticFeedback.impactMedium();
            router.push('/(modules)/stocks/scan');
          }}
        >
          <View style={styles.fabIconWrapper}>
            <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
          </View>
          <Animated.View style={[styles.fabTextWrapper, fabTextStyle]}>
            <Text style={styles.fabText}>Scan</Text>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>

      {/* Premium Business Swapping Bottom Sheet */}
      <BottomSheet
        visible={isBusinessSheetOpen}
        onClose={() => setIsBusinessSheetOpen(false)}
        title="Select Active Business"
      >
        <ScrollView
          contentContainerStyle={styles.sheetScrollContent}
          style={{ maxHeight: 400 }}
          showsVerticalScrollIndicator={false}
        >
          {businesses.map((biz) => {
            const isSelected = activeBusiness.id === biz.id;
            return (
              <TouchableOpacity
                key={biz.id}
                style={[styles.bizCard, isSelected && styles.bizCardSelected]}
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.impactMedium();
                  if (isPremium || isSelected) {
                    cartState.setActiveBusiness(biz.id);
                    setIsBusinessSheetOpen(false);
                    triggerToast(`Switched to ${biz.name}`);
                  } else {
                    setIsBusinessSheetOpen(false);
                    setPremiumModalVisible(true);
                  }
                }}
              >
                <View style={styles.bizCardLeft}>
                  <View style={[styles.bizIconBox, isSelected && styles.bizIconBoxActive]}>
                    <Feather
                      name="home"
                      size={18}
                      color={isSelected ? TOKENS.card : TOKENS.primary}
                    />
                  </View>
                  <View style={styles.bizDetails}>
                    <Text style={styles.bizName}>{biz.name}</Text>
                    <Text style={styles.bizAddress}>{biz.address}</Text>
                    <Text style={styles.bizPhone}>{biz.phone}</Text>
                  </View>
                </View>
                {isSelected && <Feather name="check-circle" size={20} color={TOKENS.success} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheet>

      <BarcodeScannerModal
        visible={isScanning}
        onClose={() => setIsScanning(false)}
        onBarcodeScanned={(data) => {
          setSearchQuery(data);
          setIsScanning(false);
          triggerToast(`Scanned Barcode: ${data} 🔍`);
        }}
      />

      <PremiumUpgradeModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        featureName="Multi-branch swapping"
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: TOKENS.card,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  headerTextWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  headerSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TOKENS.muted,
    marginTop: 1,
  },
  searchIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 10,
  },
  catalogBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogBannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: TOKENS.primary,
  },
  catalogBannerSubtitle: {
    fontSize: 10,
    color: '#6366F1',
    marginTop: 1,
  },
  categoriesWrapper: {
    height: 48,
    marginTop: 8,
    backgroundColor: TOKENS.background,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryChipActive: {
    backgroundColor: TOKENS.primary,
  },
  categoryChipInactive: {
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: TOKENS.card,
    fontWeight: 'bold',
  },
  categoryTextInactive: {
    color: TOKENS.muted,
  },
  gridContainer: {
    padding: 10,
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
    height: 110,
    backgroundColor: '#F3F4F6',
  },
  productCardImage: {
    width: '100%',
    height: 110,
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
    boxShadow: 'none',
  },
  emptyGridState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
    marginTop: 32,
    marginHorizontal: 16,
  },
  emptyGridTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.dark,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyGridSub: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  animatedFabContainer: {
    position: 'absolute',
    right: 20,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB', // Vibrant POS Blue (matches UI brand perfectly)
    borderWidth: 1,
    borderColor: '#3B82F6', // Electric Blue Border
    boxShadow: '0px 4px 6px 0px rgba(37, 99, 235, 0.3)',
    zIndex: 100,
    overflow: 'hidden',
  },
  fabTouchable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  fabIconWrapper: {
    position: 'absolute',
    left: 15,
    top: 0,
    bottom: 0,
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabTextWrapper: {
    position: 'absolute',
    left: 44,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  businessSwitcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  businessRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bizBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bizBadgeText: {
    color: TOKENS.card,
    fontWeight: '700',
    fontSize: 12,
  },
  headerSubtitleDark: {
    color: TOKENS.dark,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheetDismissArea: {
    flex: 1,
  },
  sheetContent: {
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: TOKENS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  sheetCloseBtn: {
    padding: 4,
  },
  sheetScrollContent: {
    paddingHorizontal: 0,
    paddingTop: 16,
    paddingBottom: 0,
    gap: 12,
  },
  bizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 14,
  },
  bizCardSelected: {
    borderColor: TOKENS.primary,
    backgroundColor: '#F4F7FF',
  },
  bizCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  bizIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: TOKENS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bizIconBoxActive: {
    backgroundColor: TOKENS.primary,
  },
  bizDetails: {
    flex: 1,
    gap: 2,
  },
  bizName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  bizAddress: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  bizPhone: {
    fontSize: 11,
    color: TOKENS.muted,
  },
});
