import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PermissionProvider } from "../hooks/usePermissionHandler";
import { useEffect } from "react";
import {
  startUploadQueueMonitor,
  setQueryInvalidator,
} from "../services/uploadQueue";
import { setupNotificationListeners } from "../services/notificationService";
import { useForceUpdate } from "../hooks/useForceUpdate";
import { ForceUpdateScreen } from "../components/screens/ForceUpdateScreen";
import { FullScreenLoader } from "../components/screens/FullScreenLoader";

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

  if (isLoading) {
    return <FullScreenLoader />;
  }

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

