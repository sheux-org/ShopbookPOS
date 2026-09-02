# Known Issues

Defect register for Shopbook POS. One row per issue, with the fix where one is known.

Compiled `dev` @ `f23870f`, 2026-09-01. Analysis lives in [`architecture.md`](./architecture.md), [`sync-architecture.md`](./sync-architecture.md) and [`revenuecat/`](./revenuecat/); this file is the actionable index.

**Status** — `open` (no fix written) · `fix-specified` (fix designed, not applied) · `decision-needed` (blocked on a product call) · `done`.

## Summary

| ID                  | Severity | Issue                                                     | Status                         |
| ------------------- | -------- | --------------------------------------------------------- | ------------------------------ |
| [SYNC-1](#sync-1)   | High     | Concurrent stock decrements silently lost                 | fix-specified                  |
| [SEC-1](#sec-1)     | High     | Hardcoded OTP `11111` grants an admin session             | open                           |
| [SEC-2](#sec-2)     | High     | Tenant isolation is a client-supplied parameter           | open                           |
| [RC-1](#rc-1)       | High     | Promotional-grant endpoint documented as v1; is v2        | fix-specified                  |
| [SEC-3](#sec-3)     | Medium   | RBAC is advisory — client-side only                       | open                           |
| [SYNC-2](#sync-2)   | Medium   | `lastPulledAt` discarded on push                          | fix-specified                  |
| [CFG-1](#cfg-1)     | Medium   | `app_config` store URLs are wrong                         | done (android; ios pending id) |
| [PRICE-1](#price-1) | Medium   | "Save 25%" is arithmetically 14.3%                        | decision-needed                |
| [PRICE-2](#price-2) | Medium   | Fabricated strike-through prices in the paywall           | done                           |
| [RC-2](#rc-2)       | Medium   | Webhook auth under-specified (signature vs shared header) | done (implemented)             |
| [SYNC-3](#sync-3)   | Low      | No periodic sync — foreground or sale only                | open                           |
| [SYNC-4](#sync-4)   | Low      | Peer broadcast fires only after a push                    | open                           |
| [MAINT-1](#maint-1) | Low      | Push RPC: 12 duplicated blocks, row-by-row loops          | open                           |
| [DOC-1](#doc-1)     | Low      | Broken reference link in config doc                       | fix-specified                  |

---

## SYNC-1 — Concurrent stock decrements silently lost {#sync-1}

**Severity:** High · **Status:** fix-specified · **Detail:** [`sync-architecture.md` §9](./sync-architecture.md)

**Where:** `supabase/migrations/20260603000000_secure_tenant_isolation.sql` (12 × `ON CONFLICT (id) DO UPDATE`), `mobile/hooks/useOrders.ts:181`

**Symptom:** Stock figures drift below reality. `orders` and `inventory_logs` stay correct, so nothing reconciles and the error compounds.

**Cause:** Two facts combine — every upsert is unconditional last-write-wins (grep for `WHERE EXCLUDED` across all migrations returns zero), and `stock_count` is pushed as an absolute value rather than a delta.

```
products.stock_count = 10
Till A sells 2 → pushes 8
Till B sells 3 → pushes 7
Server keeps whichever landed second → 8 or 7.   Correct: 5.
```

Also triggers with a single device: offline, sell, sync late → stale absolute count overwrites newer server state.

**Fix:**

1. _(migration only, ~12 edits)_ Append `WHERE EXCLUDED.updated_at > <table>.updated_at` to each upsert. Fixes stale-push clobbering. Does **not** fix true concurrency — both writes are newer, both pass. Postgres cannot patch a function body, so this is a full `CREATE OR REPLACE FUNCTION push_watermelondb_changes(...)` in a new migration.
2. _(schema + write path)_ Push a delta: `stock_count = <table>.stock_count + EXCLUDED.stock_delta`. Correct under concurrency. Touches `useOrders.ts`.
3. _(structural)_ Derive stock as a sum over `inventory_logs`, which is already written per line item. Removes `stock_count` as stored state; conflicts become unrepresentable.

**Recommendation:** apply (1) now — small, reversible, fixes the common case on its own. (2) is a product decision because it changes how sales are recorded.

## SEC-1 — Hardcoded OTP `11111` grants an admin session {#sec-1}

**Severity:** High · **Status:** open · **Detail:** [`architecture.md` §11.3](./architecture.md)

**Where:** `mobile/stores/useAuthStore.ts:68`, `web/src/stores/authStore.ts:63`, hint string at `web/src/app/auth/page.tsx:125`

**Symptom:** `login(phone, '11111')` returns `isLoggedIn: true` with `userRole: 'admin'` for any phone number, with no network call.

**Notes:** Known and deliberate as a test escape hatch. It grants **admin**, not merely access. The production login path is `useVerifyOtp`, which does call the OTP service; no UI call site was found for the mobile bypass (reachable via the `cartState` facade at `mobile/components/data/cartState.ts:91`). Web's auth page prints the code in an error hint.

**Fix (not applied):** gate on `__DEV__` / `NODE_ENV !== 'production'`, or delete and move the test fixture into the test suite (`web/src/__tests__/stores/authStore.test.ts` currently asserts the bypass works, so that test changes with it). Remove the hint string regardless.

**Do before store submission.** It ships in the bundle and is trivially discoverable by a reviewer.

## SEC-2 — Tenant isolation is a client-supplied parameter {#sec-2}

**Severity:** High · **Status:** open · **Detail:** [`architecture.md` §11.1](./architecture.md), [`sync-architecture.md` §8.1](./sync-architecture.md), `revenuecat/01-audit.md` P3-2

**Where:** all sync RPCs in `supabase/migrations/20260603000000_secure_tenant_isolation.sql`

**Symptom:** Anyone holding the public anon key (shipped in both client bundles) plus a `business_id` can pull or push another business's entire dataset.

**Cause:** Every RPC is `SECURITY DEFINER` (bypassing RLS) and `GRANT`ed to `anon`. Authorization is _"the caller passes `client_business_id`, and the function filters on it."_ The per-row assert prevents mixing tenants **within one call**; it does not establish entitlement to the tenant.

Every comparable open-source implementation derives the tenant from `auth.uid()` server-side instead.

**Fix:** requires real Supabase Auth sessions — a large change the phone/OTP model was built to avoid. Not scoped. Recorded so nobody assumes the entitlement work in `revenuecat/` makes the underlying data safe: it does not.

## RC-1 — Promotional-grant endpoint documented as v1; current API is v2 {#rc-1}

**Severity:** High · **Status:** fix-specified

**Where:** `docs/revenuecat/02-build-plan.md:223` (ops runbook step 3), and the single-key assumption in `docs/revenuecat/03-store-and-revenuecat-configuration.md` §4

**Symptom:** Following the runbook as written fails. This is the bank-transfer activation path — i.e. the entire non-store revenue channel.

**Cause:** The doc specifies `POST /v1/subscribers/{id}/entitlements/pro/promotional` with `duration: monthly|three_month|yearly`. The current documented endpoint is:

```
POST https://api.revenuecat.com/v2/projects/{project_id}/customers/{customer_id}/actions/grant_entitlement
Authorization: Bearer <v2 secret key>
{ "entitlement_id": "...", "expires_at": <ms since epoch> }
```

Requires permission `customer_information:customers:read_write`. **v1 keys are incompatible with v2** — verified against RevenueCat's API v2 reference via context7.

**Fix:** update the runbook step, and split `RC_SECRET_API_KEY` into a v1 key (webhook subscriber re-fetch) and a v2 key (ops grants) — or move the webhook to v2 as well and keep one. Config doc §4's "create a v1 secret API key" step needs the same change.

## SEC-3 — RBAC is advisory {#sec-3}

**Severity:** Medium · **Status:** open · **Detail:** [`architecture.md` §7, §11.4](./architecture.md)

**Where:** `mobile/hooks/useUserPermissions.ts`

**Symptom:** The admin/manager/cashier matrix is enforced only in the client. The server never receives a role and cannot enforce one — the same anon key and RPCs serve every role identically. A modified client, or a direct RPC call, ignores it.

**Fix:** blocked on SEC-2. Roles cannot be enforced server-side until the server knows who is calling.

## SYNC-2 — `lastPulledAt` discarded on push {#sync-2}

**Severity:** Medium · **Status:** fix-specified · **Detail:** [`sync-architecture.md` §8.3](./sync-architecture.md)

**Where:** `mobile/services/sync.ts:176`, `web/src/services/sync.ts`

**Symptom:** The server structurally cannot detect a write conflict — it has no idea what the client last saw.

**Cause:** WatermelonDB passes `{ changes, lastPulledAt }` to `pushChanges`; only `changes` is destructured. `lewiscasewell/Openweight` forwards it as a request parameter; this codebase drops it.

**Fix:** destructure and forward it as a third RPC argument. Cheap on its own, but only pays off alongside SYNC-1 option 1 or 2 — the guard is what would use it.

## CFG-1 — `app_config` store URLs are wrong {#cfg-1}

**Severity:** Medium · **Status:** done (Android) · **Detail:** [`architecture.md` §12](./architecture.md), `revenuecat/01-audit.md` P2-3

**Where:** `supabase/migrations/20260523000000_add_app_config.sql:6-7`

**Symptom:** The force-update screen's "Update now" deep links go nowhere.

```
android_url  https://play.google.com/store/apps/details?id=com.pasanpahasara.shopbookpos
             ↑ package mismatch — the app is lk.shopbook.pos
ios_url      https://apps.apple.com/app/id6470000000
             ↑ placeholder
```

**Fixed** in `supabase/migrations/20260901000000_revenuecat_entitlements.sql` (guarded UPDATE, only rewrites the known-bad value). iOS still waits on the real numeric App Store id.

## PRICE-1 — "Save 25%" is arithmetically 14.3% {#price-1}

**Severity:** Medium · **Status:** decision-needed · **Detail:** `revenuecat/01-audit.md` P1-8

**Where:** [the public pricing page](https://shopbook-pos-website.vercel.app/), and `mobile/app/(modules)/profile/premium-plans.tsx:54`

**Symptom:** The annual plan advertises "Save 25%". Against the monthly plan: `3,500 × 12 = 42,000` vs `36,000` = **Rs 6,000, or 14.3%**. The quarterly plan's "Save Rs. 2,000" is likewise really `3,500 × 3 − 10,000` = **Rs 500** (4.8%).

**Decision required before store prices are entered** — listings, website and paywall must agree:

- keep Rs 3,500/month and correct the copy to ~14%, **or**
- raise monthly to Rs 4,000, which makes 25% true (`4,000 × 12 = 48,000` → 36,000 = 25%).

## PRICE-2 — Fabricated strike-through prices in the paywall {#price-2}

**Severity:** Medium · **Status:** fix-specified · **Detail:** `revenuecat/01-audit.md` P1-2, build plan §5.5

**Where:** `mobile/app/(modules)/profile/premium-plans.tsx:28,41,52`

**Symptom:** `originalPrice: 'Rs. 5,000' / 'Rs. 12,000' / 'Rs. 48,000'` — prices that never existed. Apple 2.3.1 (misleading metadata) risk, plus consumer-law exposure.

**Fixed.** `originalPrice` is gone; savings are computed as `1 − perMonth / monthlyPerMonth` from live store prices in `premium-plans.tsx`. Nothing is displayed when the computed saving is zero or negative.

## RC-2 — Webhook auth under-specified {#rc-2}

**Severity:** Medium · **Status:** fix-specified

**Where:** `docs/revenuecat/02-build-plan.md` §4, step 1

**Symptom:** The plan makes a shared `Authorization` header the primary check and mentions HMAC only parenthetically.

**Cause / correct spec:** RevenueCat sends `X-RevenueCat-Webhook-Signature: t=<unix>,v1=<hmac-sha256>`. Verification is HMAC-SHA256 over `"{timestamp}.{raw_body}"` with the integration signing secret, constant-time compared, ±5 min tolerance, **computed over raw bytes before JSON parsing**.

**Fixed in code.** `supabase/functions/revenuecat-webhook/index.ts` verifies the HMAC when `RC_WEBHOOK_SIGNING_SECRET` is set and falls back to the shared header otherwise, both through a timing-safe compare. The build-plan doc still describes the old approach.

## SYNC-3 — No periodic sync {#sync-3}

**Severity:** Low · **Status:** open · **Detail:** [`sync-architecture.md` §2](./sync-architecture.md)

**Symptom:** A terminal that stays foregrounded and makes no sales never syncs. Despite the comment at `mobile/app/(tabs)/_layout.tsx:15` describing "periodic background sync", nothing polls on an interval.

**Fix:** not specified. An interval timer is the obvious move; whether it's wanted depends on battery and data cost for the target market.

## SYNC-4 — Peer broadcast fires only after a push {#sync-4}

**Severity:** Low · **Status:** open · **Detail:** [`sync-architecture.md` §6](./sync-architecture.md)

**Symptom:** A terminal that only pulls notifies nobody. Delivery is also best-effort — a backgrounded device misses the event and waits for its next foreground.

**Fix:** not specified. Acceptable given the foreground trigger covers most cases.

## MAINT-1 — Push RPC duplication and row-by-row loops {#maint-1}

**Severity:** Low · **Status:** open · **Detail:** [`architecture.md` §11.5](./architecture.md), [`sync-architecture.md` §5](./sync-architecture.md)

**Symptom:** `push_watermelondb_changes` is ~640 lines of `IF/ELSIF` with byte-identical `created` and `updated` upserts per table — **12 duplicate blocks**. Any change to push semantics (including SYNC-1's fix) is a 12-site edit. Row-by-row `FOR ... LOOP` rather than set-based `INSERT ... SELECT FROM json_array_elements(...)` also makes large first-syncs slow.

**Fix:** not specified. Worth folding into whichever change touches this function next, rather than as standalone work.

## DOC-1 — Broken reference link {#doc-1}

**Severity:** Low · **Status:** fix-specified

**Where:** `docs/revenuecat/03-store-and-revenuecat-configuration.md:115`

`admbtlr/reams` default branch is `master`, not `main` — the `/blob/main/` URL 404s. The other three cited reference implementations resolve (verified 200). `feeddeck/feeddeck` is worth adding as a fourth: it is the most mature Supabase+RevenueCat webhook found on GitHub.

---

## Verification notes

Claims here were checked against the tree rather than inherited from prior analysis:

- 12 `ON CONFLICT (id) DO UPDATE` blocks; `grep -c "WHERE EXCLUDED"` across all migrations and `supabase_migration.sql` returns **0** for every file.
- `react-native-purchases@10.8.1` is current on npm (published 2026-08-27), peer `react-native >= 0.73` — compatible with RN 0.81.5.
- RevenueCat v2 `grant_entitlement` shape and webhook signature scheme confirmed via context7 against RevenueCat's own API reference.
- Cited GitHub reference files probed with `curl -o /dev/null -w "%{http_code}"`: three 200, one 404 (DOC-1).
