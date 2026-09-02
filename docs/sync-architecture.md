# Sync Architecture

How offline-first sync works in Shopbook POS, what the reference implementations do differently, and the correctness gap this analysis surfaced.

Audited on `dev` @ `f23870f`. Applies to both clients — `mobile/services/sync.ts` and `web/src/services/sync.ts` are near-identical.

## 1. The model

Both clients run **WatermelonDB** — mobile on native SQLite, web on LokiJS/IndexedDB (`web/src/db/database.ts:9`). Same schema (v9), same six tables:

```
businesses ─┬─ employees
            ├─ products ── inventory_logs
            └─ orders ──── order_items
```

Every UI read and write hits the local database. Supabase is a **mirror**, not the source of truth. Nothing in the checkout path blocks on the network.

Supabase holds a mirror of the same six tables plus two sync-support structures:

| Object                                    | Purpose                                                                             |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `server_updated_at` (column, every table) | Pull watermark. Set by a `BEFORE INSERT OR UPDATE` trigger via `clock_timestamp()`. |
| `deleted_records`                         | Tombstones. Written by the `record_deletion` trigger on hard delete.                |

Client clocks never enter the protocol.

## 2. What triggers a sync

Five entry points, all calling `syncDatabase()`:

| Trigger                           | Where                                                                    |
| --------------------------------- | ------------------------------------------------------------------------ |
| App launch / foreground           | `mobile/hooks/useWatermelonSync.ts` — `AppState` → `active`              |
| After a sale completes            | `mobile/hooks/useOrders.ts:209` (fire-and-forget, outside the write txn) |
| Another terminal pushed           | Realtime broadcast — `mobile/app/(tabs)/_layout.tsx:27`                  |
| Login resolves to a cloud account | `mobile/hooks/useAuth.ts` after `check_phone_registered`                 |
| Branch switch                     | `requestFullPullForBusiness()` → forces `last_pulled_at = 0`             |

There is **no timer**. Despite the comment in `(tabs)/_layout.tsx:15` calling it "periodic background sync", nothing polls on an interval.

## 3. The gate and the mutex

```
syncDatabase()
  ├─ isBackupEnabled === false?   → return false      # the "Pro" soft gate
  ├─ isSyncInProgress === true?   → hasPendingSyncRequest = true; return false
  ├─ no activeBusinessId?         → return false
  └─ run
```

Module-level booleans (`sync.ts:110-113`), not a real lock — safe because JS is single-threaded here. On completion, a request that arrived mid-flight re-runs once after 50 ms.

This **coalesces**, it does not queue: ten triggers during one in-flight sync produce exactly one follow-up run.

## 4. Pull

```ts
supabase.rpc('pull_watermelondb_changes', {
  last_pulled_at: effectiveLastPulledAt,
  client_business_id: activeBusinessId,
});
```

The RPC returns one `json_build_object` covering six tables × three buckets:

| Bucket    | Predicate                                                             |
| --------- | --------------------------------------------------------------------- |
| `created` | `server_updated_at > last_pulled_at AND created_at > last_pulled_at`  |
| `updated` | `server_updated_at > last_pulled_at AND created_at <= last_pulled_at` |
| `deleted` | `record_id FROM deleted_records WHERE deleted_at > last_pulled_at`    |

Tenant filtering is `AND business_id = client_business_id` on every subquery. `order_items` and `inventory_logs` carry no `business_id`, so they filter through their parent:

```sql
order_id IN (SELECT id FROM orders WHERE business_id = client_business_id)
```

### normalizePulledChanges

`sync.ts:71` merges the server's `created` and `updated` buckets into `updated` alone, keyed by id.

Required because `sendCreatedAsUpdated: true` makes WatermelonDB raise a diagnostic error when an incoming "created" row already exists locally — which happens constantly once a second terminal is in play, or when a deferred sync replays a pull.

## 5. Push

```ts
for (const table of PUSH_TABLE_ORDER) {
  // sync.ts:36
  if (!tableHasChanges(changes[table])) continue;
  await supabase.rpc('push_watermelondb_changes', {
    changes: { [table]: slice },
    client_business_id: activeBusinessId,
  });
}
```

**One RPC per table, sequential, in foreign-key order:**

```
businesses → employees → products → orders → order_items → inventory_logs
```

Up to six round trips, but a child row can never arrive before its parent.

Server side, the RPC identifies the table with `SELECT key FROM json_each(changes) LIMIT 1`, then dispatches through a ~640-line `IF/ELSIF` chain. Per table it iterates rows with `FOR r IN json_array_elements(...)`, asserts tenancy, and upserts:

```sql
IF (r->>'business_id') != client_business_id THEN
  RAISE EXCEPTION 'Unauthorized ... push';
END IF;

INSERT INTO products (...) VALUES (...)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price = EXCLUDED.price,
  stock_count = EXCLUDED.stock_count,
  ...
  updated_at = EXCLUDED.updated_at;
```

Deletes are hard `DELETE`s; the `record_deletion` trigger writes the tombstone.

Two structural notes:

- The `created` and `updated` branches are **byte-identical** upserts, duplicated per table. Any change to push semantics has to be made twice per table — 12 places.
- Row-by-row `FOR ... LOOP` rather than set-based `INSERT ... SELECT FROM json_array_elements(...)`. Irrelevant for a ten-item order, slow for a first-sync of a thousand-product catalogue.

## 6. Broadcast

After a push containing changes (`sync.ts:181`):

```ts
supabase.channel(`sync:${activeBusinessId}`).send({
  type: 'broadcast',
  event: 'sync_trigger',
  payload: { senderId: getClientId(), businessId, timestamp },
});
```

Receivers (`(tabs)/_layout.tsx:28`, `web/src/hooks/useAppSync.ts:71`) check `senderId !== clientId` for echo suppression, then run their own `syncDatabase()`.

`getClientId()` is `Math.random()` memoized in module scope — a **per-process** id regenerated on each launch, not a stable device id. Adequate for echo suppression only.

Two limits worth knowing:

- The broadcast fires **only after a push**. A terminal that only pulls notifies nobody.
- Delivery is best-effort. A backgrounded terminal misses the event and waits for its next foreground.

## 7. Settling

`setOnSyncSuccess(refreshSyncedData)` — `mobile/app/_layout.tsx:41`:

```ts
queryClient.resetQueries(); // not invalidate — full reset
useSyncRefreshStore.getState().bump();
```

`resetQueries` rather than targeted invalidation because infinite-query pages must restart from page 0 for newly synced records to surface.

## 8. Comparison with reference implementations

Surveyed via GitHub code search: [`bndkt/sharemystack`](https://github.com/bndkt/sharemystack) (most mature), [`notJust-dev/ProfitFirst`](https://github.com/notJust-dev/ProfitFirst), [`lewiscasewell/Openweight`](https://github.com/lewiscasewell/Openweight), `gitsegovia/spendly`, `nagey/vireau`.

**The overall architecture is the mainstream one** — `rpc('pull')` / `rpc('push')` backed by plpgsql is what essentially everyone does. Not a wrong turn.

Three divergences:

### 8.1 Nobody else passes a tenant id from the client

sharemystack calls `supabase.rpc("pull", { last_pulled_at })` — no tenant argument. It runs under Supabase Auth, so the RPC reads `auth.uid()`, and its pull selects from **views** (`sync_profiles_view`, `sync_stacks_view`) where the tenant predicate lives in the view definition with RLS enforcing it.

Shopbook passes `client_business_id` as a plain string to a `SECURITY DEFINER` function `GRANT`ed to `anon`. The tenant filter is therefore **a value the caller chooses**. Anyone holding the public anon key (shipped in both bundles) plus a `business_id` can pull or push another shop's data.

This is the single structural difference between this codebase and every reference implementation. Tracked as P3-2 in `docs/revenuecat/01-audit.md`.

### 8.2 Everyone else uses soft deletes

sharemystack:

```sql
update picks set deleted_at = now(), last_modified_at = now()
from changes_data where picks.id = changes_data.deleted;
```

One column. No trigger, no second table, and the tombstone is inherently tenant-scoped because it _is_ the row.

Shopbook hard-deletes and reconstructs tombstones in `deleted_records` via trigger — which is why `record_deletion` needs an `IF TG_TABLE_NAME = ...` ladder to backfill `business_id` for `order_items` and `inventory_logs`, whose parents may already be gone. Soft deletes would remove that whole mechanism.

### 8.3 `lastPulledAt` is discarded on push

WatermelonDB provides it:

```ts
pushChanges: async ({ changes, lastPulledAt }) => { ... }   // Openweight forwards it
pushChanges: async ({ changes }) => { ... }                 // sync.ts:176 — dropped
```

Openweight sends it as `?last_pulled_at=${lastPulledAt}`. That parameter exists so the server can answer _"has this row changed since the client last saw it?"_ — the hook for conflict detection. Dropping it means the server structurally **cannot** detect a conflict.

### Where Shopbook is better

The `server_updated_at` BEFORE-trigger. sharemystack sets `last_modified_at = now()` inline in each statement, which is easy to omit in a new code path. A trigger cannot be forgotten.

## 9. Known defect — concurrent stock decrements are lost

**Severity: high.** Silent data loss on the core inventory number.

### Cause

Two facts combine:

1. All 12 `ON CONFLICT (id) DO UPDATE` blocks are **unconditional**. No migration contains a `WHERE EXCLUDED.updated_at > <table>.updated_at` predicate (verified by grep across `supabase/migrations/*.sql` and `supabase_migration.sql` — zero matches). Last write wins.
2. `stock_count` is pushed as an **absolute value**, not a delta (`useOrders.ts:181` — `p.stockCount = Math.max(0, p.stockCount - item.quantity)`).

### Failure scenario

```
products.stock_count = 10

Till A sells 2  → local 8 → pushes stock_count: 8
Till B sells 3  → local 7 → pushes stock_count: 7

Server keeps whichever RPC landed second → 8 or 7
Correct value                            → 5
```

Five units disappear from the books. Both `orders` rows are correct and both `inventory_logs` rows exist — so the audit trail is right while the stock figure is wrong, and nothing reconciles the two. The error compounds across every concurrent sale.

It does not require two terminals: a single device that goes offline, sells, and syncs late pushes a stale absolute count over newer server state.

### Fixes, cheapest first

| #   | Fix                                                                                        | Effort                                          | Covers                                                                                           |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | Add `WHERE EXCLUDED.updated_at > <table>.updated_at` to each upsert                        | ~12 edits, migration only                       | Stale offline pushes clobbering fresh state. **Not** true concurrency — both writes are "fresh". |
| 2   | Push a delta for `stock_count`: `stock_count = <table>.stock_count + EXCLUDED.stock_delta` | Schema column + `useOrders.ts` write path       | Concurrent sales                                                                                 |
| 3   | Derive stock as a sum over `inventory_logs`                                                | Largest — removes `stock_count` as stored state | Everything; conflicts become unrepresentable                                                     |

Recommendation: apply (1) immediately — small, migration-only, fixes the offline-stale case on its own. Treat (2) as a product decision, since it changes the checkout write path.

## 10. Open items

- `lastPulledAt` unused on push (§8.3) — prerequisite for any real conflict detection.
- Tenant id supplied by the client (§8.1) — bounds how meaningful any server-side authorization can be.
- No periodic sync (§2) — a terminal that never foregrounds and never sells never syncs.
- Broadcast only on push (§6) — pull-only terminals are invisible to peers.
- `created` / `updated` upsert duplication (§5) — every push-semantics change is a 12-site edit.
