import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { BarcodeScannerModal } from '../common/BarcodeScannerModal';
import { usePermission } from '../../hooks/usePermissionHandler';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SearchInput } from '../common/SearchInput';
import { ScreenWrapper } from '../common/ScreenWrapper';
import { TOKENS } from '../../constants/tokens';
import { HeaderCartButton } from '../common/HeaderCartButton';
import { useProducts } from '../../hooks/useProducts';
import { SearchProductRow } from '../product/SearchProductRow';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { PremiumUpgradeModal } from '../common/PremiumUpgradeModal';

export const SearchScreen: React.FC = () => {
  const router = useRouter();
  const { requestCameraAccess } = usePermission();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState('All');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const isPremium = useSettingsStore((s) => s.isPremium);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);

  const {
    data: productsList = [],
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProducts(undefined, searchQuery, activeChip);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  }, []);

  const triggerBarcodeScanner = () => {
    if (isPremium) {
      requestCameraAccess(() => {
        setIsScanning(true);
      });
    } else {
      setPremiumModalVisible(true);
    }
  };

  const filterChips = ['All', 'In Stock', 'Under Rs. 1000', 'Low Stock', 'Out of Stock'];

  return (
    <ScreenWrapper withKeyboard noPaddingBottom style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header matching Image 2 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        {/* Input Bar */}
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search products..."
          onScanPress={triggerBarcodeScanner}
          containerStyle={{ flex: 1 }}
        />

        <View style={styles.headerRightActions}>
          <HeaderCartButton />
        </View>
      </View>

      {/* Horizontal Filtering Chips */}
      <View style={styles.chipsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}
        >
          {filterChips.map((chip) => {
            const isActive = activeChip === chip;
            return (
              <TouchableOpacity
                key={chip}
                style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
                activeOpacity={0.85}
                onPress={() => setActiveChip(chip)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : styles.chipTextInactive,
                  ]}
                >
                  {chip}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Title Count Subheader */}
      <View style={styles.subheader}>
        <Text style={styles.subheaderText}>
          {productsList.length} {productsList.length === 1 ? 'RESULT' : 'RESULTS'}
        </Text>
      </View>

      {/* Results Scrollable list */}
      <FlashList
        data={productsList}
        keyExtractor={(item) => item.id.toString()}
        style={styles.resultsList}
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
        contentContainerStyle={{
          paddingBottom: insets.bottom + 20,
          flexGrow: 1,
        }}
        renderItem={({ item }) => <SearchProductRow item={item} onAdded={triggerToast} />}
        ListEmptyComponent={
          <View style={styles.emptySearchState}>
            <Feather name="search" size={48} color="#D1D5DB" />
            <Text style={styles.emptySearchTitle}>No items found</Text>
            <Text style={styles.emptySearchSub}>
              Try searching for another product or add a new one to catalog.
            </Text>
          </View>
        }
      />

      {/* REAL HIGH-PERFORMANCE CAMERA BARCODE SCANNER OVERLAY MODAL */}
      <BarcodeScannerModal
        visible={isScanning}
        onClose={() => setIsScanning(false)}
        title="📷 Search Barcode Active"
        instruction="Align a product barcode within the viewfinder box to search and locate it instantly"
        onBarcodeScanned={(data) => {
          setSearchQuery(data);
          setIsScanning(false);
          triggerToast(`Found Barcode: ${data} 🔍`);
        }}
      />

      <PremiumUpgradeModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        featureName="In-app barcode search scanning"
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.card,
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
    gap: 12,
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
  scanHeaderButton: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 2px 3px 0px ${TOKENS.primary}33`,
  },
  chipsWrapper: {
    height: 52,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
  },
  chipsScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: TOKENS.primary,
  },
  chipInactive: {
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: TOKENS.card,
    fontWeight: 'bold',
  },
  chipTextInactive: {
    color: TOKENS.primary,
  },
  subheader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  subheaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TOKENS.muted,
    letterSpacing: 0.5,
  },
  resultsList: {
    flex: 1,
    backgroundColor: TOKENS.card,
  },
  resultItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  iconText: {
    fontSize: 22,
  },
  itemDetails: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  skuStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  skuText: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  dividerDot: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  stockNormalText: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  stockLowText: {
    fontSize: 12,
    color: TOKENS.warning,
    fontWeight: 'bold',
  },
  stockOutText: {
    fontSize: 12,
    color: TOKENS.error,
    fontWeight: 'bold',
  },
  rightActionsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  addButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: TOKENS.border,
  },
  plusIcon: {
    marginTop: 0.5,
  },
  addButtonText: {
    fontSize: 11,
    color: TOKENS.primary,
    fontWeight: 'bold',
  },
  addButtonTextDisabled: {
    color: TOKENS.muted,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptySearchState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
    marginTop: 32,
    marginHorizontal: 16,
  },
  emptySearchTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.dark,
    marginTop: 12,
    marginBottom: 4,
  },
  emptySearchSub: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
