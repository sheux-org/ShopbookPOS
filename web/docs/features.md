# Features Guide

This guide details the core features of the **Shopbook POS Web Terminal** application, explaining the underlying code files, parameters, and hooks.

---

## 1. POS Billing Workspace

The primary workspace ([page.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/app/page.tsx)) operates via a central controller hook **`usePosBilling`** ([usePosBilling.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/hooks/usePosBilling.ts)). The terminal can toggle between two modes:

### A. Tablet (Visual Grid Mode)
- **UI Components**: Displays product grid tiles ([CatalogView.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/pos/CatalogView.tsx)) on the left pane and scrollable invoice item summaries ([TabletCartScroller.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/pos/TabletCartScroller.tsx)) on the right.
- **Workflow**: Tap items to add/increment them in the cart. Clicking "Proceed to Payment" triggers the payment modal ([SettlementModal.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/pos/SettlementModal.tsx)).

### B. Normal (Keyboard-Optimized Mode)
Designed for high-speed checkout using physical keyboards and hardware barcode scanners:
- **UI Components**: Displays a dense scanned items table ([DenseCartTable.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/pos/DenseCartTable.tsx)) and checkout card ([SettlementCard.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/pos/SettlementCard.tsx)) on the right.
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
- **Scanners**: Supports hardware scanners ([Scanner.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/Scanner.tsx)) by intercepting keyboard event inputs and matching scanned sequences against product EAN codes.

---

## 2. Active Devices & Remote Logout

Terminals log their status and configuration metadata to allow central management:
- **Hook**: [useActiveDeviceTracker.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/hooks/useActiveDeviceTracker.ts)
- **UI Dialog**: [ActiveDevicesModal.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/profile/ActiveDevicesModal.tsx)

### Pinging Mechanism
Every **30 seconds**, the tracking hook sends device telemetry back to Supabase:
- **Device ID**: Generated UUID stored in the browser's `localStorage` (`@shopbook_pos_web_device_id`).
- **Device Model**: Detects browser vendor and host operating system.
- **Battery**: Queries the Chrome Battery Status API to capture battery percentages.
- **Location**: Fetches latitude and longitude via standard HTML Geolocation queries.

### Remote Session Revocation
Administrators can view all active terminals in the devices modal. Removing a device from this modal deletes its row from the `active_devices` database table. On the revoked terminal's next ping, it detects that its session row is gone and automatically logs the cashier out locally.

---

## 3. OTP Authentication

Authentication operates via phone-based verification codes:
- **Flow Hook**: [useAuth.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/hooks/useAuth.ts)
- **Normalizer**: Cleans input numbers (removes spaces, country prefix `+94`, and leading `0`s) to ensure consistent number structures:
  ```typescript
  const normalizePhone = (phoneStr: string): string => {
    let cleaned = phoneStr.replace(/\D/g, "");
    if (cleaned.startsWith("94")) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    return cleaned;
  };
  ```
- **Sync Pull**: If a user logs in for the first time on a new terminal, the local database is empty. The login flow calls the remote Supabase RPC `check_synced_account` to verify registration. If found, a full initial sync pulls down all database tables linked to the user's `business_id` before landing on the dashboard.

---

## 4. Analytical Dashboards & Exporting

Merchant insights are displayed on the analytics page ([page.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/app/insights/page.tsx)):
- **Analytics Controller**: [useInsights.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/hooks/useInsights.ts)
- **KPI Metrics**: Displays Net Revenue, Sales Volume, Average Basket Value, Cost of Goods Sold, and Gross Profit.
- **Charts**: Interactive SVG revenue charts ([RevenueChart.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/insights/RevenueChart.tsx)).
- **Stock Alert Lists**: Displays items whose stock falls below their `low_stock_alert` threshold ([StockAlertsList.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/insights/StockAlertsList.tsx)).
- **Slow Movers / Bestsellers**: Renders tables identifying underperforming and high-performing inventory items.
- **Reports Exporter**: [ReportExporter.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/insights/ReportExporter.tsx)
  Generates reports in Excel or PDF formats from precompiled templates ([reportTemplates.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/utils/reportTemplates.ts)).

---

## 5. Inventory & Stocks Management

Allows monitoring and manual audit configuration:
- **Inventory Controller Page**: [page.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/app/stocks/page.tsx)
- **Adjust Stocks dialog**: [AdjustStockModal.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/stocks/AdjustStockModal.tsx)
- **Audit Logs**: [AuditLogScroller.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/stocks/AuditLogScroller.tsx)
  When changes are made to product quantities, the app writes an audit record to the `inventory_logs` table (detailing quantity, type `'in' | 'out'`, and modification reason). This log is saved to the local database and synced back to Supabase.
