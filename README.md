# Shopbook POS (Point of Sale) Monorepo 📱💻🛒

Welcome to the **Shopbook POS** (also known as **Mini POS**) monorepo. This repository contains a high-fidelity, ultra-premium Point-of-Sale ecosystem designed for modern retail environments. The ecosystem is split into two primary interfaces:

1. 📱 **Mobile & Tablet POS App**: A native mobile app built with Expo, React Native, and Expo Router.
2. 💻 **Desktop & Web POS App**: A modern web app built with Next.js App Router and Lucide React.

Both applications share a robust, offline-first SQLite/IndexedDB synchronization architecture with a remote **Supabase** backend.

---

## 🏗️ Monorepo Architecture

This project is configured as a `pnpm` workspace monorepo. Dependencies and commands are managed at the root, while codebases are fully isolated in their respective workspace directories:

```text
shopbook-pos/
├── mobile/                      # Expo / React Native POS Application
│   ├── app/                     # File-based router files (Expo Router)
│   ├── components/              # Native layout & form components
│   └── constants/tokens.ts      # Mobile design tokens & color systems
│
├── web/                         # Next.js App Router Web Application
│   ├── src/app/                 # Page routes & layout configurations
│   ├── src/components/          # Desktop web layout components
│   └── src/app/globals.css      # Web utility & design variables
│
├── supabase/                    # Remote database configurations
│   └── migrations/              # Cloud SQL migration schemas
│
├── supabase_migration.sql       # Shared database setup & RPC sync procedures
├── package.json                 # Root monorepo commands and scripts
└── pnpm-workspace.yaml          # Monorepo workspace routing configuration
```

---

## ⚡ Quick Feature Comparison Matrix

| Feature                       |   📱 Mobile Client (Expo)   |  💻 Web Client (Next.js)  | Description                                                     |
| :---------------------------- | :-------------------------: | :-----------------------: | :-------------------------------------------------------------- |
| **Offline-First Storage**     |    SQLite (WatermelonDB)    | IndexedDB (WatermelonDB)  | Pure client-side database layer with high-performance querying  |
| **Supabase Cloud Sync**       |   Auto / Manual RPC Sync    |  Auto / Manual RPC Sync   | Bidirectional changes syncing (orders, products, staff, logs)   |
| **Multi-Role Authentication** |   OTP / Verification Code   |  OTP / Verification Code  | Role-Based Access Control (Admin, Manager, Cashier)             |
| **Multi-Outlet Registry**     |      Outlets Isolation      |     Outlets Isolation     | Segment products and orders strictly by active outlet ID        |
| **Item Scan Integration**     |   Camera Barcode Scanner    | Hardware/Emulated Scanner | Real-time scanner decoding to automatically increment cart      |
| **Receipt Printing**          |  Native Bluetooth ESC/POS   |   Virtual Printer Feed    | Print physical thermal tickets or view visual emulator previews |
| **Telemetry & Log Monitor**   | Location, Battery & Network |     Session Sign Out      | Keep track of active staff logins and force invalidations       |

---

## 📱 Shopbook Mobile POS Features

The native mobile application is optimized for tablet layouts and hand-held terminals, providing low-latency checkout and physical hardware integrations:

- **BT ESC/POS Thermal Printing**: Scans, pairs, and commands 58mm/80mm Bluetooth hardware thermal receipt printers. Generates native byte payloads for alignment, bold text, separators, and cuts.
- **Offline Image upload Queue**: Saves product images locally immediately. When connection states monitor online through NetInfo, uploads them via `@uploadthing/expo` in a background queue.
- **Device Telemetry Logs**: Automatically logs battery percentage, network state, device model, GPS coordinates, and push tokens. Allows managers to terminate devices remotely.
- **Mandatory Force Updates**: Synchronizes client versions with remote `app_config` variables and blocks outmoded clients.
- **Licensing & Payments**: Pro features license checks connected to subscription plan modals (RevenueCat checkout or bank slip WhatsApp submission).

For detailed app routes and files, see the [mobile subdirectory](shopbook-pos/mobile).

---

## 💻 Shopbook Web POS Features

The desktop web application provides a responsive console tailored for desktop monitors, laptop screens, or fixed kiosk terminals:

- **Collapsible Sidebar Layout**: Premium SaaS feel with expandable/collapsible sidebar menu toggles, store profile badges, active role indicators, and real-time network back-up indicators.
- **Catalog Manager**: Dual representation using category grids or sidebar layout pages. Quick register modals let managers add new items (price, stock, barcode, quick code) with instant state refreshes.
- **Billing Settlement Terminal**: Dedicated `/pos` workspace to view Active Invoice details, modify quantities, calculate balances, and complete payments.
- **Invoices Sales Ledger**: A dedicated database auditing list (`/history`) to inspect past receipts, view total revenue aggregates, and void transactions.
- **IndexedDB Local Engine**: Uses LokiJS and WatermelonDB web adapters to guarantee complete responsiveness even with temporary internet dropouts.

For detailed routes and CSS tokens, see the [web subdirectory](shopbook-pos/web).

---

## 🛠️ Monorepo Getting Started

To install, configure, and launch the applications locally, ensure you have [Node.js](https://nodejs.org/) installed. This workspace strictly uses **pnpm**.

### 1. Install Workspace Dependencies

Execute the install script from the project root:

```bash
pnpm install
```

### 2. Running the Dev Servers

You can run either application from the root using workspace scripts:

- **Run Web App (Next.js)**:

  ```bash
  pnpm dev:web
  ```

  Open [http://localhost:3000](http://localhost:3000) in your browser.

- **Run Mobile App (Expo)**:
  ```bash
  pnpm dev:mobile
  ```
  Press `i` for iOS Simulator, `a` for Android Emulator, or scan the QR code with Expo Go.

### 3. Production Builds

- **Build Web Bundle**:
  ```bash
  pnpm build:web
  ```
- **Type-Check and Linting**:
  ```bash
  pnpm lint:web
  pnpm lint:mobile
  ```

---

## 🛡️ Code Quality & Pre-commit Workflow

To maintain formatting standards and prevent broken code from being committed, this repository uses an automated pre-commit hook pipeline powered by **Husky** and **lint-staged**.

### Core Quality Tools

1. **Prettier**: Enforces consistent code styling project-wide. Staged files are formatted automatically before commit completion.
2. **Husky**: Hooks into git actions to run checks during `git commit` automatically, keeping the repository green and buildable.
3. **lint-staged**: Runs Prettier formatters exclusively on modified/staged files, ensuring fast commit operations.

### Automated Pre-commit Hook Pipeline

When you run `git commit`, the hook automatically executes the following checks:

1. 🔍 **Stage Formatting**: Uses `Prettier` (via `lint-staged`) to format modified code, stylesheets, and configs.
2. 🚀 **TypeScript Verification**: Runs a web compilation check (`tsc --noEmit`) to catch any static compiler errors before committing.
3. 📦 **Next.js Production Build Validation**: Verifies the web bundle compile (`pnpm build:web`) to ensure no compile-time regressions are committed.

If any of these verification stages fail, the commit process is aborted, allowing you to fix compilation or styling issues locally before pushing to GitHub.

---

## ☁️ Supabase Setup & Database Migrations

Both apps connect to the same remote Supabase database project for data synchronization.

### 1. Environment Configurations

Create environment config files in the respective directories:

- **Mobile App Config (`mobile/.env`)**:

  ```env
  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ```

- **Web App Config (`web/.env.local`)**:
  ```env
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ```

### 2. Schema Migration

Deploy the database schema, including synchronization RPC scripts, from the root file:

- Apply the SQL statements within [supabase_migration.sql](supabase_migration.sql) inside your Supabase project's SQL Editor dashboard, or apply them via the Supabase CLI:
  ```bash
  npx supabase db push
  ```

### 3. Row Level Security (RLS)

Enable Row Level Security on the created public tables to prevent raw REST API manipulation, as the offline synchronization mechanism handles data validation securely through custom `pull_watermelondb_changes` and `push_watermelondb_changes` RPC functions:

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

## 🎨 Color Palette & Typography

- **Theme Color**: Premium Blue (`#3B82F6`) highlights all primary click, route, and checkout button accents.
- **Low-Stock Alerts**: Red (`#EF4444`) warnings reflect critical items needing replenishment.
- **Glassmorphism Backdrop**: UI layouts on both platforms overlay transclucent containers (`rgba(15, 23, 42, 0.6)`) to preserve modern design aesthetics.
- **Fonts**: Plotted with modern high-legibility sans-serif typefaces (like _Plus Jakarta Sans_ on mobile and _Inter_ on desktop layouts) for rapid visual lookup.
