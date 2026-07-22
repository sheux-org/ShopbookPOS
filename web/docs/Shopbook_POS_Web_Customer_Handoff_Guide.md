# 🛒 Shopbook POS Web Terminal — Customer Onboarding & Handoff Guide

> **Welcome to Shopbook POS!**  
> This comprehensive manual is designed for store owners, managers, and cashiers. It serves as your official onboarding guide and daily operational reference for setting up, configuring, and running your retail or service business using the **Shopbook POS Web Terminal**.

---

## 📋 Table of Contents

1. [🌟 1. System Overview & Key Highlights](#-1-system-overview--key-highlights)
2. [💻 2. System Requirements & Hardware Setup](#-2-system-requirements--hardware-setup)
3. [🔑 3. Getting Started & Account Login](#-3-getting-started--account-login)
4. [🛒 4. POS Billing Workspace & Checkout Modes](#-4-pos-billing-workspace--checkout-modes)
   - [A. Tablet Mode (Visual Touch Grid)](#a-tablet-mode-visual-touch-grid)
   - [B. Normal Mode (Keyboard & Barcode Optimized)](#b-normal-mode-keyboard--barcode-optimized)
   - [C. Cashier Hotkey Cheat Sheet](#c-cashier-hotkey-cheat-sheet)
5. [💳 5. Payment Settlement & Customer Loyalty](#-5-payment-settlement--customer-loyalty)
6. [🖨️ 6. Thermal Receipt Printer & Cash Drawer Setup](#-6-thermal-receipt-printer--cash-drawer-setup)
7. [📜 7. Order History & Invoice Management](#-7-order-history--invoice-management)
8. [📦 8. Inventory & Stock Management](#-8-inventory--stock-management)
9. [📊 9. Business Analytics & Financial Reports](#-9-business-analytics--financial-reports)
10. [👥 10. Staff Roles & Terminal Security](#-10-staff-roles--terminal-security)
11. [🔄 11. Offline Operation & Cloud Synchronization](#-11-offline-operation--cloud-synchronization)
12. [❓ 12. Troubleshooting & Frequently Asked Questions](#-12-troubleshooting--frequently-asked-questions)

---

## 🌟 1. System Overview & Key Highlights

**Shopbook POS Web Terminal** is a high-speed, modern, offline-first Point of Sale system tailored for supermarkets, retail outlets, boutiques, cafes, and service stores.

### Key Capabilities:

- **Dual POS Layouts**: Switch seamlessly between touch-friendly **Tablet Mode** and high-speed, keyboard-driven **Normal Mode**.
- **Lightning-Fast Keyboard Checkout**: Complete transactions in seconds using barcodes, 4-digit quick codes, multi-quantity add shortcuts (`5*1001`), and hotkeys (`F2` through `F12`).
- **Direct Thermal Printing & Cash Drawer Control**: Web Serial direct ESC/POS printing (58mm/80mm) with automatic cash drawer pulse triggers.
- **Offline-First Architecture**: Continue billing even when internet connection drops; all transactions sync automatically once reconnected.
- **Customer Loyalty**: Search and register customer profiles to attach to orders.
- **Stock Audit Trails**: Track inventory counts, low-stock threshold alerts, and reason-coded stock adjustments.
- **Role-Based Access Control (RBAC)**: Distinct permissions for **Admin**, **Manager**, and **Cashier** roles.
- **Live Terminal Security**: Track connected devices, battery levels, geographic locations, and remotely revoke unauthorized sessions.

---

## 💻 2. System Requirements & Hardware Setup

> 📸 **[Screenshot Placeholder: Recommended POS Hardware Setup (Terminal, Printer, Scanner, Cash Drawer)]**

### A. Recommended Web Browsers

- **Google Chrome** (v89+) or **Microsoft Edge** (v89+) — _Required for Web Serial hardware printing and webcam barcode scanning_.
- **Brave Browser** (Chromium engine).

### B. Supported Hardware Peripherals

1. **Barcode Scanners**: Any standard USB or Bluetooth handheld/desktop barcode scanner (operates in HID Keyboard Emulation mode).
2. **Thermal Receipt Printers**: 58mm or 80mm thermal printers supporting standard ESC/POS command sets (e.g., Xprinter XP-365B, Epson, POSMAX, Zjiang).
   - **Connection Types**: Direct USB (via Web Serial / COM Port) or System Print driver fallback / Chittie Companion.
3. **Cash Drawers**: Standard RJ11 / RJ12 cash drawers connected directly to the thermal printer's kick-out port.

---

## 🔑 3. Getting Started & Account Login

> 📸 **[Screenshot Placeholder: OTP Login Screen & Store/Branch Selection]**

1. Launch your browser and navigate to your store's POS URL.
2. **Phone OTP Login**: Enter your registered mobile phone number.
   - _Note_: Phone numbers are automatically formatted (e.g., removing spaces and `+94` prefixes).
3. Enter the 6-digit verification code sent via SMS.
4. **Select Store / Business Branch**: If your account manages multiple branches, select the active branch for this terminal.
5. **Initial Data Sync**: On your first login on a new device, Shopbook POS automatically downloads your product catalog, categories, and customer lists to the local terminal.

---

## 🛒 4. POS Billing Workspace & Checkout Modes

Shopbook POS offers two distinct operational modes designed for different cashier environments. You can toggle your preferred mode anytime from the **Top Navigation Settings Bar**.

---

### A. Tablet Mode (Visual Touch Grid)

Best suited for **Cafes, Restaurants, Boutiques, and Salons** using touchscreen devices or tablets.

> 📸 **[Screenshot Placeholder: Tablet Mode POS Workspace - Product Grid & Touch Drawer]**

#### Workflow in Tablet Mode:

1. **Category Navigation**: Tap any category tab at the top (e.g. _Beverages, Bakery, Snacks_) to filter products.
2. **Adding Products**: Tap a product tile to add 1 unit to the cart drawer on the right.
3. **Modifying Quantities**: Use the **`+`** and **`-`** buttons inside the cart drawer to adjust item quantities, or tap the trash icon to remove an item.
4. **Attaching a Customer**: Tap **`Attach Customer`** to search or add a customer for loyalty tracking.
5. **Settlement**: Tap **`Proceed to Payment`** to open the payment settlement modal.

---

### B. Normal Mode (Keyboard & Barcode Optimized)

Best suited for **Supermarkets, Grocery Stores, and Busy Retail Outlets**. Cashiers can process entire transactions **without touching the mouse**.

> 📸 **[Screenshot Placeholder: Normal Mode POS Workspace - Scanned Table & Tender Card]**

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Shopbook POS - Normal Mode                          │
├──────────────────────────────────────────┬─────────────────────────────────┤
│                                          │                                 │
│        DENSE CART GRID                   │      CHECKOUT SUMMARY CARD      │
│        (Scanned Products List)           │                                 │
│                                          │      • Subtotal:  Rs. 2,500.00   │
│        1. Keells Milk 1L x 2  Rs. 960    │      • Discount:  Rs.  100.00   │
│        2. Anchor Butter 200g  Rs. 850    │      • Tax (VAT):  Rs.    0.00   │
│        3. Munchee Biscuits    Rs. 590    │      • Net Total: Rs. 2,950.00   │
│                                          ├─────────────────────────────────┤
│                                          │      TENDER DETAILS             │
│                                          │      • Method: CASH [F4]        │
│                                          │      • Received:  Rs. 3,000.00  │
│                                          │      • Change:    Rs.    50.00  │
│                                          │      • Complete:  [F10 / Enter] │
└──────────────────────────────────────────┴─────────────────────────────────┘
```

#### Step-by-Step Keyboard Workflow:

1. **Focus Input**: Press **`F2`** or **`/`** to focus the scanner input box.
2. **Scan / Enter Item**:
   - **Barcode Scan**: Point the barcode scanner at the product EAN label.
   - **Quick Code Entry**: Type the item's 4-digit quick code (e.g., `1004`) and press **`Enter`**.
   - **Multi-Quantity Shortcut**: To add multiple units at once, type `<Quantity>*<QuickCode>` (e.g., `5*1004`) and press **`Enter`**.
3. **Cart Item Selection**: Use the **`Up Arrow`** and **`Down Arrow`** keys to highlight items in the scanned table.
4. **Adjust Quantity & Remove**:
   - Press **`+`** (or **`=`**) to increase quantity by 1.
   - Press **`-`** to decrease quantity by 1.
   - Press **`Delete`** or **`Backspace`** to remove the selected item.
5. **Apply Discount**: Press **`F6`** to open the discount modifier. Type the amount and press **`F6`** again to toggle between Flat Rupee (`Rs.`) and Percentage (`%`). Press **`Enter`** to apply.
6. **Apply Tax / VAT**: Press **`F7`** to enter a tax rate percentage and press **`Enter`**.
7. **Customer Loyalty**: Press **`F3`** to open customer search modal.
8. **Tender Payment**:
   - Press **`F4`** to switch payment mode: `Cash` ➔ `Card` ➔ `Bank`.
   - **For Cash**: Press **`F8`** to jump into Cash Received. Type customer cash handed over (e.g., `5000`). Change calculation displays instantly.
   - **For Card / Bank**: Press **`F9`** to type bank name or card last 4 digits.
9. **Finalize & Print**: Press **`F10`** (or press **`Enter`** while inside tender input). This completes checkout, kicks open cash drawer, prints thermal receipt, and resets cart for next customer.
10. **Cancel / Reset**: Press **`F12`** to clear the cart.

---

### C. Cashier Hotkey Cheat Sheet

> 💡 **Tip for Store Owners**: Print this table and place it right next to your POS terminal screen!

| Hotkey / Shortcut              | Action                                                     | Scope / Context      |
| :----------------------------- | :--------------------------------------------------------- | :------------------- |
| **`F2`** or **`/`**            | Focus Barcode / Quick-Code Input                           | Main POS Screen      |
| **`F3`**                       | Open Customer Attach / Search Modal                        | Main POS Screen      |
| **`F4`**                       | Cycle Payment Method (`Cash` ➔ `Card` ➔ `Bank`)            | Main POS Screen      |
| **`F6`**                       | Edit Discount Amount / Toggle Discount Type (`Rs.` vs `%`) | Main POS Screen      |
| **`F7`**                       | Edit Tax / VAT Percentage                                  | Main POS Screen      |
| **`F8`**                       | Focus Payment Received Input (Cash / Card / Bank)          | Main POS Screen      |
| **`F9`**                       | Focus Sub-Input (Card Last 4 Digits / Bank Name)           | Main POS Screen      |
| **`F10`** or **`Enter`**       | Finalize Checkout & Print Thermal Receipt                  | Tender Input Focused |
| **`F12`**                      | Clear Active Cart & Reset Workspace                        | Main POS Screen      |
| **`Up / Down Arrow`**          | Navigate Scanned Cart Items                                | Cart Grid            |
| **`+`** or **`=`**             | Increase Selected Item Quantity                            | Cart Grid            |
| **`-`**                        | Decrease Selected Item Quantity                            | Cart Grid            |
| **`Delete`** / **`Backspace`** | Remove Selected Item from Cart                             | Cart Grid            |
| **`Escape`**                   | Close Open Modal / Exit Input Focus                        | Anywhere             |

---

## 💳 5. Payment Settlement & Customer Loyalty

> 📸 **[Screenshot Placeholder: Settlement Payment Modal & Customer Lookup Window]**

### Payment Settlement Options:

- **Cash**: Enter exact amount or tender handed over. The terminal computes `Change Due` automatically. Kicks the cash drawer upon confirmation.
- **Credit / Debit Card**: Record card brand (Visa, Mastercard, AMEX) and card last 4 digits for audit reconciliation.
- **Bank Transfer**: Enter bank reference or custom bank name (e.g. _Commercial Bank, Sampath Pay_).

### Customer Loyalty Attachment:

1. Press **`F3`** or click **`Attach Customer`**.
2. **Search Existing Customer**: Enter customer mobile number or name to search. Click **`Attach Profile`**.
3. **Register New Customer**: Switch to **`Create Customer`** tab, enter Full Name, Phone Number, and optional Email. Click **`Register & Attach`**.
4. The customer's details and loyalty points will be attached to the invoice.

---

## 🖨️ 6. Thermal Receipt Printer & Cash Drawer Setup

> 📸 **[Screenshot Placeholder: Thermal Printer Configuration Modal in Settings/Profile]**

Shopbook POS features high-performance direct hardware printing via **Web Serial** (Chrome/Edge) with system fallback.

### Configuring Your Printer:

1. Navigate to **Profile & Settings** (`/profile`) in the top navigation bar.
2. Scroll to **Thermal Printer Setup** and click **`Configure Printer`**.
3. **Select Paper Width**: Choose **`80mm`** (Standard POS) or **`58mm`** (Compact POS).
4. **Set Baud Rate**: Standard setting is **`9600`** or **`115200`**.
5. **Cash Drawer Pin**: Select **`Pin 2 (Standard)`** or **`Pin 5`**.
6. **Auto Open Cash Drawer**: Enable toggle to automatically fire drawer pulse on cash sales.
7. **Connect Hardware**:
   - Click **`Connect Direct Printer`**.
   - A Chrome browser prompt will appear listing connected USB/Serial ports. Select your printer (e.g., _Xprinter / POSMAX_) and click **`Connect`**.
8. **Test Connection**: Click **`Print Test Receipt`** and **`Test Open Cash Drawer`** to verify hardware operation.

---

## 📜 7. Order History & Invoice Management

> 📸 **[Screenshot Placeholder: Order History Page - Search Filters & Receipt Detail View]**

Navigate to **History** (`/history`) to review past transactions:

- **Search & Filter**: Find invoices by Invoice Number (e.g., `INV-10024`), Cashier Name, or Customer.
- **Reprint Receipt**: Open any order detail to view the digital receipt and click **`Reprint Receipt`**.
- **Void Order**: Admins and Managers can click **`Void Invoice`** to reverse a transaction, which automatically restores inventory stock counts.
- **Export History**: Export transaction logs to **Excel (`.xlsx`)** or **PDF** format.

---

## 📦 8. Inventory & Stock Management

> 📸 **[Screenshot Placeholder: Stocks Management Page & Adjust Stock Modal]**

Navigate to **Stocks** (`/stocks`) to manage product catalogs and inventory levels.

### A. Registering / Editing Products

1. Click **`Register Product`**.
2. Complete product metadata:
   - **Product Name**: e.g., _Keells Tomato Sauce 300g_.
   - **Category**: Select or create a product category.
   - **Barcode**: Scan with barcode scanner or tap webcam icon to scan with camera.
   - **Quick Code**: Assign a unique 4-digit code (e.g., `2015`) for fast cashier billing.
   - **Selling Price & Unit Cost**: Define retail price and wholesale purchase cost.
   - **Stock Count & Alert Level**: Input current stock quantity and low-stock warning threshold (e.g., alert when stock < 5).
3. Click **`Save Product`**.

### B. Adjusting Inventory Stock & Audit Logs

When inventory is restocked, damaged, or audited:

1. Locate item on **Stocks Page** and click **`Adjust Stock`** (slider icon).
2. Select type:
   - **`Restock (+)`**: Adds quantity to inventory.
   - **`Damage / Audit (-)`**: Reduces inventory count.
3. Select or enter reason (e.g., _Supplier Delivery, Damaged Goods, Expired Stock, Stock Take_).
4. Click **`Confirm Adjustment`**. An unalterable record is saved to **Audit Logs**.

---

## 📊 9. Business Analytics & Financial Reports

> 📸 **[Screenshot Placeholder: Business Insights Page - Revenue Chart & KPI Metrics]**

Owners and Managers can access real-time business insights on the **Insights Page** (`/insights`):

- **Executive KPIs**: Net Revenue, Gross Sales Volume, Average Basket Value, Total Cost of Goods Sold (COGS), and Gross Margin %.
- **Revenue Spikes Line Graph**: Interactive trend charts over daily, weekly, or monthly timelines.
- **Inventory Performance**:
  - **Bestsellers**: Highest selling products by volume and revenue.
  - **Slow Movers**: Underperforming items for sales promotions.
  - **Low Stock Alerts**: Real-time warning list of items needing reorder.
- **Report Exporters**: Click **`Export Financial Report`** to generate downloadable Excel or PDF summary sheets for accounting.

---

## 👥 10. Staff Roles & Terminal Security

> 📸 **[Screenshot Placeholder: Profile Page - Staff Management & Active Devices Dashboard]**

### Role Permissions Matrix:

| Feature / Action                          | Admin | Manager | Cashier |
| :---------------------------------------- | :---: | :-----: | :-----: |
| Process POS Checkouts & Print Receipts    |  ✅   |   ✅    |   ✅    |
| Customer Loyalty Lookup & Registration    |  ✅   |   ✅    |   ✅    |
| View Order History & Reprint Receipts     |  ✅   |   ✅    |   ✅    |
| Register & Edit Product Catalog           |  ✅   |   ✅    |   ❌    |
| Adjust Stock Quantities & Audit Logs      |  ✅   |   ✅    |   ❌    |
| Void Orders & Revert Transactions         |  ✅   |   ✅    |   ❌    |
| Export Sales & Inventory Reports          |  ✅   |   ✅    |   ❌    |
| Access Financial Charts & Analytics       |  ✅   |   ❌    |   ❌    |
| Manage Staff Accounts & Terminal Security |  ✅   |   ❌    |   ❌    |

### Active Terminal Tracking & Remote Logout:

Under **Profile (`/profile`)**, Admins can monitor all active logged-in terminals:

- **Live Device Details**: Browser/OS type, battery level, geolocation, and IP.
- **Presence Status**: Shows **Online Now** (real-time active session) or **Offline (Last 24h)**.
- **Remote Revoke**: Click the **Trash / Revoke** icon next to any device to instantly terminate its session and block unauthorized access.

---

## 🔄 11. Offline Operation & Cloud Synchronization

Shopbook POS is built with an **Offline-First Engine**:

- **Uninterrupted Billing**: If internet connectivity drops, a yellow **Offline Mode** indicator appears in the top navigation bar. Cashiers can continue scanning, billing, and printing receipts without interruption.
- **Local Transaction Store**: All offline sales and inventory adjustments are stored securely in the terminal's encrypted local database.
- **Auto Background Sync**: As soon as internet connectivity is restored, the terminal automatically syncs all offline sales, updated inventory levels, and audit logs with the cloud database.

---

## ❓ 12. Troubleshooting & Frequently Asked Questions

### Q1: The barcode scanner is not inputting text into the POS.

- **Solution**: Click on the scanner input box or press **`F2`** to ensure cursor focus is inside the barcode input field. Ensure your scanner is set to HID keyboard mode.

### Q2: Thermal printer does not open Chrome Web Serial popup.

- **Solution**: Ensure you are using **Google Chrome** or **Microsoft Edge**. Web Serial is not supported on Firefox or Safari. Ensure no other application (like vendor utility software) is locking the printer COM port.

### Q3: Cash drawer does not kick open after cash payment.

- **Solution**: Verify that the RJ11 cable connects firmly from the cash drawer to the thermal printer's kick port. Open **Profile ➔ Thermal Printer Setup** and test **`Test Open Cash Drawer`** with Pin 2 or Pin 5 settings.

### Q4: Product catalog changes made on another terminal are not showing up.

- **Solution**: The web terminal automatically syncs changes. You can also click **`Force Refresh Sync`** in the top navigation bar to manually trigger a sync pull.

---

> **Shopbook POS Support**  
> For technical assistance, hardware inquiries, or system setup help, contact your Shopbook POS account manager or visit our support center.
