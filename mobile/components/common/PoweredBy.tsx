import React from 'react';
import { StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { TOKENS } from '../../constants/tokens';

interface PoweredByProps {
  style?: StyleProp<ViewStyle>;
  showPro?: boolean;
}

export const PoweredBy: React.FC<PoweredByProps> = ({ style, showPro = true }) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>powered by</Text>
      <Text style={styles.brand}>Shopbook</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 16,
    marginBottom: 8,
  },
  text: {
    fontSize: 12,
    color: TOKENS.muted,
  },
  brand: {
    fontSize: 13,
    fontWeight: 'bold',
    color: TOKENS.primary,
    letterSpacing: 0.5,
  },
});
