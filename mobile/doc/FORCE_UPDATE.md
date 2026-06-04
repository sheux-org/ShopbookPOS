# Force Update System Documentation

This document describes the design, database schema, client integration, and operational instructions for the **Force Update** mechanism implemented in the Shopbook Mini POS application.

---

## 1. Architecture Overview

The Force Update system ensures that all active clients are running a compatible version of the app. It prevents users from bypassing version updates by intercepting the app startup flow at the root layout level (`app/_layout.tsx`).

### System Flow

1. **Startup**: The app initializes the root layout and queries the `app_config` table in Supabase.
2. **Offline Fallback**: The client loads the last fetched configuration cached in `AsyncStorage`. If the cached config indicates an update was required, it enforces it immediately (to prevent offline bypass).
3. **Evaluation**:
   - Checks if the database flag `force_update` is `true`.
   - Compares the client's current version (from `app.json` via `expo-constants`) against `min_version` from the database.
4. **Lockout**: If `force_update` is true, or if `current_version < min_version`, the app renders the **ForceUpdateScreen** as a absolute overlay, blocking all POS navigation and hardware back buttons.
5. **Redirection**: Tapping "Update Now" dynamically resolves the platform (`iOS` or `Android`) and redirects the user to the corresponding store URL.

---

## 2. Database Schema

The configuration parameters are stored in a single-row (`id = 1`) settings table in Supabase.

### Schema Details

- **Table**: `public.app_config`
- **RLS**: Enabled (with public read access)

| Column Name    | Data Type     | Default Value     | Description                                                |
| :------------- | :------------ | :---------------- | :--------------------------------------------------------- |
| `id`           | `integer`     | `1`               | Primary Key. Restricted to `1` via a singleton constraint. |
| `force_update` | `boolean`     | `false`           | If `true`, forces update screens on all active versions.   |
| `min_version`  | `text`        | `'1.0.0'`         | Minimum required semantic version (e.g. `'1.1.0'`).        |
| `android_url`  | `text`        | `Play Store Link` | Link to the app on Google Play Store.                      |
| `ios_url`      | `text`        | `App Store Link`  | Link to the app on Apple App Store.                        |
| `updated_at`   | `timestamptz` | `now()`           | The timestamp when config was last modified.               |

---

## 3. Operational Guide (How to trigger updates)

To trigger updates or control version releases, execute the following SQL commands in your Supabase SQL Editor.

### Scenario A: Enforce a new release (e.g. version `1.1.0`)

When you release a new version of the app and want to force older versions (`< 1.1.0`) to update:

```sql
UPDATE public.app_config
SET min_version = '1.1.0', force_update = false
WHERE id = 1;
```

### Scenario B: Complete lockout / emergency block

If you need to suspend access for all users immediately (regardless of their current version):

```sql
UPDATE public.app_config
SET force_update = true
WHERE id = 1;
```

### Scenario C: Unlock / Resume normal operation

To resume normal behavior without forcing updates:

```sql
UPDATE public.app_config
SET force_update = false, min_version = '1.0.0'
WHERE id = 1;
```

### Scenario D: Update Store URLs

To update Play Store or App Store links:

```sql
UPDATE public.app_config
SET android_url = 'https://play.google.com/store/apps/details?id=YOUR_PACKAGE_NAME',
    ios_url = 'https://apps.apple.com/app/idYOUR_APP_ID'
WHERE id = 1;
```

---

## 4. Technical Implementation Files

The core logic is modularized across the following workspace files:

1. **Database Migration**: [20260523000000_add_app_config.sql](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/supabase/migrations/20260523000000_add_app_config.sql)
2. **Supabase Service Client**: [appConfig.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/services/appConfig.ts)
3. **Comparison & Evaluation Hook**: [useForceUpdate.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/hooks/useForceUpdate.ts)
4. **Frosted Glassmorphic Lock UI**: [ForceUpdateScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/ForceUpdateScreen.tsx)
5. **Animated Custom Splash Screen**: [CustomSplashScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/CustomSplashScreen.tsx)
6. **Root Layout Interceptor**: [\_layout.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/_layout.tsx)
