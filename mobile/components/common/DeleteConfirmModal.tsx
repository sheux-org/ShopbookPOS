import { Feather } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TOKENS } from '../../constants/tokens';
import { hapticFeedback } from '@/utils/haptics';

interface DeleteConfirmModalProps {
  visible: boolean;
  title: string;
  itemName: string;
  itemTypeLabel?: string; // e.g. "business" or "staff member"
  description?: string;
  confirmButtonText?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  visible,
  title,
  itemName,
  itemTypeLabel = 'item',
  description,
  confirmButtonText = 'Delete Permanently',
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  const [typedName, setTypedName] = useState('');

  useEffect(() => {
    if (visible) {
      setTypedName('');
    }
  }, [visible]);

  const cleanExpected = (itemName || '').trim().toLowerCase();
  const cleanTyped = (typedName || '').trim().toLowerCase();
  const isMatch = cleanTyped === cleanExpected && cleanExpected.length > 0;

  const handleConfirm = () => {
    if (!isMatch || isLoading) return;
    hapticFeedback.impactHeavy();
    onConfirm();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isLoading ? undefined : onClose}
    >
      <TouchableWithoutFeedback onPress={isLoading ? undefined : onClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.avoidingContainer}
          >
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                {/* Header Icon */}
                <View style={styles.iconCircle}>
                  <Feather name="alert-triangle" size={24} color="#DC2626" />
                </View>

                {/* Title & Description */}
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.description}>
                  {description ||
                    `Are you sure you want to delete this ${itemTypeLabel}? This action cannot be undone.`}
                </Text>

                {/* Target Name Highlight Box */}
                <View style={styles.targetNameBox}>
                  <Text style={styles.typePromptLabel}>
                    Type <Text style={styles.targetNameBold}>{`"${itemName}"`}</Text> to confirm:
                  </Text>
                </View>

                {/* Name Input Field */}
                <TextInput
                  style={[styles.input, isMatch && styles.inputMatched]}
                  placeholder={`Type "${itemName}"`}
                  placeholderTextColor={TOKENS.muted}
                  value={typedName}
                  onChangeText={(text) => {
                    setTypedName(text);
                    if (text.trim().toLowerCase() === cleanExpected) {
                      hapticFeedback.impactLight();
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                />

                {/* Action Buttons */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    activeOpacity={0.7}
                    onPress={onClose}
                    disabled={isLoading}
                  >
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.deleteBtn,
                      (!isMatch || isLoading) && styles.deleteBtnDisabled,
                    ]}
                    activeOpacity={0.8}
                    onPress={handleConfirm}
                    disabled={!isMatch || isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Feather name="trash-2" size={16} color="#FFFFFF" />
                        <Text style={styles.deleteBtnText}>{confirmButtonText}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  avoidingContainer: {
    width: '100%',
    alignItems: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: TOKENS.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TOKENS.dark,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: TOKENS.muted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  targetNameBox: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  typePromptLabel: {
    fontSize: 13,
    color: '#991B1B',
    textAlign: 'center',
  },
  targetNameBold: {
    fontWeight: 'bold',
    color: '#DC2626',
  },
  input: {
    width: '100%',
    height: 46,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TOKENS.dark,
    fontWeight: '600',
    marginBottom: 20,
  },
  inputMatched: {
    borderColor: '#DC2626',
    backgroundColor: '#FFF5F5',
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    backgroundColor: TOKENS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: TOKENS.dark,
  },
  deleteBtn: {
    flex: 1.3,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  deleteBtnDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});
