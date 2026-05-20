import React from "react";
import { ImageStyle, StyleProp, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";

interface ProductImageProps {
  icon?: string;
  category?: string;
  style?: StyleProp<any>;
  imageStyle?: StyleProp<ImageStyle>;
  size?: number;
  iconSize?: number;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  icon,
  category: _category,
  style,
  imageStyle,
  size = 48,
}) => {
  const finalIcon = icon ? icon.trim() : "";

  const isRealPhoto =
    finalIcon.startsWith("http") ||
    finalIcon.startsWith("file:") ||
    finalIcon.startsWith("data:") ||
    finalIcon.startsWith("/");

  if (isRealPhoto) {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <Image
          source={{ uri: finalIcon }}
          style={[styles.image, { width: "100%", height: "100%" }, imageStyle]}
          contentFit="cover"
          transition={250}
          placeholder={{ blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4" }}
        />
      </View>
    );
  }

  // Dynamic scaling of placeholder text sizes based on container size
  // Keep the home screen (where size defaults to 48) at its original font sizes: 10 and 18.
  const miniFontSize = size === 48 ? 10 : Math.max(6, Math.round(size * 0.17));
  const posFontSize = size === 48 ? 18 : Math.max(10, Math.round(size * 0.31));

  return (
    <View
      style={[
        styles.container,
        styles.placeholder,
        { width: size, height: size },
        style,
      ]}
    >
      <Text style={[styles.brandMini, { fontSize: miniFontSize }]}>Mini</Text>
      <Text style={[styles.brandPos, { fontSize: posFontSize }]}>POS</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    backgroundColor: "#F3F4F6",
  },
  placeholder: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1.5,
    borderColor: "#EBEBEB",
    gap: -1,
  },
  brandMini: {
    fontSize: 10,
    fontWeight: "700",
    color: "#C8C8C8",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  brandPos: {
    fontSize: 18,
    fontWeight: "900",
    color: "#B0B0B0",
    letterSpacing: 0.5,
  },
});
