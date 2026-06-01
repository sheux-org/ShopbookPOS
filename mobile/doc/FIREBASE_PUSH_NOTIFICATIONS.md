# Firebase Push Notifications Integration Guide

This document explains the technical implementation of the Firebase Push Notification (FCM) foundation in the Shopbook POS application, the architectural rationale behind linking push tokens to active devices, and step-by-step instructions on how to test it.

---

## 1. Implementation Overview

We have integrated the official **Expo SDK 54 compatible** push notification modules to configure native push handling, register permissions, retrieve unique device tokens, and setup background and foreground event listeners.

### Key Components:
1. **Installed Libraries**:
   - `expo-notifications`: Handles register commands, permission checks, foreground display settings, and event listeners.
   - `expo-device`: Checks if the app runs on a physical device (required for native push certificates on iOS).
   - `expo-clipboard`: Used by administrators to copy registration tokens.

2. **Database Update**:
   - Modified the Supabase database table `public.active_devices` to include a new `push_token` column (type `text`).
   - Logged the schema change in `supabase_migration.sql`.

3. **Unified Notification Service** (`services/notificationService.ts`):
   - Handles OS-level permission requests.
   - Retrieves the native registration token (FCM token on Android, APNs token on iOS) and the Expo push token.
   - Configures the foreground handler to show alerts, play sounds, and increment notification badges when the app is active.
   - Sets up listener functions for catching incoming notifications and user clicks (taps).

4. **Background Device Status Tracker** (`hooks/useActiveDeviceTracker.ts`):
   - Triggers the token registration on mount.
   - Caches the push token in local memory (via `useRef`) and saves it to AsyncStorage under `@shopbook_pos_push_token`.
   - Appends the cached `push_token` to the heartbeat status payload sent to Supabase every 30 seconds.

5. **Root Mount Listeners** (`app/_layout.tsx`):
   - Sets up active notification subscription handlers when the app launches and cleans up listeners on unmount.

6. **Active Devices Management Screen** (`app/(modules)/profile/active-devices.tsx`):
   - Displays the current push token status for each active device session.
   - Added a copy-to-clipboard button (📋) using `expo-clipboard` to simplify development and testing.

---

## 2. Why Link Push Tokens to `active_devices`?

In multi-user POS environments, employees (cashiers, managers, owners) frequently switch devices or log in across multiple tablets and phones. Linking the push token to the `active_devices` table provides significant advantages:

* **Targeted Delivery**: The backend always has a real-time list mapping active employees (`employee_name`, `role`) to their active devices (`device_model`) and their respective `push_token`. The backend can target specific users (e.g., sending an inventory alert to managers only, or notifying a specific cashier about a register update).
* **Automatic Session Cleanup**: When a cashier logs out of a device, the active session is deleted from Supabase. This immediately removes their `push_token` from the active list, preventing the backend from sending notifications to offline or dead app instances.
* **No Redundant Overhead**: Instead of maintaining a separate complex notification token registry, the POS piggybacks on the existing 30-second heartbeat check-in. If a token changes or is updated by the OS, it is automatically corrected in Supabase within 30 seconds.

---

## 3. Step-by-Step Testing & Usage Guide

Follow these steps to fetch the token and trigger a test push notification:

### Step 1: Run the Application
Start the dev environment and launch the app on your physical device or simulator:
```bash
pnpm ios   # For iOS Devices/Simulators
pnpm dev   # Start Expo CLI general server
```

### Step 2: Grant Permissions
Upon launching the application, you will be prompted with the system-level request:
**"Mini POS" Would Like to Send You Notifications**.
- Select **Allow**.

### Step 3: Copy Your Push Token
1. Open the POS app and navigate to **Profile Settings** (tap the profile menu icon).
2. Tap on **Active Devices**.
3. Under the list of "Currently Logged In Sessions," find your device card (marked as **This Device**).
4. Look for the **bell icon (🔔)**. You will see a truncated token string.
5. Tap the **Copy button (📋)** next to it.
   - A toast will confirm: *"Push token copied! 📋"*

*(Note: Push notifications require a physical device. If running on a simulator, it will show "No push token registered" or display simulator-only warnings).*

### Step 4: Send a Test Notification
You can trigger a test notification using the Firebase Console or a cURL command:

#### Option A: Using Firebase Console
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project and navigate to **Cloud Messaging** (under Engage).
3. Click **Create your first campaign** or **New campaign** and select **Firebase Notification messages**.
4. Enter a Notification Title (e.g., `"Shopbook POS Test"`) and Notification Text (e.g., `"Hello from backend!"`).
5. Click **Send test message** on the right side.
6. Paste the copied token into the **Add an FCM registration token** field and click the **+** button.
7. Select the checkbox next to the token and click **Test**.

#### Option B: Using a cURL POST request
If testing from a terminal or backend utility, send an HTTP POST request to the FCM v1 endpoint:
```bash
curl -X POST https://fcm.googleapis.com/fcm/send \
  -H "Authorization: key=YOUR_FIREBASE_SERVER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "PASTE_YOUR_COPIED_TOKEN_HERE",
    "notification": {
      "title": "Shopbook POS",
      "body": "Your register cash summary is ready.",
      "sound": "default"
    },
    "data": {
      "click_action": "FLUTTER_NOTIFICATION_CLICK"
    }
  }'
```
*(Replace `YOUR_FIREBASE_SERVER_KEY` with your Firebase project's Legacy API key, or use OAuth2 credentials for the FCM v1 API).*
