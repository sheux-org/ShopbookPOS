import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../common/ScreenWrapper';
import * as Contacts from 'expo-contacts';
import { TOKENS } from '../../constants/tokens';
import { cartState, CartItem } from '../data/cartState';
import { BottomSheet } from '../common/BottomSheet';
import { ProductImage } from '../common/ProductImage';
import { useCart } from '../../stores/useCart';
import { hapticFeedback } from '../../utils/haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Helper colors for premium initials avatars
const getAvatarColor = (name: string) => {
  const colors = [
    '#EF4444',
    '#F59E0B',
    '#10B981',
    '#3B82F6',
    '#6366F1',
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#06B6D4',
    '#059669',
    '#4F46E5',
    '#D97706',
    '#2563EB',
    '#DB2777',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const getInitials = (name: string) => {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const CartScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState(0); // Default Rs. 0
  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [tempDiscount, setTempDiscount] = useState('0');
  const [tempDiscountType, setTempDiscountType] = useState<'flat' | 'percentage'>('flat');

  // Tax rate state variables
  const [taxRate, setTaxRate] = useState(0); // Default 0%
  const [isEditingTax, setIsEditingTax] = useState(false);
  const [tempTaxRate, setTempTaxRate] = useState('0');

  // Customer state hooks
  const [isCustomerModalVisible, setIsCustomerModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'contacts' | 'new'>('contacts');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<
    { id: string; name: string; phone: string }[]
  >([]);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [attachedCustomer, setAttachedCustomer] = useState<{ name: string; phone: string } | null>(
    null
  );

  const customCustomers = useCart((state) => state.customCustomers) || [];

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 180);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const syncCart = () => {
      setInvoiceItems(cartState.getCart());
      setAttachedCustomer(cartState.getCustomer());
    };
    syncCart();
    return cartState.subscribe(syncCart);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 1500);
  };

  // Load native contacts
  const loadContacts = async () => {
    setIsLoadingContacts(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
        });

        if (data && data.length > 0) {
          const formatted = data
            .map((c) => {
              const phone =
                c.phoneNumbers && c.phoneNumbers.length > 0 ? c.phoneNumbers[0].number || '' : '';
              return {
                id: c.id || Math.random().toString(),
                name: c.name || 'Unknown Name',
                phone: phone,
              };
            })
            .filter((c) => c.name.trim() !== '');

          formatted.sort((a, b) => a.name.localeCompare(b.name));
          setDeviceContacts(formatted);
        } else {
          setDeviceContacts([]);
        }
      } else {
        setDeviceContacts([]);
      }
    } catch (error) {
      console.log('Failed to fetch native contacts:', error);
      setDeviceContacts([]);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  useEffect(() => {
    if (isCustomerModalVisible) {
      loadContacts();
    }
  }, [isCustomerModalVisible]);

  const allContacts = useMemo(() => {
    const customWithIds = customCustomers.map((c, index) => ({
      id: `custom-${index}-${c.name}-${c.phone}`,
      name: c.name,
      phone: c.phone,
      isCustom: true,
    }));

    const combined = [...customWithIds];

    for (const dc of deviceContacts) {
      const isDuplicate = customCustomers.some(
        (cc) =>
          cc.name.toLowerCase() === dc.name.toLowerCase() &&
          cc.phone.replace(/[^0-9]/g, '') === dc.phone.replace(/[^0-9]/g, '')
      );
      if (!isDuplicate) {
        combined.push({
          id: dc.id,
          name: dc.name,
          phone: dc.phone,
          isCustom: false,
        });
      }
    }

    combined.sort((a, b) => a.name.localeCompare(b.name));
    return combined;
  }, [deviceContacts, customCustomers]);

  const filteredContacts = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return allContacts;
    return allContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.replace(/[^0-9]/g, '').includes(q)
    );
  }, [debouncedQuery, allContacts]);

  const handleAddManualCustomer = () => {
    if (!newCustomerName.trim()) {
      Alert.alert('Required Fields', 'Please enter a customer name.');
      return;
    }
    const customer = {
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || 'Walking Customer',
    };
    // Save to custom customers persistent list
    useCart.getState().addCustomCustomer(customer);

    cartState.setCustomer(customer);
    setAttachedCustomer(customer);
    setIsCustomerModalVisible(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    triggerToast(`Customer ${customer.name} attached`);
  };

  const handleSelectWalkingCustomer = () => {
    cartState.setCustomer(null);
    setAttachedCustomer(null);
    setIsCustomerModalVisible(false);
    triggerToast('Set as Walking Customer');
  };

  const renderContactItem = ({ item }: { item: { id: string; name: string; phone: string } }) => {
    const avatarColor = getAvatarColor(item.name);
    const initials = getInitials(item.name);
    const isSelected =
      attachedCustomer !== null &&
      attachedCustomer.name.toLowerCase() === item.name.toLowerCase() &&
      attachedCustomer.phone === item.phone;

    return (
      <TouchableOpacity
        style={styles.contactItem}
        activeOpacity={0.7}
        onPress={() => {
          hapticFeedback.selection();
          const customer = { name: item.name, phone: item.phone || 'Walking Customer' };
          cartState.setCustomer(customer);
          setAttachedCustomer(customer);
          setIsCustomerModalVisible(false);
          triggerToast(`Attached: ${item.name}`);
        }}
      >
        <View style={[styles.contactAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.contactInitials}>{initials}</Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.name}</Text>
          <Text style={styles.contactPhone}>{item.phone || 'No phone number'}</Text>
        </View>
        {isSelected && (
          <Feather name="check" size={16} color={TOKENS.primary} style={{ marginRight: 8 }} />
        )}
        <Feather name="chevron-right" size={16} color={TOKENS.muted} />
      </TouchableOpacity>
    );
  };

  const handleClearCart = () => {
    hapticFeedback.notificationWarning();
    Alert.alert(
      'Clear Invoice',
      'Are you sure you want to remove all items from this active checkout invoice?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            hapticFeedback.impactMedium();
            cartState.clearCart();
            triggerToast('Invoice cleared');
            router.push('/pos');
          },
        },
      ]
    );
  };

  // Calculations exactly matching Image 7 logic
  const subtotal = useMemo(() => {
    return invoiceItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [invoiceItems]);

  const computedDiscountAmount = useMemo(() => {
    if (discountType === 'percentage') {
      return Math.round(subtotal * (discountValue / 100));
    }
    return discountValue;
  }, [subtotal, discountType, discountValue]);

  const tax = useMemo(() => {
    return Math.round(subtotal * (taxRate / 100));
  }, [subtotal, taxRate]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - computedDiscountAmount + tax);
  }, [subtotal, computedDiscountAmount, tax]);

  const handleUpdateQuantity = (id: string, delta: number) => {
    hapticFeedback.impactLight();
    cartState.updateQuantity(id, delta);
  };

  const handleProceedToPayment = () => {
    if (invoiceItems.length === 0) {
      hapticFeedback.notificationWarning();
      Alert.alert('Empty Cart', 'Please add products before checking out.');
      return;
    }
    hapticFeedback.selection();
    // Navigate directly to Payment Tender screen, passing parameters
    router.push({
      pathname: '/pos/payment-tender',
      params: {
        totalAmount: total.toString(),
        subtotal: subtotal.toString(),
        discount: computedDiscountAmount.toString(),
        discountType: discountType,
        discountValue: discountValue.toString(),
        tax: tax.toString(),
        taxRate: taxRate.toString(),
        paymentMethod: 'cash',
      },
    });
  };

  const handleSaveDiscount = () => {
    const val = parseFloat(tempDiscount);
    if (!isNaN(val) && val >= 0) {
      if (tempDiscountType === 'percentage' && val > 100) {
        hapticFeedback.notificationWarning();
        Alert.alert('Invalid input', 'Percentage discount cannot exceed 100%.');
        return;
      }
      hapticFeedback.notificationSuccess();
      setDiscountType(tempDiscountType);
      setDiscountValue(val);
      setIsEditingDiscount(false);
      const label = tempDiscountType === 'percentage' ? `${val}%` : `Rs. ${val}`;
      triggerToast(`Discount set to ${label}`);
    } else {
      hapticFeedback.notificationError();
      Alert.alert('Invalid input', 'Please enter a valid positive discount amount.');
    }
  };

  const handleSaveTax = () => {
    const val = parseFloat(tempTaxRate);
    if (!isNaN(val) && val >= 0) {
      if (val > 100) {
        hapticFeedback.notificationWarning();
        Alert.alert('Invalid input', 'Tax rate cannot exceed 100%.');
        return;
      }
      hapticFeedback.notificationSuccess();
      setTaxRate(val);
      setIsEditingTax(false);
      triggerToast(`Tax rate set to ${val}%`);
    } else {
      hapticFeedback.notificationError();
      Alert.alert('Invalid input', 'Please enter a valid positive tax rate.');
    }
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

      {/* Header exactly matching Image 7 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.back()}
        >
          <Feather name="chevron-left" size={22} color={TOKENS.dark} />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Cart</Text>
          <Text style={styles.headerSubtitle}>
            {invoiceItems.reduce((sum, item) => sum + item.quantity, 0)} items · #2041
          </Text>
        </View>

        <TouchableOpacity
          style={styles.clearCartButton}
          activeOpacity={0.7}
          onPress={handleClearCart}
        >
          <Feather name="trash-2" size={20} color={TOKENS.error} />
        </TouchableOpacity>
      </View>

      {/* Scrollable list of items */}
      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {invoiceItems.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            {/* Left Box Icon */}
            <ProductImage icon={item.icon || '🥛'} size={47} style={styles.iconBox} />

            {/* Middle Details */}
            <View style={styles.itemDetails}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.itemPricing}>
                {item.quantity} × Rs. {item.price.toLocaleString()}
              </Text>
            </View>

            {/* Right Active Modifiers exactly matching Image 7 */}
            <View style={styles.modifiersRow}>
              <TouchableOpacity
                style={styles.modifierBtn}
                activeOpacity={0.7}
                onPress={() => handleUpdateQuantity(item.id, -1)}
              >
                <Feather name="minus" size={14} color={TOKENS.primary} />
              </TouchableOpacity>

              <Text style={styles.quantityText}>{item.quantity}</Text>

              <TouchableOpacity
                style={styles.modifierBtn}
                activeOpacity={0.7}
                onPress={() => handleUpdateQuantity(item.id, 1)}
              >
                <Feather name="plus" size={14} color={TOKENS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {invoiceItems.length === 0 && (
          <View style={styles.emptyCart}>
            <Feather name="shopping-cart" size={48} color={TOKENS.muted} />
            <Text style={styles.emptyText}>Your cart checkout is empty</Text>
            <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/pos')}>
              <Text style={styles.browseBtnText}>Go back to POS</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Sticky Bottom Actions & Summary Container */}
      {invoiceItems.length > 0 && (
        <View
          style={[
            styles.bottomStickyContainer,
            { paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 12) : 16 },
          ]}
        >
          {/* Summary Box exactly matching Image 7 */}
          <View style={styles.summaryCard}>
            {/* Subtotal */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>Rs. {subtotal.toLocaleString()}.00</Text>
            </View>

            {/* Discount editable */}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelActive}>Discount</Text>
              {isEditingDiscount ? (
                <View style={styles.editDiscountRow}>
                  <View style={styles.discountTypeToggleGroup}>
                    <TouchableOpacity
                      style={[
                        styles.discountTypeToggleBtn,
                        tempDiscountType === 'flat' && styles.discountTypeToggleBtnActive,
                      ]}
                      onPress={() => setTempDiscountType('flat')}
                    >
                      <Text
                        style={[
                          styles.discountTypeToggleText,
                          tempDiscountType === 'flat' && styles.discountTypeToggleTextActive,
                        ]}
                      >
                        Rs.
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.discountTypeToggleBtn,
                        tempDiscountType === 'percentage' && styles.discountTypeToggleBtnActive,
                      ]}
                      onPress={() => setTempDiscountType('percentage')}
                    >
                      <Text
                        style={[
                          styles.discountTypeToggleText,
                          tempDiscountType === 'percentage' && styles.discountTypeToggleTextActive,
                        ]}
                      >
                        %
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={styles.discountInput}
                    keyboardType="numeric"
                    value={tempDiscount}
                    onChangeText={setTempDiscount}
                    autoFocus
                  />
                  <TouchableOpacity onPress={handleSaveDiscount}>
                    <Feather name="check" size={16} color={TOKENS.success} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.summaryDiscountWrapper}>
                  <Text style={styles.summaryDiscountValue}>
                    - Rs. {computedDiscountAmount.toLocaleString()}.00
                    {discountType === 'percentage' ? ` (${discountValue}%)` : ''}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setTempDiscount(discountValue.toString());
                      setTempDiscountType(discountType);
                      setIsEditingDiscount(true);
                    }}
                  >
                    <Feather
                      name="edit-3"
                      size={14}
                      color={TOKENS.primary}
                      style={styles.editIcon}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Tax */}
            <View style={styles.summaryRow}>
              <View style={styles.taxLabelWrapper}>
                <Text style={[styles.summaryLabelActive, { color: TOKENS.dark }]}>
                  Tax
                  {taxRate > 0 && <Text style={{ color: TOKENS.primary }}> ({taxRate}%)</Text>}
                </Text>
              </View>
              {isEditingTax ? (
                <View style={styles.editDiscountRow}>
                  <Text style={styles.discountTypeToggleText}>%</Text>
                  <TextInput
                    style={styles.discountInput}
                    keyboardType="numeric"
                    value={tempTaxRate}
                    onChangeText={setTempTaxRate}
                    autoFocus
                  />
                  <TouchableOpacity onPress={handleSaveTax}>
                    <Feather name="check" size={16} color={TOKENS.success} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.summaryDiscountWrapper}>
                  <Text style={styles.summaryValue}>Rs. {tax.toLocaleString()}.00</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setTempTaxRate(taxRate.toString());
                      setIsEditingTax(true);
                    }}
                  >
                    <Feather
                      name="edit-3"
                      size={14}
                      color={TOKENS.primary}
                      style={styles.editIcon}
                    />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.dividerLine} />

            {/* Total bold blue */}
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>Rs. {total.toLocaleString()}.00</Text>
            </View>
          </View>

          {/* Attach Customer / Notes actions */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.actionPill,
                attachedCustomer && {
                  backgroundColor: TOKENS.lightBlue,
                  borderColor: TOKENS.accentBlue,
                  borderWidth: 1,
                },
              ]}
              activeOpacity={0.7}
              onPress={() => setIsCustomerModalVisible(true)}
            >
              <Ionicons
                name={attachedCustomer ? 'person' : 'person-outline'}
                size={16}
                color={attachedCustomer ? TOKENS.primary : TOKENS.dark}
              />
              <Text
                style={[
                  styles.actionPillText,
                  attachedCustomer && { color: TOKENS.primary, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {attachedCustomer ? attachedCustomer.name : 'Attach Customer'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionPill}
              activeOpacity={0.7}
              onPress={() =>
                Alert.prompt('Add Note', 'Enter custom checkout note:', (txt) =>
                  triggerToast(`Note saved: "${txt}"`)
                )
              }
            >
              <Ionicons name="pricetag-outline" size={16} color={TOKENS.dark} />
              <Text style={styles.actionPillText}>Note</Text>
            </TouchableOpacity>
          </View>

          {/* Massive checkout pay button */}
          <TouchableOpacity
            style={styles.checkoutPayButton}
            activeOpacity={0.85}
            onPress={handleProceedToPayment}
          >
            <Text style={styles.checkoutPayText}>
              Proceed to Pay (Rs. {total.toLocaleString()})
            </Text>
            <Feather name="arrow-right" size={18} color={TOKENS.card} />
          </TouchableOpacity>
        </View>
      )}

      {/* Select Customer Bottom Sheet */}
      <BottomSheet
        visible={isCustomerModalVisible}
        onClose={() => setIsCustomerModalVisible(false)}
        title="Select Customer"
        contentPaddingHorizontal={0}
      >
        <View style={{ height: Math.min(680, SCREEN_HEIGHT * 0.85) }}>
          {/* Segmented Control / Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'contacts' && styles.activeTabItem]}
              onPress={() => setActiveTab('contacts')}
              activeOpacity={0.7}
            >
              <Feather
                name="search"
                size={14}
                color={activeTab === 'contacts' ? TOKENS.primary : TOKENS.muted}
              />
              <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>
                Search Contacts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'new' && styles.activeTabItem]}
              onPress={() => setActiveTab('new')}
              activeOpacity={0.7}
            >
              <Feather
                name="user-plus"
                size={14}
                color={activeTab === 'new' ? TOKENS.primary : TOKENS.muted}
              />
              <Text style={[styles.tabText, activeTab === 'new' && styles.activeTabText]}>
                Create Customer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content based on tab */}
          {activeTab === 'contacts' ? (
            <View style={{ flex: 1 }}>
              {/* Search Bar */}
              <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                <View style={styles.searchBarWrapper}>
                  <Feather name="search" size={16} color={TOKENS.muted} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search name or phone..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                  />
                </View>
              </View>

              {/* Walking Customer Option */}
              <TouchableOpacity
                style={styles.walkingCustomerRow}
                activeOpacity={0.7}
                onPress={handleSelectWalkingCustomer}
              >
                <View style={[styles.contactAvatar, { backgroundColor: '#E5E7EB' }]}>
                  <Ionicons name="people" size={18} color={TOKENS.muted} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.walkingText}>Walking Customer</Text>
                  <Text style={styles.contactPhone}>Default non-attached checkout</Text>
                </View>
                {attachedCustomer === null && (
                  <Feather name="check" size={16} color={TOKENS.primary} />
                )}
              </TouchableOpacity>

              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>CONTACTS LIST</Text>
              </View>

              {/* List of Contacts */}
              {isLoadingContacts ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={TOKENS.primary} />
                  <Text style={styles.loadingText}>Loading contacts...</Text>
                </View>
              ) : (
                <FlashList
                  data={filteredContacts}
                  keyExtractor={(item) => item.id}
                  renderItem={renderContactItem}
                  drawDistance={300}
                  showsVerticalScrollIndicator={true}
                  contentContainerStyle={styles.listContent}
                  ListEmptyComponent={
                    <View style={styles.emptyList}>
                      <Feather name="users" size={36} color={TOKENS.muted} />
                      <Text style={styles.emptyListText}>No contacts found</Text>
                    </View>
                  }
                />
              )}
            </View>
          ) : (
            <View style={[styles.newFormContainer, { paddingHorizontal: 20 }]}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>Customer Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Pasan Pahasara"
                  placeholderTextColor={TOKENS.muted}
                  value={newCustomerName}
                  onChangeText={setNewCustomerName}
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.formLabel}>Phone Number</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 077 123 4567"
                  placeholderTextColor={TOKENS.muted}
                  keyboardType="phone-pad"
                  value={newCustomerPhone}
                  onChangeText={setNewCustomerPhone}
                />
              </View>

              <TouchableOpacity
                style={styles.submitBtn}
                activeOpacity={0.8}
                onPress={handleAddManualCustomer}
              >
                <Text style={styles.submitBtnText}>Attach Customer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleSelectWalkingCustomer}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Or set as Walking Customer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </BottomSheet>
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
  headerTitleWrapper: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  headerSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
  },
  clearCartButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollWrapper: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    paddingRight: 16,
    paddingLeft: 3,
    paddingTop: 3,
    paddingBottom: 3,
  },
  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 10,
    marginRight: 12,
  },
  iconText: {
    fontSize: 22,
  },
  itemDetails: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  itemPricing: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 4,
  },
  modifiersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modifierBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: TOKENS.lightBlue,
    borderWidth: 1,
    borderColor: TOKENS.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
    minWidth: 14,
    textAlign: 'center',
  },
  emptyCart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: TOKENS.muted,
    fontWeight: '500',
  },
  browseBtn: {
    backgroundColor: TOKENS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  browseBtnText: {
    color: TOKENS.card,
    fontWeight: 'bold',
    fontSize: 13,
  },
  summaryCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 16,
    gap: 12,
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: TOKENS.muted,
  },
  summaryLabelActive: {
    fontSize: 14,
    color: TOKENS.primary,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.dark,
  },
  summaryDiscountWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryDiscountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.error,
  },
  editIcon: {
    marginTop: 1.5,
  },
  editDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountInput: {
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 4,
    width: 60,
    height: 24,
    paddingHorizontal: 6,
    fontSize: 12,
    textAlign: 'right',
  },
  discountTypeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    padding: 2,
    marginRight: 4,
  },
  discountTypeToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discountTypeToggleBtnActive: {
    backgroundColor: TOKENS.card,
    boxShadow: '0px 1px 1px 0px rgba(0, 0, 0, 0.1)',
  },
  discountTypeToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  discountTypeToggleTextActive: {
    color: TOKENS.primary,
    fontWeight: 'bold',
  },
  taxLabelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taxChangeLink: {
    fontSize: 12,
    color: TOKENS.primary,
    fontWeight: 'bold',
  },
  dividerLine: {
    height: 1,
    backgroundColor: TOKENS.border,
    marginVertical: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TOKENS.primary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    height: 38,
    gap: 6,
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKENS.dark,
  },
  checkoutPayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: TOKENS.primary,
    height: 48,
    borderRadius: 24,
    gap: 10,
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}4D`,
  },
  bottomStickyContainer: {
    backgroundColor: TOKENS.background,
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  checkoutPayText: {
    color: TOKENS.card,
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: TOKENS.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  activeTabItem: {
    backgroundColor: TOKENS.card,
    boxShadow: '0px 1px 2px 0px rgba(0, 0, 0, 0.05)',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.muted,
  },
  activeTabText: {
    color: TOKENS.primary,
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: TOKENS.dark,
  },
  walkingCustomerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  walkingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
  },
  listHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  listHeaderText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: TOKENS.muted,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: 24,
  },
  contactItem: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  contactAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactInitials: {
    color: TOKENS.card,
    fontSize: 13,
    fontWeight: 'bold',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.dark,
  },
  contactPhone: {
    fontSize: 12,
    color: TOKENS.muted,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: TOKENS.muted,
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyListText: {
    fontSize: 13,
    color: TOKENS.muted,
  },
  newFormContainer: {
    paddingTop: 16,
  },
  formField: {
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TOKENS.dark,
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 14,
    color: TOKENS.dark,
    backgroundColor: '#F9FAFB',
  },
  submitBtn: {
    backgroundColor: TOKENS.primary,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  submitBtnText: {
    color: TOKENS.card,
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelBtn: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: TOKENS.muted,
    fontSize: 13,
    fontWeight: '500',
  },
});
