# Shopbook POS (Point of Sale) 📱🛒

Welcome to the **Shopbook POS** (also known as **Mini POS**) mobile application. This is a high-fidelity, ultra-premium tablet and mobile Point-of-Sale interface designed for modern retail environments. Built with Expo, React Native, and Expo Router, it features an advanced modular structure, type-safe database mapping, offline-first database synchronization, local device telemetry, and hardware integrations.

---

## 🌟 Key Features

### 1. 📊 Insights & Real-Time Analytics Dashboard
* **Dynamic Sales Charts**: Visually stunning bar chart showing weekly sales distributions computed directly from local WatermelonDB database records.
* **KPI Metrics**: Real-time dashboard counters for **Gross Revenue**, **Transaction Volume**, **Average Basket/Ticket Value**, and **Low-Stock Warnings**.
* **Best Sellers & Slow Movers**: Ranks inventory dynamically so merchants can monitor hot and cold items instantly.
* **Export Statements**: Simulate generating and sharing formatted **PDF summaries** or tabular **CSV ledgers**.
* **Custom Calendar Picker**: Interactive custom date range filtering (pre-configured for May 2026).
* **Stock Refill/Restocking Utility**: Single-click stock replenishment mechanism integrated with product mutations.
* **Demo Database Seeder**: Instantly generates 15 dummy orders inside SQLite to visualize dashboard behavior on empty databases.

### 2. 🔐 Multi-Role Staff Authentication
* **Phone-Based OTP Login**: Fast login using verification code lookup against local registered businesses and employees.
* **Role-Based Access Control (RBAC)**: Supports three predefined staff roles with modular permissions:
  * **Admin / Owner**: Unlimited access to settings, staff management, payment setups, sync controls, and branch creation.
  * **Manager**: Can view records, sync database, and edit products but cannot manage staff or delete businesses.
  * **Cashier**: Restructured read-only profile access. Restricted from sync actions, staff configurations, and adding new outlets.

### 3. 🏢 Multi-Outlet Management & Isolation
* **Store Registry**: Register and switch between multiple branches/outlets dynamically.
* **Product Isolation**: Products and billing transactions are strictly isolated per active business ID.
* **Real-Time Synchronizers**: Active store updates propagate instantly to all open layouts and cart state controllers.

### 4. 🗄️ Offline-First Sync Architecture (WatermelonDB + Supabase)
* **WatermelonDB Core**: Fast local SQLite store wrapping React Native models, schemas, and migrations.
* **Supabase Integration**: Cloud replication to sync local sales entries, items, and inventory state with Supabase backend.
* **Auto/Manual Backup Control**: Toggle live background synchronization or run manual backups through the cashier settings.

### 5. 🛡️ Centralized Permission Handler
* **Camera Access Soft Primer**: A custom visual dialog box detailing exactly *why* the camera is required before prompting standard iOS/Android permissions.
* **Enhanced Privacy Compliance**: Centralizes and invokes camera access on-demand only when initiating the barcode scanner or camera viewport.

### 6. 🛒 Enhanced POS Keyboard & Checkout
* **Pristine Checkout Flow**: Restructured compact keypads and quick-code search entries that conserve screen height while offering card (Sunmi terminal simulator) and cash billing.
* **Unified Global Tab Layout**: Beautiful bottom navigation bar with active blue accent indicators and haptic feedback triggers.

### 7. 💬 Help & FAQ Drawer
* **Direct Hotline Support**: Quick dial hotkeys for live assistance.
* **WhatsApp Chat Launching**: Direct link to open WhatsApp support for instant troubleshooting.
* **Pre-bundled FAQs**: Help drawers detailing tax computation, print receipts, and backup flows.

### 8. ☁️ UploadThing Image Upload Queue (Offline-First)
* **Immediate Local Saves**: When adding/editing products offline, local image file paths are saved immediately to WatermelonDB with `iconPendingUpload = true`.
* **Network Status Monitor**: The queue system monitors connection states using NetInfo. When the device comes back online, it processes the queue and uploads local files to the cloud.
* **Cache Invalidation & Real-Time Sync**: Successfully uploaded images receive remote HTTPS URLs, trigger local DB syncs to Supabase, and invalidate React Query caches to refresh screens instantly.

### 9. 🖨️ Bluetooth Thermal ESC/POS Receipt Printing
* **Printer Pairing & Connection**: Integrated scanning, pairing, and connection to 58mm/80mm ESC/POS hardware thermal receipt printers.
* **Virtual Printer Output**: A simulated receipt feed modal to inspect layout, alignments, totals, and barcode elements prior to physical print triggers.
* **ESC/POS Command Payloads**: Generates correct native control byte sequences for text alignments, text styling (regular, bold, double-width/height), paper separators, and cuts.

### 10. 🛰️ Active Device Telemetry & Session Monitoring
* **Real-Time Telemetry Tracking**: Logs active device sessions (battery level, network state, device model, push notification tokens, and GPS location geocoded to city/country).
* **Remote Session Control**: Allows admins/owners to view active logins for their branch and terminate sessions remotely.
* **Real-Time Client Invalidation**: Devices check session status periodically; if their session is terminated in the Supabase table, they are forced to log out immediately.

### 11. 🔔 Native Push Notifications
* **Token Registry**: Fetches and registers FCM/APNs push notification tokens automatically for active device logs.
* **Foreground & Click Handlers**: Custom listeners capture push payloads in the foreground or on user notification taps.

### 12. 🔄 Mandatory Application Force Updates
* **Version Enforcement**: Checks client application versions against global configurations on Supabase.
* **Blocking Upgrade Dialog**: Prompts a mandatory blocking modal if the running version falls below the required threshold, guiding cashiers to App Store / Google Play links.

### 13. 💎 Premium Licensing & Monetization
* **License Check System**: Real-time Pro tier membership validation checks that unlock advanced features (unlimited outlets, active device logs, auto cloud sync, Bluetooth printing, etc.).
* **Flexible Subscriptions**: Custom plan selector (1 month, 3 months, 1 year) with interactive details and savings badges.
* **Dual Payment Selectors**: Instant activation with credit/debit card checkout via RevenueCat or bank transfer deposit slips (featuring copyable Seylan Bank details and direct WhatsApp receipt submission).

---

## 🏗️ Project Architecture & Directory Structure

The application's routing is powered by **Expo Router v3**, utilizing a modular group-based file structure:

```text
app/
├── (tabs)/                      # Core Application Navigation Tabs
│   ├── _layout.tsx              # Tab layout using custom BottomTabBar
│   ├── index.tsx                # Initial tab controller (HomeScreen)
│   ├── pos.tsx                  # POS Billing screen
│   ├── insights.tsx             # Real-time dashboard analytics
│   ├── stocks.tsx               # Stock Registry / Product directory
│   └── profile.tsx              # Profile Settings & Support Modal
│
├── (modules)/                   # Dedicated standalone modules (ignored in paths)
│   ├── auth/
│   │   └── number-input.tsx     # OTP registration & verification login flow
│   ├── pos/
│   │   ├── cart.tsx             # Cart details & item adjustment
│   │   ├── catalog.tsx          # Scrollable catalog grid
│   │   ├── history.tsx          # Transaction / Order History List
│   │   ├── payment-tender.tsx   # Card (Sunmi simulator) / Cash processor
│   │   └── search.tsx           # Quick product finder
│   ├── stocks/
│   │   ├── item-details.tsx     # Product detail display & management
│   │   ├── items.tsx            # Add/edit products with automated quick codes
│   │   └── scan.tsx             # Live camera barcode scanner
│   └── profile/
│       ├── active-devices.tsx   # View logged in sessions and terminate them
│       ├── bluetooth-printer.tsx# Scan, pair and connect to ESC/POS thermal printers
│       ├── business-details.tsx # Store name, address, category configuration
│       ├── manage-businesses.tsx# Switch branches or register new business
│       ├── manage-staff.tsx     # Add/edit staff roles (Admins, Managers, Cashiers)
│       ├── payment-select.tsx   # Plan payment method options selector
│       └── premium-plans.tsx    # Pro licensing plans (1 month, 3 months, 1 year)
│
├── api/                         # Local backend endpoints
│   └── uploadthing+api.ts       # UploadThing server-side file router endpoint
│
├── index.tsx                    # Root gate: Checks session & redirects to /auth or /(tabs)
└── _layout.tsx                  # Root layout nesting Query, Theme, & Permission Providers
```

> [!NOTE]
> Parenthesis groups like `(modules)` and `(tabs)` are automatically ignored in routes. Push commands like `router.push("/cart")` or `router.push("/bluetooth-printer")` remain fully decoupled from structural folders.

---

## 🛠️ Technology Stack

1. **Framework**: [Expo](https://expo.dev/) (React Native) + **Expo Router** (File-based routing)
2. **Package Manager**: **pnpm** (Fast, disk-efficient, strict resolution)
3. **Database Layer**: **WatermelonDB** (Local SQLite) with Supabase Cloud backup
4. **Data Fetching**: **TanStack React Query v5** (Robust cache invalidations & mutation triggers)
5. **State Management**: **Zustand** (Auth, settings & Business persistence stores)
6. **Styling & UI**: StyleSheet API using custom design tokens (`constants/tokens.ts`)
7. **Icons**: Vector Icons (Feather, Ionicons)
8. **Cloud Uploads**: **UploadThing** (`@uploadthing/expo` + `uploadthing`) for media storage
9. **Receipt Printing**: **react-native-bluetooth-classic** for ESC/POS hardware pairing
10. **Device API**: **expo-battery**, **expo-location** (for telemetry tracking), and **expo-notifications** (for push notifications)
11. **Barcodes**: **react-native-barcode-svg** (for receipt barcode generation)

---

## 🚀 Getting Started

Make sure you have [Node.js](https://nodejs.org/) installed. This repository strictly uses **pnpm**.

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Start the App
```bash
pnpm start
```
* Press `i` to launch the **iOS Simulator**.
* Press `a` to launch the **Android Emulator**.
* Scan the QR code with **Expo Go** on a physical tablet or phone.

### 3. Verification & Type Checking
```bash
pnpm tsc --noEmit
pnpm lint
```

### 4. Expo dependency & project health

Run these from the project root when upgrading Expo or before a release. They do not start the dev server.

- **`npx expo install --check`** — Compares installed dependency versions with the [Expo SDK compatibility table](https://docs.expo.dev/versions/latest/) and reports mismatches. Use `npx expo install --fix` (or install the packages it names) to align versions.

- **`npx expo-doctor`** — Runs Expo’s project health checks (config, native tooling, peer deps, React Native Directory hints, etc.). The local `expo` CLI does not include `expo doctor`; use **`expo-doctor`** as above, or **`pnpm doctor`** (same command via `package.json`).

```bash
npx expo install --check
npx expo-doctor
```

---

## ☁️ Supabase Integration & Database Migrations

This project uses **Supabase** for its offline-first backend synchronization. Local database records inside WatermelonDB are synced with a cloud Supabase database through RPC synchronization functions.

### 1. Environment Configuration

Create a `.env` file in the root directory and add your Supabase credentials:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-api-key
```

> [!IMPORTANT]
> The environment variables **must** start with `EXPO_PUBLIC_` so they are accessible within the Expo client runtime.

### 2. Database Schema Setup & Migrations

The database tables, triggers, indexes, and synchronization RPC functions are defined in [supabase_migration.sql](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/supabase_migration.sql). You can apply this schema to your Supabase project in three ways:

#### Option A: Using the Supabase MCP Server (Recommended for Model/Agent usage)
If you are using an agentic assistant with the Supabase MCP Server, the schema can be applied and verified using the following tools:
1. **Apply Schema**: Run `mcp_supabase_execute_sql` passing the contents of the `supabase_migration.sql` file.
2. **Verify Tables**: Run `mcp_supabase_list_tables` on the `public` schema to verify that `businesses`, `employees`, `products`, `orders`, `order_items`, and `deleted_records` have been successfully created.
3. **Verify Connection**: Call the `pull_watermelondb_changes` RPC from an external runner to ensure the API permissions are correct.

#### Option B: Using the Supabase Dashboard
1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **SQL Editor** -> **New Query**.
3. Copy and paste the entire contents of the `supabase_migration.sql` file.
4. Click **Run**.

#### Option C: Using the Supabase CLI
If you prefer managing migrations locally:
```bash
# Link your local CLI to your Supabase project
npx supabase link --project-ref <your-project-ref>

# Apply the SQL schema to the remote database
npx supabase db push
```

For app configurations and force updates, the configuration table is defined in the migrations directory:
- [20260523000000_add_app_config.sql](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/supabase/migrations/20260523000000_add_app_config.sql)

### 3. Row Level Security (RLS) Recommendations

By default, the tables created in the public schema are accessible via the Supabase REST API using the client's `anon` key. 

Since the WatermelonDB synchronization mechanism uses `SECURITY DEFINER` RPC functions (`pull_watermelondb_changes` and `push_watermelondb_changes`), they run with owner privileges and bypass RLS. Therefore, it is highly recommended to enable RLS on the tables to block unauthorized direct REST API access:

```sql
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_devices ENABLE ROW LEVEL SECURITY;
```

---

## 🎨 Premium UI Styles & Design System

Theme variables are configured centrally inside `constants/tokens.ts` for uniform visual styling:
* **Primary Blue (`#3B82F6`)**: Premium accents for core POS actions and tab navigations.
* **Alert States**: Bold visual warning badges (`#EF4444`) representing critical notifications (e.g., low-stock indicators).
* **Glassmorphism**: Translucent backdrops (`rgba(15, 23, 42, 0.6)`) and cards used for overlays.
* **Typography**: Bold, high-contrast text sizes optimized for cashier lookup speeds on mobile and tablet.
