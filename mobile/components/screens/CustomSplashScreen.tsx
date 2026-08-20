import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

interface CustomSplashScreenProps {
  isReady: boolean;
  onAnimationComplete: () => void;
}

const MIN_DISPLAY_TIME = 2000; // Keep the splash screen visible for at least 2.0 seconds

export function CustomSplashScreen({ isReady, onAnimationComplete }: CustomSplashScreenProps) {
  const insets = useSafeAreaInsets();

  const containerOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const footerOpacity = useSharedValue(0);

  const [timerElapsed, setTimerElapsed] = useState(false);

  // 1. Trigger clean entry animations and hide native splash
  useEffect(() => {
    const hideNativeSplash = async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (err) {
        console.warn('Failed to hide native splash screen:', err);
      }
    };
    hideNativeSplash();

    // Fade-in and scale-in animations on mount
    logoScale.value = withTiming(1.0, { duration: 800 });
    logoOpacity.value = withTiming(1, { duration: 600 });
    textOpacity.value = withTiming(1, { duration: 800 });
    footerOpacity.value = withTiming(1, { duration: 1000 });

    // Minimum display timer
    const timer = setTimeout(() => {
      setTimerElapsed(true);
    }, MIN_DISPLAY_TIME);

    return () => clearTimeout(timer);
  }, []);

  // 2. Monitor loading completion to trigger exit fade-out transition
  useEffect(() => {
    if (isReady && timerElapsed) {
      containerOpacity.value = withTiming(0, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(onAnimationComplete)();
        }
      });
    }
  }, [isReady, timerElapsed]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const animatedLogoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const animatedTextStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const animatedFooterStyle = useAnimatedStyle(() => ({
    opacity: footerOpacity.value,
  }));

  return (
    <Animated.View style={[styles.outerContainer, animatedContainerStyle]}>
      <LinearGradient colors={['#2563EB', '#225AD6']} style={styles.container}>
        <View style={styles.content}>
          {/* Circular Logo Container with solid white background */}
          <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.logo}
              contentFit="contain"
            />
          </Animated.View>

          {/* Title Text */}
          <Animated.View style={[styles.textContainer, animatedTextStyle]}>
            <Text style={styles.title}>Shopbook POS</Text>
          </Animated.View>
        </View>

        {/* Powered By Footer */}
        <Animated.View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 32) },
            animatedFooterStyle,
          ]}
        >
          <Text style={styles.footerPrefix}>powered by</Text>
          <Text style={styles.footerBrand}>shopbook</Text>
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 30, // Circular shape
    backgroundColor: '#FFFFFF', // Solid white background to make the logo pop on blue
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    boxShadow: '0px 6px 12px 0px rgba(0, 0, 0, 0.12)',
  },
  logo: {
    width: '120%',
    height: '120%',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '600',
    color: '#FFFFFF', // High-contrast white
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    alignItems: 'center',
    width: '100%',
  },
  footerPrefix: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    color: 'rgba(255, 255, 255, 0.75)', // Semi-transparent white
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  footerBrand: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF', // High-contrast white
    letterSpacing: 0.5,
  },
});
