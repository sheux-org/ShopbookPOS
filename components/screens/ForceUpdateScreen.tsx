import React, { useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  BackHandler,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { type AppConfig } from "../../services/appConfig";

interface ForceUpdateScreenProps {
  onRetry: () => void;
  config: AppConfig | null;
  currentVersion: string;
}

export function ForceUpdateScreen({
  onRetry,
  config,
  currentVersion,
}: ForceUpdateScreenProps) {
  // Shared values for entry animation
  const containerOpacity = useSharedValue(0);
  const containerScale = useSharedValue(0.9);
  const iconBounce = useSharedValue(0);

  useEffect(() => {
    // 1. Block Android back button so the user cannot close the update screen
    const backAction = () => {
      // Return true to prevent default back action
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction
    );

    // 2. Trigger entry animations
    containerOpacity.value = withTiming(1, { duration: 800 });
    containerScale.value = withSpring(1, { damping: 15 });

    // 3. Infinite micro-animation for the download icon (subtle floating bounce)
    iconBounce.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    return () => backHandler.remove();
  }, [containerOpacity, containerScale, iconBounce]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: containerOpacity.value,
      transform: [{ scale: containerScale.value }],
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: iconBounce.value }],
    };
  });

  const handleUpdatePress = async () => {
    // Trigger tactile haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!config) {
      Linking.openURL(
        Platform.OS === "ios"
          ? "https://apps.apple.com"
          : "https://play.google.com/store"
      );
      return;
    }

    const storeUrl = Platform.OS === "ios" ? config.ios_url : config.android_url;
    try {
      const supported = await Linking.canOpenURL(storeUrl);
      if (supported) {
        await Linking.openURL(storeUrl);
      } else {
        // Fallback to standard URL if protocol fails
        const fallbackUrl =
          Platform.OS === "ios"
            ? "https://apps.apple.com"
            : "https://play.google.com/store";
        await Linking.openURL(fallbackUrl);
      }
    } catch (err) {
      console.error("Failed to redirect to store:", err);
    }
  };

  const handleRetryPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRetry();
  };

  return (
    <LinearGradient
      colors={["#0A0F24", "#121E42", "#1D1135"]}
      style={styles.container}
    >
      {/* Background glow graphics */}
      <View style={styles.topGlow} />
      <View style={styles.bottomGlow} />

      <Animated.View style={[styles.cardContainer, animatedContainerStyle]}>
        <Animated.View style={[styles.iconContainer, animatedIconStyle]}>
          <LinearGradient
            colors={["#3B82F6", "#2563EB"]}
            style={styles.iconGradient}
          >
            <Ionicons name="cloud-download-outline" size={40} color="#FFFFFF" />
          </LinearGradient>
        </Animated.View>

        <Text style={styles.titleText}>Update Required</Text>
        
        <Text style={styles.messageText}>
          A newer, more secure version of Shopbook Mini POS is available. Please update to continue using the app.
        </Text>

        {/* Version specifications */}
        <View style={styles.versionDetailsContainer}>
          <View style={styles.versionBadge}>
            <Text style={styles.versionBadgeTitle}>Current</Text>
            <Text style={styles.versionBadgeText}>{currentVersion}</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.3)" />
          <View style={[styles.versionBadge, styles.versionBadgeRequired]}>
            <Text style={[styles.versionBadgeTitle, styles.versionBadgeRequiredTitle]}>Required</Text>
            <Text style={styles.versionBadgeText}>
              {config ? config.min_version : "Latest"}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdatePress}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#3B82F6", "#1D4ED8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.updateButtonGradient}
          >
            <Text style={styles.updateButtonText}>Update Now</Text>
            <Ionicons name="open-outline" size={18} color="#FFFFFF" style={styles.buttonIcon} />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetryPress}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={16} color="rgba(255, 255, 255, 0.6)" />
          <Text style={styles.retryButtonText}>Check Again</Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  topGlow: {
    position: "absolute",
    top: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(59, 130, 246, 0.15)",
    filter: "blur(80px)",
  },
  bottomGlow: {
    position: "absolute",
    bottom: -150,
    left: -150,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(147, 51, 234, 0.12)",
    filter: "blur(100px)",
  },
  cardContainer: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 24,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  iconGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  titleText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 0.3,
  },
  messageText: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  versionDetailsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  versionBadge: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  versionBadgeTitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.35)",
    textTransform: "uppercase",
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  versionBadgeText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E2E8F0",
  },
  versionBadgeRequired: {
    paddingHorizontal: 12,
  },
  versionBadgeRequiredTitle: {
    color: "#3B82F6",
  },
  updateButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  updateButtonGradient: {
    width: "100%",
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  updateButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.6)",
    marginLeft: 6,
  },
});
