import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { TOKENS } from '../../constants/tokens';
import { useTranslation } from '../../hooks/useTranslation';
import { hapticFeedback } from '@/utils/haptics';

export interface ImagePickerBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectSource: (source: 'camera' | 'gallery') => void;
}

export const ImagePickerBottomSheet: React.FC<ImagePickerBottomSheetProps> = ({
  visible,
  onClose,
  onSelectSource,
}) => {
  const { t } = useTranslation();

  const handleSelect = (source: 'camera' | 'gallery') => {
    hapticFeedback.impactMedium();
    onClose();
    onSelectSource(source);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('catalog.photoSheetTitle')}
      enableDynamicSizing={true}
      useScrollView={false}
    >
      <View style={styles.container}>
        <Text style={styles.sheetSubtitle}>{t('catalog.photoSheetSubtitle')}</Text>

        {/* Camera option */}
        <TouchableOpacity
          style={styles.sheetOption}
          activeOpacity={0.75}
          onPress={() => handleSelect('camera')}
        >
          <View style={[styles.sheetOptionIcon, { backgroundColor: TOKENS.lightBlue }]}>
            <Feather name="camera" size={22} color={TOKENS.primary} />
          </View>
          <View style={styles.sheetOptionText}>
            <Text style={styles.sheetOptionTitle}>{t('catalog.cameraOption')}</Text>
            <Text style={styles.sheetOptionSub}>{t('catalog.cameraOptionSub')}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={TOKENS.muted} />
        </TouchableOpacity>

        {/* Gallery option */}
        <TouchableOpacity
          style={styles.sheetOption}
          activeOpacity={0.75}
          onPress={() => handleSelect('gallery')}
        >
          <View style={[styles.sheetOptionIcon, { backgroundColor: '#F0FDF4' }]}>
            <Feather name="image" size={22} color="#16A34A" />
          </View>
          <View style={styles.sheetOptionText}>
            <Text style={styles.sheetOptionTitle}>{t('catalog.galleryOption')}</Text>
            <Text style={styles.sheetOptionSub}>{t('catalog.galleryOptionSub')}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={TOKENS.muted} />
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity
          style={styles.sheetCancelBtn}
          activeOpacity={0.8}
          onPress={() => {
            hapticFeedback.selection();
            onClose();
          }}
        >
          <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: TOKENS.muted,
    marginBottom: 16,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.border,
  },
  sheetOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionText: {
    flex: 1,
    gap: 2,
  },
  sheetOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TOKENS.dark,
  },
  sheetOptionSub: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  sheetCancelBtn: {
    marginTop: 16,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: TOKENS.border,
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: TOKENS.dark,
  },
});
