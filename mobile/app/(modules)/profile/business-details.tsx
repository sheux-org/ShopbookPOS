import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { TOKENS } from "../../../constants/tokens";
import { useUserPermissions } from "../../../hooks/useUserPermissions";
import { useUpdateActiveBusiness, useUploadBusinessLogo } from "../../../hooks/useBusinesses";
import { useBusinessStore } from "../../../stores/useBusinessStore";
import { BottomSheet } from "../../../components/common/BottomSheet";
import { BusinessAvatar } from "../../../components/common/BusinessAvatar";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { hapticFeedback } from "../../../utils/haptics";

const PRESET_EMOJIS = ["🛒", "🛍️", "🥛", "👕", "💊", "☕", "🍔", "📦", "🌾", "🏢", "🛠️", "📚"];

export default function BusinessDetailsRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canPerform } = useUserPermissions();

  const activeBusiness = useBusinessStore((state) => state.activeBusiness);
  const hapticsEnabled = useSettingsStore((state) => state.hapticsEnabled);
  const toggleHaptics = useSettingsStore((state) => state.toggleHaptics);
  
  const handleToggleHaptics = () => {
    toggleHaptics();
    if (!hapticsEnabled) {
      setTimeout(() => {
        hapticFeedback.impactLight();
      }, 50);
    }
  };

  const updateActiveBizMutation = useUpdateActiveBusiness();
  const uploadLogoMutation = useUploadBusinessLogo();
  const isUploading = uploadLogoMutation.isPending;
  
  // Edit form states
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(activeBusiness.name);
  const [category, setCategory] = useState(activeBusiness.category);
  const [address, setAddress] = useState(activeBusiness.address);
  const [phone, setPhone] = useState(activeBusiness.phone);
  const [logoUri, setLogoUri] = useState(activeBusiness.logoUri || "");

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showLogoSelector, setShowLogoSelector] = useState(false);

  // Sync edit form states if activeBusiness changes externally
  useEffect(() => {
    setName(activeBusiness.name);
    setCategory(activeBusiness.category);
    setAddress(activeBusiness.address);
    setPhone(activeBusiness.phone);
    setLogoUri(activeBusiness.logoUri || "");
  }, [activeBusiness]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "We need camera roll permissions to upload a custom logo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const localUri = asset.uri;
        const base64Str = asset.base64;
        setShowLogoSelector(false);
        
        try {
          const publicUrl = await uploadLogoMutation.mutateAsync({ 
            uri: localUri, 
            base64: base64Str ?? undefined,
            businessId: activeBusiness.id 
          });
          setLogoUri(publicUrl);
          triggerToast("Logo uploaded successfully! 🚀");
        } catch (uploadError: any) {
          console.error("Upload failed:", uploadError);
          Alert.alert("Upload Failed", uploadError?.message || "Could not upload image to cloud storage.");
        }
      }
    } catch (error) {
      console.error("Failed to pick image:", error);
      Alert.alert("Error", "Failed to select image from photo library.");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "We need camera permissions to capture a photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const localUri = asset.uri;
        const base64Str = asset.base64;
        setShowLogoSelector(false);
        
        try {
          const publicUrl = await uploadLogoMutation.mutateAsync({ 
            uri: localUri, 
            base64: base64Str ?? undefined,
            businessId: activeBusiness.id 
          });
          setLogoUri(publicUrl);
          triggerToast("Logo uploaded successfully! 🚀");
        } catch (uploadError: any) {
          console.error("Upload failed:", uploadError);
          Alert.alert("Upload Failed", uploadError?.message || "Could not upload image to cloud storage.");
        }
      }
    } catch (error) {
      console.error("Failed to take photo:", error);
      Alert.alert("Error", "Failed to launch camera.");
    }
  };

  const handleSaveChanges = () => {
    if (!canPerform("update", "settings")) {
      Alert.alert("Access Denied", "Your profile role is not authorized to edit business settings.");
      return;
    }

    if (!name.trim() || !category.trim() || !address.trim() || !phone.trim()) {
      Alert.alert("Required Fields", "All business profile fields must be filled out.");
      return;
    }

    updateActiveBizMutation.mutate({
      name: name.trim(),
      category: category.trim(),
      address: address.trim(),
      phone: phone.trim(),
      logoUri: logoUri,
    }, {
      onSuccess: () => {
        setIsEditing(false);
        triggerToast("Store Profile updated successfully! 🚀");
      },
      onError: () => {
        Alert.alert("Update Error", "Failed to persist business profile changes.");
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/profile")}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Store Details</Text>
        
        {(() => {
          if (!canPerform("update", "settings")) return null;

          return (
            <TouchableOpacity
              style={styles.editToggleBtn}
              activeOpacity={0.7}
              onPress={() => {
                if (isEditing) {
                  // Cancel edit
                  setName(activeBusiness.name);
                  setCategory(activeBusiness.category);
                  setAddress(activeBusiness.address);
                  setPhone(activeBusiness.phone);
                  setLogoUri(activeBusiness.logoUri || "");
                }
                setIsEditing(!isEditing);
              }}
            >
              <Text style={styles.editToggleText}>{isEditing ? "Cancel" : "Edit"}</Text>
            </TouchableOpacity>
          );
        })()}
      </View>

      <ScrollView 
        style={styles.scrollWrapper} 
        contentContainerStyle={[
          styles.scrollContent,
          isEditing && { paddingBottom: 100 }
        ]}
      >
        {/* Business Main Card */}
        <View style={styles.detailCard}>
          <TouchableOpacity 
            style={[styles.storeIconBox, isEditing && styles.storeIconBoxEditing]} 
            disabled={!isEditing || isUploading}
            onPress={() => setShowLogoSelector(true)}
            activeOpacity={0.75}
          >
            <BusinessAvatar 
              logoUri={logoUri} 
              name={name || activeBusiness.name} 
              size={72} 
              isUploading={isUploading}
            />
            
            {isEditing && !isUploading && (
              <View style={styles.cameraOverlay}>
                <Feather name="camera" size={16} color={TOKENS.card} />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.storeName}>{isEditing ? name : activeBusiness.name}</Text>
          <Text style={styles.storeStatus}>
            {isEditing ? "Tap icon to change profile image 📸" : "🛡️ Admin Control Terminal"}
          </Text>
        </View>

        {/* Haptics Switch Toggle */}
        <View style={styles.infoGroup}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "bold", color: TOKENS.dark }}>Haptic Feedback</Text>
              <Text style={{ fontSize: 11, color: TOKENS.muted, marginTop: 4 }}>
                {hapticsEnabled 
                  ? "Vibration feedback is active across the app" 
                  : "Enable tactile vibration feedback for interactions"}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={handleToggleHaptics}
              style={[
                styles.switchButton, 
                hapticsEnabled ? styles.switchButtonActive : styles.switchButtonInactive
              ]}
              activeOpacity={0.8}
            >
              <View style={[
                styles.switchThumb, 
                hapticsEnabled ? styles.switchThumbActive : styles.switchThumbInactive
              ]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Group */}
        <View style={styles.infoGroup}>
          <Text style={styles.groupLabel}>Administrative Profile</Text>

          {/* Business Name Field */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Business Name</Text>
            {isEditing ? (
              <TextInput
                style={styles.inputField}
                value={name}
                onChangeText={setName}
                placeholder="Enter Business Name"
                placeholderTextColor={TOKENS.muted}
              />
            ) : (
              <Text style={styles.infoVal}>{activeBusiness.name}</Text>
            )}
          </View>

          {/* Business Type Field */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Business Type / Category</Text>
            {isEditing ? (
              <TextInput
                style={styles.inputField}
                value={category}
                onChangeText={setCategory}
                placeholder="Enter Category (e.g. Supermarket & Groceries)"
                placeholderTextColor={TOKENS.muted}
              />
            ) : (
              <Text style={styles.infoVal}>{activeBusiness.category}</Text>
            )}
          </View>

          {/* Address Field */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address</Text>
            {isEditing ? (
              <TextInput
                style={styles.inputField}
                value={address}
                onChangeText={setAddress}
                placeholder="Enter Address"
                placeholderTextColor={TOKENS.muted}
              />
            ) : (
              <Text style={styles.infoVal}>{activeBusiness.address}</Text>
            )}
          </View>

          {/* Phone Field */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            {isEditing ? (
              <TextInput
                style={styles.inputField}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="Enter Phone Number"
                placeholderTextColor={TOKENS.muted}
              />
            ) : (
              <Text style={styles.infoVal}>{activeBusiness.phone}</Text>
            )}
          </View>

          {/* Static details showing admin privileges */}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Admin Privilege Status</Text>
            <Text style={[styles.infoVal, { color: TOKENS.success }]}>FULL READ-WRITE PRIVILEGES</Text>
          </View>
        </View>

      </ScrollView>

      {isEditing && (
        <View style={[styles.fixedBottomContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.saveButton}
            activeOpacity={0.8}
            onPress={handleSaveChanges}
          >
            <Feather name="check" size={16} color={TOKENS.card} />
            <Text style={styles.saveButtonText}>Update Details</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* LOGO SELECTOR BOTTOM SHEET */}
      <BottomSheet
        visible={showLogoSelector}
        onClose={() => setShowLogoSelector(false)}
        title="Choose Profile Image"
      >
        <View style={styles.sheetBody}>
          {/* Option 1: Gallery Picker */}
          <TouchableOpacity style={styles.pickerOptionBtn} onPress={handlePickImage}>
            <View style={styles.pickerOptionIcon}>
              <Feather name="image" size={20} color={TOKENS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickerOptionTitle}>Select from Gallery</Text>
              <Text style={styles.pickerOptionSub}>Choose a custom photo or logo</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Option 2: Live Camera Capture */}
          <TouchableOpacity style={styles.pickerOptionBtn} onPress={handleTakePhoto}>
            <View style={styles.pickerOptionIcon}>
              <Feather name="camera" size={20} color={TOKENS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickerOptionTitle}>Take Photo</Text>
              <Text style={styles.pickerOptionSub}>Capture a live image via camera</Text>
            </View>
            <Feather name="chevron-right" size={16} color={TOKENS.muted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Option 2: Presets */}
          <Text style={styles.sectionLabel}>Quick Emoji Presets</Text>
          <View style={styles.presetsGrid}>
            {PRESET_EMOJIS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.presetCell,
                  logoUri === emoji && styles.presetCellSelected
                ]}
                onPress={() => {
                  setLogoUri(emoji);
                  setShowLogoSelector(false);
                }}
              >
                <Text style={styles.presetEmojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {logoUri ? (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.removeLogoBtn}
                onPress={() => {
                  setLogoUri("");
                  setShowLogoSelector(false);
                }}
              >
                <Feather name="trash-2" size={16} color={TOKENS.error} />
                <Text style={styles.removeLogoText}>Remove Custom Logo</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

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
    boxShadow: "0px 2px 4px 0px rgba(0, 0, 0, 0.15)",
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  editToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: TOKENS.lightBlue,
  },
  editToggleText: {
    fontSize: 13,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
    position: "absolute",
    left: 60,
    right: 60,
    textAlign: "center",
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  detailCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 24,
    alignItems: "center",
  },
  storeIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: TOKENS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
  },
  storeIconBoxEditing: {
    borderWidth: 2,
    borderColor: TOKENS.primary,
    borderStyle: "dashed",
  },
  storeLogoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 36,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  storeName: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  storeStatus: {
    fontSize: 12,
    color: TOKENS.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  infoGroup: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    gap: 14,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 10,
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    color: TOKENS.muted,
    fontWeight: "500",
  },
  infoVal: {
    fontSize: 14,
    color: TOKENS.dark,
    fontWeight: "600",
  },
  inputField: {
    fontSize: 14,
    color: TOKENS.dark,
    fontWeight: "600",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TOKENS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}33`,
  },
  saveButtonText: {
    color: TOKENS.card,
    fontSize: 14,
    fontWeight: "bold",
  },
  fixedBottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: TOKENS.background,
    borderTopWidth: 1,
    borderTopColor: TOKENS.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  // Modal Bottom Sheet Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  sheetBody: {
    gap: 16,
  },
  pickerOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  pickerOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TOKENS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  pickerOptionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  pickerOptionSub: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: TOKENS.border,
    marginVertical: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: TOKENS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 4,
  },
  presetCell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  presetCellSelected: {
    borderColor: TOKENS.primary,
    backgroundColor: TOKENS.lightBlue,
  },
  presetEmojiText: {
    fontSize: 22,
  },
  removeLogoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    marginTop: 8,
  },
  removeLogoText: {
    color: TOKENS.error,
    fontSize: 13,
    fontWeight: "bold",
  },
  switchButton: {
    width: 46,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: "center",
  },
  switchButtonActive: {
    backgroundColor: TOKENS.primary,
  },
  switchButtonInactive: {
    backgroundColor: "#D1D5DB",
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    boxShadow: "0px 1px 1.5px 0px rgba(0, 0, 0, 0.2)",
  },
  switchThumbActive: {
    alignSelf: "flex-end",
  },
  switchThumbInactive: {
    alignSelf: "flex-start",
  },
  storeInitialsText: {
    fontSize: 22,
    fontWeight: "bold",
    color: TOKENS.primary,
  },
});
