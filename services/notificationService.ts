import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";

// Configure notification behavior for when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationTokens {
  expoPushToken?: string;
  devicePushToken?: string;
}

/**
 * Request notification permissions and fetch both the Expo push token
 * and the native Device token (FCM token on Android, APNs on iOS).
 */
export async function registerForPushNotificationsAsync(): Promise<PushNotificationTokens> {
  const tokens: PushNotificationTokens = {};

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB",
    });
  }

  // Push notifications require a physical device (APNs on iOS simulator will fail)
  if (!Device.isDevice) {
    console.log("Must use physical device for native Push Notifications");
    return tokens;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Notification permission not granted. Skipping push token retrieval.");
    return tokens;
  }

  try {
    // Retrieve project ID from Constants.expoConfig
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.warn("EAS Project ID not found. Ensure app.json is configured.");
    }

    const expoTokenObj = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    tokens.expoPushToken = expoTokenObj.data;

    // Get Native Device Token (FCM token on Android, APNs token on iOS)
    const deviceTokenObj = await Notifications.getDevicePushTokenAsync();
    tokens.devicePushToken = deviceTokenObj.data;

    console.log("FCM/Device Push Token retrieved successfully:", tokens.devicePushToken);
    console.log("Expo Push Token retrieved successfully:", tokens.expoPushToken);
  } catch (error) {
    console.error("Error fetching push notification tokens:", error);
  }

  return tokens;
}

/**
 * Registers listeners for notification events (foreground receipt and click/taps).
 * Returns a cleanup function.
 */
export function setupNotificationListeners(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationResponseReceived: (response: Notifications.NotificationResponse) => void
) {
  const notificationSubscription = Notifications.addNotificationReceivedListener(
    onNotificationReceived
  );

  const responseSubscription = Notifications.addNotificationResponseReceivedListener(
    onNotificationResponseReceived
  );

  return () => {
    notificationSubscription.remove();
    responseSubscription.remove();
  };
}
