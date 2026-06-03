# Shopbook POS Web Terminal Documentation

Welcome to the **Shopbook POS Web Terminal** documentation. This directory contains detailed reference documents explaining the architecture, data models, synchronization protocols, and features of the web terminal to help onboarding developers understand and continue building the system.

## Table of Contents

1. **[Architecture Overview](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/docs/architecture.md)**
   - Technical Stack and folder structure.
   - Global state management (Zustand) and Server State (React Query).
   - Hotkeys and navigation routing.
2. **[Database Schema & Models](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/docs/database.md)**
   - Local offline database: [WatermelonDB](https://watermelondb.dev) with LokiJS adapter.
   - Table schemas, database indexes, and seeding configurations.
3. **[Synchronization Protocol & Security](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/docs/synchronization.md)**
   - Supabase replication flows (`pull_watermelondb_changes` and `push_watermelondb_changes`).
   - Secure Multi-Tenant Isolation logic and RLS (Row Level Security) structure.
   - File uploads and logo hosting queues.
4. **[Features Guide](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/docs/features.md)**
   - Checkout & Point of Sale modes (Tablet Visual Mode vs. Keyboard-Optimized Normal Mode).
   - Real-time Active Device status and remote terminal session revocation.
   - OTP Authentication verification and Sri Lankan phone number normalization.
   - Analytical Dashboards, bestsellers, slow movers, and Excel/PDF reports exporter.
5. **[Developer Getting Started Guide](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/docs/getting_started.md)**
   - Environment variables setup.
   - Scripts and CLI development commands.
   - Production builds and testing diagnostics.
6. **[User & Cashier Guide](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/docs/user_guide.md)**
   - Guided walkthroughs for cashiers and store managers.
   - Tablet Touch Mode vs Keyboard-optimized Normal Mode steps.
   - Keyboard Shortcuts cheat sheet, Customer registrations, and Inventory updates.


---

## Workspace Quick Links

To examine key entry points in the source code directly, use these absolute workspace links:

- **Database Setup**:
  - Main DB Instance: [database.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/db/database.ts)
  - Tables Schema: [schema.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/db/schema.ts)
  - Models Definitions: [models.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/db/models.ts)
- **Synchronizer & Network**:
  - Sync Controller: [sync.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/services/sync.ts)
  - Offline Image Uploads Queue: [uploadQueue.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/services/uploadQueue.ts)
- **Point of Sale Core Hook & Entry Point**:
  - POS Controller Hook: [usePosBilling.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/hooks/usePosBilling.ts)
  - POS Layout Workspace: [page.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/app/page.tsx)
- **Active Devices Hook & Component**:
  - Session Pinger: [useActiveDeviceTracker.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/hooks/useActiveDeviceTracker.ts)
  - Terminal Revocation Dialog: [ActiveDevicesModal.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/components/profile/ActiveDevicesModal.tsx)
- **Supabase Isolations**:
  - Security Migration Script: [20260603000000_secure_tenant_isolation.sql](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/supabase/migrations/20260603000000_secure_tenant_isolation.sql)
