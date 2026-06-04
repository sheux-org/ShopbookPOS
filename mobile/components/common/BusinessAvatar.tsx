import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Animated } from 'react-native';
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
  const [imageError, setImageError] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Reset state and opacity on logoUri change
  useEffect(() => {
    fadeAnim.setValue(0);
    setImageError(false);
  }, [logoUri]);

  if (isUploading) {
    return (
      <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: radius }]}>
        <ActivityIndicator size="small" color={TOKENS.primary} />
      </View>
    );
  }

  const showImage = logoUri && logoUri.length > 2 && !imageError;

  const handleImageLoad = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View
      style={[
        styles.avatarCircle,
        { width: size, height: size, borderRadius: radius, overflow: 'hidden' },
      ]}
    >
      {/* Background Initials (always rendered behind/underneath the image) */}
      <Text style={[styles.avatarInitials, { fontSize: size * 0.46 }]}>
        {logoUri && logoUri.length <= 2 ? logoUri : initials}
      </Text>

      {/* Absolutely positioned Image on top that fades in smoothly upon loading */}
      {showImage && (
        <Animated.Image
          source={{ uri: logoUri }}
          style={[
            StyleSheet.absoluteFillObject,
            {
              width: '100%',
              height: '100%',
              opacity: fadeAnim,
            },
          ]}
          onLoad={handleImageLoad}
          onError={() => setImageError(true)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  avatarCircle: {
    backgroundColor: TOKENS.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0px 4px 6px 0px ${TOKENS.primary}26`,
  },
  avatarInitials: {
    fontWeight: 'bold',
    color: TOKENS.primary,
  },
});
