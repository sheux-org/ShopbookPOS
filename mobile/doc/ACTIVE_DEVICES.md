# Active Device Tracking & Session Management

This document details the architecture for **Active Device Tracking & Session Management** in Shopbook Mini POS. The system uses **Supabase Realtime Presence** for instant online device visibility, with minimal database writes only on session end or admin revocation.

---

## 1. Architecture Overview

| Layer            | Mechanism                                                 | DB writes            |
| ---------------- | --------------------------------------------------------- | -------------------- |
| Online devices   | Supabase Presence channel `devices:{businessId}`          | None                 |
| Offline snapshot | `active_devices` table (`is_online: false`)               | Once per session end |
| Remote revoke    | Broadcast `session_revoke` + `device_session_revocations` | Once per revoke      |

---

## 2. Supabase Tables

### `active_devices` (offline snapshots only)

Used when a device goes offline, backgrounds, or logs out — not for periodic pings.

```sql
create table public.active_devices (
  id text not null primary key,
  business_id text not null,
  employee_id text,
  employee_name text not null,
  role text not null,
  device_id text not null,
  device_model text not null,
  battery_level integer,
  is_online boolean not null,
  latitude double precision,
  longitude double precision,
  location_name text,
  push_token text,
  last_active_at timestamp with time zone
);
```

### `device_session_revocations` (persistent revoke ledger)

```sql
create table public.device_session_revocations (
  business_id text not null,
  device_id text not null,
  revoked_at timestamptz not null default now(),
  revoked_by_device_id text,
  primary key (business_id, device_id)
);
```

---

## 3. Presence Service (`devicePresence.ts`)

The service [devicePresence.ts](../services/devicePresence.ts) manages the Realtime channel:

- **Channel**: `devices:{businessId}`
- **Presence key**: persistent `device_id` from AsyncStorage (`@shopbook_pos_device_id`)
- **Payload**: employee info, device model, battery, location, push token, platform

Key functions:

- `startDevicePresenceTracking()` — subscribe + track on login
- `trackPresenceState()` — re-track on battery/network/location change (instant)
- `teardownDevicePresence()` — untrack + optional offline snapshot write
- `revokeDeviceSession()` — broadcast instant logout + insert revocation record
- `subscribePresenceObserver()` — admin UI read-only presence listener

---

## 4. Background Tracking Hook (`useActiveDeviceTracker`)

[useActiveDeviceTracker.ts](../hooks/useActiveDeviceTracker.ts) runs when a user is logged in.

### On login

1. Check `device_session_revocations` — if revoked, logout immediately
2. Subscribe to presence channel and `track()` device state

### On change (instant, no 30s interval)

- Battery level changes (`Battery.addBatteryLevelListener`)
- Network state changes (`NetInfo.addEventListener`)
- Re-tracks presence via `trackPresenceState()`

### On background / offline / logout

- `untrack()` presence
- Write one offline snapshot to `active_devices` (`is_online: false`)

### Remote logout

- Listens for broadcast `session_revoke` event
- If `targetDeviceId` matches this device → instant `logout()`

---

## 5. Admin Dashboard (`active-devices.tsx`)

[active-devices.tsx](<../app/(modules)/profile/active-devices.tsx>) displays:

- **Online Now**: live list from `channel.presenceState()` via `subscribePresenceObserver()`
- **Recently Offline (24h)**: one-time DB query for `is_online=false` rows

### Remote logout

1. Admin taps terminate on a device
2. `revokeDeviceSession()` broadcasts `session_revoke` (instant if online)
3. Inserts row into `device_session_revocations` (blocks reconnect)
4. Deletes offline snapshot from `active_devices`

---

## 6. Local Sign-Out Cleanup

[ProfileScreen.tsx](../components/screens/ProfileScreen.tsx) calls `deleteCurrentDeviceSession()` which:

1. Untracks presence (no offline snapshot on voluntary logout)
2. Deletes any `active_devices` row for this device
