import { Feather, Ionicons } from '@expo/vector-icons';
import { SearchInput } from '../common/SearchInput';
import { BarcodeScannerModal } from '../common/BarcodeScannerModal';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticFeedback } from '../../utils/haptics';
import { TOKENS } from '../../constants/tokens';
import { usePermission } from '../../hooks/usePermissionHandler';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { PremiumUpgradeModal } from '../common/PremiumUpgradeModal';
import {
  useDeleteProduct,
  useProducts,
  useUpdateProduct,
  useFindProductByBarcode,
} from '../../hooks/useProducts';
import { deleteUploadThingFile, uploadToUploadThing } from '../../services/uploadQueue';
import { ProductImage } from '../common/ProductImage';
import { ScreenWrapper } from '../common/ScreenWrapper';
import { useActiveBusiness } from '../../hooks/useActiveBusiness';
import { getBusinessTypeConfig, getCategoryLabel } from '../../utils/businessTypeConfig';

export const ManageItemsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requestCameraAccess } = usePermission();
  const isPremium = useSettingsStore((s) => s.isPremium);
  const [premiumModalVisible, setPremiumModalVisible] = useState(false);

  const activeBiz = useActiveBusiness();
  const config = getBusinessTypeConfig(activeBiz?.category);
  const CATEGORIES_LIST = config.categories;
  const UNIT_TYPES = config.unitTypes;

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Barcode scanner states
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const triggerBarcodeScanner = () => {
    if (isPremium) {
      requestCameraAccess(() => {
        setIsScanning(true);
      });
    } else {
      setPremiumModalVisible(true);
    }
  };

  const {
    data: productsList = [],
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProducts(undefined, searchQuery);

  // Mutators
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();
  const findProductByBarcode = useFindProductByBarcode();

  // Selected product for editing
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState(config.defaultCategory);
  const [editUnitType, setEditUnitType] = useState(config.defaultUnitType);
  const [editCostPrice, setEditCostPrice] = useState('');
  const [editSalesPrice, setEditSalesPrice] = useState('');
  const [editStockCount, setEditStockCount] = useState('');
  const [editLowStock, setEditLowStock] = useState('');
  const [editQuickCode, setEditQuickCode] = useState('');
  const [editBarcode, setEditBarcode] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editImageUploading, setEditImageUploading] = useState(false);

  const handleProductCardPress = (prod: any) => {
    router.push({
      pathname: '/stocks/item-details',
      params: { id: prod.id },
    });
  };

  // Image picker bottom sheet state
  const [imgSheetVisible, setImgSheetVisible] = useState(false);
  const imgSheetAnim = useRef(new Animated.Value(300)).current;

  const openImgSheet = () => {
    setImgSheetVisible(true);
    Animated.spring(imgSheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  const closeImgSheet = () => {
    Animated.timing(imgSheetAnim, {
      toValue: 300,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setImgSheetVisible(false));
  };

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  };

  const handleEditPress = (prod: any) => {
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditCategory(prod.category || config.defaultCategory);
    setEditUnitType(prod.unitType || config.defaultUnitType);
    setEditCostPrice(prod.costPrice ? prod.costPrice.toString() : '');
    setEditSalesPrice(prod.price ? prod.price.toString() : '');
    setEditStockCount(prod.stockCount ? prod.stockCount.toString() : '0');
    setEditLowStock(prod.lowStockAlert ? prod.lowStockAlert.toString() : '5');
    setEditQuickCode(prod.quickCode || '');
    setEditBarcode(prod.barcode || '');
    setEditImage(prod.icon || '');
    setEditModalVisible(true);
  };

  const handleSelectProductByBarcode = async (barcode: string) => {
    try {
      const product = await findProductByBarcode(barcode);

      if (product) {
        // Open edit modal directly
        handleEditPress(product);
        triggerToast(`Selected: ${product.name} 🎯`);
      } else {
        triggerToast(`No item found for barcode: ${barcode} 🔍`);
      }
    } catch (error) {
      console.error('Failed to select product by barcode:', error);
      triggerToast('Error finding product ❌');
    }
  };

  const handleDeletePress = (prod: any) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to permanently delete "${prod.name}" from your stocks? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProductMutation.mutate(prod.id, {
              onSuccess: () => {
                triggerToast('Product deleted successfully! 🗑️');
              },
              onError: (err) => {
                Alert.alert('Error', 'Failed to delete product.');
              },
            });
          },
        },
      ]
    );
  };

  // Image handling inside editing modal
  const handlePickImage = async (source: 'camera' | 'gallery') => {
    closeImgSheet();

    // Small delay to let the sheet close before opening picker
    await new Promise((r) => setTimeout(r, 280));

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

    setEditImage(localUri);
    setEditImageUploading(true);
    triggerToast('Uploading image... ⏳');

    try {
      const remoteUrl = await uploadToUploadThing(localUri);
      if (remoteUrl) {
        setEditImage(remoteUrl);
        triggerToast('Image uploaded! ✅');
      } else {
        triggerToast('Upload failed — saved local preview');
      }
    } catch {
      triggerToast('Upload error — saved local preview');
    } finally {
      setEditImageUploading(false);
    }
  };

  const handleRemoveEditImage = async () => {
    if (editImage.startsWith('http')) {
      await deleteUploadThingFile(editImage);
    }
    setEditImage('');
  };

  const handleUpdateProduct = () => {
    if (!editName || !editSalesPrice || !editStockCount) {
      Alert.alert(
        'Required Fields Missing',
        'Please enter product name, selling price, and stock quantity.'
      );
      return;
    }

    if (!editQuickCode && !editBarcode) {
      Alert.alert(
        'Identification Required',
        'Please enter at least either a Quick Code or a Barcode.'
      );
      return;
    }

    const priceNum = parseFloat(editSalesPrice);
    const costNum = parseFloat(editCostPrice) || priceNum * 0.8;
    const stockCountNum = parseInt(editStockCount, 10);
    if (isNaN(priceNum) || isNaN(stockCountNum)) {
      Alert.alert(
        'Invalid input type',
        'Please check that price and stock fields contain valid numbers.'
      );
      return;
    }

    updateProductMutation.mutate(
      {
        id: editingProduct.id,
        name: editName,
        price: priceNum,
        category: editCategory,
        icon: editImage,
        stockCount: stockCountNum,
        unitType: editUnitType,
        costPrice: costNum,
        quickCode: editQuickCode || undefined,
        barcode: editBarcode || undefined,
        lowStockAlert: parseInt(editLowStock, 10) || 5,
      },
      {
        onSuccess: () => {
          triggerToast('Product updated! ✅');
          setEditModalVisible(false);
          setEditingProduct(null);
        },
        onError: () => {
          Alert.alert('Error', 'Failed to update product details.');
        },
      }
    );
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

      {/* Header exactly matching POS screen header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push('/stocks')}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Manage Items</Text>
          <Text style={styles.headerSubtitle}>{productsList.length} items registered</Text>
        </View>
      </View>

      {/* Search Input Box */}
      <View style={styles.searchContainer}>
        <SearchInput
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            if (scannedBarcode) setScannedBarcode(null);
          }}
          placeholder="Search items by name, code or category..."
          onScanPress={triggerBarcodeScanner}
          onClear={() => {
            setScannedBarcode(null);
          }}
        />
      </View>

      {/* Products list container */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={TOKENS.primary} />
          <Text style={styles.loaderText}>Loading catalog items...</Text>
        </View>
      ) : (
        <FlashList
          data={productsList}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item }) => {
            const isScannedMatch = scannedBarcode && item.barcode === scannedBarcode;
            return (
              <View
                style={[styles.productItemCard, isScannedMatch && styles.productItemCardActive]}
              >
                <TouchableOpacity
                  style={styles.productCardBody}
                  activeOpacity={0.7}
                  onPress={() => handleProductCardPress(item)}
                >
                  <ProductImage
                    icon={item.icon}
                    category={item.category}
                    size={47}
                    style={styles.productImage}
                  />

                  <View style={styles.productMetaCol}>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Text style={[styles.productName, { flexShrink: 1 }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isScannedMatch && (
                        <View style={styles.scannedBadge}>
                          <Feather name="check" size={10} color="#FFFFFF" />
                          <Text style={styles.scannedBadgeText}>MATCH</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.badgesRow}>
                      <Text style={styles.productPriceText}>Rs. {item.price.toLocaleString()}</Text>
                      <View style={styles.dotDivider} />
                      <Text
                        style={[
                          styles.productStockText,
                          item.stockType === 'low' && styles.stockLowText,
                          item.stockType === 'out' && styles.stockOutText,
                        ]}
                      >
                        {item.stockCount} {item.unitType || 'pcs'}
                      </Text>
                    </View>

                    <View style={styles.codesRow}>
                      {item.quickCode ? (
                        <View style={styles.codePill}>
                          <Text style={styles.codeText}>Code: {item.quickCode}</Text>
                        </View>
                      ) : null}
                      {item.barcode ? (
                        <View style={[styles.codePill, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={styles.codeText}>Barcode: {item.barcode}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.codePill, { backgroundColor: '#EFF6FF' }]}>
                        <Text style={[styles.codeText, { color: TOKENS.primary }]}>
                          {item.category.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Actions column */}
                <View style={styles.itemActionCol}>
                  <View style={styles.editDeleteRow}>
                    <TouchableOpacity
                      style={styles.editIconBtn}
                      activeOpacity={0.7}
                      onPress={() => handleEditPress(item)}
                    >
                      <Feather name="edit-2" size={15} color={TOKENS.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteIconBtn}
                      activeOpacity={0.7}
                      onPress={() => handleDeletePress(item)}
                    >
                      <Feather name="trash-2" size={15} color={TOKENS.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="box" size={48} color={TOKENS.muted} />
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySub}>
                There are no products in stock matching your search query. Add items to catalog in
                the Stocks tab.
              </Text>
            </View>
          }
        />
      )}

      {/* FULL-SCREEN EDIT MODAL */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <ScreenWrapper withKeyboard style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.backButton}
              activeOpacity={0.7}
              onPress={() => setEditModalVisible(false)}
            >
              <Feather name="x" size={22} color={TOKENS.dark} />
            </TouchableOpacity>

            <View style={styles.headerTitleWrapper}>
              <Text style={styles.headerTitle}>Edit Product</Text>
              <Text style={styles.headerSubtitle}>Modify details and save changes</Text>
            </View>

            <TouchableOpacity
              style={styles.modalSaveBtnHeader}
              activeOpacity={0.7}
              onPress={handleUpdateProduct}
            >
              <Text style={styles.modalSaveTextHeader}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Modal Form ScrollView */}
          <ScrollView
            style={styles.modalFormScroll}
            contentContainerStyle={[styles.modalFormContent, { paddingBottom: 60 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Field: Name */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Product Name *</Text>
              <TextInput
                style={styles.formInput}
                placeholder="e.g. Anchor Milk Powder 400g"
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor="#A0AEC0"
              />
            </View>

            {/* Field: Category Selector */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Category</Text>
              <View style={styles.chipsSelector}>
                {CATEGORIES_LIST.map((cat) => {
                  const isSelected = editCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.selectorChip, isSelected && styles.selectorChipActive]}
                      onPress={() => setEditCategory(cat)}
                    >
                      <Text
                        style={[
                          styles.selectorChipText,
                          isSelected && styles.selectorChipTextActive,
                        ]}
                      >
                        {getCategoryLabel(cat, activeBiz?.category)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Double Row: Price & Cost Price */}
            <View style={styles.inputGridRow}>
              <View style={[styles.fieldRow, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Selling Price (Rs.) *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="0.00"
                  value={editSalesPrice}
                  onChangeText={setEditSalesPrice}
                  keyboardType="numeric"
                  placeholderTextColor="#A0AEC0"
                />
              </View>

              <View style={[styles.fieldRow, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Cost Price (Rs.)</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="0.00"
                  value={editCostPrice}
                  onChangeText={setEditCostPrice}
                  keyboardType="numeric"
                  placeholderTextColor="#A0AEC0"
                />
              </View>
            </View>

            {/* Double Row: Stock & Low Alert Level */}
            <View style={styles.inputGridRow}>
              <View style={[styles.fieldRow, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Stock Quantity *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 50"
                  value={editStockCount}
                  onChangeText={setEditStockCount}
                  keyboardType="numeric"
                  placeholderTextColor="#A0AEC0"
                />
              </View>

              <View style={[styles.fieldRow, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Low Alert Level</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 5"
                  value={editLowStock}
                  onChangeText={setEditLowStock}
                  keyboardType="numeric"
                  placeholderTextColor="#A0AEC0"
                />
              </View>
            </View>

            {/* Field: Unit Type */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Unit Type</Text>
              <View style={styles.chipsSelector}>
                {UNIT_TYPES.map((unit) => {
                  const isSelected = editUnitType === unit;
                  return (
                    <TouchableOpacity
                      key={unit}
                      style={[styles.selectorChip, isSelected && styles.selectorChipActive]}
                      onPress={() => setEditUnitType(unit)}
                    >
                      <Text
                        style={[
                          styles.selectorChipText,
                          isSelected && styles.selectorChipTextActive,
                        ]}
                      >
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Identification row */}
            <View style={styles.inputGridRow}>
              <View style={[styles.fieldRow, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Quick Code</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 101"
                  value={editQuickCode}
                  onChangeText={setEditQuickCode}
                  keyboardType="numeric"
                  maxLength={6}
                  placeholderTextColor="#A0AEC0"
                />
              </View>

              <View style={[styles.fieldRow, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Barcode</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 4792002340..."
                  value={editBarcode}
                  onChangeText={setEditBarcode}
                  keyboardType="numeric"
                  placeholderTextColor="#A0AEC0"
                />
              </View>
            </View>

            {/* 📸 Brand-identical dashed centered product photo picker 📸 */}
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Product Image</Text>
              <Text style={styles.fieldHelpText}>
                Tap preview to capture from camera or browse files
              </Text>

              <View style={styles.imgPickerPanel}>
                {editImage ? (
                  <View style={styles.imgContainerWrap}>
                    <ProductImage
                      icon={editImage}
                      category={editCategory}
                      size={160}
                      style={styles.premiumImagePreview}
                    />

                    {/* Change Button Overlay */}
                    {!editImageUploading && (
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
                          <Text style={styles.changeImageText}>Change Image</Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Delete Floating Pill */}
                    {!editImageUploading && (
                      <TouchableOpacity
                        style={styles.floatingRemoveBtn}
                        activeOpacity={0.8}
                        onPress={handleRemoveEditImage}
                      >
                        <Feather name="trash-2" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}

                    {/* Loading overlay */}
                    {editImageUploading && (
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
                      disabled={editImageUploading}
                    >
                      <View style={styles.uploadIconCircle}>
                        <Ionicons name="cloud-upload-outline" size={24} color={TOKENS.primary} />
                      </View>
                      <Text style={styles.uploadAreaTitle}>Upload Product Image</Text>
                      <Text style={styles.uploadAreaSubtitle}>
                        Tap to take a photo or select from gallery
                      </Text>
                    </TouchableOpacity>

                    {/* Loading overlay for empty image state */}
                    {editImageUploading && (
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
          </ScrollView>

          {/* Fixed Bottom Footer for Update Button */}
          <View style={[styles.modalFooter, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TouchableOpacity
              style={styles.saveSubmitBtn}
              activeOpacity={0.85}
              onPress={handleUpdateProduct}
            >
              <Text style={styles.saveSubmitBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </ScreenWrapper>
      </Modal>

      {/* SIMULATED HIGH-FIDELITY BARCODE SCANNER OVERLAY MODAL */}
      <BarcodeScannerModal
        visible={isScanning}
        onClose={() => setIsScanning(false)}
        onBarcodeScanned={async (data) => {
          setSearchQuery(data);
          setScannedBarcode(data);
          setIsScanning(false);
          await handleSelectProductByBarcode(data);
        }}
      />

      {/* ── Image Picker Bottom Sheet ── */}
      <Modal
        visible={imgSheetVisible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeImgSheet}
      >
        {/* Scrim — tap to dismiss */}
        <Pressable style={styles.sheetScrim} onPress={closeImgSheet}>
          <Animated.View
            style={[styles.sheetContainer, { transform: [{ translateY: imgSheetAnim }] }]}
          >
            {/* Stop tap-through on the sheet itself */}
            <Pressable onPress={(e) => e.stopPropagation()}>
              {/* Drag handle */}
              <View style={styles.sheetHandle} />

              <Text style={styles.sheetTitle}>Product Photo</Text>
              <Text style={styles.sheetSubtitle}>Choose how to add an image for this product</Text>

              {/* Camera option */}
              <TouchableOpacity
                style={styles.sheetOption}
                activeOpacity={0.75}
                onPress={() => {
                  hapticFeedback.impactMedium();
                  handlePickImage('camera');
                }}
              >
                <View style={[styles.sheetOptionIcon, { backgroundColor: TOKENS.lightBlue }]}>
                  <Feather name="camera" size={22} color={TOKENS.primary} />
                </View>
                <View style={styles.sheetOptionText}>
                  <Text style={styles.sheetOptionTitle}>Camera</Text>
                  <Text style={styles.sheetOptionSub}>Take a new photo right now</Text>
                </View>
                <Feather name="chevron-right" size={18} color={TOKENS.muted} />
              </TouchableOpacity>

              {/* Gallery option */}
              <TouchableOpacity
                style={styles.sheetOption}
                activeOpacity={0.75}
                onPress={() => {
                  hapticFeedback.impactMedium();
                  handlePickImage('gallery');
                }}
              >
                <View style={[styles.sheetOptionIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Feather name="image" size={22} color="#16A34A" />
                </View>
                <View style={styles.sheetOptionText}>
                  <Text style={styles.sheetOptionTitle}>Photo Library</Text>
                  <Text style={styles.sheetOptionSub}>Pick from your gallery</Text>
                </View>
                <Feather name="chevron-right" size={18} color={TOKENS.muted} />
              </TouchableOpacity>

              {/* Cancel */}
              <TouchableOpacity
                style={styles.sheetCancelBtn}
                activeOpacity={0.8}
                onPress={() => {
                  hapticFeedback.selection();
                  closeImgSheet();
                }}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <PremiumUpgradeModal
        visible={premiumModalVisible}
        onClose={() => setPremiumModalVisible(false)}
        featureName="In-app barcode catalog scanning"
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
  headerTitleWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 1,
  },
  searchContainer: {
    padding: 12,
    backgroundColor: TOKENS.card,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loaderText: {
    fontSize: 14,
    color: TOKENS.muted,
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  productItemCard: {
    flexDirection: 'row',
    backgroundColor: TOKENS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingRight: 16,
    paddingLeft: 3,
    paddingTop: 3,
    paddingBottom: 3,
    gap: 12,
    alignItems: 'center',
  },
  productImage: {
    width: 74,
    height: 74,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  productMetaCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.primary,
  },
  dotDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  productStockText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  stockLowText: {
    color: TOKENS.warning,
  },
  stockOutText: {
    color: TOKENS.error,
  },
  codesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  codePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 10,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  itemActionCol: {
    flexDirection: 'column',
    alignSelf: 'center',
    gap: 6,
  },
  editDeleteRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stockInLabelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 28,
    borderRadius: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 4,
    width: 70,
  },
  stockInLabelText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: 'bold',
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TOKENS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  emptySub: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal styling
  modalContainer: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: TOKENS.card,
  },
  modalSaveBtnHeader: {
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 15,
  },
  modalSaveTextHeader: {
    color: TOKENS.card,
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalFormScroll: {
    flex: 1,
  },
  modalFormContent: {
    padding: 16,
    gap: 14,
  },
  fieldRow: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.dark,
  },
  fieldHelpText: {
    fontSize: 11,
    color: TOKENS.muted,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: TOKENS.card,
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
    borderColor: '#E5E7EB',
  },
  selectorChipActive: {
    backgroundColor: TOKENS.lightBlue,
    borderColor: TOKENS.primary,
  },
  selectorChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: TOKENS.muted,
  },
  selectorChipTextActive: {
    color: TOKENS.primary,
  },
  inputGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  saveSubmitBtn: {
    backgroundColor: TOKENS.primary,
    borderRadius: 8,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    boxShadow: `0px 2px 4px 0px ${TOKENS.primary}33`,
  },
  saveSubmitBtnText: {
    color: TOKENS.card,
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Centered Image Picker design styles matching StocksScreen exactly
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
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 12,
  },
  imgUploadingText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    backgroundColor: TOKENS.card,
  },

  searchScanBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productItemCardActive: {
    borderColor: TOKENS.primary,
    borderWidth: 2,
    backgroundColor: '#EFF6FF', // Premium light-blue background highlight
  },
  scannedBadge: {
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    gap: 2,
  },
  scannedBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  productCardBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetHeaderWrapper: {
    gap: 12,
    marginBottom: 16,
  },
  sheetProductCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingRight: 16,
    paddingLeft: 3,
    paddingTop: 3,
    paddingBottom: 3,
    gap: 12,
    alignItems: 'center',
  },
  sheetProductImage: {
    width: 74,
    height: 74,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  sheetProductMeta: {
    flex: 1,
    gap: 4,
  },
  sheetProductName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  sheetProductBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  sheetPricesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  sheetPriceLabel: {
    fontSize: 10,
    color: TOKENS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetPriceVal: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.primary,
  },
  sheetPriceValSec: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.dark,
  },
  sheetPriceDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#E2E8F0',
  },
  marginBadge: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-end',
  },
  marginBadgeText: {
    color: '#16A34A',
    fontSize: 9,
    fontWeight: 'bold',
  },
  sheetStatusPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 8,
  },
  statusPanelCol: {
    gap: 2,
  },
  statusPanelLabel: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  statusPanelCount: {
    fontSize: 18,
    fontWeight: '800',
    color: TOKENS.dark,
  },
  statusPanelUnit: {
    fontSize: 12,
    fontWeight: 'normal',
    color: TOKENS.muted,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPillWarning: {
    backgroundColor: '#FFFBEB',
  },
  statusPillError: {
    backgroundColor: '#FEF2F2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: TOKENS.success,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: TOKENS.success,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 16,
  },
  stockAdjustmentForm: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginBottom: 6,
  },
  stockInRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputWithSuffix: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.card,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    height: 38,
    overflow: 'hidden',
  },
  suffixInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 12,
    fontSize: 13,
    color: TOKENS.dark,
  },
  suffixContainer: {
    backgroundColor: '#F1F5F9',
    height: '100%',
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: TOKENS.border,
  },
  suffixText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 6,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  suggestionChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  suggestionChipText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  suggestionChipTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  stockInSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: TOKENS.success,
    height: 40,
    borderRadius: 8,
    marginTop: 12,
  },
  stockInSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  // Removed unused stockInIconBtn style
  logCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: TOKENS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
    gap: 12,
    boxShadow: '0px 1px 3px 0px rgba(15, 23, 42, 0.03)',
  },
  logLeftCol: {
    justifyContent: 'center',
  },
  logBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  logBadgeIn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  logBadgeOut: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  logBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  logBadgeTextIn: {
    color: '#059669',
  },
  logBadgeTextOut: {
    color: '#DC2626',
  },
  logMeta: {
    flex: 1,
    gap: 3,
  },
  logReasonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  logDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logDateText: {
    fontSize: 11,
    color: '#64748B',
  },
  logQtyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logQtyBadgeIn: {
    backgroundColor: '#D1FAE5',
  },
  logQtyBadgeOut: {
    backgroundColor: '#FEE2E2',
  },
  logQtyText: {
    fontSize: 12,
    fontWeight: '800',
  },
  logQtyTextIn: {
    color: '#047857',
  },
  logQtyTextOut: {
    color: '#B91C1C',
  },
  emptyLogsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyLogsTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  emptyLogsSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
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
  standardPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  standardPhotoPlaceholderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 4,
  },
});
