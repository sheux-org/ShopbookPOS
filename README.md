# Shopbook POS (Point of Sale) 📱🛒

Welcome to the **Shopbook POS** mobile application. This is a high-fidelity, ultra-premium tablet and mobile Point-of-Sale interface designed for modern retail environments. Built with Expo, React Native, and Expo Router, it features an advanced modular structure, type-safe database mapping, and offline-first database synchronization.

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

### 7. 💬 Help & FAQ Support Drawer
* **Direct Hotline Support**: Quick dial hotkeys for live assistance.
* **WhatsApp Chat Launching**: Direct link to open WhatsApp support for instant troubleshooting.
* **Pre-bundled FAQs**: Help drawers detailing tax computation, print receipts, and backup flows.

---

## 🏗️ Project Architecture & Directory Structure

The application's routing is powered by **Expo Router v3**, utilizing a modular group-based file structure:

```text
app/
├── (tabs)/                      # Core Application Navigation Tabs
│   ├── _layout.tsx              # Tab layout using custom BottomTabBar
│   ├── index.tsx                # Session check -> Redirect to home or auth
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
│   │   ├── payment.tsx          # Payment tender selector
│   │   ├── payment-tender.tsx   # Card (Sunmi simulator) / Cash processor
│   │   └── search.tsx           # Quick product finder
│   ├── stocks/
│   │   ├── add-item.tsx         # Add products with automated quick codes
│   │   └── scan.tsx             # Live camera barcode scanner
│   └── profile/
│       ├── business-details.tsx # Store name, address, category configuration
│       ├── manage-businesses.tsx# Switch branches or register new business
│       └── manage-staff.tsx     # Add/edit staff roles (Admins, Managers, Cashiers)
│
└── _layout.tsx                  # Root layout nesting Query & Permission Providers
```

> [!NOTE]
> Parenthesis groups like `(modules)` and `(tabs)` are automatically ignored in routes. Push commands like `router.push("/cart")` or `router.push("/add-item")` remain fully decoupled from structural folders.

---

## 🛠️ Technology Stack

1. **Framework**: [Expo](https://expo.dev/) (React Native) + **Expo Router** (File-based routing)
2. **Package Manager**: **pnpm** (Fast, disk-efficient, strict resolution)
3. **Database Layer**: **WatermelonDB** (Local SQLite) with Supabase Cloud backup
4. **Data Fetching**: **TanStack React Query v5** (Robust cache invalidations & mutation triggers)
5. **State Management**: **Zustand** (Auth & Business persistence stores)
6. **Styling & UI**: StyleSheet API using custom design tokens (`constants/tokens.ts`)
7. **Icons**: Vector Icons (Feather, Ionicons)

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
```

---

## 🎨 Premium UI Styles & Design System


Theme variables are configured centrally inside `constants/tokens.ts` for uniform visual styling:
* **Primary Blue (`#3B82F6`)**: Premium accents for core POS actions and tab navigations.
* **Alert States**: Bold visual warning badges (`#EF4444`) representing critical notifications (e.g., low-stock indicators).
* **Glassmorphism**: Translucent backdrops (`rgba(15, 23, 42, 0.6)`) and cards used for overlays.
* **Typography**: Bold, high-contrast text sizes optimized for cashier lookup speeds on mobile and tablet.
