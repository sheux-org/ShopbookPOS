import React from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { TOKENS } from '../../constants/tokens';

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onScanPress?: () => void;
  onClear?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onScanPress,
  onClear,
  containerStyle,
}) => {
  const handleClear = () => {
    onChangeText('');
    if (onClear) {
      onClear();
    }
  };

  return (
    <View style={[styles.searchInputWrapper, containerStyle]}>
      <Feather name="search" size={18} color={TOKENS.muted} />
      <TextInput
        style={styles.searchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <TouchableOpacity onPress={handleClear}>
          <Feather name="x-circle" size={16} color={TOKENS.muted} />
        </TouchableOpacity>
      ) : onScanPress ? (
        <TouchableOpacity onPress={onScanPress}>
          <Ionicons name="qr-code-outline" size={16} color={TOKENS.primary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TOKENS.dark,
    paddingVertical: 0,
  },
});
