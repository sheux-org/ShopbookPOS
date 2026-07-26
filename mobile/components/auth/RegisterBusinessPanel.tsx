import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TOKENS } from '../../constants/tokens';

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

interface RegisterBusinessPanelProps {
  phone: string;
  businessName: string;
  setBusinessName: (val: string) => void;
  businessType: string;
  setBusinessType: (val: string) => void;
  businessAddress: string;
  setBusinessAddress: (val: string) => void;
  registerStep?: 1 | 2 | 3;
  setRegisterStep?: (step: 1 | 2 | 3) => void;
  isLoading: boolean;
  handleRegister: () => void;
  setStep: (step: 'phone' | 'otp' | 'register') => void;
}

export function RegisterBusinessPanel({
  businessName,
  setBusinessName,
  businessType,
  setBusinessType,
  businessAddress,
  setBusinessAddress,
  isLoading,
  handleRegister,
  setStep,
}: RegisterBusinessPanelProps) {
  const [focusedField, setFocusedField] = useState<'name' | 'address' | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const nameInputRef = useRef<TextInput>(null);
  const addressInputRef = useRef<TextInput>(null);

  const isFormValid =
    businessName.trim() !== '' && businessType !== '' && businessAddress.trim() !== '';

  const selectedCategory = BUSINESS_TYPES.find((b) => b.label === businessType);

  return (
    <View style={panelStyles.card}>
      {/* Back Button */}
      <TouchableOpacity
        style={panelStyles.backButton}
        onPress={() => setStep('otp')}
        activeOpacity={0.7}
      >
        <Feather name="arrow-left" size={16} color={TOKENS.primary} />
        <Text style={panelStyles.backText}>Back to OTP</Text>
      </TouchableOpacity>

      {/* Header */}
      <View style={panelStyles.header}>
        <Text style={panelStyles.title}>Register Store Profile</Text>
        <Text style={panelStyles.subtitle}>
          Provide your outlet information to set up the billing terminal
        </Text>
      </View>

      {/* Form Area - Scrollable internally to prevent screen overflow */}
      <View style={panelStyles.form}>
        <ScrollView
          style={panelStyles.internalScroll}
          contentContainerStyle={panelStyles.internalScrollContent}
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Business Name */}
          <View style={[panelStyles.fieldGroup, { zIndex: 1 }]}>
            <Text style={panelStyles.label}>Business / Brand Name</Text>
            <TouchableOpacity
              activeOpacity={1}
              style={[
                panelStyles.inputWrapper,
                focusedField === 'name' && panelStyles.inputWrapperFocused,
                focusedField !== 'name' &&
                  businessName.trim() !== '' &&
                  panelStyles.inputWrapperSelected,
              ]}
              onPress={() => nameInputRef.current?.focus()}
            >
              <Feather
                name="shopping-bag"
                size={18}
                color={
                  focusedField === 'name' || businessName.trim() !== ''
                    ? TOKENS.primary
                    : TOKENS.muted
                }
                style={panelStyles.inputIcon}
              />
              <TextInput
                ref={nameInputRef}
                style={panelStyles.input}
                placeholder="e.g. Green Mart"
                placeholderTextColor="#9CA3AF"
                value={businessName}
                onChangeText={setBusinessName}
                onFocus={() => {
                  setFocusedField('name');
                  setIsDropdownOpen(false);
                }}
                onBlur={() => setFocusedField(null)}
              />
              {businessName.trim() !== '' && (
                <Feather name="check" size={18} color={TOKENS.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Business Type Custom Dropdown Selector */}
          <View style={[panelStyles.fieldGroup, { zIndex: 10 }]}>
            <Text style={panelStyles.label}>Business Type</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                panelStyles.inputWrapper,
                isDropdownOpen && panelStyles.inputWrapperFocused,
                !isDropdownOpen && businessType !== '' && panelStyles.inputWrapperSelected,
              ]}
              onPress={() => {
                setIsDropdownOpen(!isDropdownOpen);
                setFocusedField(null);
                nameInputRef.current?.blur();
                addressInputRef.current?.blur();
              }}
            >
              {selectedCategory ? (
                <View
                  style={[
                    panelStyles.selectedEmojiWrapper,
                    !isDropdownOpen && businessType !== '' && { backgroundColor: '#FFFFFF' },
                  ]}
                >
                  <Text style={panelStyles.selectedEmoji}>{selectedCategory.icon}</Text>
                </View>
              ) : (
                <Feather
                  name="briefcase"
                  size={18}
                  color={businessType ? TOKENS.primary : TOKENS.muted}
                  style={panelStyles.inputIcon}
                />
              )}
              <Text style={[panelStyles.inputText, !businessType && panelStyles.placeholderText]}>
                {businessType || 'Select business type'}
              </Text>
              <Feather
                name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={TOKENS.muted}
              />
            </TouchableOpacity>

            {/* Dropdown Options absolute overlay list */}
            {isDropdownOpen && (
              <View style={panelStyles.dropdownList}>
                <ScrollView
                  nestedScrollEnabled
                  style={{ maxHeight: 150 }}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                >
                  {BUSINESS_TYPES.map((item) => {
                    const isSelected = businessType === item.label;
                    return (
                      <TouchableOpacity
                        key={item.label}
                        style={[
                          panelStyles.dropdownItem,
                          isSelected && panelStyles.dropdownItemSelected,
                        ]}
                        onPress={() => {
                          setBusinessType(item.label);
                          setIsDropdownOpen(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={panelStyles.categoryIconWrapper}>
                          <Text style={panelStyles.categoryEmoji}>{item.icon}</Text>
                        </View>
                        <Text
                          style={[
                            panelStyles.dropdownItemText,
                            isSelected && panelStyles.dropdownItemTextSelected,
                          ]}
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

          {/* Store Address */}
          <View style={[panelStyles.fieldGroup, { zIndex: 1 }]}>
            <Text style={panelStyles.label}>Store Address</Text>
            <TouchableOpacity
              activeOpacity={1}
              style={[
                panelStyles.inputWrapper,
                focusedField === 'address' && panelStyles.inputWrapperFocused,
                focusedField !== 'address' &&
                  businessAddress.trim() !== '' &&
                  panelStyles.inputWrapperSelected,
              ]}
              onPress={() => addressInputRef.current?.focus()}
            >
              <Feather
                name="map-pin"
                size={18}
                color={
                  focusedField === 'address' || businessAddress.trim() !== ''
                    ? TOKENS.primary
                    : TOKENS.muted
                }
                style={panelStyles.inputIcon}
              />
              <TextInput
                ref={addressInputRef}
                style={panelStyles.input}
                placeholder="e.g. 123 Galle Road, Colombo 03"
                placeholderTextColor="#9CA3AF"
                value={businessAddress}
                onChangeText={setBusinessAddress}
                onFocus={() => {
                  setFocusedField('address');
                  setIsDropdownOpen(false);
                }}
                onBlur={() => setFocusedField(null)}
              />
              {businessAddress.trim() !== '' && (
                <Feather name="check" size={18} color={TOKENS.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Launch Button (Positioned inside scrollable area so dropdown overlays correctly) */}
          <TouchableOpacity
            style={[
              panelStyles.submitButton,
              (!isFormValid || isLoading) && panelStyles.submitButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={!isFormValid || isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={TOKENS.card} size="small" />
            ) : (
              <>
                <Text style={panelStyles.submitButtonText}>Launch POS Terminal</Text>
                <Feather name="arrow-right" size={16} color={TOKENS.card} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const panelStyles = StyleSheet.create({
  card: {
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: TOKENS.border,
    padding: 24,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    boxShadow: '0px 8px 16px rgba(0, 0, 0, 0.04)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: 13,
    color: TOKENS.primary,
    fontWeight: '700',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: TOKENS.dark,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    color: TOKENS.muted,
    lineHeight: 18,
  },
  form: {
    gap: 16,
  },
  internalScroll: {
    maxHeight: 320,
    overflow: 'visible',
  },
  internalScrollContent: {
    gap: 16,
    paddingBottom: 8,
    overflow: 'visible',
  },
  fieldGroup: {
    gap: 6,
    position: 'relative',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: TOKENS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
  },
  inputWrapperFocused: {
    borderColor: TOKENS.primary,
    backgroundColor: TOKENS.card,
    boxShadow: '0px 0px 6px 0px rgba(37, 99, 235, 0.18)',
  },
  inputWrapperSelected: {
    borderColor: TOKENS.primary,
    backgroundColor: '#EFF6FF',
    boxShadow: '0px 0px 4px 0px rgba(37, 99, 235, 0.1)',
  },
  inputIcon: {
    marginRight: 8,
  },
  selectedEmojiWrapper: {
    marginRight: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  selectedEmoji: {
    fontSize: 14,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 14,
    color: TOKENS.dark,
    fontWeight: '600',
  },
  inputText: {
    flex: 1,
    fontSize: 14,
    color: TOKENS.dark,
    fontWeight: '600',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
  dropdownList: {
    position: 'absolute',
    top: 72,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: TOKENS.border,
    borderRadius: 10,
    backgroundColor: TOKENS.card,
    zIndex: 1000,
    boxShadow: '0px 4px 12px 0px rgba(0, 0, 0, 0.08)',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemSelected: {
    backgroundColor: '#F4F7FF',
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: TOKENS.dark,
  },
  dropdownItemTextSelected: {
    color: TOKENS.primary,
    fontWeight: '700',
  },
  categoryIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  categoryEmoji: {
    fontSize: 14,
  },
  submitButton: {
    flexDirection: 'row',
    height: 48,
    backgroundColor: TOKENS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    boxShadow: '0px 4px 8px rgba(37, 99, 235, 0.12)',
  },
  submitButtonDisabled: {
    backgroundColor: '#E5E7EB',
    boxShadow: 'none',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: TOKENS.card,
  },
});
