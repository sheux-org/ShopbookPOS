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
import { Business, cartState } from "../../../components/data/cartState";
import { TOKENS } from "../../../constants/tokens";

export default function BusinessDetailsRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeBusiness, setActiveBusiness] = useState<Business>(cartState.getActiveBusiness());
  
  // Edit form states
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(activeBusiness.name);
  const [category, setCategory] = useState(activeBusiness.category);
  const [address, setAddress] = useState(activeBusiness.address);
  const [phone, setPhone] = useState(activeBusiness.phone);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncState = () => {
      const biz = cartState.getActiveBusiness();
      setActiveBusiness(biz);
      setName(biz.name);
      setCategory(biz.category);
      setAddress(biz.address);
      setPhone(biz.phone);
    };
    return cartState.subscribe(syncState);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleSaveChanges = async () => {
    if (!name.trim() || !category.trim() || !address.trim() || !phone.trim()) {
      Alert.alert("Required Fields", "All business profile fields must be filled out.");
      return;
    }

    try {
      await cartState.updateActiveBusinessDetails({
        name: name.trim(),
        category: category.trim(),
        address: address.trim(),
        phone: phone.trim(),
      });
      setIsEditing(false);
      triggerToast("Store Profile updated successfully! 🚀");
    } catch (error) {
      Alert.alert("Update Error", "Failed to persist business profile changes.");
    }
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
          const { useAuthStore } = require("../../../stores/useAuthStore");
          const role = useAuthStore.getState().userRole || "admin";
          if (role === "cashier") return null;

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
          <View style={styles.storeIconBox}>
            <Feather name="home" size={28} color={TOKENS.primary} />
          </View>
          <Text style={styles.storeName}>{activeBusiness.name}</Text>
          <Text style={styles.storeStatus}>🛡️ Admin Control Terminal</Text>
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: TOKENS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
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
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
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
});
