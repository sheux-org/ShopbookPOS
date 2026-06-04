# Shopbook POS Web Terminal — User & Cashier Guide

Welcome to the **Shopbook POS Web Terminal User Guide**! This document serves as a complete instruction manual for shop owners, store managers, and cashiers. It is designed to be easily read on screen or printed directly as a physical reference manual.

---

## 🚀 1. Choosing Your POS Mode

Shopbook POS is highly customizable and supports two distinct workspace layouts to match your retail environment. You can switch modes from the **Settings Panel** in the top navigation bar.

| POS Mode           | Description                                                                                    | Best Suited For                           | Key Input Methods                   |
| :----------------- | :--------------------------------------------------------------------------------------------- | :---------------------------------------- | :---------------------------------- |
| **📱 Tablet Mode** | A visual, touch-optimized grid displaying product cards, categories, and tap-based billing.    | Cafes, Restaurants, Boutiques, Salons.    | Touchscreen taps, cursor clicks.    |
| **⌨️ Normal Mode** | A high-speed, dense checkout grid optimized for fast keyboard navigation and barcode scanners. | Supermarkets, Grocery Stores, pharmacies. | Barcode scanners, keyboard hotkeys. |

---

## 🛒 2. Daily Checkout Workflows

### A. Operating in Tablet Mode (Visual Grid)

1. **Selecting Items**: Tap on any category tab at the top (e.g. _Drinks, Snacks_) to filter products. Tap the product card to add it to the cart.
2. **Adjusting Quantities**: In the checkout drawer on the right, click the **`+`** or **`-`** buttons next to an item name to adjust quantities.
3. **Attaching a Customer**: Tap the **`Attach Customer`** button to link a phone profile for loyalty tracking.
4. **Finalizing Checkout**: Tap **`Proceed to Payment`**. Select Cash, Card, or Bank Transfer, enter details, and tap **`Confirm checkout`** to save the invoice and view the receipt.

---

### B. Operating in Normal Mode (Keyboard-Optimized)

In Normal Mode, you can run the entire register **without touching the mouse**.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                             Shopbook POS Layout                            │
├──────────────────────────────────────────┬─────────────────────────────────┤
│                                          │                                 │
│          DENSE CART GRID                 │       CHECKOUT SUMMARY          │
│          (Products List & Scans)         │                                 │
│                                          │       • Subtotal: Rs. 1,500     │
│                                          │       • Discount: Rs. 150       │
│                                          │       • Net Due:  Rs. 1,350     │
│                                          ├─────────────────────────────────┤
│                                          │       TENDER CARD               │
│                                          │       • Cash Received [F8]      │
│                                          │       • Confirm Pay   [F10]     │
│                                          │                                 │
└──────────────────────────────────────────┴─────────────────────────────────┘
```

#### Step-by-Step Keyboard Workflow:

1. **Add Items**: Scan a product barcode or press **`F2`** to focus the scanner input. Type the product's EAN **Barcode** or **4-digit Quick Code** and press **`Enter`**.
   - _Pro-Tip (Multi-Quantity Add)_: To add 5 units of an item, type `5*<QuickCode>` (e.g. `5*2001`) and press **`Enter`**.
2. **Navigate the Cart List**: Use the **`Up Arrow`** and **`Down Arrow`** keys to highlight items in the grid.
3. **Change Quantities**: Press **`+`** (or **`=`**) to increase the selected item's quantity. Press **`-`** to decrease the quantity. Press **`Delete`** or **`Backspace`** to remove the item.
4. **Attach a Customer**: Press **`F3`** to open the customer modal. Use the search input or tab into the registration form.
5. **Apply Discounts**: Press **`F6`** to open the discount editor. Type the value and press **`F6`** again to toggle between a flat Rupee discount and a percentage discount. Press **`Enter`** to save.
6. **Apply Tax/VAT**: Press **`F7`** to enter a tax rate (%), and press **`Enter`** to save.
7. **Tender Payment**: Press **`F4`** to toggle payment methods (`cash` ➔ `card` ➔ `bank`).
   - For **Cash**: Press **`F8`** to focus cash received input. Type the cash handed over by the customer (change due will calculate automatically).
   - For **Card**: Select the card brand, then press **`F9`** to focus and enter the card's last 4 digits.
   - For **Bank**: Press **`F9`** to type the custom bank name.
8. **Finalize Checkout**: Press **`F10`** (or press **`Enter`** while inside a focused payment input) to confirm the checkout. This prints the receipt and automatically clears the screen for the next transaction.
9. **Clear Workspace**: Press **`F12`** to cancel and wipe the active cart.

---

## 👤 3. Managing Customer Loyalty

Shopbook POS allows you to track customer accounts for repeat visits:

1. Open the Customer Modal by clicking **`Attach Customer`** or pressing **`F3`**.
2. **Search Profiles**: Search by entering their mobile phone number or name. Once found, click **`Attach Profile`** to link their loyalty account.
3. **Register New Customer**: Select the **`Create Customer`** tab. Enter the customer's full name, phone number, and optional email address. Click **`Register & Attach`** to save the account and automatically add them to the transaction.

---

## 📦 4. Managing Products & Inventory

Store owners and managers can update items metadata, prices, and stock counts.

### A. Registering New Products

1. Navigate to the **Stocks Page** from the sidebar navigation.
2. Click **`Register Product`** in the top right corner.
3. Complete the form details:
   - **Product Name**: Enter a descriptive label (e.g. _Keells Tomato Sauce 300g_).
   - **Barcode**: Scan or manually enter the manufacturer barcode. You can also tap the camera scanner icon to scan using your terminal's webcam.
   - **Quick Code**: Define a unique 4-digit code (e.g. _1055_) for fast keyboard checkouts.
   - **Image representation**: Drag and drop a product picture (Max 4MB) or leave it empty to use a category-themed emoji representation automatically.
   - **Selling Price / Cost Price**: Define your retail pricing and wholesale unit cost.
   - **Stock Count & Alert Level**: Input the current quantity in stock and set a low-alert trigger (e.g. warning shows if quantity is below _5_).
4. Click **`Save Product to Catalog`**. The new item is written to the local database and synced to the cloud.

### B. Adjusting Inventory Stock (Audit Logs)

If stock is damaged, sold, returned, or restocked:

1. On the **Stocks Page**, locate your item and click **`Adjust Stock`** (represented by the slider icon).
2. Choose the adjustment type:
   - **`Restock`**: Increments your inventory count.
   - **`Damage / Write-Off / Audit`**: Decrements your inventory count.
3. Enter the quantity and select or write a reason (e.g. _Expired goods, stock audit restock, damaged on delivery_).
4. Click **`Confirm Adjustment`**. An audit trail record is logged on the **Audit Logs** timeline at the bottom of the page.

---

## 📊 5. View Business Insights & Analytics

Store owners can track overall financial performance from the **Insights Page**:

- **Key Performance Indicators (KPIs)**: Track Net Revenue, gross transactions, average basket sizes, and gross margins.
- **Revenue Graphs**: Visual interactive line charts showing revenue spikes over days, weeks, or months.
- **Stock Alert Warnings**: View an aggregated list of products whose quantities have fallen below their low stock threshold.
- **Moving Inventory Rankings**: Check best-performing items (_Bestsellers_) and slow-moving stocks (_Slow Movers_) to adjust order frequencies.
- **Report Exporters**: Click **`Export Report`** to download full transaction ledger audits as formatted Excel sheets or print-friendly PDFs.

---

## 🏢 6. Admin and Staff Management

Under the **Profile Page**, store owners can configure terminal permissions:

- **Staff Registration**: Register employee accounts and assign roles:
  - **`Admin`**: Full permissions including stock adjustments, staff deletions, and analytics reviews.
  - **`Manager`**: Accesses POS and stocks management but cannot access store financial charts.
  - **`Cashier`**: Restricted strictly to the POS Billing screen for daily checkouts.
- **Terminal Management & Revocation**: Displays a dashboard of all active devices currently logged into the store. Details include battery charge levels, geolocations, and browser operating systems. Owners can click the trash icon next to a terminal's session to remotely log out that terminal.

---

## 🎹 7. Cashier Keyboard Shortcuts Cheat Sheet

Keep this quick reference guide printed next to the cash drawer:

| Key Command              | Action                                               | Where to Use          |
| :----------------------- | :--------------------------------------------------- | :-------------------- |
| **`F2`** or **`/`**      | Focus barcode scanner input                          | POS Main Screen       |
| **`F3`**                 | Attach or register customer                          | POS Main Screen       |
| **`F4`**                 | Toggle Payment Methods (Cash ➔ Card ➔ Bank)          | POS Main Screen       |
| **`F6`**                 | Edit or toggle transaction discount (Rupee vs %)     | POS Main Screen       |
| **`F7`**                 | Edit tax/VAT percentage                              | POS Main Screen       |
| **`F8`**                 | Focus payment inputs (Cash Received / Bank / Card)   | POS Main Screen       |
| **`F9`**                 | Focus payment sub-inputs (Custom Bank / Card Digits) | POS Main Screen       |
| **`F10`** or **`Enter`** | Confirm checkout and print receipt                   | Payment input focused |
| **`F12`**                | Clear active cart and reset                          | POS Main Screen       |
| **`Arrow Up / Down`**    | Highlight items inside dense items table             | POS normal cart grid  |
| **`+`** (or **`=`**)     | Increase quantity of highlighted item                | POS normal cart grid  |
| **`-`**                  | Decrease quantity of highlighted item                | POS normal cart grid  |
| **`Delete`**             | Remove highlighted item from cart                    | POS normal cart grid  |
| **`Escape`**             | Close current open modal or abort inputs             | Anywhere              |
