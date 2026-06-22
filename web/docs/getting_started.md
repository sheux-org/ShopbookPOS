# Developer Getting Started Guide

This guide helps new developers set up, run, test, and build the **Shopbook POS Web Terminal** project on their local systems.

---

## 1. Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: Version 18.x or 20.x (Recommended)
- **Package Manager**: `npm` (v9+) or `yarn` / `pnpm`

---

## 2. Configuration (`.env.local`)

Copy or create a `.env.local` file in the root of the `/web` directory:

```bash
# Path: /Users/shenux/Desktop/Shopbook/shopbook-pos/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://<your-supabase-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
UPLOADTHING_TOKEN=<your-uploadthing-token-for-images-bucket>
```

Refer to the local [.env.local](../.env.local) to see the active staging environment keys.

---

## 3. Installation & Local Development

1. Open your terminal and navigate to the `web` workspace folder.
2. Install the node modules:
   ```bash
   pnpm install
   ```
3. Run the Next.js development server:
   ```bash
   pnpm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 4. Production Build

To test production builds and validate type correctness before deployments, compile the Next.js static asset bundle:

```bash
# Compile and build production bundles
pnpm run build

# Start the compiled production build locally
pnpm run start
```

---

## 5. Diagnostic Tools & Scripts

To debug configurations, authentication schemas, and local DB adapters, the project provides several helper scripts and diagnostics tools:

### A. Terminal Diagnostics Component

- **Location**: [TerminalDiagnostics.tsx](../src/components/TerminalDiagnostics.tsx)
- **Features**: An interactive screen in the web client displaying:
  - **IndexedDB Space Usage**: Live estimation of LokiJS adapter's storage utilization.
  - **Network Latency**: Active ping checks to Supabase endpoints.
  - **Sync Diagnostics**: Detailed logs showing last synced timestamps and replication success flags.

### B. OTP Backend Authentication Tester

- **Script**: [test_auth.js](../src/test_auth.js)
- **Usage**: Tests the Vercel microservices OTP generation endpoints (`/api/v1/auth/check` and `/api/v1/auth/verify`) directly from the command line:
  ```bash
  node src/test_auth.js
  ```

### C. Sync RPC Query Tester

- **Script**: [query_tables.js](../src/query_tables.js)
- **Usage**: Simulates a pull replication cycle by invoking the PostgreSQL database RPC function `pull_watermelondb_changes` directly using network fetch:
  ```bash
  node src/query_tables.js
  ```

---

## 6. Codebase Quality & Git Commit Hooks (Husky)

Before submitting pull requests, ensure your code adheres to codebase standards. The project implements a local **Husky pre-commit hook** that automatically runs on every `git commit`. It executes:

1. **Prettier Formatting** (`lint-staged`)
2. **TypeScript Compilation Check** (`tsc --noEmit`)
3. **Next.js Production Build Validation** (`pnpm build:web`)

For more details, see the [Testing Guide](testing.md#7-git-pre-commit-quality-guard-husky).

---

## 7. Manual Device Testing (login, scanner, printer)

For testing the POS device features — logging in, the barcode scanner, and the thermal
printer / cash drawer **without physical hardware** — follow the
[Device & Hardware Testing Guide](device-testing.md).
