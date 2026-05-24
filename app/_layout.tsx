import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PermissionProvider } from "../hooks/usePermissionHandler";
import { useEffect, useState } from "react";
import {
  startUploadQueueMonitor,
  setQueryInvalidator,
} from "../services/uploadQueue";
import { setupNotificationListeners } from "../services/notificationService";
import { useForceUpdate } from "../hooks/useForceUpdate";
import { ForceUpdateScreen } from "../components/screens/ForceUpdateScreen";
import { CustomSplashScreen } from "../components/screens/CustomSplashScreen";
import { useAuthStore } from "../stores/useAuthStore";
import * as SplashScreen from "expo-splash-screen";

// Prevent native splash screen from hiding automatically on app startup
SplashScreen.preventAutoHideAsync().catch((err) => {
  console.warn("Failed to prevent native splash auto hide:", err);
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

// Register React Query invalidator with the upload queue service
// so it can refresh all screens after a deferred upload completes
setQueryInvalidator(() => {
  queryClient.invalidateQueries({ queryKey: ["products"] });
});

function MainAppContent() {
  const { isLoading, isUpdateRequired, config, currentVersion, refetch } = useForceUpdate();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSplashActive, setIsSplashActive] = useState(true);

  // Monitor Zustand storage hydration status
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      setIsHydrated(true);
    });
    return unsubscribe;
  }, []);

  // Display custom premium splash screen during initial store loading
  if (isSplashActive) {
    return (
      <CustomSplashScreen
        isReady={!isLoading && isHydrated}
        onAnimationComplete={() => setIsSplashActive(false)}
      />
    );
  }

  // Once splash completes, show force update blocking screen if required
  if (isUpdateRequired) {
    return (
      <ForceUpdateScreen
        config={config}
        currentVersion={currentVersion}
        onRetry={refetch}
      />
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(modules)/auth/number-input" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(modules)/pos/cart" />
      <Stack.Screen name="(modules)/pos/catalog" />
      <Stack.Screen name="(modules)/pos/payment-tender" />
      <Stack.Screen name="(modules)/pos/search" />
      <Stack.Screen name="(modules)/stocks/scan" />
      <Stack.Screen name="(modules)/profile/business-details" />
      <Stack.Screen name="(modules)/profile/bluetooth-printer" />
      <Stack.Screen name="(modules)/profile/manage-businesses" />
      <Stack.Screen name="(modules)/profile/manage-staff" />
      <Stack.Screen name="(modules)/profile/active-devices" />
      <Stack.Screen name="(modules)/profile/premium-plans" />
      <Stack.Screen name="(modules)/profile/payment-select" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    // Start the NetInfo connectivity monitor for the offline upload queue
    startUploadQueueMonitor();

    // Configure push notification event handlers
    const cleanupNotifications = setupNotificationListeners(
      (notification) => {
        console.log("Foreground notification received:", notification.request.content);
      },
      (response) => {
        console.log("Notification clicked:", response.notification.request.content);
      }
    );

    return () => {
      cleanupNotifications();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <PermissionProvider>
          <MainAppContent />
        </PermissionProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

