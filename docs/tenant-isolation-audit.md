# Multi-Tenant Isolation Audit

Shopbook POS — `mobile/` (Expo), `web/` (Next.js), Supabase project `zsuxkwzcyulnlhkignrh`.
Audited 2026-09-08 against branch `feat/account-deletion` @ `d842c6b` and the **live production database**.

Every claim below is grounded in a file path with a line number or a named database object. Findings
marked **verified live** were reproduced against production with nothing but the public anon key from
`mobile/.env`; all live probes were read-only. Destructive steps were reasoned about from the function
bodies and reachability-probed, but deliberately **not executed** — those are labelled as such.

No merchant personal data is reproduced here. Counts and record shapes only.

---

## Verdict

**An attacker who holds only the public anon key — which ships inside both app bundles and is
extractable from any installed APK, IPA or the web page source in minutes — can today read the entire
database of every merchant on the platform. They need nothing else. There is no second factor to
acquire, nothing to guess and nothing to brute-force.**

The reason is a single table. `public.active_devices` carries the RLS policy
`FOR SELECT USING (true)` (`supabase/migrations/20260603000000_secure_tenant_isolation.sql:631`), so
one unauthenticated `GET /rest/v1/active_devices?select=*` returns every row. Those rows contain
`business_id`. That is the complete tenant directory — verified live: **82 rows, all 12 business ids on
the platform, 100% coverage.** The `business_id` is itself a cryptographically strong 16-character
WatermelonDB id (~95 bits of entropy, unguessable in principle); that strength is irrelevant, because
the platform publishes the full list.

With an id in hand, `pull_watermelondb_changes(0, <id>)` is `SECURITY DEFINER`, granted to `anon`, and
authorises the caller purely by the fact that they typed the id. Verified live against one real
merchant: **1 business record, 4 employee records, 33 products, 101 orders, 223 order items, 271
inventory logs**, including business address, tax id, owner phone, and every employee's name, phone
number, email and role. Repeat for the other 11 ids and the platform's entire dataset is on the
attacker's disk.

The same key writes as well as reads. `push_watermelondb_changes` carries identical authorisation, so
the attacker can rewrite prices, fabricate or delete sales, and empty a shop's catalogue. And the new
`delete_account` RPC, combined with the anon-callable `get_or_create_owner`, forms a chain that
**permanently destroys a merchant's entire account and all its data** — no OTP is verified server-side
at any point.

**What they additionally need to reach another merchant's data: nothing.** The honest answer to the
question "how hard is the second factor to get" is that there is no second factor. `docs/known-issues.md`
SEC-2 describes this as "anyone holding the public anon key **plus a `business_id`**" — the "plus" is
doing work it cannot do, because the platform hands out the `business_id` list for free.

This is not a theoretical weakness. It is a live, unauthenticated, full-database compromise, and it is
reachable from `curl`.

---

## Findings

| ID | Severity | Issue | Evidence |
|---|---|---|---|
| [TEN-1](#ten-1) | **Critical** | `active_devices` is world-readable and publishes the complete tenant directory plus staff PII, GPS and push tokens | `20260603000000_secure_tenant_isolation.sql:631`; `pg_policies` on `public.active_devices` |
| [TEN-2](#ten-2) | **Critical** | `pull_watermelondb_changes` returns any tenant's full dataset to anon on request | `20260603000000_secure_tenant_isolation.sql:39-93,600` |
| [TEN-3](#ten-3) | **Critical** | `push_watermelondb_changes` grants any tenant full write/delete to anon on request | `20260603000000_secure_tenant_isolation.sql:96-601` |
| [TEN-4](#ten-4) | **Critical** | `get_or_create_owner` + `delete_account` chain permanently destroys any merchant account, unauthenticated | `20260908000000_account_deletion.sql:38-94`; `20260901000000_revenuecat_entitlements.sql:103-125` |
| [TEN-5](#ten-5) | **High** | `check_phone_registered` / `check_synced_account` / `fetch_user_businesses` are a pre-auth phone→tenant+PII oracle over an enumerable keyspace | `20260604000000_fetch_user_businesses.sql:4-52`; `public.check_phone_registered` |
| [TEN-6](#ten-6) | **High** | `active_devices` and `device_session_revocations` are world-**writable**: forge devices, harvest/replace push tokens, force-logout every till | `20260603000000_secure_tenant_isolation.sql:635-643`; `20260606000000_device_session_revocations.sql:13-22` |
| [TEN-7](#ten-7) | **High** | Realtime presence and sync channels are public topics keyed by `business_id`; no Realtime Authorization configured | `mobile/services/devicePresence.ts:100-101,187`; `mobile/services/sync.ts:187`; zero policies on `realtime.messages` |
| [TEN-8](#ten-8) | **Medium** | Paywall bypass: `get_entitlement` trusts a client-supplied `business_id`, and `is_owner` a client-supplied phone | `public.get_entitlement`; `mobile/stores/useEntitlementStore.ts:91` |
| [TEN-9](#ten-9) | **Medium** | RBAC is client-side only and fails **open** to `admin` | `mobile/hooks/useUserPermissions.ts:34` |
| [TEN-10](#ten-10) | **Medium** | One unpartitioned local SQLite DB accumulates every business the device has opened | `mobile/components/data/db/index.native.ts:16-31`; `mobile/hooks/useBusinessSwitchSync.ts:30` |
| [TEN-11](#ten-11) | **Medium** | `log_paywall_event` is an unauthenticated unbounded INSERT against any `business_id` | `20260904000000_hard_paywall_store_trial.sql:135` |
| [TEN-12](#ten-12) | **Medium** | UploadThing route has no auth middleware; `DELETE` accepts an arbitrary `fileKey` | `web/src/app/api/uploadthing/route.ts:10,21-28` |
| [TEN-13](#ten-13) | **Low** | `app_config` is world-readable (by design) but the same `GRANT` pattern gives anon table privileges everywhere | `information_schema.role_table_grants` |
| [TEN-14](#ten-14) | **Info** | `get_auth_business_id()` is dead code — it reads `auth.jwt()`, which is always null | `public.get_auth_business_id` |
| [TEN-15](#ten-15) | **Info** | Secrets inventory: no genuinely-secret value ships in a client bundle | `mobile/.env`, `web/.env` |

---

## RLS and privilege baseline

All 14 tables in `public` have `rowsecurity = true`. That is not the same as being protected. The
actual posture, from `pg_policies` and `information_schema.role_table_grants`:

| Table | Policies | Effective anon access via PostgREST |
|---|---|---|
| `active_devices` | SELECT/INSERT/UPDATE/DELETE, all `USING (true)`, role `public` | **full read + write + delete** |
| `device_session_revocations` | SELECT/INSERT/UPDATE/DELETE, all `USING (true)`, role `public` | **full read + write + delete** |
| `app_config` | SELECT `USING (true)`, role `public` | read-only |
| `products` | INSERT/UPDATE `WITH CHECK (true)` — role `authenticated` only | none (clients are `anon`) |
| `businesses`, `employees`, `orders`, `order_items`, `inventory_logs`, `deleted_records`, `owners`, `subscriptions`, `subscription_events`, `paywall_events` | **none** | none |

Two things matter here.

First, the ten tables with zero policies are genuinely closed to direct table access. Verified live:
`GET /rest/v1/businesses?select=id` with the anon key returns `200 []`, not the 12 rows that exist.
RLS is doing its job on that path.

Second, that protection is bypassed entirely by the RPC layer. Every function in `public` is
`SECURITY DEFINER` except `normalize_phone_pg` and `set_server_updated_at`, and every one of them is
`GRANT EXECUTE`ed to `anon`. `SECURITY DEFINER` runs as `postgres`, so RLS does not apply. The tables
are locked and the RPCs are the unlocked door beside them.

Note also that `anon` and `authenticated` hold `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE,
UPDATE` on *every* table including `businesses` and `owners`. Today only RLS stands between `anon` and
those tables. Anyone who later adds a permissive policy for convenience — or runs
`ALTER TABLE ... DISABLE ROW LEVEL SECURITY` while debugging — instantly exposes the table with no
further change. The grants should be revoked so that RLS is the second line of defence rather than the
only one.

### The anon key

Decoded claims: `{"iss":"supabase","role":"anon","iat":1779167572,"exp":2094743572}` — valid until
**2036**. It is `EXPO_PUBLIC_`/`NEXT_PUBLIC_` prefixed in `mobile/.env` and `web/.env`, so it is
compiled into the JS bundle by design. This is correct and normal: the anon key is *meant* to be
public. The security model assumes RLS or a server-side identity behind it. Neither exists here.

---

## TEN-1 — `active_devices` publishes the complete tenant directory {#ten-1}

**Severity: Critical · verified live**

### What it is

`public.active_devices` has RLS enabled and then four policies that switch it straight back off:

```sql
-- supabase/migrations/20260603000000_secure_tenant_isolation.sql:627-643
ALTER TABLE public.active_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select" ON public.active_devices FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.active_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.active_devices FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.active_devices FOR DELETE USING (true);
```

The role is `public`, which includes `anon`. `USING (true)` is not a filter.

The table's every column is readable, and the column list is the problem:

```
id, business_id, employee_id, employee_name, role, device_id, device_model,
battery_level, is_online, latitude, longitude, location_name, last_active_at, push_token
```

### Exploit path

1. Extract the anon key from the shipped bundle (or read it out of the web page source).
2. `curl "https://<ref>.supabase.co/rest/v1/active_devices?select=*" -H "apikey: <anon>"`.
3. Read `business_id` off every row.

**Verified live.** The request returns HTTP 200 and 82 rows. Distinct `business_id` values: **12**.
`SELECT count(*) FROM businesses` is **12**. The table leaks *every tenant on the platform*, with no
sampling gap.

Beyond the tenant directory, the same single request returned, across those 82 rows:

| Field | Non-null | Why it matters |
|---|---|---|
| `employee_name` | 82/82 | Staff roster of every merchant, by name |
| `role` | 82/82 | `owner`, `admin`, `manager`, `cashier` — tells an attacker which staff member to target |
| `device_model` + `device_id` | 82/82 | Device fingerprinting |
| `location_name` | 81/82 | Named place per till |
| `latitude`/`longitude` | 19/82 | **Precise GPS coordinates of staff devices** |
| `push_token` | 20/82 | **Expo push tokens** |

The push tokens deserve emphasis. Expo's push API accepts a token and a message from anyone — it
requires no credential tied to the app. Twenty harvested tokens are twenty devices to which an attacker
can send arbitrary, perfectly native-looking notifications ("Your Shopbook subscription failed, tap to
re-enter card details"). That is a ready-made phishing channel against known named staff at known
businesses at known GPS coordinates.

### Fix

**Cheap. This is the single highest-value change in this document and it does not require touching the
auth model.** Drop the four `USING (true)` policies. The table is only ever accessed with a
`business_id` already in hand (`mobile/services/devicePresence.ts:238,246,495`), so nothing in the app
needs a global read. Until the caller's tenant can be derived server-side (TEN-2), replace the direct
table access with a `SECURITY DEFINER` RPC that takes `business_id` — which is no worse than the rest
of the system and is dramatically better than publishing the directory. Also `REVOKE` the blanket
table grants from `anon`.

Removing this one table's read policy converts the platform from "fully compromised by anyone" to
"compromised by anyone who can obtain a business id" — still bad (TEN-2 through TEN-5), but no longer
a self-service breach.

---

## TEN-2 — `pull_watermelondb_changes` returns any tenant's dataset on request {#ten-2}

**Severity: Critical · verified live**

### What it is

The function is `SECURITY DEFINER`, granted to `anon`, and its only authorisation check is that the
parameter is non-empty:

```sql
-- supabase/migrations/20260603000000_secure_tenant_isolation.sql:39-49
CREATE OR REPLACE FUNCTION pull_watermelondb_changes(last_pulled_at bigint, client_business_id text)
RETURNS json
SECURITY DEFINER
AS $$
...
  IF client_business_id IS NULL OR client_business_id = '' THEN
    RAISE EXCEPTION 'Unauthorized: client_business_id must be provided.';
  END IF;
```

```sql
-- :600
GRANT EXECUTE ON FUNCTION public.pull_watermelondb_changes(bigint, text) TO anon, authenticated;
```

Every subsequent query filters on `... AND business_id = client_business_id`. The filter is correct —
it will not mix tenants. It simply has no bearing on whether the caller is entitled to the tenant they
named. The word `Unauthorized` in that exception is checking that a parameter was supplied.

The client is explicit that it believes this is sufficient:

```ts
// mobile/services/sync.ts:110
// Client runs anonymously with anon key. Authentication is enforced at the RPC layer by passing client_business_id.
```

Passing a parameter is not authentication. `web/src/services/sync.ts:110` carries the same comment.

### Exploit path

1. Harvest ids via TEN-1.
2. `POST /rest/v1/rpc/pull_watermelondb_changes` with `{"last_pulled_at":0,"client_business_id":"<id>"}`
   and the anon key. `last_pulled_at: 0` means "give me everything since the epoch".
3. Loop over all 12 ids.

**Verified live** against one real merchant. HTTP 200, and the response contained:

```
businesses:     created=0   updated=1    deleted=0
employees:      created=2   updated=2    deleted=5
products:       created=4   updated=29   deleted=0
orders:         created=98  updated=3    deleted=0
order_items:    created=223 updated=0    deleted=0
inventory_logs: created=271 updated=0    deleted=0
```

Field lists returned (from the live response, values withheld):

- **businesses** — `id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at`
- **employees** — `id, business_id, name, role, phone, email, created_at, updated_at`
- **orders** — `id, business_id, invoice_number, total_amount, status, payment_method, bank_name, card_last_four, discount_type, discount_value, tax_rate, tax_value, created_at, updated_at`

That is the merchant's registered address and tax id, the full name/phone/email of every employee, and
a complete itemised sales ledger including payment method, bank name and card last-four. Under Sri
Lanka's PDPA — and under Apple's and Google's data-handling requirements — this is a reportable
personal-data breach affecting every merchant and every employee on the platform.

### Fix

**Expensive — this is the one that needs the auth model replaced.** The correct shape is that the
server derives the tenant, and `client_business_id` stops being a parameter at all:

```sql
WHERE business_id = (SELECT business_id FROM public.employees
                     WHERE user_id = auth.uid())
```

That requires a real Supabase Auth session, which the phone/OTP design was chosen to avoid.

Two routes, honestly costed:

1. **Supabase Auth with phone OTP.** Supabase natively supports phone OTP sign-in. It replaces the
   external `mini-pos-sync-server.vercel.app` service, gives every client a real JWT and a stable
   `auth.uid()`, and makes `auth.uid()`-based RLS work everywhere. This is the right end state and it
   deletes the entire class of finding. Cost: significant — auth screens, session lifecycle, token
   refresh, offline session handling, a migration mapping existing phones to auth users, and RLS
   policies on all 14 tables. Weeks, not days.
2. **Keep the external OTP service; have it mint a Supabase JWT.** The service already verifies the
   phone. Give it the project's JWT secret and have it issue a signed Supabase token carrying
   `business_id` (and `role`) as a custom claim. RLS then reads
   `auth.jwt() ->> 'business_id'`, and the RPCs derive the tenant from the claim instead of a
   parameter. This preserves the existing OTP UX and is materially cheaper than route 1, at the cost
   of the JWT secret living in a second system.

Route 2 is the pragmatic pre-launch move; route 1 is where this should end up.

**Interim mitigation, cheap and worth doing this week:** TEN-1's fix removes the free id directory, and
TEN-5's fix removes the phone→id oracle. Neither makes the RPCs safe, but together they mean an
attacker must already know a specific merchant's `business_id` — which downgrades "scrape the whole
platform in one script" to "targeted attack against a merchant you already have inside knowledge of".
Do not mistake this for a fix; it is a delay.

---

## TEN-3 — `push_watermelondb_changes` grants write and delete on the same terms {#ten-3}

**Severity: Critical · reachability verified live; destructive step deliberately not executed**

### What it is

Identical authorisation to TEN-2 — a non-empty check and nothing else:

```sql
-- supabase/migrations/20260603000000_secure_tenant_isolation.sql:96-108
CREATE OR REPLACE FUNCTION push_watermelondb_changes(changes json, client_business_id text)
RETURNS void
SECURITY DEFINER
AS $$
...
  IF client_business_id IS NULL OR client_business_id = '' THEN
    RAISE EXCEPTION 'Unauthorized: client_business_id must be provided.';
  END IF;
```

```sql
-- :601
GRANT EXECUTE ON FUNCTION public.push_watermelondb_changes(json, text) TO anon, authenticated;
```

The function contains 12 per-table "Security assert" blocks (`:130, :163, :205, :234, :272, :317,
:371, :412, :462, :491, :531, :565`), each of the form:

```sql
-- :205
IF (r->>'business_id') != client_business_id THEN
  RAISE EXCEPTION 'Unauthorized employee push';
END IF;
```

These are worth reading precisely, because they look like authorisation and are not. They compare a
row's tenant against **the same value the caller supplied in the same request**. They guarantee
internal consistency — you cannot smuggle a row for tenant B into a push declared for tenant A. An
attacker declaring tenant B and pushing rows for tenant B satisfies every assert.

The deletes are equally reachable:

```sql
-- :194
DELETE FROM businesses WHERE id IN (SELECT json_array_elements_text(deleted_ids)) AND id = client_business_id;
-- :261
DELETE FROM employees WHERE id IN (...) AND business_id = client_business_id;
-- :360
DELETE FROM products WHERE id IN (...) AND business_id = client_business_id;
-- :451
DELETE FROM orders WHERE id IN (...) AND business_id = client_business_id;
```

### Exploit path

1. Harvest ids (TEN-1) and pull the tenant's data (TEN-2) to learn the real row ids.
2. `POST /rest/v1/rpc/push_watermelondb_changes` with a `changes` payload naming that tenant.

Worst outcomes, all reachable with the anon key alone:

- **Financial fraud.** Rewrite `products.price` and `cost_price`; the tills pull the change on next
  sync and start charging the attacker's prices.
- **Books manipulation.** Insert fabricated `orders` and `order_items`, or delete real ones. Since
  `deleted_records` tombstones propagate, the deletion reaches every till.
- **Inventory destruction.** Overwrite `stock_count` platform-wide.
- **Staff account takeover.** `employees` rows carry `phone` and `role`. Rewriting an employee's phone
  to the attacker's, or promoting a `cashier` to `admin`, is a plain push — and since login is
  phone-based (TEN-5), rewriting the phone hands the attacker a legitimate login.

Compounding this: `docs/known-issues.md` SYNC-1 records that every upsert is unconditional
last-write-wins with no `WHERE EXCLUDED.updated_at > ...` guard (`grep -c "WHERE EXCLUDED"` across all
migrations returns 0). A malicious push always wins; there is no staleness check to trip over.

I did not execute a push. The RPC is reachable by `anon` (proven for its read twin under identical
grants, and the grant is verified in `pg_proc.proacl`: `anon=X/postgres`), and the function body above
is the live definition. That is sufficient evidence; running it against production merchant data would
not have been.

### Fix

Same as TEN-2 — the tenant must be derived server-side. Same cost. Until then, the asserts should be
understood as consistency checks and never cited as authorisation. Independently, add the
`WHERE EXCLUDED.updated_at > <table>.updated_at` guards from SYNC-1 (cheap, ~12 edits, one new
migration) — that fixes silent data loss on its own and is worth doing regardless.

---

## TEN-4 — `get_or_create_owner` + `delete_account` destroys any account, unauthenticated {#ten-4}

**Severity: Critical · both RPCs reachability-verified live; destructive step deliberately not executed**

This is the newest code in the repo (`d842c6b`, 2026-09-08) and it is the most dangerous, because its
outcome is irreversible.

### What it is

`delete_account` authorises by requiring that a `business_id` and a phone resolve to the same owner:

```sql
-- supabase/migrations/20260908000000_account_deletion.sql:63-85
  SELECT o.* INTO owner_row
  FROM public.owners o
  WHERE o.phone = normalized;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no account matches that phone';
  END IF;

  -- The supplied business must belong to the phone that was verified.
  -- Without this check any known business id would delete any account.
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = input_business_id
      AND public.normalize_phone_pg(b.phone_number) = normalized
  ) THEN
    RAISE EXCEPTION 'that shop is not registered to this phone';
  END IF;
```

The comment says "the phone that was verified". **Nothing in this function, or anywhere server-side,
verifies the phone.** It is a string in the request body. The check establishes that the two supplied
values are mutually consistent — exactly the same category error as the TEN-3 asserts. And both values
are obtainable: `businesses.phone_number` is one of the fields TEN-2 returns.

The migration's own header states the trust model explicitly:

```sql
-- :18-22
--    Both the business id and the phone must be supplied and must resolve to
--    the same owner. That is the same trust bar as push_watermelondb_changes,
--    which already lets anyone holding a business id rewrite or empty the
--    shop; this adds no reach that an attacker did not already have, and the
--    client only calls it after a fresh OTP verification.
```

The reasoning is internally consistent but rests on two premises that do not hold. "The client only
calls it after a fresh OTP verification" is true of the app (`mobile/services/account.ts:18`) and
irrelevant to `curl` — the server cannot tell the difference. And "adds no reach that an attacker did
not already have" understates it: `push` lets an attacker empty a shop's *rows*, which resync
partially and are recoverable from other devices' local copies; `delete_account` removes the
`businesses` row, every cascade beneath it, the `owners` row, and the `deleted_records` tombstones that
would tell other devices what happened. It is a different order of harm.

### The precondition is attacker-satisfiable

The one thing that might have limited this is the `owners` lookup: `SELECT count(*) FROM owners`
currently returns **1**, so for 11 of the 12 businesses the function would raise "no account matches
that phone".

That protection does not survive contact, because `get_or_create_owner` is also `SECURITY DEFINER`,
also granted to `anon`, and its entire job is to create the missing row:

```sql
-- supabase/migrations/20260901000000_revenuecat_entitlements.sql:103-125
CREATE OR REPLACE FUNCTION public.get_or_create_owner(input_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
...
  INSERT INTO public.owners (phone) VALUES (clean)
  ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
  RETURNING id INTO result_id;
...
GRANT EXECUTE ON FUNCTION public.get_or_create_owner(text) TO anon, authenticated;
```

An unauthenticated caller mints the `owners` row for any phone they choose, then deletes the account.

### Exploit path

1. `GET /rest/v1/active_devices?select=business_id` → a victim `business_id` (TEN-1).
2. `POST /rpc/pull_watermelondb_changes {"last_pulled_at":0,"client_business_id":"<id>"}` → the
   `businesses` record, which includes `phone_number` (TEN-2, verified live).
3. `POST /rpc/get_or_create_owner {"input_phone":"<that phone>"}` → creates the `owners` row.
4. `POST /rpc/delete_account {"input_business_id":"<id>","input_phone":"<that phone>"}`.

Note step 4's blast radius is wider than the id supplied. The function collects **every** business
sharing that phone:

```sql
-- :87-89
  SELECT array_agg(b.id) INTO target_ids
  FROM public.businesses b
  WHERE public.normalize_phone_pg(b.phone_number) = normalized;
```

A multi-branch merchant loses every branch from one call. Cascades then take `employees`, `orders`,
`order_items`, `products`, `inventory_logs` and `subscriptions`; `active_devices`,
`device_session_revocations` and `deleted_records` are cleared explicitly (`:83-93`). There is no soft
delete and no undo.

**Verified live (non-destructive):** `POST /rpc/delete_account` with a non-existent id and phone
returns HTTP 400 `{"code":"P0001","message":"no account matches that phone"}` — a *business-logic*
error, not `401`/`403`/`42501`. The anon caller reached the function body. That is the whole finding.
Steps 3 and 4 against real data were not run.

### Fix

**Cheap and urgent, independent of the auth model.** Three options, best first:

1. **`REVOKE EXECUTE ON FUNCTION public.delete_account(text, text) FROM anon;`** and move the call to a
   Supabase Edge Function that verifies a fresh OTP against the auth service using the service-role
   key. One migration plus a small function. This is the correct shape and is a day of work.
2. Require a server-verified one-time deletion token: the client verifies OTP, the auth service stores
   a short-lived token, `delete_account` takes it and consumes it. Also a day, and keeps the flow in
   the DB.
3. At absolute minimum before launch, if neither can ship: revoke `anon` execute and gate deletion
   behind a manual support request. Google Play requires an in-app *initiation* path, not an
   unauthenticated in-database purge.

Also `REVOKE` `get_or_create_owner` from `anon`. It is called from
`mobile/services/entitlement.ts:31` on owner login and has no business being an unauthenticated
write primitive — quite apart from its role here, it lets anyone insert unbounded rows into `owners`.

---

## TEN-5 — Phone→tenant oracle, pre-auth, over an enumerable keyspace {#ten-5}

**Severity: High · verified live**

### What it is

Three `SECURITY DEFINER` functions granted to `anon` map a phone number to tenant identity and PII.

`fetch_user_businesses(input_phone)` returns full business and employee records:

```sql
-- supabase/migrations/20260604000000_fetch_user_businesses.sql:20-45
    SELECT id, business_id, name, role, phone, email, created_at, updated_at
    FROM public.employees
    WHERE public.normalize_phone_pg(phone) = clean_input
...
    SELECT id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at
    FROM public.businesses
    WHERE public.normalize_phone_pg(phone_number) = clean_input
       OR id IN (SELECT business_id FROM public.employees WHERE public.normalize_phone_pg(phone) = clean_input)
```

```sql
-- :55
GRANT EXECUTE ON FUNCTION public.fetch_user_businesses(text) TO anon, authenticated;
```

`check_phone_registered(input_phone, ...)` returns tenant identity and the caller's role:

```sql
-- live definition, public.check_phone_registered
    RETURN json_build_object(
      'exists', true, 'type', 'owner', 'role', 'admin', 'name', 'Owner / Admin',
      'business_id', matched_biz.id, 'business_name', matched_biz.name);
...
    RETURN json_build_object(
      'exists', true, 'type', 'employee', 'role', matched_emp.role, 'name', matched_emp.name,
      'employee_id', matched_emp.id, 'business_id', matched_emp.business_id,
      'business_name', matched_emp.business_name);
```

`check_synced_account(input_phone)` is a thin wrapper over it.

These are called **before** OTP, from the phone-entry screen (`mobile/app/(modules)/auth/number-input.tsx:67`
sits alongside the same flow), so they are pre-auth by design.

### Exploit path

Sri Lankan mobile numbers are `07XXXXXXXX` — roughly 10 live prefixes × 10⁶, so on the order of **10⁷
candidates**. At a modest 50 req/s that is under three days, and it parallelises trivially. There is no
rate limiting visible in these functions and PostgREST applies none by default.

For each hit the attacker receives, unauthenticated: `business_id`, `business_name`, the person's real
`name`, their `role`, their `employee_id`, and — via `fetch_user_businesses` — the business `address`,
`tax_id`, and every colleague's `name`, `phone` and `email`.

This is a second, independent route to the `business_id` that TEN-2 and TEN-3 need. Even after TEN-1 is
fixed, this oracle keeps the attack alive; both must be closed.

**Verified live:** all three return HTTP 200 to the anon key. Probed with a non-existent number
(`0700000001` → `{"exists": false}` / `{"businesses": [], "employees": []}`) specifically so as not to
retrieve real merchant PII.

### Fix

**Moderate.** The login flow legitimately needs "is this phone registered". It does not need the answer
before the phone is proven.

- Reduce `check_phone_registered`'s pre-auth response to a bare boolean. Return `business_id`, `role`,
  `name` and `employee_id` only **after** OTP verification. Cheap — one migration plus a small client
  change on each side.
- `fetch_user_businesses` should not be callable pre-auth at all; it is a post-login business-picker
  query. Gate it the same way, and drop `address`, `tax_id` and colleagues' `email`/`phone` from its
  projection unless a screen actually renders them.
- Add rate limiting on the auth path regardless — the external OTP service should be throttling by IP
  and by phone, and that is worth confirming (it lives outside this repo; **unverified** here).

---

## TEN-6 — Device presence and session revocation are world-writable {#ten-6}

**Severity: High · verified live (read side); write side follows from the policies**

### What it is

Both tables carry the full `USING (true)` set for role `public`:

```sql
-- supabase/migrations/20260603000000_secure_tenant_isolation.sql:635-643  (active_devices)
CREATE POLICY "Allow public insert" ON public.active_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.active_devices FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.active_devices FOR DELETE USING (true);
```

```sql
-- supabase/migrations/20260606000000_device_session_revocations.sql:13-22
CREATE POLICY "Allow public select" ON public.device_session_revocations FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.device_session_revocations FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.device_session_revocations FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.device_session_revocations FOR DELETE USING (true);
```

`device_session_revocations` is the mechanism by which an owner kicks a lost or stolen till off the
system. The client reads it at `mobile/services/devicePresence.ts:206-209` and writes at `:286`.

### Exploit path

With the anon key and a harvested `business_id`:

- **Force-logout the entire shop.** `INSERT` a revocation row per `device_id` (all of which are
  readable from `active_devices`). Every till in the business logs out. Repeat on a loop and the
  merchant cannot trade. For a POS, denial of service *is* revenue loss, in real time, during trading
  hours.
- **Defeat revocation.** `DELETE` the rows an owner just inserted. A genuinely stolen device stays
  authorised, and the owner has no way to tell the kick did not take.
- **Replace push tokens.** `UPDATE active_devices SET push_token = '<attacker token>'` — or insert
  fabricated device rows. Combined with the token harvesting in TEN-1, an attacker controls both ends
  of the notification channel and the owner's "Active Devices" screen
  (`mobile/app/(modules)/profile/active-devices.tsx`) shows whatever the attacker wrote.
- **Erase the audit trail.** `DELETE FROM active_devices` removes the only record of which device did
  what.

**Verified live:** `GET /rest/v1/device_session_revocations?select=business_id` returns HTTP 200 and 3
rows to the anon key, confirming the `public` role reaches the table. The write policies are read
directly from `pg_policies` and the migration above; I did not execute writes against production.

### Fix

**Cheap.** Same shape as TEN-1: drop the `USING (true)` policies on both tables, revoke the blanket
grants, and route both through `SECURITY DEFINER` RPCs keyed on `business_id` until the auth model
lands. Revocation in particular should be an owner/admin-only operation, which is not expressible at
all until TEN-9 is fixed.

---

## TEN-7 — Realtime channels are public topics keyed by `business_id` {#ten-7}

**Severity: High · configuration verified live; live subscription not attempted**

### What it is

The presence channel name is the tenant id:

```ts
// mobile/services/devicePresence.ts:100-101
export function getDevicesChannelName(businessId: string): string {
  return `devices:${businessId}`;
}
```

```ts
// mobile/services/devicePresence.ts:187
channel = supabase.channel(getDevicesChannelName(businessId), {
  config: {
    presence: { key: deviceId, enabled: true },
  },
});
```

There is no `config: { private: true }` anywhere in either client — `grep -rn "private: true"` across
`mobile/` and `web/` returns nothing. And `pg_policies` for schema `realtime` returns **zero rows**, so
Supabase Realtime Authorization is not configured either. Both halves of the private-channel mechanism
are absent, which makes these public topics: any client with the anon key may join any topic name it
can spell.

The sync-trigger channel has the same shape — `mobile/services/sync.ts:187` and
`web/src/services/sync.ts:192` both use `` .channel(`sync:${activeBusinessId}`) ``.

### Exploit path

1. Harvest `business_id` (TEN-1).
2. `supabase.channel('devices:<victim id>')` and subscribe.
3. Receive the victim's live presence state — staff names, roles, device models, battery, GPS and push
   tokens — updating in real time as staff clock in and move.

Worse, the revoke listener trusts any broadcast on the topic:

```ts
// mobile/services/devicePresence.ts:194-200
channel.on('broadcast', { event: SESSION_REVOKE_EVENT }, ({ payload }) => {
  const data = payload as { targetDeviceId?: string } | null;
  if (data?.targetDeviceId) {
    revokeListeners.forEach((listener) => listener(data.targetDeviceId!));
  }
});
```

There is no check on who sent it. An attacker joined to `devices:<victim>` sends a
`SESSION_REVOKE_EVENT` naming each `device_id` and logs the shop out — the same DoS as TEN-6, but
without even needing a table write, and leaving no row behind as evidence.

I confirmed the configuration (no `private: true`, no `realtime` policies) but did not open a WebSocket
against production to demonstrate the subscription. **Partially unverified** on that specific point:
what would settle it conclusively is a single `supabase.channel('devices:<id>').subscribe()` from an
anon client, which should be run in a staging environment rather than against live merchants.

### Fix

**Cheap.** Supabase supports private channels: set `config: { private: true }` on every
`supabase.channel(...)` call and add RLS policies on `realtime.messages` restricting the topic to the
caller's tenant. The catch is that the policy needs to know the caller's tenant — so the full fix is
gated on TEN-2's auth work, exactly as SEC-3 is. What *can* be done now, cheaply, is to stop trusting
the broadcast payload: treat the realtime revoke as a hint that triggers a re-read of
`device_session_revocations`, rather than as an instruction to act on.

---

## TEN-8 — Paywall bypass via client-supplied identifiers {#ten-8}

**Severity: Medium · reachability verified live**

`get_entitlement(client_business_id, client_phone)` is `SECURITY DEFINER`, granted to `anon`
(`20260901000000_revenuecat_entitlements.sql:171`, re-granted at
`20260904000000_hard_paywall_store_trial.sql:57`), and looks the subscription up by the supplied id:

```sql
     FROM public.businesses b
     JOIN public.owners o ON o.phone = public.normalize_phone_pg(b.phone_number)
     LEFT JOIN public.subscriptions s ON s.owner_id = o.id
     WHERE b.id = client_business_id
```

The client stores whatever comes back (`mobile/stores/useEntitlementStore.ts:91`).

Two consequences:

1. **Paywall bypass.** A non-paying merchant passes a *paying* merchant's `business_id` — freely
   available from TEN-1 — and receives `is_pro: true`, unlocking their own app indefinitely. Cost to
   the attacker: one changed string. Revenue impact scales with however many merchants figure it out.
2. **`is_owner` is self-asserted.** It is computed by comparing the client-supplied `client_phone`
   against `businesses.phone_number`:

   ```sql
        'is_owner',
          COALESCE(
            public.normalize_phone_pg(client_phone) <> ''
            AND public.normalize_phone_pg(client_phone)
                = public.normalize_phone_pg(b.phone_number),
            false),
   ```

   Since `phone_number` is readable via TEN-2, anyone can set `is_owner: true` for any business. Per
   `docs/known-issues.md` ENT-2, `is_owner` gates who may purchase and restore.

**Verified live:** `POST /rpc/get_entitlement` returns HTTP 200 to the anon key (probed with a
non-existent id, returning the `{"is_pro": false, ...}` default).

Note the entitlement *value* cannot be forged — `is_pro` is computed from the `subscriptions` table
server-side, which is correct design. The flaw is only that the caller chooses whose entitlement they
receive.

### Fix

Gated on TEN-2: derive `business_id` and the phone from the session rather than the request. Cheap
partial mitigation in the meantime: none that is meaningful — any client-side check is bypassed by the
same modified client that would exploit this. Treat paywall revenue leakage as an accepted risk until
the auth model lands, and size it accordingly.

---

## TEN-9 — RBAC is client-side and fails open to `admin` {#ten-9}

**Severity: Medium · confirmed**

`docs/known-issues.md` SEC-3 is **confirmed**, with one detail it does not record.

The permission matrix is a plain object consulted in the client:

```ts
// mobile/hooks/useUserPermissions.ts:34
const userRoleRaw = useAuthStore((s: any) => s.userRole) || 'admin';
```

The role comes from the client's own Zustand store, set by `loginWithEmployee`
(`mobile/stores/useAuthStore.ts:49-54`). The server never receives a role: neither
`pull_watermelondb_changes` nor `push_watermelondb_changes` takes one, and there is no role column in
any RPC signature.

**Can a `cashier` client perform owner/admin-only writes by calling the RPCs directly? Yes,
unambiguously.** The matrix denies `cashier` all `staff` access and all `sync` actions
(`useUserPermissions.ts:24-29`), yet `push_watermelondb_changes` accepts an `employees` payload from
any caller who names the tenant. The cashier already has the anon key (it is in the app they are
holding) and their own `business_id` (it is in their session). Promoting themselves to `admin`, or
deleting a colleague, is a single `curl` from the device in their hand. Every merchant's staff is
therefore a fully-privileged user of that merchant's data.

The detail SEC-3 omits: the fallback at line 34 is `|| 'admin'`, so a missing or falsy `userRole`
grants **full** permissions rather than the least ones. Line 38-41 then defaults an *unrecognised*
role string to `'cashier'` — so the code fails closed on a bad value and open on a missing one. That
asymmetry is almost certainly unintended.

### Fix

The `|| 'admin'` → `|| 'cashier'` change is **one character short of free** and should be made now; it
costs nothing and removes a fail-open. It is defence in depth only — it does not make RBAC real.

Real enforcement is blocked on TEN-2, exactly as SEC-3 says. Once the caller's identity is server-side,
the role travels in the JWT claim and RLS/RPC bodies can enforce it.

---

## TEN-10 — The local database accumulates every business the device has opened {#ten-10}

**Severity: Medium · confirmed by code reading**

One `SQLiteAdapter`, one `Database`, no per-business namespace or file:

```ts
// mobile/components/data/db/index.native.ts:16-31
const adapter = new SQLiteAdapter({
  schema,
  migrations,
  jsi: isJSISupported,
  ...
});

const database = new Database({
  adapter,
  modelClasses: [Business, Employee, Product, Order, OrderItem, InventoryLog],
});
```

`web/src/components/data/db/index.ts` has the same shape.

On a business switch, the only action taken is to force a full pull:

```ts
// mobile/services/sync.ts:122-125
/** Request a full pull for a business (e.g. after switching branches). */
export function requestFullPullForBusiness(businessId: string) {
  forceFullPullBusinessId = businessId;
}
```

which sets `effectiveLastPulledAt = 0` (`mobile/services/sync.ts:162-165`). Called from
`mobile/hooks/useBusinessSwitchSync.ts:30` and `web/src/hooks/useAppAuthGuard.ts:65`.

Nothing clears the previous tenant's rows. `grep -rn "unsafeResetDatabase"` across both apps returns
exactly one call site — `mobile/services/account.ts:28`, in the account-deletion flow. So a device used
by someone with access to several shops (a multi-branch owner, or a staff member who has moved
employers) holds **all** of those shops' products, orders, order items, inventory logs and employee
records in one unencrypted SQLite file, indefinitely.

The UI scopes its queries by `business_id`, so this is data-at-rest exposure rather than a
cross-tenant display bug — I found no path that *renders* another business's rows. The exposure is to
anyone with the device: a stolen phone, a device handed to a new employee, or a full-device backup.
This also collides with the deletion promise in TEN-4: deleting an account purges the server and the
*current* device, while other devices keep their local copies.

### Fix

**Cheap.** Call `database.write(() => database.unsafeResetDatabase())` on business switch, immediately
before the forced full pull — the full pull already re-fetches everything, so nothing is lost. That is
a few lines in `useBusinessSwitchSync.ts` and `useAppAuthGuard.ts`. Consider also an encrypted SQLite
adapter for at-rest protection, which is a larger change and lower priority than everything above.

---

## TEN-11 — `log_paywall_event` is an unauthenticated unbounded INSERT {#ten-11}

**Severity: Medium**

`SECURITY DEFINER`, granted to `anon` (`20260904000000_hard_paywall_store_trial.sql:135`). It validates
the event name against a whitelist and nothing else:

```sql
  IF input_event NOT IN (
    'viewed', 'plan_selected', 'purchase_started', 'purchase_cancelled',
    'purchase_failed', 'purchase_succeeded', 'restore_attempted'
  ) THEN
    RAISE EXCEPTION 'unknown paywall event: %', input_event;
  END IF;
```

`input_business_id`, `input_platform`, `input_app_version` and a free-form `input_metadata jsonb` are
inserted unchecked. An attacker can attribute fabricated funnel events to any merchant (poisoning the
conversion analytics the pricing decisions in PRICE-1 depend on) and can insert unbounded rows with
arbitrary JSONB payloads — a slow storage-exhaustion and cost-inflation vector against the Supabase
bill.

### Fix

Cheap: cap `input_metadata` size, and rate-limit per `business_id`. Proper attribution is gated on
TEN-2. Given the analytics are advisory, this is a lower priority than everything above it — but the
unbounded-insert half is worth a size cap before launch.

---

## TEN-12 — UploadThing route has no authentication {#ten-12}

**Severity: Medium**

```ts
// web/src/app/api/uploadthing/route.ts:8-10
  productImageUploader: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(() => ({ ok: true }))
```

The `middleware` callback is where UploadThing expects the auth check; here it unconditionally returns
`{ ok: true }`. Anyone who can reach `POST /api/uploadthing` can upload 4MB images to the project's
UploadThing account — storage abuse and cost, plus a host for arbitrary content served from the
merchant's domain.

The `DELETE` handler is worse:

```ts
// web/src/app/api/uploadthing/route.ts:21-28
export async function DELETE(request: Request) {
  try {
    const { fileKey } = (await request.json()) as { fileKey: string };
    if (!fileKey) return Response.json({ error: 'fileKey is required' }, { status: 400 });

    const result = await utapi.deleteFiles(fileKey);
```

No authentication and no ownership check — any `fileKey` supplied is deleted using the server's
`UTApi` credentials. File keys appear in the image URLs stored in `products.icon` / `businesses.logo_uri`,
which TEN-2 exposes, so an attacker can enumerate keys and delete every product image on the platform.

### Fix

**Cheap.** Put a real check in `.middleware()` and at the top of `DELETE`, and verify the file belongs
to the caller's business before deleting. Meaningful ownership checks are gated on TEN-2, but rejecting
entirely unauthenticated requests is not — that is a few lines today.

`UPLOADTHING_TOKEN` itself is correctly scoped: it has no `NEXT_PUBLIC_` prefix, so Next.js does not
inline it, and it is referenced only from server files (`route.ts`). The client helper
(`web/src/utils/uploadthing.ts`) goes through the API route. The token is not exposed; the route it
protects is simply unguarded.

---

## TEN-13 — Blanket table grants to `anon` {#ten-13}

**Severity: Low (today) — but it removes the safety net**

`information_schema.role_table_grants` shows `anon` and `authenticated` each holding
`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` on **all 14 tables plus the
`v_subscription_events` view** — `businesses`, `owners`, `subscriptions` included.

Today RLS blocks this for the ten policy-less tables (verified live: `businesses` returns `200 []`).
The finding is that RLS is the *only* thing blocking it. Any future permissive policy, or a
`DISABLE ROW LEVEL SECURITY` run during debugging, exposes the table immediately and silently. Defence
in depth means the grant should not be there in the first place.

`app_config` being world-readable is fine and intended — it holds `force_update`, `min_version`, store
URLs and `iap_enabled`, all of which the app must read before login. It should be `SELECT`-only for
`anon`, though: today `anon` also holds `INSERT`/`UPDATE`/`DELETE` on it, and while no policy currently
permits the write, the single `app_config` row controls force-update behaviour for every installed app.

### Fix

Cheap, one migration:
`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;` then grant back only what is
genuinely needed (`GRANT SELECT ON public.app_config TO anon;`, plus whatever the presence tables need
once TEN-1/TEN-6 are reshaped). Test the sync path afterwards — the RPCs run as `postgres` under
`SECURITY DEFINER` and are unaffected, so the blast radius of this change is small.

---

## TEN-14 — `get_auth_business_id()` is dead code {#ten-14}

**Severity: Informational**

```sql
-- live definition, public.get_auth_business_id
  v_phone := auth.jwt() ->> 'phone';
  IF v_phone IS NOT NULL AND v_phone <> '' THEN
```

There is no Supabase Auth session anywhere in this system, so `auth.jwt()` is always null and this
function always returns `NULL`. No policy or RPC references it.

It is worth keeping in view rather than deleting: it is the shape the fix for TEN-2 needs. If route 2
of that fix is taken (external OTP service mints a Supabase JWT), this function becomes correct
almost as written.

---

## TEN-15 — Secrets inventory {#ten-15}

**Severity: Informational — no genuinely-secret value was found in a client bundle**

| Name | Location | Ships to client? | Classification |
|---|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `mobile/.env` | Yes | **Designed public.** Fine. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `mobile/.env` | Yes | **Designed public.** Correct in itself — but it is the sole credential in every finding above, because nothing sits behind it. |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `web/.env` | Yes | Same. |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` / `_TEST_KEY` | `mobile/.env` | Yes | **Designed public.** RevenueCat SDK keys are publishable by design; they cannot grant or revoke entitlements. Correctly used. |
| OTP service base URL `https://mini-pos-sync-server.vercel.app` | hardcoded, `mobile/app/(modules)/auth/number-input.tsx:67`, `mobile/hooks/useAuth.ts:21`, `web/src/app/api/auth/check/route.ts:6`, `web/src/app/api/auth/verify/route.ts:15` | Yes (mobile) | **Not a secret, but not harmless.** An endpoint URL is not confidential; what matters is that the service is the entire authentication system and its rate limiting and OTP-verification behaviour are **unverified** — it lives outside this repo. Given SEC-1's note that the client-side `11111` bypass was removed but the server may still honour it, this warrants direct testing before launch. |
| `UPLOADTHING_TOKEN` | `web/.env` | **No** | **Genuinely secret, correctly handled.** No `NEXT_PUBLIC_` prefix; referenced only from `web/src/app/api/uploadthing/route.ts`. See TEN-12 — the token is safe, the route is not. |
| `SUPABASE_ACCESS_TOKEN`, `RC_SECRET_API_KEY`, `RC_WEBHOOK_AUTH` | repo-root `.env` | **No** | **Genuinely secret, correctly handled.** Root `.env` is gitignored (`.gitignore:10`) and these are used by tooling and the Edge Function, never bundled. |

`git ls-files | grep -i '\.env'` returns only `mobile/.env.example` and `web/.env.example`. No secret
is committed.

**The conclusion is worth stating plainly, because it inverts the usual finding:** the secrets
management here is fine. Nothing that should be private is public. The problem is not a leaked key —
it is that a key which is *supposed* to be public has been made load-bearing for authorization.
Rotating the anon key would achieve nothing; it is in the next build either way.

---

## Guessability of `business_id`: strong id, published list

The audit brief asks whether `business_id` is guessable, since that determines whether SEC-2 is a
serious weakness or a critical hole. The answer has two halves that point in opposite directions.

**The id itself is cryptographically strong.** WatermelonDB generates it, and no override exists —
`grep -rn "setGenerator"` across `mobile/` and `web/` returns nothing, so the default applies:

```js
// node_modules/@nozbe/watermelondb/src/utils/common/randomId/randomId.js
const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
...
  while (len < 16) {
    ...
      globalThis.crypto.getRandomValues(randomNumbers)
```

16 characters from a 62-character alphabet, drawn from `crypto.getRandomValues` on web and from the
native secure RNG on React Native (`randomId.native.js` → `WMDatabaseBridge.getRandomBytes` /
`getRandomIds`). That is ~95 bits of entropy — not brute-forceable, not sequential, not predictable,
with no timestamp component. Confirmed against production: `SELECT length(id), count(*) FROM businesses
GROUP BY 1` gives **11 rows at length 16** and **1 at length 36** (a single legacy UUID-format row,
likely seed data), and all 12 match `^[A-Za-z0-9_-]+$`.

If the id were secret, SEC-2 would be a serious-but-contained weakness — an attacker would need inside
knowledge of a specific merchant.

**But the id is published, twice over.** `active_devices` hands out all 12 to anyone with the anon key
(TEN-1, verified live: 12 of 12), and `check_phone_registered` / `fetch_user_businesses` return one for
any phone an attacker can enumerate (TEN-5). Neither requires guessing.

**So the answer is: critical and actively exploitable.** Not because the identifier is weak — it is
excellent — but because treating a well-designed *identifier* as a *credential* fails the moment
anything publishes it, and two separate subsystems here publish it. This is the general lesson: an
identifier's entropy is irrelevant to its fitness as a secret, because identifiers are meant to be
shared.

---

## Exploitable today vs theoretical

The distinction that should drive the pre-launch triage.

### Exploitable today, by anyone, with only the anon key

Each of these was either reproduced live or is reachable through a path that was reproduced live.
None requires social engineering, a stolen device, insider knowledge, or a guess.

| | Finding | Proven how |
|---|---|---|
| 1 | **Full tenant directory + staff PII + GPS + push tokens** (TEN-1) | Reproduced. 82 rows, 12/12 business ids. |
| 2 | **Complete dataset of every merchant** (TEN-2) | Reproduced against one real tenant: 101 orders, 223 order items, 271 inventory logs, employee names/phones/emails, business address and tax id. |
| 3 | **Full write and delete on every merchant's data** (TEN-3) | Grant and function body verified; identical authorisation to (2), which was reproduced. Not executed. |
| 4 | **Permanent destruction of any merchant account** (TEN-4) | Both RPCs confirmed anon-reachable — `delete_account` returned a business-logic error, not a permission error. Chain not executed. |
| 5 | **Phone→tenant+PII oracle, ~10⁷ keyspace** (TEN-5) | All three RPCs returned 200 to anon (probed with a non-existent number). |
| 6 | **Force-logout every till; defeat device revocation** (TEN-6) | Read side reproduced; write policies read from `pg_policies`. |
| 7 | **Paywall bypass** (TEN-8) | RPC confirmed anon-reachable. |
| 8 | **Cashier performs admin writes** (TEN-9) | Follows directly from (3); no server-side role exists to check. |
| 9 | **Unauthenticated deletion of every product image** (TEN-12) | Code read: no auth on the `DELETE` handler. |

Items 1, 2 and 4 are the ones that should block a store submission. Item 2 alone is a personal-data
breach of every merchant and every employee on the platform, and item 4 is irreversible.

### Real but conditional

- **TEN-7 (realtime channels).** Configuration confirmed absent on both sides. Not demonstrated with a
  live subscription — do that in staging to close it out.
- **TEN-10 (local DB accumulation).** Certain from the code, but it requires physical access to a
  device, and no rendering path exposes it in-app.
- **TEN-11 (paywall event injection).** Trivially doable; the harm is analytics poisoning and storage
  cost rather than data exposure.

### Theoretical

- **TEN-13 (blanket grants).** Harmless while RLS holds. It is a missing safety net, not an open door —
  it converts one future mistake into an immediate breach.
- **TEN-14 (dead code).** No impact.
- **TEN-15 (secrets).** Nothing exposed.

### Explicitly unverified

Stated so nothing here is mistaken for a clean bill of health:

- **The external OTP service** (`mini-pos-sync-server.vercel.app`) was not tested. Its rate limiting,
  OTP entropy, and whether it still accepts `11111` server-side (SEC-1 removed only the client half)
  are all unknown and outside this repo. Since it is the entire authentication system, this is the
  largest remaining gap in the picture. Settled by: sending a verify request with `11111` for a phone
  the tester controls, and measuring the request rate the `check` endpoint tolerates.
- **Realtime channel subscription** (TEN-7) — settled by one anon `subscribe()` in staging.
- **Whether any merchant data has already been exfiltrated.** Supabase's API logs would show anomalous
  `active_devices` reads and `pull_watermelondb_changes` calls with mismatched id patterns. Given the
  ease of the attack, this is worth checking before deciding whether the incident is prospective or
  historical.

---

## Recommended order

Grouped by what each buys and what it costs. The first group is days of work and removes the
self-service breach; the second is the real fix.

**Before any store submission — cheap, no auth-model change:**

1. Drop the `USING (true)` policies on `active_devices` and `device_session_revocations`; move both
   through tenant-scoped RPCs (TEN-1, TEN-6). *This is the single highest-value change here.*
2. `REVOKE EXECUTE` on `delete_account` and `get_or_create_owner` from `anon`; move deletion behind a
   server-verified OTP (TEN-4).
3. Reduce the pre-auth response of `check_phone_registered` to a boolean; gate `fetch_user_businesses`
   behind verification (TEN-5).
4. Add auth to the UploadThing route and its `DELETE` handler (TEN-12).
5. `useUserPermissions.ts:34`: `|| 'admin'` → `|| 'cashier'` (TEN-9). One character.
6. Reset the local DB on business switch (TEN-10).
7. `REVOKE` the blanket table grants from `anon`/`authenticated` (TEN-13).

Together these mean an attacker must already know a specific merchant's `business_id`. That is a large
improvement and it is **not** a fix — steps 1-7 leave TEN-2, TEN-3, TEN-7, TEN-8 and TEN-9 live for
anyone who obtains an id by any other route.

**The actual fix — schedule it, do not defer it indefinitely:**

8. Replace client-supplied `business_id` with a server-derived tenant, either via Supabase Auth phone
   OTP or by having the existing OTP service mint a Supabase JWT carrying `business_id` and `role`
   (TEN-2). Everything else — TEN-3, TEN-7, TEN-8, TEN-9, and real RLS on all 14 tables — collapses
   out of this one change.

**Also worth doing while in the area:**

9. Test the external OTP service directly (rate limiting, and whether `11111` still works server-side).
10. Add the SYNC-1 `WHERE EXCLUDED.updated_at > ...` guards — unrelated to isolation, but it is the
    same function bodies and it fixes silent data loss.
11. Review Supabase API logs for prior exploitation.

`docs/known-issues.md` SEC-2 and SEC-3 should be updated to reference this document, and SEC-2's
severity raised from High to Critical: its current wording ("anyone holding the public anon key plus a
`business_id`") describes a precondition the platform does not actually impose.
