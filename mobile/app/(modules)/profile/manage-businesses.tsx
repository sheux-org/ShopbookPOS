import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, BottomSheetTextInput } from '../../../components/common/BottomSheet';
import { Business, cartState } from '../../../components/data/cartState';
import { TOKENS } from '../../../constants/tokens';
import {
  useBusinesses,
  useDeleteBusiness,
  useRegisterBusiness,
  useUpdateBusiness,
} from '../../../hooks/useBusinesses';
import { getTopSafeInset } from '../../../utils/safeArea';
import { useUserPermissions } from '../../../hooks/useUserPermissions';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useBusinessStore } from '../../../stores/useBusinessStore';
import { hapticFeedback } from '@/utils/haptics';
import { useTranslation } from '../../../hooks/useTranslation';

const BUSINESS_TYPES = [
  { label: 'Cafe', icon: '☕' },
  { label: 'Restaurant', icon: '🍽️' },
  { label: 'Boutique', icon: '👗' },
  { label: 'Salon', icon: '✂️' },
  { label: 'Supermarket', icon: '🛒' },
  { label: 'Grocery Shop', icon: '🏪' },
  { label: 'Pharmacy', icon: '💊' },
  { label: 'Hardware', icon: '🔧' },
  { label: 'Other', icon: '✨' },
];

export default function ManageBusinessesRoute() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { canPerform } = useUserPermissions();
  const { t } = useTranslation();

  const { data: businesses = [] } = useBusinesses();
  const activeBusiness = useBusinessStore((state) => state.activeBusiness);

  // Mutations
  const registerMutation = useRegisterBusiness();
  const updateMutation = useUpdateBusiness();
  const deleteMutation = useDeleteBusiness();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBusinessType, setNewBusinessType] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);

  // Edit Modal states
  const [editingBusiness, setEditingBusiness] = useState<Business | null>(null);
  const [editName, setEditName] = useState('');
  const [editBusinessType, setEditBusinessType] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditDropdownOpen, setIsEditDropdownOpen] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleOpenEditModal = (biz: Business) => {
    setEditingBusiness(biz);
    setEditName(biz.name);
    setEditBusinessType(biz.category);
    setEditAddress(biz.address);
    setEditPhone(biz.phone);
    setIsEditModalOpen(true);
    hapticFeedback.impactLight();
  };

  const handleSaveEditBusiness = () => {
    if (!editingBusiness) return;
    if (!editName.trim() || !editBusinessType.trim() || !editAddress.trim() || !editPhone.trim()) {
      hapticFeedback.notificationWarning();
      triggerToast('All fields are required!');
      return;
    }

    updateMutation.mutate(
      {
        id: editingBusiness.id,
        details: {
          name: editName.trim(),
          category: editBusinessType.trim(),
          address: editAddress.trim(),
          phone: editPhone.trim(),
        },
      },
      {
        onSuccess: () => {
          setIsEditModalOpen(false);
          setEditingBusiness(null);
          triggerToast('Business details updated successfully! 🚀');
          hapticFeedback.notificationSuccess();
        },
        onError: () => {
          triggerToast('Failed to update business details.');
          hapticFeedback.notificationError();
        },
      }
    );
  };

  const handleConfirmDelete = (biz: Business) => {
    if (biz.id === activeBusiness.id) {
      hapticFeedback.notificationError();
      Alert.alert(
        'Action Restricted',
        'You cannot delete your active business branch. Please switch to another business branch first before attempting to delete this one.'
      );
      return;
    }

    if (businesses.length <= 1) {
      hapticFeedback.notificationWarning();
      Alert.alert(
        'Action Restricted',
        'You cannot delete the only business in the catalog. You must have at least one active store branch.'
      );
      return;
    }

    hapticFeedback.notificationWarning();
    Alert.alert(
      'Delete Business Branch',
      `Are you sure you want to permanently delete "${biz.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Branch',
          style: 'destructive',
          onPress: () => {
            hapticFeedback.impactMedium();
            deleteMutation.mutate(biz.id, {
              onSuccess: () => {
                triggerToast('Business branch deleted successfully! 🗑️');
                hapticFeedback.notificationSuccess();
              },
              onError: () => {
                triggerToast('Failed to delete business branch.');
                hapticFeedback.notificationError();
              },
            });
          },
        },
      ]
    );
  };

  const handleCreateBusiness = () => {
    if (!canPerform('create', 'settings')) {
      hapticFeedback.notificationError();
      triggerToast('Access Denied: Cashiers are not authorized to create branches.');
      return;
    }

    if (!newName.trim()) {
      hapticFeedback.notificationWarning();
      triggerToast('Please enter business name!');
      return;
    }
    if (!newBusinessType.trim()) {
      hapticFeedback.notificationWarning();
      triggerToast('Please select business type!');
      return;
    }
    if (!newAddress.trim()) {
      hapticFeedback.notificationWarning();
      triggerToast('Please enter business address!');
      return;
    }
    if (!newPhone.trim()) {
      hapticFeedback.notificationWarning();
      triggerToast('Please enter phone number!');
      return;
    }

    registerMutation.mutate(
      {
        name: newName.trim(),
        address: newAddress.trim(),
        phone: newPhone.trim(),
        category: newBusinessType.trim(),
      },
      {
        onSuccess: (newBiz) => {
          setIsModalOpen(false);
          setNewName('');
          setNewBusinessType('');
          setNewAddress('');
          setNewPhone('');
          triggerToast('Business store created successfully! 🎉');

          hapticFeedback.notificationSuccess();
          Alert.alert(
            'Activate New Branch',
            `Would you like to set "${newBiz.name}" as your active business branch immediately?`,
            [
              {
                text: 'No',
                style: 'cancel',
              },
              {
                text: 'Yes, Activate',
                onPress: () => {
                  useBusinessStore.setState({
                    activeBusiness: {
                      id: newBiz.id,
                      name: newBiz.name,
                      category: newBiz.category,
                      address: newBiz.address,
                      phone: newBiz.phone,
                    },
                  });

                  useAuthStore.getState().setActiveBusinessId(newBiz.id);
                  triggerToast(`Switched active business to "${newBiz.name}"! 🚀`);
                },
              },
            ]
          );
        },
        onError: () => {
          hapticFeedback.notificationError();
          triggerToast('Failed to register business.');
        },
      }
    );
  };

  const getCategoryColor = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes('elect')) return { bg: '#FEF7E0', text: '#B06000' };
    if (lower.includes('cloth') || lower.includes('apparel') || lower.includes('fashion'))
      return { bg: '#E6F4EA', text: '#137333' };
    if (lower.includes('groc') || lower.includes('super'))
      return { bg: '#FCE8E6', text: '#C5221F' };
    return { bg: '#E8F0FE', text: TOKENS.primary };
  };

  return (
    <View style={[styles.container, { paddingTop: getTopSafeInset(insets) }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.push('/profile')}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Business Management</Text>

        {(() => {
          if (!canPerform('create', 'settings')) return null;

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
        <Text style={styles.groupLabel}>{t('businessMgmt.registeredCategories')}</Text>

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
                  <Feather
                    name="briefcase"
                    size={20}
                    color={isActive ? TOKENS.card : TOKENS.primary}
                  />
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                {isActive && (
                  <Feather
                    name="check-circle"
                    size={20}
                    color={TOKENS.primary}
                    style={{ marginRight: 4 }}
                  />
                )}

                {canPerform('delete', 'settings') && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: '#E8F0FE',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleOpenEditModal(biz);
                      }}
                    >
                      <Feather name="edit-2" size={14} color={TOKENS.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={isActive ? 1.0 : 0.7}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: isActive ? '#F3F4F6' : '#FCE8E6',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleConfirmDelete(biz);
                      }}
                    >
                      <Feather
                        name="trash-2"
                        size={14}
                        color={isActive ? '#9CA3AF' : TOKENS.error}
                      />
                    </TouchableOpacity>
                  </View>
                )}

                {!canPerform('delete', 'settings') && !isActive && (
                  <Feather name="chevron-right" size={16} color={TOKENS.muted} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* FIX: All plain <TextInput> instances inside these two <BottomSheet> forms
  have been changed to <BottomSheetTextInput>.

  Why this fixes it:
  @gorhom/bottom-sheet's keyboard-avoidance logic (keyboardBehavior="extend")
  only works if the FOCUSED input is a BottomSheetTextInput — that's how the
  library knows a text field inside the sheet is focused and resizes/extends
  the sheet to sit above the keyboard. A plain react-native TextInput is
  invisible to that logic, so the sheet never adjusts, and the footer button
  stays pinned under the keyboard instead of above it.

  Make sure this import is added at the top of the file (adjust the path to
  wherever your BottomSheet.tsx wrapper lives — it already re-exports
  BottomSheetTextInput):

    import { BottomSheet, BottomSheetTextInput } from '../path/to/BottomSheet';
*/}

      {/* Modal for creating a new business */}
      <BottomSheet
        visible={isModalOpen}
        useScrollView
        onClose={() => setIsModalOpen(false)}
        title="Create New Business"
        footerComponent={
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!newName.trim() ||
                !newBusinessType.trim() ||
                !newAddress.trim() ||
                !newPhone.trim()) &&
                styles.submitButtonDisabled,
            ]}
            activeOpacity={0.8}
            onPress={handleCreateBusiness}
            disabled={
              !newName.trim() || !newBusinessType.trim() || !newAddress.trim() || !newPhone.trim()
            }
          >
            <Text style={styles.submitButtonText}>{t('businessMgmt.createAndActivate')}</Text>
            <Feather name="plus-circle" size={16} color={TOKENS.card} />
          </TouchableOpacity>
        }
      >
        <View style={styles.modalScroll}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{t('businessMgmt.bizNameLabel')}</Text>
            <BottomSheetTextInput
              style={styles.formInput}
              placeholder="e.g. Shopbook Retail Store"
              placeholderTextColor="#9CA3AF"
              value={newName}
              onChangeText={setNewName}
            />
          </View>

          <View style={[styles.formGroup, { zIndex: isCreateDropdownOpen ? 1000 : 1 }]}>
            <Text style={styles.formLabel}>{t('businessMgmt.bizTypeLabel')}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.formInput,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
                isCreateDropdownOpen && { borderColor: TOKENS.primary },
              ]}
              onPress={() => setIsCreateDropdownOpen(!isCreateDropdownOpen)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {newBusinessType ? (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F3F4F6',
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>
                      {BUSINESS_TYPES.find((b) => b.label === newBusinessType)?.icon}
                    </Text>
                  </View>
                ) : (
                  <Feather name="briefcase" size={16} color={TOKENS.muted} />
                )}
                <Text
                  style={{
                    fontSize: 14,
                    color: newBusinessType ? TOKENS.dark : '#9CA3AF',
                    fontWeight: '500',
                  }}
                >
                  {newBusinessType || t('businessDetails.placeholderType')}
                </Text>
              </View>
              <Feather
                name={isCreateDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={TOKENS.muted}
              />
            </TouchableOpacity>

            {isCreateDropdownOpen && (
              <View style={styles.dropdownOverlayList}>
                <ScrollView
                  nestedScrollEnabled
                  style={{ maxHeight: 150 }}
                  showsVerticalScrollIndicator
                >
                  {BUSINESS_TYPES.map((item) => {
                    const isSelected = newBusinessType === item.label;
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={[
                          styles.dropdownOverlayItem,
                          isSelected && { backgroundColor: '#F4F7FF' },
                        ]}
                        onPress={() => {
                          setNewBusinessType(item.label);
                          setIsCreateDropdownOpen(false);
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#F3F4F6',
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>{item.icon}</Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? '700' : '500',
                            color: isSelected ? TOKENS.primary : TOKENS.dark,
                          }}
                        >
                          {item.label}
                        </Text>
                        {isSelected && (
                          <Feather
                            name="check"
                            size={14}
                            color={TOKENS.primary}
                            style={{ marginLeft: 'auto' }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{t('businessMgmt.storeAddressLabel')}</Text>
            <BottomSheetTextInput
              style={styles.formInput}
              placeholder="e.g. 142 Galle Road, Colombo 03"
              placeholderTextColor="#9CA3AF"
              value={newAddress}
              onChangeText={setNewAddress}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{t('businessMgmt.phoneLabel')}</Text>
            <BottomSheetTextInput
              style={styles.formInput}
              placeholder="e.g. +94 11 234 5678"
              placeholderTextColor="#9CA3AF"
              value={newPhone}
              onChangeText={setNewPhone}
              keyboardType="phone-pad"
            />
          </View>
        </View>
      </BottomSheet>

      {/* Modal for editing a business */}
      <BottomSheet
        visible={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingBusiness(null);
        }}
        title="Edit Business Details"
        footerComponent={
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!editName.trim() ||
                !editBusinessType.trim() ||
                !editAddress.trim() ||
                !editPhone.trim()) &&
                styles.submitButtonDisabled,
            ]}
            activeOpacity={0.8}
            onPress={handleSaveEditBusiness}
            disabled={
              !editName.trim() ||
              !editBusinessType.trim() ||
              !editAddress.trim() ||
              !editPhone.trim()
            }
          >
            <Text style={styles.submitButtonText}>{t('businessMgmt.saveEdit')}</Text>
            <Feather name="check" size={16} color={TOKENS.card} />
          </TouchableOpacity>
        }
      >
        <View style={styles.modalScroll}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{t('businessMgmt.bizNameLabel')}</Text>
            <BottomSheetTextInput
              style={styles.formInput}
              placeholder="e.g. Shopbook Retail Store"
              placeholderTextColor="#9CA3AF"
              value={editName}
              onChangeText={setEditName}
            />
          </View>

          <View style={[styles.formGroup, { zIndex: isEditDropdownOpen ? 1000 : 1 }]}>
            <Text style={styles.formLabel}>{t('businessMgmt.bizTypeLabel')}</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.formInput,
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
                isEditDropdownOpen && { borderColor: TOKENS.primary },
              ]}
              onPress={() => setIsEditDropdownOpen(!isEditDropdownOpen)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {editBusinessType ? (
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#F3F4F6',
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>
                      {BUSINESS_TYPES.find((b) => b.label === editBusinessType)?.icon}
                    </Text>
                  </View>
                ) : (
                  <Feather name="briefcase" size={16} color={TOKENS.muted} />
                )}
                <Text
                  style={{
                    fontSize: 14,
                    color: editBusinessType ? TOKENS.dark : '#9CA3AF',
                    fontWeight: '500',
                  }}
                >
                  {editBusinessType || 'Select business type'}
                </Text>
              </View>
              <Feather
                name={isEditDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={TOKENS.muted}
              />
            </TouchableOpacity>

            {isEditDropdownOpen && (
              <View style={styles.dropdownOverlayList}>
                <ScrollView
                  nestedScrollEnabled
                  style={{ maxHeight: 150 }}
                  showsVerticalScrollIndicator
                >
                  {BUSINESS_TYPES.map((item) => {
                    const isSelected = editBusinessType === item.label;
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={[
                          styles.dropdownOverlayItem,
                          isSelected && { backgroundColor: '#F4F7FF' },
                        ]}
                        onPress={() => {
                          setEditBusinessType(item.label);
                          setIsEditDropdownOpen(false);
                        }}
                      >
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#F3F4F6',
                          }}
                        >
                          <Text style={{ fontSize: 14 }}>{item.icon}</Text>
                        </View>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: isSelected ? '700' : '500',
                            color: isSelected ? TOKENS.primary : TOKENS.dark,
                          }}
                        >
                          {item.label}
                        </Text>
                        {isSelected && (
                          <Feather
                            name="check"
                            size={14}
                            color={TOKENS.primary}
                            style={{ marginLeft: 'auto' }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{t('businessMgmt.storeAddressLabel')}</Text>
            <BottomSheetTextInput
              style={styles.formInput}
              placeholder="e.g. 142 Galle Road, Colombo 03"
              placeholderTextColor="#9CA3AF"
              value={editAddress}
              onChangeText={setEditAddress}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>{t('businessMgmt.phoneLabel')}</Text>
            <BottomSheetTextInput
              style={[
                styles.formInput,
                { backgroundColor: '#F3F4F6', color: '#6B7280', borderColor: '#E5E7EB' },
              ]}
              placeholder="e.g. +94 11 234 5678"
              placeholderTextColor="#9CA3AF"
              value={editPhone}
              editable={false}
              selectTextOnFocus={false}
            />
          </View>
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
    position: 'absolute',
    left: 60,
    right: 60,
    textAlign: 'center',
  },
  createHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: TOKENS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastContainer: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: TOKENS.dark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    zIndex: 999,
  },
  toastText: {
    color: TOKENS.card,
    fontSize: 12,
    fontWeight: '600',
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
    fontWeight: '700',
    color: TOKENS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bizCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
  },
  bizCardActive: {
    borderColor: TOKENS.primary,
    backgroundColor: '#F4F7FF',
  },
  bizCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: TOKENS.background,
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  bizName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  categoryBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  bizSub: {
    fontSize: 11,
    color: TOKENS.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 32,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: TOKENS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingTop: 6,
    paddingBottom: 24,
    paddingHorizontal: 0,
    gap: 18,
  },
  formGroup: {
    gap: 6,
    position: 'relative',
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: TOKENS.dark,
  },
  formInput: {
    height: 46,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: TOKENS.dark,
    backgroundColor: '#F9FAFB',
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    height: 50,
    backgroundColor: TOKENS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}33`,
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
    boxShadow: 'none',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.card,
  },
  dropdownOverlayList: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    zIndex: 9999,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    backgroundColor: TOKENS.card,
    boxShadow: '0px 6px 16px 0px rgba(0, 0, 0, 0.12)',
  },
  dropdownOverlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
});
