# Features Guide

This guide details the core features of the **Shopbook POS Web Terminal** application, explaining the underlying code files, parameters, and hooks.

---

## 1. POS Billing Workspace

The primary workspace ([page.tsx](../src/app/page.tsx)) operates via a central controller hook **`usePosBilling`** ([usePosBilling.ts](../src/hooks/usePosBilling.ts)). The terminal can toggle between two modes:

### A. Tablet (Visual Grid Mode)

- **UI Components**: Displays product grid tiles ([CatalogView.tsx](../src/components/pos/CatalogView.tsx)) on the left pane and scrollable invoice item summaries ([TabletCartScroller.tsx](../src/components/pos/TabletCartScroller.tsx)) on the right.
- **Workflow**: Tap items to add/increment them in the cart. Clicking "Proceed to Payment" triggers the payment modal ([SettlementModal.tsx](../src/components/pos/SettlementModal.tsx)).

### B. Normal (Keyboard-Optimized Mode)

Designed for high-speed checkout using physical keyboards and hardware barcode scanners:

- **UI Components**: Displays a dense scanned items table ([DenseCartTable.tsx](../src/components/pos/DenseCartTable.tsx)) and checkout card ([SettlementCard.tsx](../src/components/pos/SettlementCard.tsx)) on the right.
- **Keyboard Shortcuts**: Supported by global event listeners:
  - **`F2`** or **`/`**: Focuses the barcode/manual item entry scanner input.
  - **`F3`**: Opens the customer lookup and creation popup.
  - **`F4`**: Switches between payment methods (`cash` ➔ `card` ➔ `bank`).
  - **`F6`**: Opens the transaction discount modifier input.
  - **`F7`**: Opens the VAT/Tax rate modifier input.
  - **`F8`**: Focuses the payment inputs (Cash Received / Card Select / Bank Select).
  - **`F9`**: Focuses sub-inputs (Custom Bank names / Card last-4-digits).
  - **`F10`** or **`Enter`**: Completes checkout, saves invoice, and prints the bill.
  - **`F12`**: Clears the active cart.
  - **`Arrow Up / Down`**: Selects items inside the dense items grid.
  - **`+ / =`**: Increments selected item quantity.
  - **`-`**: Decrements selected item quantity.
  - **`Delete / Backspace`**: Removes the selected item from the cart.
- **Scanners**: Supports hardware scanners ([Scanner.tsx](../src/components/Scanner.tsx)) by intercepting keyboard event inputs and matching scanned sequences against product EAN codes.

---

## 2. Active Devices & Remote Logout

Terminals publish live status via **Supabase Realtime Presence** — no periodic database pings.

- **Presence Service**: [devicePresence.ts](../src/services/devicePresence.ts)
- **Hook**: [useActiveDeviceTracker.ts](../src/hooks/useActiveDeviceTracker.ts)
- **UI Dialog**: [ActiveDevicesModal.tsx](../src/components/profile/ActiveDevicesModal.tsx)

### Presence Tracking

When logged in, the hook subscribes to channel `devices:{businessId}` and calls `channel.track()` with:

- **Device ID**: UUID in `localStorage` (`@shopbook_pos_web_device_id`)
- **Device Model**: Browser and OS detection from user agent
- **Battery**: Chrome Battery Status API (when available)
- **Location**: HTML Geolocation API

Updates are pushed instantly on visibility/network changes — not on a 30-second interval.

### Offline & Revocation (minimal DB)

- **Session end**: one `active_devices` write with `is_online: false`
- **Admin revoke**: broadcast `session_revoke` for instant logout + `device_session_revocations` insert to block reconnect

The admin modal shows **Online Now** from presence state and **Recently Offline (24h)** from the snapshot table.

---

## 3. OTP Authentication

Authentication operates via phone-based verification codes:

- **Flow Hook**: [useAuth.ts](../src/hooks/useAuth.ts)
- **Normalizer**: Cleans input numbers (removes spaces, country prefix `+94`, and leading `0`s) to ensure consistent number structures:
  ```typescript
  const normalizePhone = (phoneStr: string): string => {
    let cleaned = phoneStr.replace(/\D/g, '');
    if (cleaned.startsWith('94')) cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
    return cleaned;
  };
  ```
- **Sync Pull**: If a user logs in for the first time on a new terminal, the local database is empty. The login flow calls the remote Supabase RPC `check_synced_account` to verify registration. If found, a full initial sync pulls down all database tables linked to the user's `business_id` before landing on the dashboard.

---

## 4. Analytical Dashboards & Exporting

Merchant insights are displayed on the analytics page ([page.tsx](../src/app/insights/page.tsx)):

- **Analytics Controller**: [useInsights.ts](../src/hooks/useInsights.ts)
- **KPI Metrics**: Displays Net Revenue, Sales Volume, Average Basket Value, Cost of Goods Sold, and Gross Profit.
- **Charts**: Interactive SVG revenue charts ([RevenueChart.tsx](../src/components/insights/RevenueChart.tsx)).
- **Stock Alert Lists**: Displays items whose stock falls below their `low_stock_alert` threshold ([StockAlertsList.tsx](../src/components/insights/StockAlertsList.tsx)).
- **Slow Movers / Bestsellers**: Renders tables identifying underperforming and high-performing inventory items.
- **Reports Exporter**: [ReportExporter.tsx](../src/components/insights/ReportExporter.tsx)
  Generates reports in Excel or PDF formats from precompiled templates ([reportTemplates.ts](../src/utils/reportTemplates.ts)).

---

## 5. Inventory & Stocks Management

Allows monitoring and manual audit configuration:

- **Inventory Controller Page**: [page.tsx](../src/app/stocks/page.tsx)
- **Adjust Stocks dialog**: [AdjustStockModal.tsx](../src/components/stocks/AdjustStockModal.tsx)
- **Audit Logs**: [AuditLogScroller.tsx](../src/components/stocks/AuditLogScroller.tsx)
  When changes are made to product quantities, the app writes an audit record to the `inventory_logs` table (detailing quantity, type `'in' | 'out'`, and modification reason). This log is saved to the local database and synced back to Supabase.
