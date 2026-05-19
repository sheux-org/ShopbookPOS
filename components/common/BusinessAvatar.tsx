import React from 'react';
import { View, Text, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { TOKENS } from '../../constants/tokens';
import { getBusinessInitials } from '../../utils/business';

interface BusinessAvatarProps {
  logoUri?: string;
  name: string;
  size?: number;
  isUploading?: boolean;
}

export const BusinessAvatar: React.FC<BusinessAvatarProps> = ({
  logoUri,
  name,
  size = 72,
  isUploading = false,
}) => {
  const radius = size / 2;
  const initials = getBusinessInitials(name);

  if (isUploading) {
    return (
      <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: radius }]}>
        <ActivityIndicator size="small" color={TOKENS.card} />
      </View>
    );
  }

  if (logoUri && logoUri.length > 2) {
    return (
      <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: radius, overflow: 'hidden' }]}>
        <Image source={{ uri: logoUri }} style={{ width: '100%', height: '100%' }} />
      </View>
    );
  }

  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: radius }]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.36 }]}>
        {logoUri && logoUri.length <= 2 ? logoUri : initials}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  avatarCircle: {
    backgroundColor: TOKENS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TOKENS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarInitials: {
    fontWeight: 'bold',
    color: TOKENS.card,
  },
});
