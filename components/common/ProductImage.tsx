import React, { useState } from "react";
import { StyleSheet, Text, View, StyleProp, ImageStyle } from "react-native";
import { Image } from "expo-image";

interface ProductImageProps {
  icon?: string;
  category?: string;
  style?: StyleProp<any>;
  imageStyle?: StyleProp<ImageStyle>;
  size?: number;
  iconSize?: number;
}

// Map standard default emojis to high-quality Unsplash real product images for gorgeous initial loading
const EMOJI_TO_IMAGE_MAP: Record<string, string> = {
  "🥛": "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=400",
  "🥣": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&q=80&w=400",
  "🍪": "https://images.unsplash.com/photo-1558961309-dbdf717a13d9?auto=format&fit=crop&q=80&w=400",
  "🥮": "https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&q=80&w=400",
  "🥤": "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400",
  "🧼": "https://images.unsplash.com/photo-1607006342411-9a905574372a?auto=format&fit=crop&q=80&w=400",
  "🌾": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400",
  "☕": "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&q=80&w=400",
  "🍞": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400",
  "🍎": "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&q=80&w=400",
};

// Fallback high-quality images based on category
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  grocery: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400",
  dairy: "https://images.unsplash.com/photo-1528750951163-f03b7b329437?auto=format&fit=crop&q=80&w=400",
  drinks: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=400",
  snacks: "https://images.unsplash.com/photo-1599490659273-e316c12db38f?auto=format&fit=crop&q=80&w=400",
  household: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&q=80&w=400",
};

// Pastel backgrounds for customized emojis
const getCategoryBgColor = (cat?: string) => {
  switch (cat?.toLowerCase()) {
    case "grocery": return "#FEF3C7"; // warm amber
    case "dairy": return "#DBEAFE"; // light blue
    case "drinks": return "#E0F2FE"; // sky blue
    case "snacks": return "#FEE2E2"; // red/pink
    case "household": return "#F3E8FF"; // purple
    default: return "#F3F4F6"; // default neutral gray
  }
};

export const ProductImage: React.FC<ProductImageProps> = ({
  icon,
  category = "grocery",
  style,
  imageStyle,
  size = 48,
  iconSize,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const finalIcon = icon ? icon.trim() : "";
  
  // Detect if it is a local path, base64, or web URI
  const isImageUri = 
    finalIcon.startsWith("http") || 
    finalIcon.startsWith("file:") || 
    finalIcon.startsWith("data:") || 
    finalIcon.startsWith("/");

  const mappedUrl = EMOJI_TO_IMAGE_MAP[finalIcon];

  if (isImageUri || mappedUrl) {
    const sourceUri = isImageUri ? finalIcon : mappedUrl;
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        {/* Mini POS branded placeholder shown while image loads */}
        {isLoading && (
          <View style={[StyleSheet.absoluteFillObject, styles.placeholder]}>
            <Text style={styles.placeholderLogo}>Mini</Text>
            <Text style={styles.placeholderLogoAccent}>POS</Text>
          </View>
        )}
        <Image
          source={{ uri: sourceUri }}
          style={[styles.image, { width: "100%", height: "100%" }, imageStyle]}
          contentFit="cover"
          transition={300}
          onLoadEnd={() => setIsLoading(false)}
        />
      </View>
    );
  }

  // Fallback to emoji with styled container if it's not a URL or mapped emoji
  const fallbackBg = getCategoryBgColor(category);
  const calculatedIconSize = iconSize || size * 0.5;

  return (
    <View 
      style={[
        styles.container, 
        styles.fallbackContainer, 
        { width: size, height: size, backgroundColor: fallbackBg }, 
        style
      ]}
    >
      <Text style={{ fontSize: calculatedIconSize }}>
        {finalIcon || "📦"}
      </Text>
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
  fallbackContainer: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  image: {
    backgroundColor: "#F3F4F6",
  },
  placeholder: {
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 1,
  },
  placeholderLogo: {
    fontSize: 10,
    fontWeight: "800",
    color: "#93C5FD",
    letterSpacing: 0.5,
  },
  placeholderLogoAccent: {
    fontSize: 10,
    fontWeight: "900",
    color: "#3B82F6",
    letterSpacing: 0.5,
  },
});
