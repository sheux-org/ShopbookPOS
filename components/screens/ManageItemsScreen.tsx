import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { CameraView } from "expo-camera";
import { usePermission } from "../../hooks/usePermissionHandler";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { useDeleteProduct, useProducts, useUpdateProduct } from "../../hooks/useProducts";
import { deleteUploadThingFile, uploadToUploadThing } from "../../services/uploadQueue";
import { ProductImage } from "../common/ProductImage";

const CATEGORIES_LIST = ["grocery", "dairy", "drinks", "snacks", "household"];
const UNIT_TYPES = ["Pieces", "kg", "Liters", "Packets"];

export const ManageItemsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { requestCameraAccess } = usePermission();

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Barcode scanner states
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);

  const triggerBarcodeScanner = () => {
    requestCameraAccess(() => {
      setIsScanning(true);
    });
  };

  // Fetch products with search string (delegates query dynamically to WatermelonDB)
  const { data: productsList = [], isLoading } = useProducts(undefined, searchQuery);

  // Mutators
  const updateProductMutation = useUpdateProduct();
  const deleteProductMutation = useDeleteProduct();

  // Selected product for editing
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("grocery");
  const [editUnitType, setEditUnitType] = useState("Pieces");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editSalesPrice, setEditSalesPrice] = useState("");
  const [editStockCount, setEditStockCount] = useState("");
  const [editLowStock, setEditLowStock] = useState("");
  const [editQuickCode, setEditQuickCode] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editImageUploading, setEditImageUploading] = useState(false);

  // Bottom Sheet for Camera / Gallery
  const [imgSheetVisible, setImgSheetVisible] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  };

  const handleEditPress = (prod: any) => {
    setEditingProduct(prod);
    setEditName(prod.name);
    setEditCategory(prod.category || "grocery");
    setEditUnitType(prod.unitType || "Pieces");
    setEditCostPrice(prod.costPrice ? prod.costPrice.toString() : "");
    setEditSalesPrice(prod.price ? prod.price.toString() : "");
    setEditStockCount(prod.stockCount ? prod.stockCount.toString() : "0");
    setEditLowStock(prod.lowStockAlert ? prod.lowStockAlert.toString() : "5");
    setEditQuickCode(prod.quickCode || "");
    setEditBarcode(prod.barcode || "");
    setEditImage(prod.icon || "");
    setEditModalVisible(true);
  };

  const handleSelectProductByBarcode = async (barcode: string) => {
    try {
      const db = require("../../components/data/db").default;
      const { Q } = require("@nozbe/watermelondb");
      const { cartState } = require("../../components/data/cartState");
      const activeBiz = cartState.getActiveBusiness();

      const dbProducts = await db.get("products").query(
        Q.where("business_id", activeBiz.id),
        Q.where("barcode", barcode)
      ).fetch();

      if (dbProducts && dbProducts.length > 0) {
        const p = dbProducts[0];
        const stockCount = p.stockCount ?? 0;
        const stockType = stockCount === 0 ? "out" : stockCount <= 5 ? "low" : "normal";
        const stockText = stockType === "out" ? "Out of Stock" : stockType === "low" ? `Low · ${stockCount} remaining` : `${stockCount} in stock`;

        const mappedItem = {
          id: p.id,
          name: p.name,
          price: p.price,
          category: p.category ?? "grocery",
          icon: p.icon ?? "",
          stockCount,
          stockType,
          stockText,
          barcode: p.barcode,
          quickCode: p.quickCode,
          isFavorite: p.isFavorite ?? false,
          unitType: p.unitType ?? "Pieces",
          costPrice: p.costPrice,
          lowStockAlert: p.lowStockAlert ?? 5,
          createdAt: p.createdAt ? new Date(p.createdAt).getTime() : Date.now(),
        };

        // Open edit modal directly
        handleEditPress(mappedItem);
        triggerToast(`Selected: ${mappedItem.name} 🎯`);
      } else {
        triggerToast(`No item found for barcode: ${barcode} 🔍`);
      }
    } catch (error) {
      console.error("Failed to select product by barcode:", error);
      triggerToast("Error finding product ❌");
    }
  };

  const handleDeletePress = (prod: any) => {
    Alert.alert(
      "Delete Product",
      `Are you sure you want to permanently delete "${prod.name}" from your stocks? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteProductMutation.mutate(prod.id, {
              onSuccess: () => {
                triggerToast("Product deleted successfully! 🗑️");
              },
              onError: (err) => {
                Alert.alert("Error", "Failed to delete product.");
              },
            });
          },
        },
      ]
    );
  };

  // Image handling inside editing modal
  const handlePickImage = async (source: 'camera' | 'gallery') => {
    setImgSheetVisible(false);
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
    setEditImage("");
  };

  const handleUpdateProduct = () => {
    if (!editName || !editSalesPrice || !editStockCount) {
      Alert.alert("Required Fields Missing", "Please enter product name, selling price, and stock quantity.");
      return;
    }

    if (!editQuickCode && !editBarcode) {
      Alert.alert("Identification Required", "Please enter at least either a Quick Code or a Barcode.");
      return;
    }

    const priceNum = parseFloat(editSalesPrice);
    const costNum = parseFloat(editCostPrice) || priceNum * 0.8;
    const stockCountNum = parseInt(editStockCount, 10);
    const lowStockNum = parseInt(editLowStock, 10) || 5;

    if (isNaN(priceNum) || isNaN(stockCountNum)) {
      Alert.alert("Invalid input type", "Please check that price and stock fields contain valid numbers.");
      return;
    }

    updateProductMutation.mutate({
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
    }, {
      onSuccess: () => {
        triggerToast("Product updated! ✅");
        setEditModalVisible(false);
        setEditingProduct(null);
      },
      onError: () => {
        Alert.alert("Error", "Failed to update product details.");
      }
    });
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
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
          onPress={() => router.push("/stocks")}
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
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={TOKENS.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search items by name, code or category..."
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              if (scannedBarcode) setScannedBarcode(null);
            }}
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity onPress={() => {
              setSearchQuery("");
              setScannedBarcode(null);
            }}>
              <Feather name="x-circle" size={16} color={TOKENS.muted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={triggerBarcodeScanner}>
              <Ionicons name="qr-code-outline" size={16} color={TOKENS.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Products list container */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={TOKENS.primary} />
          <Text style={styles.loaderText}>Loading catalog items...</Text>
        </View>
      ) : (
        <FlatList
          data={productsList}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
          renderItem={({ item }) => {
            const isScannedMatch = scannedBarcode && item.barcode === scannedBarcode;
            return (
              <View style={[styles.productItemCard, isScannedMatch && styles.productItemCardActive]}>
                <ProductImage
                  icon={item.icon}
                  category={item.category}
                  size={47}
                  style={styles.productImage}
                />

                <View style={styles.productMetaCol}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
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
                        item.stockType === "low" && styles.stockLowText,
                        item.stockType === "out" && styles.stockOutText,
                      ]}
                    >
                      {item.stockCount} {item.unitType || "pcs"}
                    </Text>
                  </View>

                  <View style={styles.codesRow}>
                    {item.quickCode ? (
                      <View style={styles.codePill}>
                        <Text style={styles.codeText}>Code: {item.quickCode}</Text>
                      </View>
                    ) : null}
                    {item.barcode ? (
                      <View style={[styles.codePill, { backgroundColor: "#F1F5F9" }]}>
                        <Text style={styles.codeText}>Barcode: {item.barcode}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.codePill, { backgroundColor: "#EFF6FF" }]}>
                      <Text style={[styles.codeText, { color: TOKENS.primary }]}>
                        {item.category.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Actions row */}
                <View style={styles.itemActionCol}>
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
            )
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="box" size={48} color={TOKENS.muted} />
              <Text style={styles.emptyTitle}>No items found</Text>
              <Text style={styles.emptySub}>
                There are no products in stock matching your search query. Add items to catalog in the Stocks tab.
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={[styles.modalContainer, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}
        >
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
                      <Text style={[styles.selectorChipText, isSelected && styles.selectorChipTextActive]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
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

            {/* Double Row: Stock & Unit Type */}
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
                        <Text style={[styles.selectorChipText, isSelected && styles.selectorChipTextActive]}>
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
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
              <Text style={styles.fieldHelpText}>Tap preview to capture from camera or browse files</Text>

              <View style={styles.imgPickerPanel}>
                <TouchableOpacity
                  style={styles.imgPreviewWrap}
                  activeOpacity={0.85}
                  onPress={() => {
                    // Open prompt
                    Alert.alert(
                      "Capture or Choose",
                      "How would you like to pick a product photo?",
                      [
                        { text: "📷 Camera", onPress: () => handlePickImage("camera") },
                        { text: "🖼️ Gallery", onPress: () => handlePickImage("gallery") },
                        { text: "Cancel", style: "cancel" }
                      ]
                    );
                  }}
                  disabled={editImageUploading}
                >
                  <ProductImage
                    icon={editImage}
                    category={editCategory}
                    size={47}
                    style={{ width: 110, height: 110, borderRadius: 16 }}
                  />

                  {!editImageUploading && (
                    <View style={styles.imgCameraBadge}>
                      <Feather name="camera" size={14} color="#FFFFFF" />
                    </View>
                  )}

                  {editImageUploading && (
                    <View style={styles.imgUploadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>

                {editImageUploading ? (
                  <View style={styles.imgUploadingInfo}>
                    <ActivityIndicator size="small" color={TOKENS.primary} />
                    <Text style={styles.imgUploadingText}>Uploading image…</Text>
                  </View>
                ) : (editImage.startsWith('http') || editImage.startsWith('file://') || editImage.startsWith('/')) ? (
                  <View style={styles.imgRealPhotoInfo}>
                    <View style={styles.imgSuccessBadge}>
                      <Feather name="check-circle" size={16} color="#16A34A" />
                      <Text style={styles.imgSuccessText}>Photo ready</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.imgRemovePillBtn}
                      activeOpacity={0.8}
                      onPress={handleRemoveEditImage}
                    >
                      <Feather name="x" size={13} color={TOKENS.error} />
                      <Text style={styles.imgRemovePillText}>Remove photo</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.imgHintCol}>
                    <Feather name="upload-cloud" size={20} color="#94A3B8" />
                    <Text style={styles.imgHintTitle}>Tap to add a product photo</Text>
                    <Text style={styles.imgHintSub}>Take a photo or pick from gallery</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Large Update Button */}
            <TouchableOpacity
              style={styles.saveSubmitBtn}
              activeOpacity={0.85}
              onPress={handleUpdateProduct}
            >
              <Text style={styles.saveSubmitBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* SIMULATED HIGH-FIDELITY BARCODE SCANNER OVERLAY MODAL */}
      <Modal
        visible={isScanning}
        transparent
        animationType="fade"
        onRequestClose={() => setIsScanning(false)}
      >
        <View style={styles.scannerBg}>
          <View style={styles.scannerCard}>
            <View style={styles.scannerHeaderRow}>
              <Text style={styles.scannerTitle}>📷 Barcode Scanner Active</Text>
              <TouchableOpacity
                style={styles.closeScannerBtn}
                onPress={() => setIsScanning(false)}
              >
                <Feather name="x" size={20} color={TOKENS.dark} />
              </TouchableOpacity>
            </View>

            <Text style={styles.scannerInstruction}>
              Align the retail product barcode within the viewfinder to automatically scan and catalog
            </Text>

            {/* Viewfinder area with blinking animation and moving laser line */}
            <View style={styles.scannerViewfinder}>
              {isScanning ? (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  barcodeScannerSettings={{
                    barcodeTypes: ["upc_a", "upc_e", "ean13", "ean8", "qr", "code128", "code39"],
                  }}
                  onBarcodeScanned={async ({ type, data }) => {
                    setSearchQuery(data);
                    setScannedBarcode(data);
                    setIsScanning(false);
                    await handleSelectProductByBarcode(data);
                  }}
                />
              ) : null}

              {/* Four corners */}
              <View style={[styles.viewfinderCorner, styles.cornerTL]} />
              <View style={[styles.viewfinderCorner, styles.cornerTR]} />
              <View style={[styles.viewfinderCorner, styles.cornerBL]} />
              <View style={[styles.viewfinderCorner, styles.cornerBR]} />

              {/* Moving Laser line */}
              <View style={styles.scannerLaserLine} />

              <Text style={styles.scanningText}>SCANNING...</Text>
            </View>

            <TouchableOpacity
              style={styles.scannerForceScanBtn}
              activeOpacity={0.8}
              onPress={async () => {
                try {
                  const db = require("../../components/data/db").default;
                  const { Q } = require("@nozbe/watermelondb");
                  const { cartState } = require("../../components/data/cartState");
                  const activeBiz = cartState.getActiveBusiness();

                  // Query actual products in this business that have a barcode
                  const dbProducts = await db.get("products").query(
                    Q.where("business_id", activeBiz.id),
                    Q.where("barcode", Q.notEq(null)),
                    Q.where("barcode", Q.notEq(""))
                  ).fetch();

                  let targetBarcode = "";
                  if (dbProducts && dbProducts.length > 0) {
                    const randomProduct = dbProducts[Math.floor(Math.random() * dbProducts.length)];
                    targetBarcode = randomProduct.barcode;
                  } else {
                    // Fallback mock barcode
                    const mockBarcodes = [
                      "8901030777551",
                      "501234567890",
                      "4902430582766",
                      "7622300744961",
                    ];
                    targetBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
                  }

                  setSearchQuery(targetBarcode);
                  setScannedBarcode(targetBarcode);
                  setIsScanning(false);
                  await handleSelectProductByBarcode(targetBarcode);
                } catch (err) {
                  console.error("Instant mock scan error:", err);
                  setIsScanning(false);
                  triggerToast("Failed mock scan ❌");
                }
              }}
            >
              <Text style={styles.forceScanText}>⚡ Instant Capture</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  toastContainer: {
    position: "absolute",
    top: 90,
    alignSelf: "center",
    backgroundColor: TOKENS.success,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
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
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TOKENS.dark,
  },
  loaderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loaderText: {
    fontSize: 14,
    color: TOKENS.muted,
    marginTop: 12,
  },
  listContent: {
    padding: 12,
    gap: 12,
  },
  productItemCard: {
    flexDirection: "row",
    backgroundColor: TOKENS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingRight: 16,
    paddingLeft: 3,
    paddingTop: 3,
    paddingBottom: 3,
    gap: 12,
    alignItems: "center",
  },
  productImage: {
    width: 74,
    height: 74,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  productMetaCol: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  badgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  productPriceText: {
    fontSize: 13,
    fontWeight: "700",
    color: TOKENS.primary,
  },
  dotDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
  },
  productStockText: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.muted,
  },
  stockLowText: {
    color: TOKENS.warning,
  },
  stockOutText: {
    color: TOKENS.error,
  },
  codesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  codePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 10,
    fontWeight: "600",
    color: TOKENS.muted,
  },
  itemActionCol: {
    flexDirection: "row",
    alignSelf: "center",
    gap: 6,
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: TOKENS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  emptySub: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    lineHeight: 18,
  },

  // Modal styling
  modalContainer: {
    flex: 1,
    backgroundColor: TOKENS.background,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "bold",
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
    fontWeight: "600",
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  selectorChip: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  selectorChipActive: {
    backgroundColor: TOKENS.lightBlue,
    borderColor: TOKENS.primary,
  },
  selectorChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: TOKENS.muted,
  },
  selectorChipTextActive: {
    color: TOKENS.primary,
  },
  inputGridRow: {
    flexDirection: "row",
    gap: 12,
  },
  saveSubmitBtn: {
    backgroundColor: TOKENS.primary,
    borderRadius: 8,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveSubmitBtnText: {
    color: TOKENS.card,
    fontWeight: "bold",
    fontSize: 14,
  },

  // Centered Image Picker design styles matching StocksScreen exactly
  imgPickerPanel: {
    alignItems: 'center' as const,
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed' as const,
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 12,
  },
  imgPreviewWrap: {
    position: 'relative' as const,
    width: 110,
    height: 110,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imgCameraBadge: {
    position: 'absolute' as const,
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  imgUploadingOverlay: {
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 16,
  },
  imgUploadingInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  imgUploadingText: {
    fontSize: 13,
    color: TOKENS.primary,
    fontWeight: '600' as const,
  },
  imgRealPhotoInfo: {
    alignItems: 'center' as const,
    gap: 8,
  },
  imgSuccessBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  imgSuccessText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#16A34A',
  },
  imgRemovePillBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  imgRemovePillText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: TOKENS.error,
  },
  imgHintCol: {
    alignItems: 'center' as const,
    gap: 4,
  },
  imgHintTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: TOKENS.dark,
  },
  imgHintSub: {
    fontSize: 11,
    color: TOKENS.muted,
    textAlign: 'center' as const,
  },

  searchScanBtn: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  productItemCardActive: {
    borderColor: TOKENS.primary,
    borderWidth: 2,
    backgroundColor: "#EFF6FF", // Premium light-blue background highlight
  },
  scannedBadge: {
    backgroundColor: "#16A34A",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    gap: 2,
  },
  scannedBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "bold",
  },
  scannerBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  scannerCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  scannerHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  scannerTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  closeScannerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerInstruction: {
    fontSize: 12,
    color: TOKENS.muted,
    textAlign: "center",
    lineHeight: 16,
  },
  scannerViewfinder: {
    width: 220,
    height: 140,
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.3)",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  viewfinderCorner: {
    position: "absolute",
    width: 16,
    height: 16,
    borderColor: TOKENS.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  scannerLaserLine: {
    position: "absolute",
    width: "90%",
    height: 2,
    backgroundColor: "#EF4444",
    top: "50%",
  },
  scanningText: {
    position: "absolute",
    bottom: 10,
    fontSize: 10,
    fontWeight: "bold",
    color: TOKENS.primary,
    letterSpacing: 1.5,
  },
  scannerForceScanBtn: {
    backgroundColor: TOKENS.primary,
    height: 40,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  forceScanText: {
    color: TOKENS.card,
    fontSize: 14,
    fontWeight: "bold",
  },
});
