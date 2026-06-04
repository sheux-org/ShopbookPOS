import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { TOKENS } from '../../constants/tokens';

interface HeaderProps {
  variant?: 'default' | 'primary';
  title: string;
  subtitle: string;
  onBackPress?: () => void;
  onCartPress?: () => void;
  cartTotalDisplay?: string;
}

export const Header: React.FC<HeaderProps> = ({
  variant = 'default',
  title,
  subtitle,
  onBackPress,
  onCartPress,
  cartTotalDisplay,
}) => {
  const isPrimary = variant === 'primary';

  return (
    <View style={[styles.container, isPrimary ? styles.containerPrimary : styles.containerDefault]}>
      <TouchableOpacity
        style={[styles.backButton, isPrimary ? styles.backButtonPrimary : styles.backButtonDefault]}
        activeOpacity={0.7}
        onPress={onBackPress}
      >
        <Feather
          name={isPrimary ? 'arrow-left' : 'chevron-left'}
          size={22}
          color={isPrimary ? TOKENS.card : TOKENS.dark}
        />
      </TouchableOpacity>

      <View style={styles.titleWrapper}>
        <Text style={[styles.title, isPrimary ? styles.textLight : styles.textDark]}>{title}</Text>
        <Text style={[styles.subtitle, isPrimary ? styles.textLightSubtitle : styles.textMuted]}>
          {subtitle}
        </Text>
      </View>

      {cartTotalDisplay && onCartPress && !isPrimary && (
        <TouchableOpacity style={styles.cartButton} activeOpacity={0.8} onPress={onCartPress}>
          <Feather name="shopping-cart" size={16} color={TOKENS.primary} />
          <Text style={styles.cartButtonText}>{cartTotalDisplay}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  containerDefault: {
    backgroundColor: TOKENS.background,
  },
  containerPrimary: {
    backgroundColor: TOKENS.primary,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonDefault: {
    backgroundColor: '#F3F4F6',
  },
  backButtonPrimary: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  titleWrapper: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 1,
  },
  textDark: {
    color: TOKENS.dark,
  },
  textLight: {
    color: TOKENS.card,
  },
  textMuted: {
    color: TOKENS.muted,
  },
  textLightSubtitle: {
    color: TOKENS.card,
    fontWeight: '500',
  },
  cartButton: {
    backgroundColor: TOKENS.lightBlue,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  cartButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: TOKENS.primary,
  },
});
