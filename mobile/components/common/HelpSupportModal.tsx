import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from './BottomSheet';
import { TOKENS } from '../../constants/tokens';
import { useTranslation } from '../../hooks/useTranslation';

interface HelpSupportModalProps {
  visible: boolean;
  onClose: () => void;
}

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Help & Support">
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={[styles.container, { paddingBottom: Math.max(insets.bottom + 48, 56) }]}
      >
        <Text style={styles.supportIntro}>
          Need assistance with your Shopbook POS terminal? Get priority response 24/7.
        </Text>

        {/* Action Buttons as Premium Card Rows */}
        <View style={styles.supportActions}>
          <TouchableOpacity
            style={styles.premiumSupportCard}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('tel:+94782470168')}
          >
            <View style={[styles.supportIconCircle, { backgroundColor: '#EFF6FF' }]}>
              <Feather name="phone" size={18} color={TOKENS.primary} />
            </View>
            <View style={styles.supportCardTextWrapper}>
              <Text style={styles.supportCardTitle}>Call Helpline</Text>
              <Text style={styles.supportCardSubtitle}>Call +94 78 247 0168 · Active 24/7</Text>
            </View>
            <Feather name="chevron-right" size={18} color={TOKENS.muted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.premiumSupportCard}
            activeOpacity={0.7}
            onPress={() => Linking.openURL('https://wa.me/94782470168')}
          >
            <View style={[styles.supportIconCircle, { backgroundColor: '#E8FDF0' }]}>
              <Feather name="message-circle" size={18} color="#10B981" />
            </View>
            <View style={styles.supportCardTextWrapper}>
              <Text style={styles.supportCardTitle}>WhatsApp Support</Text>
              <Text style={styles.supportCardSubtitle}>Chat immediately & send screenshots</Text>
            </View>
            <Feather name="chevron-right" size={18} color={TOKENS.muted} />
          </TouchableOpacity>
        </View>

        {/* FAQs Section */}
        <Text style={styles.faqHeader}>{t('profile.faqTitle')}</Text>
        <View style={styles.faqList}>
          {[1, 2, 3, 4, 5, 6, 7].map((num, index) => {
            const isExpanded = expandedFaqIndex === index;
            return (
              <View key={num} style={styles.faqCard}>
                <TouchableOpacity
                  style={styles.faqQuestionRow}
                  activeOpacity={0.7}
                  onPress={() => setExpandedFaqIndex(isExpanded ? null : index)}
                >
                  <Text style={styles.faqQuestionText}>{t(`faq.q${num}`)}</Text>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={TOKENS.muted}
                  />
                </TouchableOpacity>
                {isExpanded && (
                  <View style={styles.faqAnswerWrapper}>
                    <Text style={styles.faqAnswerText}>{t(`faq.a${num}`)}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    maxHeight: 650,
  },
  supportIntro: {
    fontSize: 13,
    color: TOKENS.muted,
    lineHeight: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  supportActions: {
    gap: 12,
    marginBottom: 24,
  },
  premiumSupportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: TOKENS.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: TOKENS.border,
    padding: 14,
    boxShadow: '0px 2px 3px 0px rgba(0, 0, 0, 0.02)',
  },
  supportIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  supportCardTextWrapper: {
    flex: 1,
  },
  supportCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TOKENS.dark,
  },
  supportCardSubtitle: {
    fontSize: 11,
    color: TOKENS.muted,
    marginTop: 2,
    lineHeight: 14,
  },
  faqHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.dark,
    marginBottom: 12,
    marginTop: 8,
  },
  faqList: {
    gap: 10,
  },
  faqCard: {
    backgroundColor: TOKENS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TOKENS.border,
    overflow: 'hidden',
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  faqQuestionText: {
    fontSize: 13,
    fontWeight: '700',
    color: TOKENS.dark,
    flex: 1,
    marginRight: 8,
  },
  faqAnswerWrapper: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
  },
  faqAnswerText: {
    fontSize: 12,
    color: TOKENS.muted,
    lineHeight: 16,
  },
});
