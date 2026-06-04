# Mini POS Pro Plan & Payment Architecture Documentation

This document describes the design, features, state management, upgrade flow, and developer instructions for the **Mini POS Pro** subscription plan in the Shopbook Mini POS application.

---

## 1. Plan Overview & Capabilities

The **Mini POS Pro** tier (branded as _Mini POS Pro_, powered by _Shopbook Pro_) unlocks high-performance enterprise features that scale the POS from a single-device offline database to a multi-branch cloud-synchronized terminal.

### Premium Features & Restriction Hooks

When `isPremium` is `false` (Free tier), the client intercepts premium features and prompts the user with the `PremiumUpgradeModal`. When `isPremium` is `true`, these features are unlocked:

1. **In-App Camera Barcode Searching & Scanning**:
   - **Where**: [SearchScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/SearchScreen.tsx#L52-L60) and [StocksScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/StocksScreen.tsx#L117-L125).
   - **Behavior**: Grants camera permissions and triggers the animated `BarcodeScannerModal` overlay.
2. **Auto Cloud Backup & Sync**:
   - **Where**: [InsightsScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/InsightsScreen.tsx#L166-L195).
   - **Behavior**: Synchronizes local WatermelonDB operations with remote PostgreSQL storage.
3. **Multi-Branch Store Swapping**:
   - **Where**: [HomeScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/HomeScreen.tsx#L479-L489).
   - **Behavior**: Allows swapping between active outlets/branches within the bottom sheet selection.
4. **Bluetooth Thermal Receipt Printing**:
   - **Where**: [PaymentTenderScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/PaymentTenderScreen.tsx#L170-L211).
   - **Behavior**: Spools formatted HTML to bluetooth or airprint printers.
5. **PDF & CSV Financial Reports Export**:
   - **Where**: [InsightsScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/InsightsScreen.tsx#L199-L211).
   - **Behavior**: Compiles store gross sales distribution and shares statement documents via native sharing sheets.
6. **Ultimate Staff Accounts & Permissions**:
   - **Where**: [ProfileScreen.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/screens/ProfileScreen.tsx#L224-L239) and the staff routing view [manage-staff.tsx](<file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/(modules)/profile/manage-staff.tsx>).
   - **Behavior**: Unlocks multi-user support, allowing owners to create and configure unlimited employee profiles (Admins, Managers, Cashiers) with strict Role-Based Access Control (RBAC). Free tier accounts are restricted to the single owner/admin session. (For comprehensive detail, refer to the [Role & Staff Management Documentation](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/doc/ROLE_MANAGEMENT.md)).
7. **Web Browser Access (Live POS from any device)**:
   - **Where**: Standard web-browser interface synchronized with Supabase data storage.
   - **Behavior**: Allows store owners and administrators to open the POS checkout terminal directly in any desktop/laptop web browser, ensuring instant data parity and real-time operations across mobile register terminals and back-office portals.

---

## 2. Upgrade & Checkout Flows

The upgrade path is designed as a secure, premium light-themed experience split across two routing views:

### Step 1: Subscription Tier Selection

- **Route**: `/profile/premium-plans` ([premium-plans.tsx](<file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/(modules)/profile/premium-plans.tsx>))
- **Flow**:
  - Displays pricing plans under three tabs: **1 Month Pro** (Rs. 3,500), **3 Months Pro** (Rs. 10,000, marked popular), and **1 Year Pro** (Rs. 36,000).
  - Tapping "Choose Plan" passes selection metadata as query parameters (`planId`, `planTitle`, `price`, `billing`) to the payment route.

### Step 2: Payment Processing

- **Route**: `/profile/payment-select` ([payment-select.tsx](<file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/(modules)/profile/payment-select.tsx>))
- **Channels**:
  1. **Credit / Debit Card (RevenueCat Mock)**:
     - Prompts a secure activation modal. Clicking "Pay & Activate" sets `isPremium = true` and updates state instantly.
  2. **Bank Transfer / Deposit**:
     - Lists **Seylan Bank** details (Account: `008013639890001`, Name: `SHOPBOOK TECHNOLOGIES (PVT) LTD`, Branch: `Kollupitiya`).
     - Includes native clipboard overlays to copy credentials.
     - The primary action button **"Share Receipt via WhatsApp"** triggers a direct WhatsApp redirect to **+94 78 247 0168** with prefilled text `"Hey Mini POS Bill"` for manual backend invoice activation.

---

## 3. Developer Guide: How to Enable / Disable Pro State

The application uses **Zustand** with persistent **AsyncStorage** middleware to track premium membership status locally on the device.

### State Store API

The active settings state is defined in [useSettingsStore.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/stores/useSettingsStore.ts):

- **State Property**: `isPremium: boolean` (defaults to `false`)
- **State Action**: `setPremium: (premium: boolean) => void`

### Reading Premium Status in Code

To check if the user is Pro in any React Native component:

```tsx
import { useSettingsStore } from '../../../stores/useSettingsStore';

export default function MyFeature() {
  const isPremium = useSettingsStore((s) => s.isPremium);

  return <Text>{isPremium ? 'Pro Activated ✨' : 'Free Plan'}</Text>;
}
```

### Mutating Pro State (Enable/Disable)

To manually enable or disable the premium flag (e.g., inside configuration settings, test hooks, or payment callbacks):

```tsx
import { useSettingsStore } from '../../../stores/useSettingsStore';

// Get setter action
const setPremium = useSettingsStore((s) => s.setPremium);

// 1. Enable Pro subscription
setPremium(true);

// 2. Disable / Revoke license
setPremium(false);
```

---

## 4. Technical File Reference

The subscription and checkout architecture spans across the following files:

1. **State Store Definition**: [useSettingsStore.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/stores/useSettingsStore.ts)
2. **Plans Listing UI**: [premium-plans.tsx](<file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/(modules)/profile/premium-plans.tsx>)
3. **Checkout Selector UI**: [payment-select.tsx](<file:///Users/shenux/Desktop/Shopbook/shopbook-pos/app/(modules)/profile/payment-select.tsx>)
4. **Common Powered By Footer**: [PoweredBy.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/common/PoweredBy.tsx)
5. **Restricted Modal Trigger**: [PremiumUpgradeModal.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/components/common/PremiumUpgradeModal.tsx)
