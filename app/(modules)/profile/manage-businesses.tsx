import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Business, cartState } from "../../../components/data/cartState";
import { TOKENS } from "../../../constants/tokens";
import { useUserPermissions } from "../../../hooks/useUserPermissions";
import { useBusinesses, useRegisterBusiness, useUpdateBusiness, useDeleteBusiness } from "../../../hooks/useBusinesses";
import { useBusinessStore } from "../../../stores/useBusinessStore";

export default function ManageBusinessesRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canPerform } = useUserPermissions();

  const { data: businesses = [] } = useBusinesses();
  const activeBusiness = useBusinessStore((state) => state.activeBusiness);

  // Mutations
  const registerMutation = useRegisterBusiness();
  const updateMutation = useUpdateBusiness();
  const deleteMutation = useDeleteBusiness();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Edit Modal states
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleOpenEditModal = (biz: Business) => {
    setEditingBusiness(biz);
    setEditName(biz.name);
    setEditCategory(biz.category);
    setEditAddress(biz.address);
    setEditPhone(biz.phone);
    setIsEditModalOpen(true);
  };

  const handleSaveEditBusiness = () => {
    if (!editingBusiness) return;
    if (!editName.trim() || !editCategory.trim() || !editAddress.trim() || !editPhone.trim()) {
      triggerToast("All fields are required!");
      return;
    }
    
    updateMutation.mutate({
      id: editingBusiness.id,
      details: {
        name: editName.trim(),
        category: editCategory.trim(),
        address: editAddress.trim(),
        phone: editPhone.trim(),
      }
    }, {
      onSuccess: () => {
        setIsEditModalOpen(false);
        setEditingBusiness(null);
        triggerToast("Business details updated successfully! 🚀");
      },
      onError: () => {
        triggerToast("Failed to update business details.");
      }
    });
  };

  const handleConfirmDelete = (biz: Business) => {
    if (businesses.length <= 1) {
      Alert.alert(
        "Action Restricted",
        "You cannot delete the only business in the catalog. You must have at least one active store branch."
      );
      return;
    }

    Alert.alert(
      "Delete Business Branch",
      `Are you sure you want to permanently delete "${biz.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Branch",
          style: "destructive",
          onPress: () => {
            deleteMutation.mutate(biz.id, {
              onSuccess: () => {
                triggerToast("Business branch deleted successfully! 🗑️");
              },
              onError: () => {
                triggerToast("Failed to delete business branch.");
              }
            });
          },
        },
      ]
    );
  };

  const handleCreateBusiness = () => {
    if (!canPerform("create", "settings")) {
      triggerToast("Access Denied: Cashiers are not authorized to create branches.");
      return;
    }

    if (!newName.trim()) {
      triggerToast("Please enter business name!");
      return;
    }
    if (!newCategory.trim()) {
      triggerToast("Please enter business type/category!");
      return;
    }
    if (!newAddress.trim()) {
      triggerToast("Please enter business address!");
      return;
    }
    if (!newPhone.trim()) {
      triggerToast("Please enter phone number!");
      return;
    }

    registerMutation.mutate({
      name: newName.trim(),
      address: newAddress.trim(),
      phone: newPhone.trim(),
      category: newCategory.trim(),
    }, {
      onSuccess: () => {
        setIsModalOpen(false);
        setNewName("");
        setNewCategory("");
        setNewAddress("");
        setNewPhone("");
        triggerToast("Business store created successfully!");
      },
      onError: () => {
        triggerToast("Failed to register business.");
      }
    });
  };

  const getCategoryColor = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("elect")) return { bg: "#FEF7E0", text: "#B06000" };
    if (lower.includes("cloth") || lower.includes("apparel") || lower.includes("fashion")) return { bg: "#E6F4EA", text: "#137333" };
    if (lower.includes("groc") || lower.includes("super")) return { bg: "#FCE8E6", text: "#C5221F" };
    return { bg: "#E8F0FE", text: TOKENS.primary };
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "ios" ? insets.top : 10 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push("/profile")}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Business Management</Text>

        {(() => {
          if (!canPerform("create", "settings")) return null;

          return (
            <TouchableOpacity
              style={styles.createHeaderBtn}
              activeOpacity={0.8}
              onPress={() => setIsModalOpen(true)}
            >
              <Feather name="plus" size={20} color={TOKENS.primary} />
            </TouchableOpacity>
          );
        })()}
      </View>

      {/* Toast Alert */}
      {toastMessage && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={15} color={TOKENS.card} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Scrollable list */}
      <ScrollView style={styles.scrollWrapper} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.groupLabel}>Registered Business Categories</Text>

        {businesses.map((biz) => {
          const isActive = activeBusiness.id === biz.id;
          const badge = getCategoryColor(biz.category);
          return (
            <TouchableOpacity
              key={biz.id}
              style={[styles.bizCard, isActive && styles.bizCardActive]}
              activeOpacity={0.85}
              onPress={() => {
                cartState.setActiveBusiness(biz.id);
                triggerToast(`Active store changed to ${biz.name}`);
              }}
            >
              <View style={styles.bizCardLeft}>
                <View style={[styles.iconBox, isActive && styles.iconBoxActive]}>
                  <Feather name="briefcase" size={20} color={isActive ? TOKENS.card : TOKENS.primary} />
                </View>
                <View style={styles.bizDetails}>
                  <View style={styles.bizNameRow}>
                    <Text style={styles.bizName}>{biz.name}</Text>
                    <View style={[styles.categoryBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.categoryBadgeText, { color: badge.text }]}>
                        {biz.category}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bizSub}>{biz.address}</Text>
                  <Text style={styles.bizSub}>📞 {biz.phone}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                {isActive && <Feather name="check-circle" size={20} color={TOKENS.primary} style={{ marginRight: 4 }} />}
                
                {canPerform("delete", "settings") && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#E8F0FE", alignItems: "center", justifyContent: "center" }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(biz);
                      }}
                    >
                      <Feather name="edit-2" size={14} color={TOKENS.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#FCE8E6", alignItems: "center", justifyContent: "center" }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleConfirmDelete(biz);
                      }}
                    >
                      <Feather name="trash-2" size={14} color={TOKENS.error} />
                    </TouchableOpacity>
                  </View>
                )}

                {!canPerform("delete", "settings") && !isActive && (
                  <Feather name="chevron-right" size={16} color={TOKENS.muted} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Modal for creating a new business */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.dismissArea} onPress={() => setIsModalOpen(false)} />
          <View style={styles.modalContent}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Business</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={TOKENS.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Business / Brand Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Shopbook Retail Store"
                  placeholderTextColor="#9CA3AF"
                  value={newName}
                  onChangeText={setNewName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Business Category / Type</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Electronics, Clothing, Groceries"
                  placeholderTextColor="#9CA3AF"
                  value={newCategory}
                  onChangeText={setNewCategory}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Store Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 142 Galle Road, Colombo 03"
                  placeholderTextColor="#9CA3AF"
                  value={newAddress}
                  onChangeText={setNewAddress}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. +94 11 234 5678"
                  placeholderTextColor="#9CA3AF"
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, (!newName.trim() || !newCategory.trim() || !newAddress.trim() || !newPhone.trim()) && styles.submitButtonDisabled]}
                activeOpacity={0.8}
                onPress={handleCreateBusiness}
                disabled={!newName.trim() || !newCategory.trim() || !newAddress.trim() || !newPhone.trim()}
              >
                <Text style={styles.submitButtonText}>Create & Activate Business</Text>
                <Feather name="plus-circle" size={16} color={TOKENS.card} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal for editing a business */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalOpen}
        onRequestClose={() => {
          setIsEditModalOpen(false);
          setEditingBusiness(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.dismissArea} onPress={() => {
            setIsEditModalOpen(false);
            setEditingBusiness(null);
          }} />
          <View style={styles.modalContent}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Business Details</Text>
              <TouchableOpacity onPress={() => {
                setIsEditModalOpen(false);
                setEditingBusiness(null);
              }} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={TOKENS.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Business / Brand Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Shopbook Retail Store"
                  placeholderTextColor="#9CA3AF"
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Business Category / Type</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Electronics, Clothing, Groceries"
                  placeholderTextColor="#9CA3AF"
                  value={editCategory}
                  onChangeText={setEditCategory}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Store Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 142 Galle Road, Colombo 03"
                  placeholderTextColor="#9CA3AF"
                  value={editAddress}
                  onChangeText={setEditAddress}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. +94 11 234 5678"
                  placeholderTextColor="#9CA3AF"
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, (!editName.trim() || !editCategory.trim() || !editAddress.trim() || !editPhone.trim()) && styles.submitButtonDisabled]}
                activeOpacity={0.8}
                onPress={handleSaveEditBusiness}
                disabled={!editName.trim() || !editCategory.trim() || !editAddress.trim() || !editPhone.trim()}
              >
                <Text style={styles.submitButtonText}>Update Business Details</Text>
                <Feather name="check" size={16} color={TOKENS.card} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TOKENS.background,
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
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: TOKENS.dark,
    position: "absolute",
    left: 60,
    right: 60,
    textAlign: "center",
  },
  createHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.lightBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  toastContainer: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    backgroundColor: TOKENS.dark,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 12,
    fontWeight: "600",
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bizCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
  },
  bizCardActive: {
    borderColor: TOKENS.primary,
    backgroundColor: "#F4F7FF",
  },
  bizCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: TOKENS.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconBoxActive: {
    backgroundColor: TOKENS.primary,
  },
  bizDetails: {
    flex: 1,
    gap: 2,
  },
  bizNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  bizName: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  categoryBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  bizSub: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: TOKENS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: TOKENS.dark,
  },
  formInput: {
    height: 44,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: TOKENS.dark,
    backgroundColor: "#F9FAFB",
    fontWeight: "500",
  },
  submitButton: {
    flexDirection: "row",
    height: 48,
    backgroundColor: TOKENS.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: "#E5E7EB",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.card,
  },
});
