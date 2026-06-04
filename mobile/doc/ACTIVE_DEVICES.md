# Active Device Tracking & Session Management

This document details the architecture, data collection, and synchronization mechanics for the **Active Device Tracking & Session Management** system in Shopbook Mini POS. The feature allows store owners and administrators to monitor logged-in devices in real-time, view device diagnostics (location, online status, battery, push tokens), and remotely terminate active sessions.

---

## 1. Supabase Database Schema

All active sessions are tracked in a Supabase table named `active_devices`.

```sql
create table public.active_devices (
  id text not null primary key,           -- Format: {business_id}_{employee_id}_{device_id}
  business_id text not null,              -- Foreign key referencing the business
  employee_id text,                       -- Reference to employee, null if Owner / Admin
  employee_name text not null,            -- Display name of the active employee
  role text not null,                     -- Role string: 'admin' | 'manager' | 'cashier'
  device_id text not null,                -- Persistent client UUID generated on install
  device_model text not null,             -- Hardware model name (e.g. iPhone 13 / Pixel 6)
  battery_level integer,                  -- Device battery percentage (0 - 100)
  is_online boolean not null,             -- Current network availability state
  latitude double precision,              -- Latitude of the device
  longitude double precision,             -- Longitude of the device
  location_name text,                     -- Geocoded address or coordinate string
  push_token text,                        -- Expo push token for notifications
  last_active_at timestamp with time zone -- Last ping timestamp
);
```

---

## 2. Background Tracking Hook (`useActiveDeviceTracker`)

The custom hook [useActiveDeviceTracker.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/hooks/useActiveDeviceTracker.ts) initializes a continuous background ping cycle when a user is logged in.

### A. Initialization & Cycle Frequency

- Runs immediately upon successful login.
- Sets a background interval that repeats every **30 seconds** (`30000ms`).
- Registers event listeners to trigger an **immediate ping** on local hardware changes:
  - Battery level alterations (via `Battery.addBatteryLevelListener`).
  - Network state changes (via `NetInfo.addEventListener`).

### B. Device Identity Persistence

To ensure a device's identity remains stable across app restarts:

- Checks local `AsyncStorage` for a persistent UUID stored under key `@shopbook_pos_device_id`.
- If no UUID exists, it generates a new UUID v4 and saves it.

### C. Diagnostics Data Collection

During each ping cycle, the tracker queries native APIs to assemble the payload:

1. **Network Status**: Checks connectivity using `@react-native-community/netinfo`.
2. **Battery Level**: Fetches current capacity using `expo-battery`.
3. **Geo-Location**:
   - Requests location permissions from the OS.
   - If granted, obtains latitude and longitude.
   - Translates coordinates into a readable address (e.g. `"Colombo, Sri Lanka"`) using `expo-location`'s reverse geocoding API. If denied, sets `"Location Denied"`.
4. **Push Token**: Fetches and caches the Expo push notification token via the device registration utility.

### D. Upsert & Terminate-Check Cycle

1. **Database Upsert**: Sends the payload to Supabase using a `.upsert()` call, matching the unique composite key `id`.
2. **Remote Kill-Switch Verification**:
   - Immediately queries the `active_devices` table for its own row matching its `device_id` and `business_id`.
   - If the query returns **no record** (indicating an administrator deleted the session from another terminal), the device immediately triggers:
     ```typescript
     useAuthStore.getState().logout();
     ```
   - This logs the user out, clears local caches, and redirects them to the login screen.

---

## 3. UI & Session Termination Dashboard

The session dashboard is rendered in the [ActiveDevicesRoute](<file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/(modules)/profile/active-devices.tsx>) screen.

### A. Real-Time Data Sync

Rather than relying on manual refreshes, the screen sets up a **Supabase Realtime PostgreSQL Change Listener** filtered by the active business ID:

```typescript
supabase
  .channel(channelId)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'active_devices',
      filter: `business_id=eq.${activeBusinessId}`,
    },
    () => {
      fetchDevices(); // Re-fetch list on any database upsert/delete
    }
  )
  .subscribe();
```

### B. Session List Features

- **"This Device" Identification**: Highlights the active terminal session card using a custom styling border (`deviceCardCurrent`) by checking the current device UUID.
- **Copy Push Token**: Provides a clipboard copy button next to the Expo token for push notification debugging.
- **Diagnostics Output**: Displays an online/offline indicator, current battery level, geolocated city/country, and last-active formatted timer.

### C. Remote Logout Trigger (Kill-Switch)

1. Administrators can press the **Log Out** (Trash/Sign Out) icon next to other active sessions.
2. The action triggers a DELETE operation on Supabase:
   ```typescript
   await supabase
     .from('active_devices')
     .delete()
     .eq('device_id', targetDeviceId)
     .eq('business_id', activeBusinessId);
   ```
3. Within 30 seconds (or immediately on battery/network updates), the target device's tracker checks its session row, detects the deletion, and signs out.

---

## 4. Local Sign-Out Cleanup

To prevent stale session rows in the cloud database when users log out voluntarily:

1. When clicking **Sign Out** in [ProfileScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/ProfileScreen.tsx), the app calls `deleteCurrentDeviceSession()`.
2. This utility function queries the device ID and business ID from stores and deletes the row from Supabase:
   ```typescript
   await supabase
     .from('active_devices')
     .delete()
     .eq('device_id', deviceId)
     .eq('business_id', activeBusinessId);
   ```
3. The local Zustand stores and database caches are then cleared.
