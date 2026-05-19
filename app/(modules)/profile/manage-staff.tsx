import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
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
  const { canPerform } = useUserPermissions();

  const [activeBusiness, setActiveBusiness] = useState<Business>(cartState.getActiveBusiness());

  const [staffList, setStaffList] = useState<StaffMember[]>([]);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"Admin" | "Manager" | "Cashier">("Cashier");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // Edit Modal states
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"Admin" | "Manager" | "Cashier">("Cashier");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenEditStaffModal = (member: StaffMember) => {
    setEditingStaff(member);
    setEditName(member.name);
    setEditRole(member.role);
    setEditEmail(member.email);
    setEditPhone(member.phone);
    setIsEditModalOpen(true);
  };

  const handleSaveEditStaff = async () => {
    if (!editingStaff) return;
    if (!editName.trim() || !editEmail.trim() || !editPhone.trim()) {
      triggerToast("All fields are required!");
      return;
    }

    try {
      const db = require('../../../components/data/db').default;
      const { Q } = require('@nozbe/watermelondb');
      
      const employees = await db.get('employees').query(Q.where('id', editingStaff.id)).fetch();
      if (employees.length > 0) {
        const targetEmp = employees[0];
        
        const normalizePhone = (phoneStr: string): string => {
          let cleaned = phoneStr.replace(/\D/g, "");
          if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
          if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
          return cleaned;
        };
        const cleanPhone = normalizePhone(editPhone);
        const dbRole = editRole === 'Admin' ? 'admin' : editRole === 'Manager' ? 'manager' : 'cashier';

        await db.write(async () => {
          await targetEmp.update((emp: any) => {
            emp.name = editName.trim();
            emp.role = dbRole;
            emp.phone = cleanPhone;
            emp.email = editEmail.trim();
          });
        });

        triggerToast("Staff details updated successfully! 🚀");
        setIsEditModalOpen(false);
        setEditingStaff(null);
        await loadStaffFromDb();
      }
    } catch (err) {
      console.error('Failed to update employee in database:', err);
      triggerToast("Failed to update staff details.");
    }
  };

  const handleConfirmDeleteStaff = (staff: StaffMember) => {
    const { Alert } = require('react-native');
    Alert.alert(
      "Remove Staff Member",
      `Are you sure you want to permanently remove "${staff.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove Staff",
          style: "destructive",
          onPress: async () => {
            try {
              const db = require('../../../components/data/db').default;
              const { Q } = require('@nozbe/watermelondb');
              
              const employees = await db.get('employees').query(Q.where('id', staff.id)).fetch();
              if (employees.length > 0) {
                const targetEmp = employees[0];
                await db.write(async () => {
                  await targetEmp.destroyPermanently();
                });
                triggerToast("Staff member removed successfully! 🗑️");
                await loadStaffFromDb();
              }
            } catch (err) {
              console.error('Failed to delete employee from database:', err);
              triggerToast("Failed to delete staff member.");
            }
          },
        },
      ]
    );
  };

  const loadStaffFromDb = async () => {
    try {
      const db = require('../../../components/data/db').default;
      const { Q } = require('@nozbe/watermelondb');
      
      const activeBiz = cartState.getActiveBusiness();
      if (!activeBiz || activeBiz.id === "0") return;
      
      const dbEmployees = await db.get('employees').query(
        Q.where('business_id', activeBiz.id)
      ).fetch();
      
      const list: StaffMember[] = dbEmployees.map((emp: any) => ({
        id: emp.id,
        name: emp.name,
        role: emp.role === 'admin' ? 'Admin' : emp.role === 'manager' ? 'Manager' : 'Cashier',
        email: emp.email || "no-email@shopbook.lk",
        phone: emp.phone,
      }));
      
      setStaffList(list);
    } catch (err) {
      console.error('Failed to load staff from database:', err);
    }
  };

  useEffect(() => {
    loadStaffFromDb();
  }, [activeBusiness]);

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

  const handleAddStaff = async () => {
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

    try {
      const db = require('../../../components/data/db').default;
      const { Q } = require('@nozbe/watermelondb');
      
      const activeBiz = cartState.getActiveBusiness();
      const businesses = await db.get('businesses').query(Q.where('id', activeBiz.id)).fetch();
      const dbBiz = businesses[0];
      
      if (!dbBiz) {
        triggerToast("No business registered in SQLite!");
        return;
      }
      
      const dbRole = newRole === 'Admin' ? 'admin' : newRole === 'Manager' ? 'manager' : 'cashier';
      
      const normalizePhone = (phoneStr: string): string => {
        let cleaned = phoneStr.replace(/\D/g, "");
        if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
        if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
        return cleaned;
      };
      
      const cleanPhone = normalizePhone(newPhone);

      await db.write(async () => {
        await db.get('employees').create((emp: any) => {
          emp.business.set(dbBiz);
          emp.name = newName;
          emp.role = dbRole;
          emp.phone = cleanPhone;
          emp.email = newEmail;
        });
      });
      
      triggerToast(`${newName} added as ${newRole} successfully! 🎉`);
      setIsModalOpen(false);
      
      // Clear inputs
      setNewName("");
      setNewRole("Cashier");
      setNewEmail("");
      setNewPhone("");
      
      // Reload list dynamically
      await loadStaffFromDb();
    } catch (err) {
      console.error('Failed to save staff to WatermelonDB database:', err);
      triggerToast("Failed to add staff member.");
    }
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

        {canPerform("create", "staff") && (
          <TouchableOpacity
            style={styles.createHeaderBtn}
            activeOpacity={0.8}
            onPress={() => setIsModalOpen(true)}
          >
            <Feather name="plus" size={20} color={TOKENS.primary} />
          </TouchableOpacity>
        )}
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
              {/* Only admins can edit/delete staff */}
              {canPerform("create", "staff") && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#E8F0FE", alignItems: "center", justifyContent: "center" }}
                    onPress={() => handleOpenEditStaffModal(member)}
                  >
                    <Feather name="edit-2" size={14} color={TOKENS.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#FCE8E6", alignItems: "center", justifyContent: "center" }}
                    onPress={() => handleConfirmDeleteStaff(member)}
                  >
                    <Feather name="trash-2" size={14} color={TOKENS.error} />
                  </TouchableOpacity>
                </View>
              )}
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

      {/* Modal for editing a staff member */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isEditModalOpen}
        onRequestClose={() => {
          setIsEditModalOpen(false);
          setEditingStaff(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.dismissArea} onPress={() => {
            setIsEditModalOpen(false);
            setEditingStaff(null);
          }} />
          <View style={styles.modalContent}>
            {/* Modal Handle */}
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Staff Details</Text>
              <TouchableOpacity onPress={() => {
                setIsEditModalOpen(false);
                setEditingStaff(null);
              }} style={styles.modalCloseBtn}>
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
                  value={editName}
                  onChangeText={setEditName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Staff Role</Text>
                <View style={styles.rolesSelectorRow}>
                  {(["Admin", "Manager", "Cashier"] as const).map((role) => {
                    const isSelected = editRole === role;
                    return (
                      <TouchableOpacity
                        key={role}
                        style={[styles.roleSelectTab, isSelected && styles.roleSelectTabActive]}
                        activeOpacity={0.8}
                        onPress={() => setEditRole(role)}
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
                  value={editEmail}
                  onChangeText={setEditEmail}
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
                  value={editPhone}
                  onChangeText={setEditPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, (!editName.trim() || !editEmail.trim() || !editPhone.trim()) && styles.submitButtonDisabled]}
                activeOpacity={0.8}
                onPress={handleSaveEditStaff}
                disabled={!editName.trim() || !editEmail.trim() || !editPhone.trim()}
              >
                <Text style={styles.submitButtonText}>Update Staff Details</Text>
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
