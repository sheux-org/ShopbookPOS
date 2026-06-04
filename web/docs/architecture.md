# Architecture Overview

This document provides a comprehensive overview of the **Shopbook POS Web Terminal** application architecture, its technical stack, codebase structure, and state management strategies.

---

## Technical Stack

The Web Terminal is built using a modern, performant, and resilient frontend stack designed for retail environments with potential network connectivity fluctuations:

- **Framework**: [Next.js (v15)](https://nextjs.org/) using the **App Router** layout system.
- **Local Database Engine**: [WatermelonDB](https://nozbe.github.io/WatermelonDB/) paired with a **LokiJS adapter** for in-browser high-speed IndexedDB caching and queries.
- **Remote Database Engine**: [Supabase](https://supabase.com) (PostgreSQL) acting as the centralized single source of truth.
- **Global State Management**: [Zustand](https://github.com/pmndrs/zustand) for sync stores, UI modes, carts, and cached local sessions.
- **Server Cache & Mutation State**: [React Query (v5)](https://tanstack.com/query/latest) for paginated queries (e.g. products, orders).
- **Styling**: Plain Vanilla CSS for custom, high-speed, animations-rich dashboards.

---

## Folder Structure

The application source code lives inside the `/src` folder, separated into layers by function:

```bash
web/src/
├── app/                  # Next.js App Router Pages and API endpoints
│   ├── api/              # Local server endpoints (Auth OTP helpers)
│   ├── auth/             # OTP sign-in landing workspace
│   ├── history/          # Sales invoice records list page
│   ├── insights/         # Revenue analysis charts and exports page
│   ├── pos/              # Tablet visual point-of-sale layout page
│   ├── profile/          # Merchant settings, staff and branches page
│   ├── stocks/           # Inventory stock tracking table and logs page
│   ├── globals.css       # Core design tokens, CSS variables, and layout resets
│   ├── layout.tsx        # Next.js global provider configuration (Header, Sidebar)
│   └── page.tsx          # Main POS Billing workspace entry point
├── components/           # Reusable UI component modules (nested by domain)
│   ├── auth/             # OTP verification UI phases
│   ├── catalog/          # Products creation forms
│   ├── layout/           # Sidebar navigation, Header controllers
│   ├── pos/              # Dense checkout tables, modal bills, customer selectors
│   ├── profile/          # Active devices pingers, staff permissions modals
│   └── insights/         # Charts, date range pickers, ledger components
├── db/                   # WatermelonDB connection, LokiJS adapters and Models
│   ├── database.ts       # Database database init (Client and SSR wrapper)
│   ├── models.ts         # Watermelon schema models (Product, Order, Employee)
│   └── schema.ts         # Local Watermelon schema version definitions
├── hooks/                # Custom React controller hooks (separating layout from business logic)
│   ├── usePosBilling.ts  # Centralized POS Billing action state machine
│   ├── useAuth.ts        # Mutators for logging in and Normalizing numbers
│   └── useActiveDeviceTracker.ts # Web terminal status background pinger
├── services/             # Networking interfaces
│   ├── sync.ts           # Supabase push/pull Watermelon replication RPCs
│   └── uploadQueue.ts    # Offline image upload synchronization manager
├── stores/               # Zustand local storage state stores
│   ├── authStore.ts      # Active logged-in Employee states
│   └── businessStore.ts  # Current store selection and seeding triggers
└── utils/                # Standard helper functions and static product seeds
```

---

## State Management

The application implements a hybrid state architecture:

```
                  ┌────────────────────────────────────────┐
                  │           React Components             │
                  └───────────┬────────────────┬───────────┘
                              │                │
                              ▼                ▼
                  ┌──────────────────────┐   ┌──────────────────────┐
                  │    Zustand Stores    │   │  React Query Hooks   │
                  │   (Auth, Settings,   │   │  (useProducts,       │
                  │     Cart States)     │   │   useOrders, etc.)   │
                  └──────────────────────┘   └──────────┬───────────┘
                                                        │
                                                        ▼
                                             ┌──────────────────────┐
                                             │   WatermelonDB Local │
                                             │    (IndexedDB/Loki)  │
                                             └──────────┬───────────┘
                                                        │ (Background Sync)
                                                        ▼
                                             ┌──────────────────────┐
                                             │  Supabase Cloud DB   │
                                             └──────────────────────┘
```

### 1. Local UI & Session State (Zustand)

Used for fast-changing client settings and ephemeral states:

- **`useAuthStore`** ([authStore.ts](../src/stores/authStore.ts)): Tracks active employee identifiers, phone number, login credentials, and JWT auth tokens in local storage.
- **`useBusinessStore`** ([businessStore.ts](../src/stores/businessStore.ts)): Stores registered branches linked to the owner's phone number, triggers local database queries to refresh the active profile, and controls catalog seedings.
- **`useCartStore`** ([cartStore.ts](../src/stores/cartStore.ts)): Maintains attached customer profiles and client checkout lists.
- **`useSettingsStore`** ([settingsStore.ts](../src/stores/settingsStore.ts)): Remembers preferences such as standard POS workspace mode (`normal` keyboard-optimized vs `tablet` visual grid).

### 2. Client Database Queries (React Query)

React Query wraps around local WatermelonDB query fetches to handle caching, reactive layout updates, and smooth infinite scroll paginations:

- **`useProducts`** ([useProducts.ts](../src/hooks/useProducts.ts)): Automatically queries products matching category filters and text queries directly from LokiJS indexed tables, caching matching queries.
- **`useOrders`** ([useOrders.ts](../src/hooks/useOrders.ts)): Fetches sales history ledgers and triggers transaction mutations (e.g. creating new paid receipts).

### 3. Database Layer (WatermelonDB)

To ensure the web app functions instantly and supports offline checkout, all queries are made against the local WatermelonDB instance ([database.ts](../src/db/database.ts)). Data is written locally, then replicated to Supabase in the background.

---

## Workspace Navigation & Global Layout

The shell layout of the application is controlled by:

- **`layout.tsx`** ([layout.tsx](../src/app/layout.tsx)): Integrates custom navigation sidebars, alerts banners, and wraps application pages with a query client.
- **`Header.tsx`** ([Header.tsx](../src/components/layout/Header.tsx)): Displays connection indicators (Online/Offline), triggers direct database replication triggers, showing last sync time, and hosts shop profile dropdowns.
