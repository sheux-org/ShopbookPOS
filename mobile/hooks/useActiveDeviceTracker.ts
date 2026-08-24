import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { useAuthStore } from '../stores/useAuthStore';
import { registerForPushNotificationsAsync } from '../services/notificationService';
import {
  deleteOfflineSnapshot,
  startDevicePresenceTracking,
  teardownDevicePresence,
  trackPresenceState,
  type DevicePresenceState,
} from '../services/devicePresence';

export const DEVICE_ID_KEY = '@shopbook_pos_device_id';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Cleans up presence tracking on manual logout.
 */
export async function deleteCurrentDeviceSession() {
  try {
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    const activeBusinessId = useAuthStore.getState().activeBusinessId;
    if (deviceId && activeBusinessId) {
      await teardownDevicePresence({ writeSnapshot: false });
      await deleteOfflineSnapshot(activeBusinessId, deviceId);
      console.log('Cleaned up active device presence session.');
    }
  } catch (e) {
    console.warn('Failed to delete active session on logout:', e);
  }
}

export function useActiveDeviceTracker() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusinessId = useAuthStore((s) => s.activeBusinessId);
  const activeEmployeeId = useAuthStore((s) => s.activeEmployeeId);
  const employeeName = useAuthStore((s) => s.employeeName);
  const userRole = useAuthStore((s) => s.userRole);

  const deviceIdRef = useRef<string | null>(null);
  const pushTokenRef = useRef<string | null>(null);
  const lastCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastLocationNameRef = useRef<string | null>(null);
  const isActiveRef = useRef(false);
  const isRequestingPermissionRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !activeBusinessId) {
      if (isActiveRef.current) {
        void teardownDevicePresence({ writeSnapshot: true });
        isActiveRef.current = false;
      }
      return;
    }

    let cancelled = false;
    isActiveRef.current = true;

    const handleSessionRevoke = (targetDeviceId: string) => {
      if (targetDeviceId === deviceIdRef.current) {
        console.log('Active session was terminated remotely.');
        void teardownDevicePresence({ writeSnapshot: false });
        useAuthStore.getState().logout();
      }
    };

    const collectPresenceState = async (): Promise<DevicePresenceState | null> => {
      let currentPushToken = pushTokenRef.current;
      if (!currentPushToken) {
        try {
          const tokens = await registerForPushNotificationsAsync();
          if (tokens.devicePushToken) {
            currentPushToken = tokens.devicePushToken;
            pushTokenRef.current = currentPushToken;
            await AsyncStorage.setItem('@shopbook_pos_push_token', currentPushToken);
          }
        } catch (e) {
          console.warn('Failed to retrieve push token in active device tracker:', e);
        }
      }

      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = generateUUID();
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      deviceIdRef.current = deviceId;

      let batteryLevel: number | null = null;
      try {
        const power = await Battery.getBatteryLevelAsync();
        batteryLevel = Math.round(power * 100);
      } catch (e) {
        console.warn('Failed to get battery level:', e);
      }

      let isOnline = true;
      try {
        const net = await NetInfo.fetch();
        isOnline = net.isConnected ?? true;
      } catch (e) {
        console.warn('Failed to get network state:', e);
      }

      if (!isOnline) {
        console.log('Device is offline, presence tracking paused.');
        return null;
      }

      let latitude: number | null = null;
      let longitude: number | null = null;
      let locationName: string | null = null;

      try {
        let { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted' && status !== 'denied') {
          if (!isRequestingPermissionRef.current) {
            isRequestingPermissionRef.current = true;
            const res = await Location.requestForegroundPermissionsAsync();
            status = res.status;
            isRequestingPermissionRef.current = false;
          }
        }

        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;

          const hasMoved =
            !lastCoordsRef.current ||
            Math.abs(lastCoordsRef.current.latitude - latitude) > 0.001 ||
            Math.abs(lastCoordsRef.current.longitude - longitude) > 0.001;

          if (!hasMoved && lastLocationNameRef.current) {
            locationName = lastLocationNameRef.current;
          } else {
            const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geo && geo.length > 0) {
              const place = geo[0];
              locationName = [place.city || place.subregion || place.district, place.country]
                .filter(Boolean)
                .join(', ');
            } else {
              locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            }
            lastCoordsRef.current = { latitude, longitude };
            lastLocationNameRef.current = locationName;
          }
        } else {
          locationName = 'Location Denied';
        }
      } catch (e) {
        console.warn('Failed to get location info:', e);
        locationName = 'Location Unavailable';
      }

      const deviceModel =
        Constants.deviceName ||
        Constants.modelName ||
        (Platform.OS === 'ios' ? 'iOS Device' : 'Android Device');

      return {
        device_id: deviceId,
        business_id: activeBusinessId,
        employee_id: activeEmployeeId || null,
        employee_name: employeeName || 'Owner / Admin',
        role: userRole,
        device_model: deviceModel,
        platform: 'mobile',
        battery_level: batteryLevel,
        location_name: locationName,
        latitude,
        longitude,
        push_token: currentPushToken || null,
        online_at: new Date().toISOString(),
      };
    };

    const syncPresence = async (isInitial = false) => {
      try {
        const state = await collectPresenceState();
        if (!state || cancelled) return;

        if (isInitial) {
          await startDevicePresenceTracking(
            activeBusinessId,
            state.device_id,
            state,
            handleSessionRevoke
          );
        } else {
          await trackPresenceState(state);
        }
      } catch (err) {
        if (err instanceof Error && err.message === 'DEVICE_REVOKED') {
          console.log('Device session was previously revoked.');
          useAuthStore.getState().logout();
          return;
        }
        // Silent catch for network/timeout errors to avoid spamming terminal
      }
    };

    void syncPresence(true);

    const batterySub = Battery.addBatteryLevelListener(() => {
      if (!cancelled) void syncPresence(false);
    });

    const netSub = NetInfo.addEventListener((state) => {
      if (cancelled) return;
      if (state.isConnected) {
        void syncPresence(true);
      } else {
        void teardownDevicePresence({ writeSnapshot: true });
      }
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (cancelled) return;
      if (nextState === 'background' || nextState === 'inactive') {
        void teardownDevicePresence({ writeSnapshot: true });
      } else if (nextState === 'active') {
        void syncPresence(true);
      }
    });

    return () => {
      cancelled = true;
      isActiveRef.current = false;
      batterySub.remove();
      netSub();
      appStateSub.remove();
      void teardownDevicePresence({ writeSnapshot: true });
    };
  }, [isLoggedIn, activeBusinessId, activeEmployeeId, employeeName, userRole]);
}
