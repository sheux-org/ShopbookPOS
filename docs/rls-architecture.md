# Row-Level Security (RLS) & Multi-Tenant Data Isolation Architecture

> **Document Classification**: Engineering Architecture & Security Specification  
> **Target Audience**: Technical Leads, Systems Architects, Security Auditors, Senior Software Engineers  
> **Status**: Production Reference  
> **Applies to**: Shopbook POS Cloud (PostgreSQL / Supabase), Mobile (React Native/Expo), Web (Next.js)

---

## 1. Executive Summary & Philosophy

Modern mobile Point-of-Sale (POS) applications operate under a fundamentally distinct security and operational paradigm compared to standard cloud-first CRUD web apps:

1. **Offline-First Resilience**: Transactions, receipt generation, and catalog updates occur locally inside an embedded database (WatermelonDB with SQLite on Mobile, LokiJS/IndexedDB on Web). The remote database is an asynchronous event mirror, never a synchronous gate on the checkout path.
2. **Terminal Credential Model**: POS terminals (tablets, counter phones, till PCs) frequently operate under shared branch sessions where cashiers log in via localized numeric PINs rather than cloud-managed OAuth/JWT tokens per terminal user.

### The Architectural Problem with Conventional Supabase RLS

In standard Supabase applications, Row-Level Security (RLS) relies on the user's authenticated JWT:

```sql
-- Standard (Anti-Pattern for Offline Multi-Terminal POS)
CREATE POLICY "Users can only see their own rows"
ON orders FOR ALL
USING (auth.uid() = user_id);
```

If applied to Shopbook POS:

- It requires every cashier or device to constantly maintain an active Supabase Auth session token.
- Network drops during sales would cause auth token expiration or sync failures.
- WatermelonDB's bulk sync protocol (`pullChanges` / `pushChanges`) would require hundreds of individual REST API calls or complex subquery joins evaluated row-by-row on PostgREST, inducing extreme latency and database connection exhaustion.

### The Solution: Zero-Trust Direct REST "Deny-All" + Hardened RPC Gateways

To resolve this tension between offline speed and enterprise multi-tenant security, Shopbook POS adopts a **Two-Tiered Isolation Architecture**:

- **Tier 1 (Database Boundary - RLS)**: RLS is enabled across all primary transactional tables with **zero permissive REST policies**. Direct PostgREST table querying (`supabase.from('products').select()`) is completely rejected.
- **Tier 2 (Application Boundary - `SECURITY DEFINER` RPCs)**: Synchronization is strictly brokered through security-hardened PL/pgSQL procedures (`pull_watermelondb_changes` and `push_watermelondb_changes`) that enforce cryptographic and programmatic tenant scoping (`WHERE business_id = client_business_id`) inside atomic database transactions.

---

## 2. Threat Modeling & Attack Surface Analysis

| Threat Vector                                   | Potential Impact                                                                                 | Shopbook POS Mitigation Architecture                                                                                                                                                                                    |
| :---------------------------------------------- | :----------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Leaked Supabase Anon Key**                    | Attacker attempts to dump competitor sales, catalog, or employee data via public REST endpoints. | **Mitigated at Tier 1**: Core tables have RLS enabled with no `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies. PostgREST returns an empty set or 403 Forbidden.                                                            |
| **Forged `business_id` in Push Payload (IDOR)** | A rogue terminal attempts to inject or overwrite inventory or orders in another shop's tenant.   | **Mitigated at Tier 2**: Every record in the push batch is inspected inside PL/pgSQL. If `(record->>'business_id') != client_business_id`, the function raises an exception and aborts the entire database transaction. |
| **Clock Tampering / Replay Attacks**            | Client terminal clock skewed to falsify order timestamps or resurrect deleted items.             | **Server-Authoritative Watermarks**: Client timestamps are never trusted for sync watermarking. Synchronization relies on `server_updated_at` generated via PostgreSQL `clock_timestamp()`.                             |
| **Compromised Terminal Device**                 | Stolen tablet or rogue staff device continues to pull real-time updates.                         | **Remote Session Revocation**: Terminals maintain an entry in `active_devices`. When revoked by the business owner, downstream RPCs and background listeners reject syncing.                                            |

---

## 3. Tier 1: The Core RLS Barrier (Deny-All by Default)

PostgreSQL's RLS engine follows a default-deny policy when enabled without explicit policies. In migration [`20260603000000_secure_tenant_isolation.sql`](../supabase/migrations/20260603000000_secure_tenant_isolation.sql), all core business tables are locked down:

```sql
-- 1. Enable Row Level Security across all tenant-isolated entities
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- 2. Strip legacy permissive policies (Denies PostgREST direct reads/writes)
DROP POLICY IF EXISTS "Allow business products select" ON public.products;
DROP POLICY IF EXISTS "Allow business products all" ON public.products;
DROP POLICY IF EXISTS "Allow business orders select" ON public.orders;
DROP POLICY IF EXISTS "Allow business orders all" ON public.orders;
-- (...Repeated for all core tables...)
```

### Direct REST Access Behavior

If an external client executes:

```ts
// Attempting direct REST query with anon key
const { data, error } = await supabase.from('orders').select('*');
```

PostgREST queries the table as role `anon` or `authenticated`. Because RLS is active and no matching `USING` expression evaluates to `true`, PostgreSQL returns `[]` (0 rows) without leaking metadata or schema content.

---

## 4. Tier 2: The RPC Isolation Engine (`SECURITY DEFINER`)

Since direct table access is closed, synchronization flows exclusively through two stored procedures granted to `anon` and `authenticated` roles.

```
                    ┌─────────────────────────────────────────┐
                    │      Client Terminal (Mobile / Web)     │
                    └────────────────────┬────────────────────┘
                                         │
                 Calls RPC with payload  │  RPC Request with:
                 & client_business_id    │  - last_pulled_at
                                         │  - client_business_id
                                         ▼
                    ┌─────────────────────────────────────────┐
                    │       Supabase Gateway (PostgREST)      │
                    └────────────────────┬────────────────────┘
                                         │
                             Executes as │ SECURITY DEFINER
                                         ▼
    ┌─────────────────────────────────────────────────────────────────────┐
    │                     PostgreSQL Runtime Engine                       │
    │                                                                     │
    │  [Security Check]                                                   │
    │  client_business_id IS NULL or ''? ──► YES ──► RAISE EXCEPTION      │
    │                 │ NO                                                │
    │                 ▼                                                   │
    │  [Tenant Scoping]                                                   │
    │  WHERE business_id = client_business_id                             │
    │  AND server_updated_at > last_pulled_at                             │
    │                 │                                                   │
    │                 ▼                                                   │
    │  [Payload Validation on Push]                                       │
    │  FOR record IN payload.records:                                     │
    │    record.business_id != client_business_id? ──► RAISE EXCEPTION    │
    │                 │ NO                                                │
    │                 ▼                                                   │
    │  ATOMIC COMMIT / ROLLBACK                                           │
    └─────────────────────────────────────────────────────────────────────┘
```

### 4.1 The Pull Mechanism (`pull_watermelondb_changes`)

The pull procedure accepts the client's last sync checkpoint (`last_pulled_at`) and target tenant identifier (`client_business_id`):

```sql
CREATE OR REPLACE FUNCTION pull_watermelondb_changes(
  last_pulled_at bigint,
  client_business_id text
)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  current_time_ms bigint;
  result json;
BEGIN
  -- Strict guard against null/empty tenant identifier
  IF client_business_id IS NULL OR client_business_id = '' THEN
    RAISE EXCEPTION 'Unauthorized: client_business_id must be provided.';
  END IF;

  current_time_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

  SELECT json_build_object(
    'changes', json_build_object(
      'businesses', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (
            SELECT id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at
            FROM businesses
            WHERE server_updated_at > last_pulled_at AND created_at > last_pulled_at AND id = client_business_id
        ) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (
            SELECT id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at
            FROM businesses
            WHERE server_updated_at > last_pulled_at AND created_at <= last_pulled_at AND id = client_business_id
        ) t), '[]'::json),
        'deleted', coalesce((
            SELECT json_agg(record_id)
            FROM deleted_records
            WHERE table_name = 'businesses' AND deleted_at > last_pulled_at AND business_id = client_business_id
        ), '[]'::json)
      ),
      -- Scoped products
      'products', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (
            SELECT * FROM products
            WHERE server_updated_at > last_pulled_at AND created_at > last_pulled_at AND business_id = client_business_id
        ) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (
            SELECT * FROM products
            WHERE server_updated_at > last_pulled_at AND created_at <= last_pulled_at AND business_id = client_business_id
        ) t), '[]'::json),
        'deleted', coalesce((
            SELECT json_agg(record_id)
            FROM deleted_records
            WHERE table_name = 'products' AND deleted_at > last_pulled_at AND business_id = client_business_id
        ), '[]'::json)
      ),
      -- Child records scoped through parent join (order_items, inventory_logs)
      'order_items', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (
            SELECT * FROM order_items
            WHERE server_updated_at > last_pulled_at AND created_at > last_pulled_at
              AND order_id IN (SELECT id FROM orders WHERE business_id = client_business_id)
        ) t), '[]'::json),
        -- ...
      )
    ),
    'timestamp', current_time_ms
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

#### Key Architecture Guarantees in Pull:

1. **Server Clock Authority**: `current_time_ms` is fetched using `clock_timestamp()`. Client clock drift has zero influence on the server's event horizon.
2. **Child Record Scoping**: Entities lacking a direct `business_id` column (such as `order_items`) are safely isolated by joining against their parent table (`order_id IN (SELECT id FROM orders WHERE business_id = client_business_id)`).
3. **Bandwidth Optimization**: Changes are grouped into `created`, `updated`, and `deleted` arrays matching WatermelonDB's delta sync interface directly, minimizing database compute and serialization overhead.

---

### 4.2 The Push Mechanism (`push_watermelondb_changes`)

When a client pushes local offline changes, it invokes `push_watermelondb_changes(changes, client_business_id)`. The function iterates through the payload with **hard security asserts**:

```sql
-- Security Assert inside push loop
IF (r->>'business_id') != client_business_id THEN
  RAISE EXCEPTION 'Unauthorized product push: target tenant mismatch';
END IF;
```

#### Transactional Atomicity:

Because PL/pgSQL functions execute within a single database transaction:

- If a client sends a batch of 50 orders, and item #49 contains an unauthorized `business_id`, an exception is thrown.
- PostgreSQL **rolls back the entire batch**. Partial or corrupt cross-tenant writes are mathematically impossible.

---

### 4.3 Deletion Auditing & Tombstones (`record_deletion`)

Since offline clients cannot detect hard-deleted rows via standard delta queries, hard deletions trigger the `record_deletion()` procedure:

```sql
CREATE OR REPLACE FUNCTION record_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_business_id text;
BEGIN
  IF TG_TABLE_NAME = 'businesses' THEN
    v_business_id := OLD.id;
  ELSIF TG_TABLE_NAME IN ('employees', 'products', 'orders') THEN
    v_business_id := OLD.business_id;
  ELSIF TG_TABLE_NAME = 'order_items' THEN
    SELECT business_id INTO v_business_id FROM public.orders WHERE id = OLD.order_id;
  ELSIF TG_TABLE_NAME = 'inventory_logs' THEN
    SELECT business_id INTO v_business_id FROM public.products WHERE id = OLD.product_id;
  END IF;

  INSERT INTO deleted_records (table_name, record_id, deleted_at, business_id)
  VALUES (TG_TABLE_NAME, OLD.id, floor(extract(epoch from clock_timestamp()) * 1000)::bigint, v_business_id)
  ON CONFLICT (table_name, record_id)
  DO UPDATE SET deleted_at = EXCLUDED.deleted_at, business_id = EXCLUDED.business_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Tombstones are indexed by `business_id` and `deleted_at`. When a terminal pulls changes, it receives deletion notifications strictly bound to its own `business_id`.

---

## 5. Architectural Exceptions to the "Deny-All" Rule

There are specific operational exceptions where direct PostgREST RLS policies are explicitly defined:

### 5.1 Terminal Heartbeats & Presence (`active_devices`)

Terminals need to register their presence, report app versions, and listen to remote lock/revocation events without spinning up full sync RPCs:

```sql
ALTER TABLE public.active_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select" ON public.active_devices FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.active_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.active_devices FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public delete" ON public.active_devices FOR DELETE USING (true);
```

- **Why permissive policies?** Terminals generate ephemeral hardware identifiers on launch and ping every 30 seconds.
- **Risk Assessment**: Low. The table contains hardware metadata, app build numbers, and last active timestamps. Financial data, catalogs, and transaction ledgers are completely separate.

### 5.2 Global Application Configuration (`app_config`)

The `app_config` table controls forced version updates, maintenance modes, Terms of Service URLs, and the in-app purchase (IAP) feature flag.

- RLS is enabled.
- Public read access is granted so offline terminals coming online can immediately evaluate if their app version is deprecated before attempting synchronization.

### 5.3 RevenueCat Webhooks & In-App Subscriptions

Tables `owners`, `subscriptions`, and `subscription_events` maintain store subscription state.

- RLS is enabled with **NO public policies**.
- Writes occur exclusively via the Supabase Service Role key invoked by the RevenueCat webhook Edge Function.
- Reads are exposed only via locked-down RPCs (`get_or_create_owner`, `get_business_entitlements`).

---

## 6. Sequence Flow: The Complete Request Lifecycle

```mermaid
sequenceDiagram
    autonumber
    participant App as POS Client (WatermelonDB)
    participant PostgREST as Supabase Gateway
    participant StoredProc as RPC (SECURITY DEFINER)
    participant Tables as PostgreSQL Tables
    participant RLS as PostgreSQL RLS Engine

    Note over App,RLS: SCENARIO 1: Malicious Direct REST Query
    App->>PostgREST: GET /rest/v1/orders?select=*
    PostgREST->>RLS: Evaluate RLS policies for role "anon"
    RLS-->>PostgREST: Deny: No permissive policy found
    PostgREST-->>App: 200 OK with [] (Zero rows returned)

    Note over App,RLS: SCENARIO 2: Authorized Offline Sync (Pull)
    App->>PostgREST: POST /rest/v1/rpc/pull_watermelondb_changes
    Note right of App: { last_pulled_at: 1741420000, client_business_id: "biz_123" }
    PostgREST->>StoredProc: Execute pull_watermelondb_changes()
    StoredProc->>StoredProc: Validate client_business_id != NULL
    StoredProc->>Tables: SELECT * WHERE business_id = 'biz_123'
    Tables-->>StoredProc: Filtered delta dataset
    StoredProc-->>PostgREST: Serialized JSON bundle
    PostgREST-->>App: Return changes & new server watermark

    Note over App,RLS: SCENARIO 3: Tampered Push (Cross-Tenant Forgery)
    App->>PostgREST: POST /rest/v1/rpc/push_watermelondb_changes
    Note right of App: Payload contains item with business_id: "biz_VICTIM"
    PostgREST->>StoredProc: Execute push_watermelondb_changes()
    StoredProc->>StoredProc: Loop items: assert (r.business_id == client_business_id)
    StoredProc-->>PostgREST: 500 EXCEPTION: 'Unauthorized product push'
    PostgREST-->>App: Transaction rolled back; 0 rows modified
```

---

## 7. Security Matrix & Component Summary

| Component / Table | RLS Status | Permissive Policies                           | Access Gateway                                           | Trust Level                     |
| :---------------- | :--------- | :-------------------------------------------- | :------------------------------------------------------- | :------------------------------ |
| `businesses`      | `ENABLED`  | None (Deny All)                               | `pull_watermelondb_changes`, `push_watermelondb_changes` | High (Multi-tenant isolate)     |
| `products`        | `ENABLED`  | None (Deny All)                               | `pull_watermelondb_changes`, `push_watermelondb_changes` | High (Multi-tenant isolate)     |
| `orders`          | `ENABLED`  | None (Deny All)                               | `pull_watermelondb_changes`, `push_watermelondb_changes` | High (Multi-tenant isolate)     |
| `order_items`     | `ENABLED`  | None (Deny All)                               | Join-scoped in Pull / Parent checked in Push             | High (Multi-tenant isolate)     |
| `inventory_logs`  | `ENABLED`  | None (Deny All)                               | Product-join scoped                                      | High (Multi-tenant isolate)     |
| `deleted_records` | `ENABLED`  | None (Deny All)                               | `record_deletion()` trigger / Pull filter                | High (Multi-tenant isolate)     |
| `active_devices`  | `ENABLED`  | Public `SELECT`, `INSERT`, `UPDATE`, `DELETE` | Direct PostgREST REST API                                | Low (Device heartbeat metadata) |
| `app_config`      | `ENABLED`  | Public `SELECT`                               | Direct PostgREST REST API                                | Public (App updates & flags)    |
| `subscriptions`   | `ENABLED`  | None (Deny All)                               | Service Role Webhook & Entitlement RPCs                  | Critical (Payment entitlements) |

---

## 8. Summary for Leadership & Engineers

1. **Why not row-by-row JWT RLS?** It contradicts offline-first POS architecture and creates fatal sync latency and connection exhaustion.
2. **How are tenants isolated?** By enforcing **RLS Deny-All** on direct queries and funneling all data transfers through single-transaction **PL/pgSQL RPCs** that validate `client_business_id` programmatic constraints before writing or reading.
3. **Is the Supabase Anon Key safe to expose in the mobile/web bundle?** Yes. A compromised anon key cannot read or alter orders, inventory, or customers because direct table permissions are entirely closed by RLS.
