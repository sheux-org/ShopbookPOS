import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Battery from "expo-battery";
import * as Location from "expo-location";
import NetInfo from "@react-native-community/netinfo";
import Constants from "expo-constants";
import { supabase } from "../services/sync";
import { useAuthStore } from "../stores/useAuthStore";

export const DEVICE_ID_KEY = "@shopbook_pos_device_id";

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Deletes the active device session on Supabase during manual logout.
 */
export async function deleteCurrentDeviceSession() {
  try {
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    const activeBusinessId = useAuthStore.getState().activeBusinessId;
    if (deviceId && activeBusinessId) {
      await supabase
        .from("active_devices")
        .delete()
        .eq("device_id", deviceId)
        .eq("business_id", activeBusinessId);
      console.log("Deleted active device session on Supabase.");
    }
  } catch (e) {
    console.warn("Failed to delete active session on logout:", e);
  }
}

export function useActiveDeviceTracker() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const activeEmployeeId = useAuthStore((s) => s.activeEmployeeId);
  const employeeName = useAuthStore((s) => s.employeeName);
  const userRole = useAuthStore((s) => s.userRole);

  const trackerIntervalRef = useRef<any>(null);
  const deviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !activeBusinessId) {
      if (trackerIntervalRef.current) {
        clearInterval(trackerIntervalRef.current);
        trackerIntervalRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const runTracker = async () => {
      try {
        // 1. Get or create device ID
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
          deviceId = generateUUID();
          await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        deviceIdRef.current = deviceId;

        // 2. Fetch battery info
        let batteryLevel: number | null = null;
        try {
          const power = await Battery.getBatteryLevelAsync();
          batteryLevel = Math.round(power * 100);
        } catch (e) {
          console.warn("Failed to get battery level:", e);
        }

        // 3. Fetch network info
        let isOnline = true;
        try {
          const net = await NetInfo.fetch();
          isOnline = net.isConnected ?? true;
        } catch (e) {
          console.warn("Failed to get network state:", e);
        }

        // 4. Fetch location info
        let latitude: number | null = null;
        let longitude: number | null = null;
        let locationName: string | null = null;

        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            latitude = loc.coords.latitude;
            longitude = loc.coords.longitude;

            const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geo && geo.length > 0) {
              const place = geo[0];
              locationName = [
                place.city || place.subregion || place.district,
                place.country,
              ]
                .filter(Boolean)
                .join(", ");
            } else {
              locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            }
          } else {
            locationName = "Location Denied";
          }
        } catch (e) {
          console.warn("Failed to get location info:", e);
          locationName = "Location Unavailable";
        }

        // 5. Get device model / name
        const deviceModel =
          Constants.deviceName ||
          Constants.modelName ||
          (Platform.OS === "ios" ? "iOS Device" : "Android Device");

        // 6. Update database record on Supabase
        const recordId = `${activeBusinessId}_${
          activeEmployeeId || "admin"
        }_${deviceId}`;

        const payload = {
          id: recordId,
          business_id: activeBusinessId,
          employee_id: activeEmployeeId || null,
          employee_name: employeeName || "Owner / Admin",
          role: userRole,
          device_id: deviceId,
          device_model: deviceModel,
          battery_level: batteryLevel,
          is_online: isOnline,
          latitude: latitude,
          longitude: longitude,
          location_name: locationName,
          last_active_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from("active_devices")
          .upsert(payload);

        if (upsertError) {
          console.error("Failed to upsert active device status:", upsertError);
        }

        // 7. Remote session termination check
        const { data: dbSession, error: selectError } = await supabase
          .from("active_devices")
          .select("id")
          .eq("device_id", deviceId)
          .eq("business_id", activeBusinessId)
          .maybeSingle();

        if (!selectError && !dbSession) {
          // Explicitly deleted from DB by another device/admin, sign out
          console.log("Active session was terminated remotely.");
          useAuthStore.getState().logout();
        }
      } catch (err) {
        console.error("Active device tracker error:", err);
      }
    };

    // Run immediately
    runTracker();

    // Set up interval for every 30 seconds
    trackerIntervalRef.current = setInterval(() => {
      if (isSubscribed) {
        runTracker();
      }
    }, 30000);

    // Set up listeners for real-time local updates
    const batterySub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (isSubscribed) runTracker();
    });

    const netSub = NetInfo.addEventListener(() => {
      if (isSubscribed) runTracker();
    });

    return () => {
      isSubscribed = false;
      if (trackerIntervalRef.current) {
        clearInterval(trackerIntervalRef.current);
        trackerIntervalRef.current = null;
      }
      batterySub.remove();
      netSub();
    };
  }, [
    isLoggedIn,
    activeBusinessId,
    activeEmployeeId,
    employeeName,
    userRole,
  ]);
}
