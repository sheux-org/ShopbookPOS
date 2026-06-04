import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useBusinessStore } from '../stores/businessStore';
import { supabase } from '../services/sync';

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
 * Deletes the active device session on Supabase during manual logout.
 */
export async function deleteCurrentDeviceSession() {
  try {
    if (typeof window === 'undefined') return;
    const deviceId = localStorage.getItem(DEVICE_ID_KEY);
    const activeBusinessId = useBusinessStore.getState().activeBusiness?.id;
    if (deviceId && activeBusinessId && activeBusinessId !== '0') {
      await supabase
        .from('active_devices')
        .delete()
        .eq('device_id', deviceId)
        .eq('business_id', activeBusinessId);
      console.log('Deleted active web device session on Supabase.');
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

  const trackerIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isLoggedIn || !activeBusinessId || activeBusinessId === '0') {
      if (trackerIntervalRef.current) {
        clearInterval(trackerIntervalRef.current);
        trackerIntervalRef.current = null;
      }
      return;
    }

    let isSubscribed = true;

    const runTracker = async () => {
      try {
        if (typeof window === 'undefined') return;
        if (!navigator.onLine) {
          console.log('Client is offline, skipping active device ping.');
          return;
        }

        // 1. Get or create device ID
        let deviceId = localStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
          deviceId = generateUUID();
          localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }

        // 2. Fetch battery info (Chrome/Edge/Opera Web API)
        let batteryLevel: number | null = null;
        try {
          if ('getBattery' in navigator) {
            const battery: any = await (navigator as any).getBattery();
            batteryLevel = Math.round(battery.level * 100);
          }
        } catch (e) {
          // battery API not supported or failed
        }

        // 3. Fetch location info
        let latitude: number | null = null;
        let longitude: number | null = null;
        let locationName = 'Location Unavailable';

        try {
          if (navigator.geolocation) {
            const position: any = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 8000,
                enableHighAccuracy: false,
              });
            });
            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
            if (typeof latitude === 'number' && typeof longitude === 'number') {
              locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            }
          } else {
            locationName = 'Geolocation Unsupported';
          }
        } catch (e: any) {
          if (e && e.code === 1) {
            // PERMISSION_DENIED
            locationName = 'Location Denied';
          }
        }

        const deviceModel = getBrowserAndOS();
        const recordId = `${activeBusinessId}_${activeEmployeeId || 'admin'}_${deviceId}`;

        const payload = {
          id: recordId,
          business_id: activeBusinessId,
          employee_id: activeEmployeeId || null,
          employee_name: employeeName || 'Owner / Admin',
          role: userRole,
          device_id: deviceId,
          device_model: deviceModel,
          battery_level: batteryLevel,
          is_online: true,
          latitude: latitude,
          longitude: longitude,
          location_name: locationName,
          push_token: null, // No Expo push notification token for web POS clients
          last_active_at: new Date().toISOString(),
        };

        // 4. Upsert status to Supabase
        const { error: upsertError } = await supabase.from('active_devices').upsert(payload);

        if (upsertError) {
          console.warn('Failed to upsert active device status:', upsertError);
        }

        // 5. Remote session termination check
        const { data: dbSession, error: selectError } = await supabase
          .from('active_devices')
          .select('id')
          .eq('device_id', deviceId)
          .eq('business_id', activeBusinessId)
          .maybeSingle();

        if (!selectError && !dbSession) {
          console.log('Web terminal session terminated remotely.');
          logout();
        }
      } catch (err) {
        console.warn('Web active device tracker error:', err);
      }
    };

    // Run immediately
    runTracker();

    // Set up 30s interval
    trackerIntervalRef.current = setInterval(() => {
      if (isSubscribed) runTracker();
    }, 30000);

    return () => {
      isSubscribed = false;
      if (trackerIntervalRef.current) {
        clearInterval(trackerIntervalRef.current);
        trackerIntervalRef.current = null;
      }
    };
  }, [isLoggedIn, activeBusinessId, activeEmployeeId, employeeName, userRole, logout]);
}
