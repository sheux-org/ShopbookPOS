import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Animated,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { BarcodeScannerModal } from '../common/BarcodeScannerModal';
import * as ImagePicker from 'expo-image-picker';
import { usePermission } from '../../hooks/usePermissionHandler';
import { useUserPermissions } from '../../hooks/useUserPermissions';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../common/ScreenWrapper';
import { ImagePickerBottomSheet } from '../common/ImagePickerBottomSheet';
import { TOKENS } from '../../constants/tokens';
import { useActiveBusiness } from '../../hooks/useActiveBusiness';
import { cartState } from '../data/cartState';
import { HeaderCartButton } from '../common/HeaderCartButton';
import {
  useAddProduct,
  useProducts,
  useToggleFavoriteProduct,
  useFindProduct,
} from '../../hooks/useProducts';
import { deleteUploadThingFile, uploadToUploadThing } from '../../services/uploadQueue';
import { ProductImage } from '../common/ProductImage';
import { hapticFeedback } from '../../utils/haptics';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { PremiumUpgradeModal } from '../common/PremiumUpgradeModal';
import { getBusinessTypeConfig } from '../../utils/businessTypeConfig';
import { useTranslation } from '../../hooks/useTranslation';

function getRelativeTimeAgo(timestamp?: number): string {
  if (!timestamp) return 'Just now';
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDays}d ago`;
}

export const StocksScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();

  const activeBiz = useActiveBusiness();
  const config = getBusinessTypeConfig(activeBiz?.category);
  const CATEGORIES_LIST = config.categories;
  const UNIT_TYPES = config.unitTypes;

  const addProductMutation = useAddProduct();
  const { data: favoriteProducts = [] } = useProducts(undefined, undefined, 'Favorites');
  const { data: recentProducts = [] } = useProducts(undefined, undefined, 'Recents');

  const toggleFavoriteMutation = useToggleFavoriteProduct();
  const [isEditingFavorites, setIsEditingFavorites] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Image picker bottom sheet state
  const [imgSheetVisible, setImgSheetVisible] = useState(false);
  const [formImageUploading, setFormImageUploading] = useState(false);

  const openImgSheet = () => {
    setImgSheetVisible(true);
  };

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState(config.defaultCategory);
  const [formUnitType, setFormUnitType] = useState(config.defaultUnitType);
  const [formCostPrice, setFormCostPrice] = useState('');
  const [formSalesPrice, setFormSalesPrice] = useState('');
  const [formStockIn, setFormStockIn] = useState('');
  const [formLowStock, setFormLowStock] = useState('');
  const { requestCameraAccess } = usePermission();
  const { canPerform } = useUserPermissions();
  const isPremium = useSettingsStore((s) => s.isPremium);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);

  const [formQuickCode, setFormQuickCode] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formImage, setFormImage] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const { generateUniqueBarcode } = useFindProduct();

  const handleAutoGenerateBarcode = async () => {
    try {
      const uniqueCode = await generateUniqueBarcode();
      setFormBarcode(uniqueCode);
      triggerToast('Generated unique barcode! 🏷️');
    } catch (err: any) {
      Alert.alert('Generation Failed', err.message || 'Failed to generate a unique barcode');
    }
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  };

  const handleAddProductToCart = (name: string, price: number, icon: string) => {
    hapticFeedback.impactLight();
    cartState.addCartItem(name, price, icon);
    triggerToast(`Added ${name} to checkout invoice`);
  };

  const triggerBarcodeScanner = () => {
    if (isPremium) {
      requestCameraAccess(() => {
        setIsScanning(true);
      });
    } else {
      setPremiumModalVisible(true);
    }
  };

  const handlePickImage = async (source: 'camera' | 'gallery') => {
    // Small delay to let the sheet close before opening picker
    await new Promise((r) => setTimeout(r, 200));

    let localUri: string | null = null;

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required.');
        return;
      }
      try {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1] as [number, number],
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]?.uri) {
          localUri = result.assets[0].uri;
        }
      } catch {
        Alert.alert('Camera Unavailable', 'Camera is not available. Please use Gallery.');
        return;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1] as [number, number],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]?.uri) {
        localUri = result.assets[0].uri;
      }
    }

    if (!localUri) return;

    // Show local image immediately while uploading
    setFormImage(localUri);
    setFormImageUploading(true);
    triggerToast('Uploading image... ⏳');

    try {
      const remoteUrl = await uploadToUploadThing(localUri);
      if (remoteUrl) {
        setFormImage(remoteUrl);
        triggerToast('Image uploaded! ✅');
      } else {
        // Keep local URI if upload failed — will try again on save
        triggerToast('Upload failed — image saved locally');
      }
    } catch {
      triggerToast('Upload error — image saved locally');
    } finally {
      setFormImageUploading(false);
    }
  };

  const handleRemoveFormImage = async () => {
    // If there's a remote UploadThing URL, delete it from storage
    if (formImage.startsWith('http')) {
      await deleteUploadThingFile(formImage);
    }
    setFormImage('');
  };

  const handleSaveProduct = () => {
    if (!canPerform('create', 'products')) {
      hapticFeedback.notificationError();
      Alert.alert('Access Denied', 'Your profile role is not authorized to add new catalog items.');
      return;
    }

    if (!formName || !formSalesPrice || !formStockIn) {
      hapticFeedback.notificationWarning();
      Alert.alert(
        'Required Fields Missing',
        'Please enter product name, selling price, and initial stock quantity.'
      );
      return;
    }

    if (!formQuickCode && !formBarcode) {
      hapticFeedback.notificationWarning();
      Alert.alert(
        'Identification Required',
        'Please enter at least either a Quick Code or a Barcode to identify this product.'
      );
      return;
    }

    const priceNum = parseFloat(formSalesPrice);
    const costNum = parseFloat(formCostPrice) || priceNum * 0.8; // default cost
    const stockCount = parseInt(formStockIn, 10);
    const lowStockThreshold = parseInt(formLowStock, 10) || 5;

    if (isNaN(priceNum) || isNaN(stockCount)) {
      hapticFeedback.notificationWarning();
      Alert.alert('Invalid input type', 'Please verify numeric fields.');
      return;
    }

    // Save product dynamically using React Query mutation hook
    addProductMutation.mutate({
      name: formName,
      price: priceNum,
      category: formCategory,
      // icon is the real uploaded photo URL, or empty string if no photo was set
      icon: formImage,
      stockCount: stockCount,
      unitType: formUnitType,
      costPrice: costNum,
      quickCode: formQuickCode || undefined,
      barcode: formBarcode || undefined,
      lowStockAlert: lowStockThreshold,
    });

    hapticFeedback.notificationSuccess();
    triggerToast(`Product "${formName}" saved to catalog!`);

    // Reset form fields
    setFormName('');
    setFormCostPrice('');
    setFormSalesPrice('');
    setFormStockIn('');
    setFormLowStock('');
    setFormQuickCode('');
    setFormBarcode('');
    setFormImage('');
  };

  return (
    <ScreenWrapper withKeyboard noPaddingBottom style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header matching exact layout of Image 3 but for Stocks */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => {
            hapticFeedback.selection();
            router.push('/');
          }}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Stocks</Text>
          <Text style={{ fontSize: 11, color: TOKENS.muted, marginTop: 1 }}>
            {t('catalog.subtitle')}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.headerHistoryBtn}
            activeOpacity={0.7}
            onPress={() => {
              hapticFeedback.selection();
              router.push('/stocks/items');
            }}
          >
            <Feather name="archive" size={15} color={TOKENS.primary} />
            <Text
              style={{ fontSize: 12, fontWeight: 'bold', color: TOKENS.primary, marginLeft: 4 }}
            >
              {t('catalog.itemsBtn')}
            </Text>
          </TouchableOpacity>

          <HeaderCartButton />
        </View>
      </View>

      {/* Scrollable Area */}
      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ➕ ADD NEW PRODUCT FORM CARD (Sleek and beautiful border card) ➕ */}
        {canPerform('create', 'products') ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>➕ {t('catalog.addProduct')}</Text>
            <Text style={styles.formSubtitle}>{t('catalog.addProductSub')}</Text>

            <View style={styles.formGrid}>
              {/* Field: Name */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t('catalog.productName')} *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Munchee Chocolate Puff"
                  placeholderTextColor="#9CA3AF"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              {/* Field: Quick Code & Barcode Row */}
              <View style={styles.fieldColumnsRow}>
                <View style={styles.flexField}>
                  <Text style={styles.fieldLabel}>{t('catalog.quickCode')}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. QC-302"
                    placeholderTextColor="#9CA3AF"
                    value={formQuickCode}
                    onChangeText={setFormQuickCode}
                  />
                </View>

                <View style={styles.flexField}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={styles.fieldLabel}>{t('catalog.barcode')}</Text>
                    <TouchableOpacity onPress={handleAutoGenerateBarcode} activeOpacity={0.7}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: TOKENS.primary }}>
                        {t('catalog.autoGen')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.barcodeInputContainer}>
                    <TextInput
                      style={styles.barcodeInput}
                      placeholder="Type or Scan 890..."
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                      value={formBarcode}
                      onChangeText={setFormBarcode}
                    />
                    <TouchableOpacity
                      style={styles.barcodeScanBtn}
                      activeOpacity={0.8}
                      onPress={() => {
                        hapticFeedback.impactLight();
                        triggerBarcodeScanner();
                      }}
                    >
                      <Ionicons name="qr-code-outline" size={16} color={TOKENS.primary} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Field: Category Chips selector */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t('catalog.category')}</Text>
                <View style={styles.chipsSelector}>
                  {CATEGORIES_LIST.map((cat) => {
                    const isSelected = formCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[styles.selectorChip, isSelected && styles.selectorChipActive]}
                        onPress={() => {
                          hapticFeedback.selection();
                          setFormCategory(cat);
                        }}
                      >
                        <Text
                          style={[
                            styles.selectorChipText,
                            isSelected && styles.selectorChipTextActive,
                          ]}
                        >
                          {cat.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Field: Unit Type Chips selector */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t('catalog.unitType')}</Text>
                <View style={styles.chipsSelector}>
                  {UNIT_TYPES.map((u) => {
                    const isSelected = formUnitType === u;
                    return (
                      <TouchableOpacity
                        key={u}
                        style={[styles.selectorChip, isSelected && styles.selectorChipActive]}
                        onPress={() => {
                          hapticFeedback.selection();
                          setFormUnitType(u);
                        }}
                      >
                        <Text
                          style={[
                            styles.selectorChipText,
                            isSelected && styles.selectorChipTextActive,
                          ]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Field: Cost & Selling Price Row */}
              <View style={styles.fieldColumnsRow}>
                <View style={styles.flexField}>
                  <Text style={styles.fieldLabel}>{t('catalog.costPrice')} (Rs.)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 140"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={formCostPrice}
                    onChangeText={setFormCostPrice}
                  />
                </View>

                <View style={styles.flexField}>
                  <Text style={styles.fieldLabel}>{t('catalog.price')} * (Rs.)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 180"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={formSalesPrice}
                    onChangeText={setFormSalesPrice}
                  />
                </View>
              </View>

              {/* Field: Initial Stock & Low Threshold Row */}
              <View style={styles.fieldColumnsRow}>
                <View style={styles.flexField}>
                  <Text style={styles.fieldLabel}>{t('catalog.stockQuantity')} *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 50"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={formStockIn}
                    onChangeText={setFormStockIn}
                  />
                </View>

                <View style={styles.flexField}>
                  <Text style={styles.fieldLabel}>{t('catalog.lowStockAlert')}</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="e.g. 5"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={formLowStock}
                    onChangeText={setFormLowStock}
                  />
                </View>
              </View>

              {/* ────── Product Image / Icon field ────── */}
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{t('catalog.productImage')} *</Text>
                <Text style={styles.fieldHelpText}>{t('catalog.uploadImageHint')}</Text>

                <View style={styles.imgPickerPanel}>
                  {formImage ? (
                    <View style={styles.imgContainerWrap}>
                      <ProductImage
                        icon={formImage}
                        category={formCategory}
                        size={160}
                        style={styles.premiumImagePreview}
                      />

                      {/* Change Button Overlay */}
                      {!formImageUploading && (
                        <TouchableOpacity
                          style={styles.changeImageOverlay}
                          activeOpacity={0.8}
                          onPress={() => {
                            hapticFeedback.impactMedium();
                            openImgSheet();
                          }}
                        >
                          <View style={styles.changeImageBadge}>
                            <Feather name="camera" size={14} color="#FFFFFF" />
                            <Text style={styles.changeImageText}>{t('catalog.changeImage')}</Text>
                          </View>
                        </TouchableOpacity>
                      )}

                      {/* Delete Floating Pill */}
                      {!formImageUploading && (
                        <TouchableOpacity
                          style={styles.floatingRemoveBtn}
                          activeOpacity={0.8}
                          onPress={handleRemoveFormImage}
                        >
                          <Feather name="trash-2" size={14} color="#FFFFFF" />
                        </TouchableOpacity>
                      )}

                      {/* Loading overlay */}
                      {formImageUploading && (
                        <View style={styles.imgUploadingOverlay}>
                          <ActivityIndicator
                            size="small"
                            color="#FFFFFF"
                            style={{ marginBottom: 6 }}
                          />
                          <Text style={styles.imgUploadingText}>Uploading image…</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={{ position: 'relative' }}>
                      <TouchableOpacity
                        style={styles.premiumUploadArea}
                        activeOpacity={0.7}
                        onPress={() => {
                          hapticFeedback.impactMedium();
                          openImgSheet();
                        }}
                        disabled={formImageUploading}
                      >
                        <View style={styles.uploadIconCircle}>
                          <Ionicons name="cloud-upload-outline" size={24} color={TOKENS.primary} />
                        </View>
                        <Text style={styles.uploadAreaTitle}>
                          {t('catalog.uploadProductImage')}
                        </Text>
                        <Text style={styles.uploadAreaSubtitle}>
                          {t('catalog.uploadImageHint')}
                        </Text>
                      </TouchableOpacity>

                      {/* Loading overlay for empty image state */}
                      {formImageUploading && (
                        <View style={[styles.imgUploadingOverlay, { borderRadius: 12 }]}>
                          <ActivityIndicator
                            size="small"
                            color="#FFFFFF"
                            style={{ marginBottom: 6 }}
                          />
                          <Text style={styles.imgUploadingText}>Uploading image…</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                activeOpacity={0.8}
                onPress={handleSaveProduct}
              >
                <Text style={styles.submitBtnText}>{t('catalog.saveProductToCatalog')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.formCard, { alignItems: 'center', paddingVertical: 32, gap: 12 }]}>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: '#FEE2E2',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#FECACA',
              }}
            >
              <Feather name="lock" size={24} color={TOKENS.error} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: TOKENS.dark }}>
              Inventory Operations Restricted
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: TOKENS.muted,
                textAlign: 'center',
                lineHeight: 17,
                paddingHorizontal: 24,
              }}
            >
              Cashier profiles are not authorized to create, update, or edit products in the catalog
              list.
            </Text>
          </View>
        )}

        {/* Favorites section exactly like Image 3 */}
        <View style={styles.favoritesSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Favorites</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  hapticFeedback.impactMedium();
                  setIsEditingFavorites(!isEditingFavorites);
                }}
              >
                <Text
                  style={[
                    styles.editLink,
                    isEditingFavorites && { color: TOKENS.primary, fontWeight: '700' },
                  ]}
                >
                  {isEditingFavorites ? 'Done' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.favGrid}>
            {favoriteProducts.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <View style={[styles.emptyIconContainer, { backgroundColor: '#FFF1F2' }]}>
                  <Ionicons name="heart-outline" size={20} color="#F43F5E" />
                </View>
                <Text style={styles.emptyStateTitle}>No Favorites Added</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Tap the heart icon on products in the home catalog to access them quickly here.
                </Text>
              </View>
            ) : (
              favoriteProducts.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.favCard}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (isEditingFavorites) {
                      hapticFeedback.impactMedium();
                      toggleFavoriteMutation.mutate(item.id);
                    } else {
                      handleAddProductToCart(item.name, item.price, item.icon);
                    }
                  }}
                >
                  {/* Product image */}
                  <View style={{ width: '100%', height: 65, position: 'relative' }}>
                    <ProductImage
                      icon={item.icon}
                      category={item.category}
                      size={65}
                      style={{
                        width: '100%',
                        height: 65,
                        borderTopLeftRadius: 11,
                        borderTopRightRadius: 11,
                      }}
                    />
                    {isEditingFavorites && (
                      <TouchableOpacity
                        style={styles.favRemoveBtn}
                        activeOpacity={0.8}
                        onPress={() => {
                          hapticFeedback.impactMedium();
                          toggleFavoriteMutation.mutate(item.id);
                        }}
                      >
                        <Ionicons name="close-circle" size={22} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.favName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.favPrice}>Rs. {item.price}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>

        {/* Recents section exactly like Image 3 */}
        <View style={styles.recentsSection}>
          <View style={styles.recentHeaderRow}>
            <Feather name="clock" size={16} color={TOKENS.dark} />
            <Text style={styles.recentTitle}>Recents</Text>
          </View>

          <View style={styles.recentsList}>
            {recentProducts.length === 0 ? (
              <View style={styles.emptyStateCard}>
                <View style={[styles.emptyIconContainer, { backgroundColor: TOKENS.lightBlue }]}>
                  <Feather name="clock" size={20} color={TOKENS.primary} />
                </View>
                <Text style={styles.emptyStateTitle}>No Recent Items</Text>
                <Text style={styles.emptyStateSubtitle}>
                  Products you add or update in the catalog will appear here for fast lookup.
                </Text>
              </View>
            ) : (
              recentProducts.map((item) => (
                <View key={item.id} style={styles.recentRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <ProductImage
                      icon={item.icon}
                      category={item.category}
                      size={58}
                      style={{ width: 58, height: 58, borderRadius: 10 }}
                    />
                    <View style={styles.recentInfoWrapper}>
                      <Text style={styles.recentItemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: TOKENS.primary }}>
                          Rs. {item.price.toLocaleString()}
                        </Text>
                        <View
                          style={{
                            width: 3,
                            height: 3,
                            borderRadius: 1.5,
                            backgroundColor: '#E2E8F0',
                          }}
                        />
                        <Text style={styles.recentTimeAgo}>
                          {getRelativeTimeAgo(item.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.recentActions}>
                    <TouchableOpacity
                      style={styles.addButton}
                      activeOpacity={0.8}
                      onPress={() => handleAddProductToCart(item.name, item.price, item.icon)}
                    >
                      <Text style={styles.addButtonText}>+ Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Image Picker Bottom Sheet ── */}
      <ImagePickerBottomSheet
        visible={imgSheetVisible}
        onClose={() => setImgSheetVisible(false)}
        onSelectSource={handlePickImage}
      />

      {/* SIMULATED HIGH-FIDELITY BARCODE SCANNER OVERLAY MODAL */}
      <BarcodeScannerModal
        visible={isScanning}
        onClose={() => setIsScanning(false)}
        onBarcodeScanned={(data) => {
          setFormBarcode(data);
          setIsScanning(false);
          triggerToast(`Barcode Scanned: ${data} ✅`);
        }}
      />

      <PremiumUpgradeModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        featureName="In-app barcode stock scanning"
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
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    boxShadow: `0px 2px 3px 0px ${TOKENS.primary}33`,
  },
  scanButtonText: {
    color: TOKENS.card,
    fontWeight: 'bold',
    fontSize: 14,
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  formCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TOKENS.accentBlue,
    padding: 16,
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.05)',
  },
  formTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.primary,
  },
  formSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 4,
    lineHeight: 14,
  },
  formGrid: {
    marginTop: 12,
    gap: 12,
  },
  fieldRow: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.dark,
  },
  formInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 12,
    fontSize: 13,
    color: TOKENS.dark,
  },
  chipsSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  selectorChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  selectorChipActive: {
    backgroundColor: TOKENS.primary,
    borderColor: TOKENS.primary,
  },
  selectorChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.muted,
  },
  selectorChipTextActive: {
    color: TOKENS.card,
  },
  fieldColumnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexField: {
    flex: 1,
    gap: 4,
  },
  submitBtn: {
    backgroundColor: TOKENS.primary,
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    boxShadow: `0px 2px 4px 0px ${TOKENS.primary}33`,
  },
  submitBtnText: {
    color: TOKENS.card,
    fontWeight: 'bold',
    fontSize: 14,
  },
  favoritesSection: {
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  editLink: {
    fontSize: 14,
    color: TOKENS.primary,
    fontWeight: 'bold',
  },
  favGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  favCard: {
    width: '31.5%',
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 10,
    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.03)',
  },
  favImageBox: {
    width: '100%',
    height: 65,
    borderRadius: 0,
    marginBottom: 6,
  },
  favName: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.dark,
    textAlign: 'center',
    paddingHorizontal: 6,
    marginTop: 6,
  },
  favPrice: {
    fontSize: 11,
    color: TOKENS.primary,
    fontWeight: 'bold',
    marginTop: 2,
  },
  recentsSection: {
    gap: 10,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  recentsList: {
    gap: 10,
  },
  recentRow: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingRight: 16,
    paddingLeft: 3,
    paddingTop: 3,
    paddingBottom: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 64,
  },
  recentInfoWrapper: {
    flex: 1,
  },
  recentItemName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  recentTimeAgo: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    boxShadow: `0px 1px 2px 0px ${TOKENS.primary}26`,
  },
  addButtonText: {
    color: TOKENS.card,
    fontWeight: 'bold',
    fontSize: 13,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    borderRadius: 19,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    paddingHorizontal: 12,
  },
  placeholderWidth: {
    width: 38,
  },
  barcodeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 8,
  },
  barcodeInput: {
    flex: 1,
    fontSize: 13,
    color: TOKENS.dark,
    padding: 0,
  },
  barcodeScanBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: TOKENS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  fieldHelpText: {
    fontSize: 11,
    color: TOKENS.muted,
    marginBottom: 6,
  },
  // ── Redesigned premium product photo picker — wide card layout ──
  imgPickerPanel: {
    marginTop: 6,
  },
  premiumUploadArea: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: TOKENS.accentBlue,
    borderStyle: 'dashed' as const,
    backgroundColor: TOKENS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.05)',
  },
  uploadAreaTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TOKENS.primary,
  },
  uploadAreaSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  imgContainerWrap: {
    position: 'relative' as const,
    width: '100%',
    height: 160,
    borderRadius: 12,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: '#F8FAFC',
  },
  premiumImagePreview: {
    width: '100%',
    height: '100%',
  },
  changeImageOverlay: {
    position: 'absolute' as const,
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeImageBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  changeImageText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  floatingRemoveBtn: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.1)',
  },
  imgUploadingOverlay: {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 12,
  },
  imgUploadingText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  // ── Standard upload placeholder & Fav edit styles ──
  standardPhotoPlaceholder: {
    width: '100%' as const,
    height: '100%' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F8FAFC',
  },
  standardPhotoPlaceholderText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#64748B',
    marginTop: 6,
  },
  favRemoveBtn: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    boxShadow: '0px 2px 3px 0px rgba(0, 0, 0, 0.15)',
    zIndex: 10,
  },
  // ── (old picker styles kept for reference, unused) ──
  imagePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  imagePreviewBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TOKENS.accentBlue,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreviewInner: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  imagePreviewCameraOverlay: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageOptionsScroll: {
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  imageOptionChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  imageOptionChipActive: {
    backgroundColor: TOKENS.lightBlue,
    borderColor: TOKENS.primary,
    borderWidth: 1.5,
  },
  imageOptionText: {
    fontSize: 20,
  },
  imageOptionChipUpload: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  imageUploadText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TOKENS.primary,
  },
  emptyStateCard: {
    width: '100%',
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    borderStyle: 'dashed',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    paddingHorizontal: 12,
  },
  // Camera overlay button on favorites grid cards
  favCameraBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(37, 99, 235, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.2)',
  },
  // Row wrapper for camera + add button in recents
  recentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Camera icon button in recents rows
  recentCameraBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Image picker bottom sheet ──
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    boxShadow: '0px -4px 16px 0px rgba(0, 0, 0, 0.12)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TOKENS.dark,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: TOKENS.muted,
    marginBottom: 20,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  sheetOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: {
    flex: 1,
    gap: 2,
  },
  sheetOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TOKENS.dark,
  },
  sheetOptionSub: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  sheetCancelBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: TOKENS.dark,
  },
});
