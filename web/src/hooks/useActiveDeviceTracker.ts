import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import {
  deleteOfflineSnapshot,
  startDevicePresenceTracking,
  teardownDevicePresence,
  trackPresenceState,
  type DevicePresenceState,
} from '../services/devicePresence';

export const DEVICE_ID_KEY = '@shopbook_pos_web_device_id';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getBrowserAndOS() {
  if (typeof window === 'undefined') return 'Web POS';
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.indexOf('Win') !== -1) os = 'Windows';
  else if (ua.indexOf('Mac') !== -1) os = 'macOS';
  else if (ua.indexOf('X11') !== -1) os = 'UNIX';
  else if (ua.indexOf('Linux') !== -1) os = 'Linux';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';

  let browser = 'Unknown Browser';
  if (ua.indexOf('Chrome') !== -1) browser = 'Chrome';
  else if (ua.indexOf('Firefox') !== -1) browser = 'Firefox';
  else if (ua.indexOf('Safari') !== -1) browser = 'Safari';
  else if (ua.indexOf('Edge') !== -1) browser = 'Edge';

  return `Web: ${browser} (${os})`;
}

/**
 * Cleans up presence tracking and offline snapshot on manual logout.
 */
export async function deleteCurrentDeviceSession() {
  try {
    if (typeof window === 'undefined') return;
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    const activeBusinessId = useBusinessStore.getState().activeBusiness?.id;
    if (deviceId && activeBusinessId && activeBusinessId !== '0') {
      await teardownDevicePresence({ writeSnapshot: false });
      await deleteOfflineSnapshot(activeBusinessId, deviceId);
      console.log('Cleaned up web device presence session.');
    }
  } catch (e) {
    console.warn('Failed to delete active web session on logout:', e);
  }
}

export function useActiveDeviceTracker() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const activeBusiness = useBusinessStore((s) => s.activeBusiness);
  const activeBusinessId = activeBusiness?.id;
  const activeEmployeeId = useAuthStore((s) => s.activeEmployeeId);
  const employeeName = useAuthStore((s) => s.employeeName);
  const userRole = useAuthStore((s) => s.userRole);
  const logout = useAuthStore((s) => s.logout);

  const deviceIdRef = useRef<string | null>(null);
  const isActiveRef = useRef(false);

  useEffect(() => {
    if (!isLoggedIn || !activeBusinessId || activeBusinessId === '0') {
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
        console.log('Web terminal session terminated remotely.');
        void teardownDevicePresence({ writeSnapshot: false });
        logout();
      }
    };

    const collectPresenceState = async (): Promise<DevicePresenceState | null> => {
      if (typeof window === 'undefined') return null;
      if (!navigator.onLine) {
        console.log('Client is offline, skipping presence update.');
        return null;
      }

      let deviceId = localStorage.getItem(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = generateUUID();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
      }
      deviceIdRef.current = deviceId;

      let batteryLevel: number | null = null;
      try {
        if ('getBattery' in navigator) {
          const battery: { level: number } = await (
            navigator as Navigator & {
              getBattery: () => Promise<{ level: number }>;
            }
          ).getBattery();
          batteryLevel = Math.round(battery.level * 100);
        }
      } catch {
        // battery API not supported
      }

      let latitude: number | null = null;
      let longitude: number | null = null;
      let locationName = 'Location Unavailable';

      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 8000,
              enableHighAccuracy: false,
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
          locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        } else {
          locationName = 'Geolocation Unsupported';
        }
      } catch (e: unknown) {
        const geoError = e as { code?: number };
        if (geoError?.code === 1) {
          locationName = 'Location Denied';
        }
      }

      return {
        device_id: deviceId,
        business_id: activeBusinessId,
        employee_id: activeEmployeeId || null,
        employee_name: employeeName || 'Owner / Admin',
        role: userRole,
        device_model: getBrowserAndOS(),
        platform: 'web',
        battery_level: batteryLevel,
        location_name: locationName,
        latitude,
        longitude,
        push_token: null,
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
          console.log('Web device session was previously revoked.');
          logout();
          return;
        }
        console.warn('Web active device tracker error:', err);
      }
    };

    void syncPresence(true);

    const handleOnline = () => {
      if (!cancelled) void syncPresence(true);
    };

    const handleOffline = () => {
      if (!cancelled) void teardownDevicePresence({ writeSnapshot: true });
    };

    const handleVisibilityChange = () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') {
        void teardownDevicePresence({ writeSnapshot: true });
      } else if (document.visibilityState === 'visible') {
        void syncPresence(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      isActiveRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void teardownDevicePresence({ writeSnapshot: true });
    };
  }, [isLoggedIn, activeBusinessId, activeEmployeeId, employeeName, userRole, logout]);
}
