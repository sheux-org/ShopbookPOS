import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  TextInput,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOKENS } from "../../constants/tokens";
import { cartState, Business } from "../../components/data/cartState";

interface StaffMember {
  id: string;
  name: string;
  role: "Admin" | "Manager" | "Cashier";
  email: string;
  phone: string;
}

export default function ManageStaffRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeBusiness, setActiveBusiness] = useState<Business>(cartState.getActiveBusiness());
  
  // Initial pre-populated staff members list
  const [staffList, setStaffList] = useState<StaffMember[]>([
    { id: "1", name: "Shopbook Owner (You)", role: "Admin", email: "owner@shopbook.lk", phone: "+94 71 713 3074" },
    { id: "2", name: "Pasan Pahasara", role: "Manager", email: "pasan@shopbook.lk", phone: "+94 77 123 4567" },
    { id: "3", name: "Dilshan Perera", role: "Cashier", email: "dilshan@shopbook.lk", phone: "+94 72 987 6543" },
  ]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"Admin" | "Manager" | "Cashier">("Cashier");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const syncState = () => {
      setActiveBusiness(cartState.getActiveBusiness());
    };
    return cartState.subscribe(syncState);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleAddStaff = () => {
    if (!newName.trim()) {
      triggerToast("Please enter staff name!");
      return;
    }
    if (!newEmail.trim()) {
      triggerToast("Please enter email address!");
      return;
    }
    if (!newPhone.trim()) {
      triggerToast("Please enter phone number!");
      return;
    }

    const newMember: StaffMember = {
      id: String(staffList.length + 1),
      name: newName,
      role: newRole,
      email: newEmail,
      phone: newPhone,
    };

    setStaffList([...staffList, newMember]);
    setIsModalOpen(false);

    // Clear inputs
    setNewName("");
    setNewRole("Cashier");
    setNewEmail("");
    setNewPhone("");

    triggerToast(`${newName} added as ${newRole} successfully!`);
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case "Admin":
        return { backgroundColor: "#E6F4EA", color: "#137333" };
      case "Manager":
        return { backgroundColor: "#E8F0FE", color: TOKENS.primary };
      default:
        return { backgroundColor: "#F3F4F6", color: TOKENS.dark };
    }
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

        <Text style={styles.headerTitle}>Staff Management</Text>

        <TouchableOpacity
          style={styles.createHeaderBtn}
          activeOpacity={0.8}
          onPress={() => setIsModalOpen(true)}
        >
          <Feather name="plus" size={20} color={TOKENS.primary} />
        </TouchableOpacity>
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
        <Text style={styles.groupLabel}>Authorized Staff Members</Text>

        {staffList.map((member) => {
          const badge = getRoleBadgeStyle(member.role);
          return (
            <View key={member.id} style={styles.staffCard}>
              <View style={styles.staffCardLeft}>
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarInitials}>
                    {member.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.staffDetails}>
                  <View style={styles.staffHeaderRow}>
                    <Text style={styles.staffName}>{member.name}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: badge.backgroundColor }]}>
                      <Text style={[styles.roleBadgeText, { color: badge.color }]}>{member.role}</Text>
                    </View>
                  </View>
                  <Text style={styles.staffSub}>📧 {member.email}</Text>
                  <Text style={styles.staffSub}>📞 {member.phone}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Modal for adding staff member */}
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
              <Text style={styles.modalTitle}>Add Staff Member</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)} style={styles.modalCloseBtn}>
                <Feather name="x" size={20} color={TOKENS.dark} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Staff Full Name</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Aruni Silva"
                  placeholderTextColor="#9CA3AF"
                  value={newName}
                  onChangeText={setNewName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Staff Role</Text>
                <View style={styles.rolesSelectorRow}>
                  {(["Admin", "Manager", "Cashier"] as const).map((role) => {
                    const isSelected = newRole === role;
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[styles.roleSelectTab, isSelected && styles.roleSelectTabActive]}
                        activeOpacity={0.8}
                        onPress={() => setNewRole(role)}
                      >
                        <Text style={[styles.roleSelectTabText, isSelected && styles.roleSelectTabTextActive]}>
                          {role}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Email Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. aruni@shopbook.lk"
                  placeholderTextColor="#9CA3AF"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mobile Number</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. +94 77 987 6543"
                  placeholderTextColor="#9CA3AF"
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, (!newName.trim() || !newEmail.trim() || !newPhone.trim()) && styles.submitButtonDisabled]}
                activeOpacity={0.8}
                onPress={handleAddStaff}
                disabled={!newName.trim() || !newEmail.trim() || !newPhone.trim()}
              >
                <Text style={styles.submitButtonText}>Authorize Staff Member</Text>
                <Feather name="user-plus" size={16} color={TOKENS.card} />
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
    marginTop: 8,
    marginBottom: 4,
  },
  staffCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
  },
  staffCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  staffDetails: {
    flex: 1,
    gap: 2,
  },
  staffHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  staffName: {
    fontSize: 14,
    fontWeight: "bold",
    color: TOKENS.dark,
  },
  roleBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: "bold",
  },
  staffSub: {
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
  rolesSelectorRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  roleSelectTab: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  roleSelectTabActive: {
    borderColor: TOKENS.primary,
    backgroundColor: TOKENS.lightBlue,
  },
  roleSelectTabText: {
    fontSize: 12,
    fontWeight: "600",
    color: TOKENS.dark,
  },
  roleSelectTabTextActive: {
    color: TOKENS.primary,
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
