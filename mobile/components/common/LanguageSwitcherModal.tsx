import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { BottomSheet } from './BottomSheet';
import { TOKENS } from '../../constants/tokens';
import { useSettingsStore, LanguageCode } from '../../stores/useSettingsStore';
import { useTranslation } from '../../hooks/useTranslation';
import { hapticFeedback } from '../../utils/haptics';

const LANGUAGES: { code: LanguageCode; name: string }[] = [
  { code: 'en', name: 'English (US)' },
  { code: 'si', name: 'සිංහල (Sinhala)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
];

interface LanguageSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectLanguage?: (langName: string) => void;
}

export const LanguageSwitcherModal: React.FC<LanguageSwitcherModalProps> = ({
  visible,
  onClose,
  onSelectLanguage,
}) => {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('profile.languageTitle')}>
      <View style={styles.languageList}>
        {LANGUAGES.map((lang) => {
          const isSelected = language === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              style={[styles.languageCard, isSelected && styles.languageCardActive]}
              activeOpacity={0.7}
              onPress={() => {
                hapticFeedback.notificationSuccess();
                setLanguage(lang.code);
                onClose();
                if (onSelectLanguage) {
                  onSelectLanguage(lang.name);
                }
              }}
            >
              <Text style={[styles.languageCardText, isSelected && styles.languageCardTextActive]}>
                {lang.name}
              </Text>
              {isSelected && <Feather name="check" size={18} color={TOKENS.success} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  languageList: {
    paddingVertical: 12,
    paddingBottom: 24,
    gap: 8,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  languageCardActive: {
    backgroundColor: '#EFF6FF',
    borderColor: TOKENS.primary,
  },
  languageCardText: {
    fontSize: 15,
    fontWeight: '500',
    color: TOKENS.dark,
  },
  languageCardTextActive: {
    color: TOKENS.primary,
    fontWeight: '600',
  },
});
