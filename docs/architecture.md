# Shopbook POS — Architecture

System overview for the monorepo: what the pieces are, how identity and data flow through them, and where the structural risks sit.

Audited on `dev` @ `f23870f`. Sync has its own deep-dive in [`sync-architecture.md`](./sync-architecture.md); the billing/entitlement work is in [`revenuecat/`](./revenuecat/).

## 1. Shape

A pnpm workspace with three deployables and two external dependencies.

| Package     | Stack                                | Role                                                        |
| ----------- | ------------------------------------ | ----------------------------------------------------------- |
| `mobile/`   | Expo SDK 54, RN 0.81.5, expo-router  | The product. Offline-first POS terminal.                    |
| `web/`      | Next.js 15, React 19                 | Same application in a browser. Positioned as a Pro feature. |
| `supabase/` | migrations only — **no server code** | Postgres schema + 9 `SECURITY DEFINER` RPCs                 |

| External                          | Purpose                                |
| --------------------------------- | -------------------------------------- |
| `mini-pos-sync-server.vercel.app` | Phone/OTP verification. Separate repo. |
| UploadThing                       | Product image hosting                  |

There is no application server in this repository. Everything server-side is SQL.

```
   ┌─────────────┐        ┌─────────────┐
   │  mobile/    │        │   web/      │
   │ WatermelonDB│        │ WatermelonDB│
   │  (SQLite)   │        │  (LokiJS)   │
   └──────┬──────┘        └──────┬──────┘
          │   anon key + business_id
          └───────────┬───────────┘
                      ▼
         ┌────────────────────────┐      ┌──────────────────────┐
         │ Supabase Postgres      │      │ Vercel OTP service   │
         │  • 6 mirror tables     │      │  /api/v1/auth/verify │
         │  • 9 SECURITY DEFINER  │      └──────────────────────┘
         │    RPCs (anon-granted) │
         │  • Realtime broadcast  │      ┌──────────────────────┐
         │  • app_config          │      │ UploadThing          │
         └────────────────────────┘      └──────────────────────┘
```

## 2. The central design decision: local-first

Both clients run **WatermelonDB** against the same schema (v9, six tables) — mobile on native SQLite, web on LokiJS/IndexedDB (`web/src/db/database.ts:9`).

```
businesses ─┬─ employees
            ├─ products ── inventory_logs
            └─ orders ──── order_items
```

**Every UI read and write hits the local database.** Supabase is a mirror. Nothing in the checkout path blocks on the network — the correct call for retail tills on unreliable connectivity, and the constraint that explains most other decisions in this codebase.

### The write path (selling something)

`mobile/hooks/useOrders.ts:133` — a single `database.write()` transaction:

1. Generate `invoiceNumber`
2. Insert the `orders` row
3. Insert each `order_items` row
4. Decrement `product.stockCount` — `Math.max(0, stock - qty)`, floored at zero
5. Insert an `inventory_logs` entry per line item (audit trail)
6. Return `{ orderId, invoiceNumber }`

Then, **outside** the transaction and deliberately unawaited, `syncDatabase()` fires (`:209`). The sale commits locally the moment the transaction closes.

Receipt printing is ESC/POS over Bluetooth Classic, via a patched dependency (`mobile/patches/react-native-bluetooth-classic@1.73.0-rc.17.patch`).

## 3. Identity and authentication

The unusual part of this system. `mobile/hooks/useAuth.ts`:

1. **OTP is verified remotely, identity is resolved locally.** The Vercel service is asked only _"is this code valid for this phone"_ — it returns no identity, no session, no token beyond the bearer used for the call.

2. **The client then searches its own local database** for who that phone belongs to, in this order:

   | Order | Match                        | Result                                                                                         |
   | ----- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
   | 1     | `employees.phone`            | staff session, role from the row                                                               |
   | 2     | `businesses.phone_number`    | owner session (`employeeId: 'owner'`, role `admin`)                                            |
   | 3     | RPC `check_phone_registered` | account exists in cloud, not on device → enable backup, full `syncDatabase()`, pull everything |
   | 4     | no match                     | → register a new business                                                                      |

3. `loginWithEmployee(...)` writes the session into a persisted zustand store (`useAuthStore`, AsyncStorage). The bearer token goes to `expo-secure-store`.

**There is no Supabase Auth session anywhere.** `persistSession: false`, `autoRefreshToken: false`, and every client operates on the public anon key (`mobile/services/sync.ts:17-27`).

### Consequence: owner detection is not obvious

Registration also creates an `employees` row carrying the owner's own phone. Because step 1 runs before step 2, **an owner logging in matches as staff first**. Any code needing "is this the owner" must compare the session phone against `businesses.phone_number`, not check `activeEmployeeId === 'owner'`.

## 4. Multi-tenancy and authorization

The tenant key is `business_id`, threaded from the client into every RPC as a parameter:

```ts
supabase.rpc('pull_watermelondb_changes', { last_pulled_at, client_business_id });
```

Server-side each RPC is `SECURITY DEFINER` (bypassing RLS), `GRANT`ed to `anon`, and filters on the `client_business_id` it was handed. Push additionally asserts per row:

```sql
IF (r->>'business_id') != client_business_id THEN
  RAISE EXCEPTION 'Unauthorized ... push';
END IF;
```

That assertion prevents a caller from mixing tenants **within one call**. It does not establish which tenant the caller is entitled to — the caller declares that. See §11.

### The RPC surface

| RPC                         | Used by     |
| --------------------------- | ----------- |
| `pull_watermelondb_changes` | mobile, web |
| `push_watermelondb_changes` | mobile, web |
| `fetch_user_businesses`     | mobile, web |
| `check_phone_registered`    | mobile      |
| `check_synced_account`      | mobile      |
| `normalize_phone_pg`        | internal    |
| `record_deletion`           | trigger     |
| `set_server_updated_at`     | trigger     |

## 5. Sync

Summarised here; full detail in [`sync-architecture.md`](./sync-architecture.md).

- **Triggers:** app foreground, after a sale, realtime broadcast from a peer terminal, login-with-cloud-account, branch switch. **No timer.**
- **Pull:** one RPC returning six tables × `created`/`updated`/`deleted`, watermarked on `server_updated_at` (set by trigger, never a client clock).
- **Push:** one RPC _per table_, sequential, in foreign-key order, so children never precede parents.
- **Fan-out:** after a push, a Supabase Realtime broadcast on `sync:{businessId}` wakes peer terminals, which pull.
- **Settle:** `queryClient.resetQueries()` + a store bump, so infinite-query pages restart from page 0.

Known defect: concurrent stock decrements are lost (unconditional `ON CONFLICT DO UPDATE` + absolute `stock_count`). Detail and ranked fixes in `sync-architecture.md` §9.

## 6. Real-time and device management

Beyond sync fan-out, `services/devicePresence.ts` runs a second Realtime layer:

- **Presence** — each terminal publishes device model, battery, GPS, role, employee, push token; mirrored into `active_devices` for offline snapshots.
- **Remote logout** — `revokeDeviceSession()` writes to `device_session_revocations` and broadcasts `session_revoke`; the target device's listener force-logs-out. A device offline at the time checks `checkDeviceRevoked()` on next start.
- **Push notifications** — Expo push tokens registered per device (`services/notificationService.ts`).

Surfaced in the UI at `profile/active-devices`.

## 7. Roles and permissions

`mobile/hooks/useUserPermissions.ts` — a 3×5 matrix:

| Role      | products | transactions | staff | settings | sync |
| --------- | -------- | ------------ | ----- | -------- | ---- |
| `admin`   | CRUD     | CRUD         | CRUD  | CRUD     | CRUD |
| `manager` | CRU      | CR           | —     | R        | CRU  |
| `cashier` | R        | CR           | —     | —        | —    |

Plus `isRoleAtLeast()` for hierarchical checks (cashier 1 < manager 2 < admin 3).

**Entirely client-side.** The server never receives a role and cannot enforce one — the same anon key and RPCs serve every role identically.

## 8. Feature gating (premium)

Eleven gates read `useSettingsStore((s) => s.isPremium)` and open `PremiumUpgradeModal` when false — camera barcode scanning (5 screens), branch switching, thermal printing (2), printer pairing, cloud sync + exports, staff management.

Today the flag is meaningless: `mobile/stores/useSettingsStore.ts:54-77` wraps the store in a `Proxy` returning `isPremium = true` for every read, and `web/src/stores/settingsStore.ts:47` hard-codes `true`. Every user is Pro; no server-side notion of a subscription exists.

Replacing this is the RevenueCat project — see [`revenuecat/01-audit.md`](./revenuecat/01-audit.md).

Note that **"cloud sync is Pro" is already false in practice**: registration pushes to Supabase immediately, login depends on `check_phone_registered`, and phone uniqueness is checked in the cloud. Sync is a free-tier dependency of the auth path.

## 9. Web client

Next.js 15 App Router, mirroring mobile screen-for-screen: `pos`, `stocks/[id]`, `history`, `insights`, `profile`, `auth`.

- Same WatermelonDB schema, LokiJS adapter, same three sync RPCs.
- Own API routes proxying the same OTP service: `/api/auth/verify`, `/api/auth/check`, plus `/api/uploadthing`.
- `useAppAuthGuard.ts` handles redirects and business hydration; layout guards `MobileBlocker` (refuses phone viewports) and `SyncBlocker`.
- Has a test suite (`web/src/__tests__/`) covering stores, hooks, services, db, api — mobile has none.

## 10. Supporting services

| Concern               | Implementation                                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Offline image uploads | `services/uploadQueue.ts` — local `file://` saved instantly with `iconPendingUpload = true`; NetInfo monitor uploads to UploadThing on reconnect, rewrites to `https://`, invalidates queries |
| Force update          | `services/appConfig.ts` reads `app_config` (`force_update`, `min_version`, store URLs) → `ForceUpdateScreen` blocks the app                                                                   |
| i18n                  | `locales/{en,si,ta}.ts` in both clients — English, Sinhala, Tamil                                                                                                                             |
| Query caching         | TanStack Query, `staleTime` 5 min, `retry` 2; full `resetQueries()` after sync                                                                                                                |
| Splash / hydration    | `CustomSplashScreen` gates on `useAuthStore.persist.hasHydrated()`                                                                                                                            |

## 11. Structural risks

Ordered by blast radius.

### 11.1 Tenant isolation is a parameter, not a boundary

Every sync RPC is `SECURITY DEFINER` (bypasses RLS) and `GRANT`ed to `anon`. Authorization is: _the caller passes `client_business_id`, and the function filters on it._ The anon key ships in both client bundles.

Anyone with that key plus a `business_id` can pull or push another business's entire dataset. The migration is named `secure_tenant_isolation`, but the security property it provides is intra-call consistency, not access control.

Every comparable open-source implementation derives the tenant server-side from `auth.uid()` instead (see `sync-architecture.md` §8.1). Fixing this means introducing real Supabase Auth sessions — a large change that this codebase's phone/OTP model was built to avoid.

### 11.2 Concurrent stock decrements are lost

Unconditional last-write-wins upserts plus absolute (not delta) `stock_count`. Two tills selling the same product concurrently lose one decrement silently, while `orders` and `inventory_logs` both stay correct — so nothing reconciles. Full analysis and three ranked fixes in `sync-architecture.md` §9.

### 11.3 A hardcoded OTP bypass exists in both auth stores

`useAuthStore.login(phone, otp)` returns an authenticated admin session for `otp === '11111'` — `mobile/stores/useAuthStore.ts:68`, `web/src/stores/authStore.ts:63`. Web's auth page surfaces it in an error hint (`web/src/app/auth/page.tsx:125`).

No UI call site was found for the mobile one (reachable only through the `cartState` compatibility facade at `components/data/cartState.ts:91`), but it is live code in a shipped bundle. The real login path is `useVerifyOtp`, which does call the OTP service. This should be removed or environment-gated before store submission — and it is exactly the kind of thing an App Review reader would find in a bundle.

### 11.4 Roles are advisory

The permission matrix is client-side only (§7). A modified client, or a direct RPC call, ignores it entirely.

### 11.5 Push RPC maintenance cost

The `push_watermelondb_changes` body is ~640 lines of `IF/ELSIF` with byte-identical `created` and `updated` upserts per table — 12 duplicate blocks. Any change to push semantics is a 12-site edit. Row-by-row `FOR ... LOOP` rather than set-based SQL also makes large first-syncs slow.

## 12. Build and release

EAS profiles (`mobile/eas.json`): `development` / `development-simulator` (dev client), `preview` / `android-preview` (internal APK), `production`, `shopbook-pos-ios-dev` (store distribution, app-bundle).

Bundle id and package are both `lk.shopbook.pos`. Note `app_config.android_url` currently points at `com.pasanpahasara.shopbookpos` and `ios_url` is a placeholder — force-update deep links do not resolve.

Web builds with `next build` (`pnpm build:web`).

## 13. Codebase map

```
mobile/
  app/                  expo-router: (tabs) + (modules)/{auth,pos,stocks,profile}
  components/
    data/db/            WatermelonDB schema, models, migrations
    screens/            screen implementations (the tabs are thin wrappers)
    common/             PremiumUpgradeModal, SideDrawer, ...
  hooks/                useAuth, useOrders, useProducts, useUserPermissions, useWatermelonSync
  services/             sync, devicePresence, uploadQueue, notificationService, appConfig
  stores/               zustand: auth, business, cart, settings, syncRefresh, user
  locales/              en, si, ta

web/src/                same structure, Next.js App Router; adds app/api/ and __tests__/

supabase/migrations/    schema + RPCs (no functions/ directory)
docs/
  architecture.md       this file
  sync-architecture.md  sync deep-dive
  revenuecat/           billing integration: audit, build plan, store config
```
