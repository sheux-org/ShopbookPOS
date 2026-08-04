import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Modal, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ProductImage } from '../common/ProductImage';
import { TOKENS } from '../../constants/tokens';

interface ImagePreviewModalProps {
  visible: boolean;
  onClose: () => void;
  product: {
    name: string;
    price: number;
    category: string;
    icon?: string;
    quickCode?: string;
  };
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  onClose,
  product,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerTitleContainer}>
              <Feather name="image" size={16} color={TOKENS.primary} />
              <Text style={styles.title} numberOfLines={1}>
                {product.name}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} activeOpacity={0.7} onPress={onClose}>
              <Feather name="x" size={16} color="#4B5563" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <View style={styles.imagePreviewCard}>
              <ProductImage
                icon={product.icon}
                category={product.category}
                size={320}
                style={styles.productImage}
              />
            </View>

            <View style={styles.footer}>
              <View style={[styles.codePill, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.codeText, { color: TOKENS.primary, fontWeight: '700' }]}>
                  {product.category.toUpperCase()}
                </Text>
              </View>
              {product.quickCode ? (
                <View style={styles.codePill}>
                  <Text style={styles.codeText}>Code: {product.quickCode}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: TOKENS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: TOKENS.border,
    boxShadow: '0px 10px 15px 0px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
    backgroundColor: '#F9FAFB',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: TOKENS.dark,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: 12,
    alignItems: 'center',
  },
  imagePreviewCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 2,
    width: '100%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  codePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeText: {
    fontSize: 10,
    fontWeight: '600',
    color: TOKENS.muted,
  },
});
