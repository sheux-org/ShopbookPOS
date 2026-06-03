# Database Synchronization & Security

To support real-time collaboration across multiple terminals, the application replicates local database modifications to the cloud database (Supabase) in the background.

---

## Synchronization Protocol

Replication is handled by the **`syncDatabase`** function inside [sync.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/services/sync.ts#L62-L95) using WatermelonDB’s built-in replication protocol. It executes two main cycles:

1. **Pull Cycle (`pullChanges`)**: Retrieves modified records from the server that have a newer modification timestamp than the client's `lastPulledAt` marker.
2. **Push Cycle (`pushChanges`)**: Sends a batch of locally created, updated, and deleted records to the server.

```
+------------------+                   +----------------------+
|   WatermelonDB   |                   |  Supabase Server DB  |
| (Local terminal) |                   |    (Cloud DB)        |
+--------┬---------+                   +----------┬-----------+
         │                                        │
         │ 1. pullChanges(lastPulledAt)           │
         ├───────────────────────────────────────>│ 
         │                                        │ RPC: pull_watermelondb_changes
         │ 2. Return JSON changes & timestamp     │ Filtered by client_business_id
         │<───────────────────────────────────────┤
         │                                        │
         │ 3. pushChanges(created, updated, del)  │
         ├───────────────────────────────────────>│
         │                                        │ RPC: push_watermelondb_changes
         │ 4. SQL UPSERT / delete execution       │ Security assert checked
         │<───────────────────────────────────────┤
         ▼                                        ▼
```

---

## Server RPC Functions

The database uses raw SQL PL/pgSQL Remote Procedure Calls (RPCs) to perform mutations and selections to prevent direct table manipulation via REST endpoints. The schema of these RPCs is defined in [20260603000000_secure_tenant_isolation.sql](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/supabase/migrations/20260603000000_secure_tenant_isolation.sql).

### 1. `pull_watermelondb_changes(last_pulled_at, client_business_id)`
Fetches server updates for all 6 tables.
- **Tenant Filtering**: The query automatically appends a filter: `business_id = client_business_id` (or `id = client_business_id` for the `businesses` table).
- **Time Window**: Evaluates records with a `server_updated_at > last_pulled_at` timestamp.
- **Deletion Tracking**: Retrieves deleted records from a dedicated `deleted_records` tracking table.

### 2. `push_watermelondb_changes(changes, client_business_id)`
Saves client-side modifications back to Supabase.
- **Table Batches**: Processes changes sequentially. The order is strictly defined by `PUSH_TABLE_ORDER` to prevent foreign key errors:
  1. `businesses`
  2. `employees`
  3. `products`
  4. `orders`
  5. `order_items`
  6. `inventory_logs`
- **Security Check**: Enforces tenant boundary assertions on every record:
  ```sql
  -- Security assert in PL/pgSQL function
  IF (r->>'business_id') != client_business_id THEN
    RAISE EXCEPTION 'Unauthorized product push';
  END IF;
  ```
  If a malicious terminal attempts to push rows with a foreign `business_id`, the function raises an exception and aborts the entire transaction.

---

## Secure Multi-Tenant Isolation (RLS)

The database security model enforces **Zero Trust Direct REST access** to ensure tenants can only interact with their own data:

1. **Anonymous Connection**: The Web client operates anonymously, authenticating calls by passing the active shop ID (`client_business_id`) to the secure RPC functions.
2. **REST API Deny-All Policy**: Direct table querying via postgREST (`supabase.from('products').select()`) is blocked. All core tables (`businesses`, `employees`, `products`, `orders`, `order_items`, `deleted_records`) have Row Level Security (RLS) enabled with no permissive policies:
   ```sql
   ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
   -- Without SELECT/INSERT/UPDATE policies defined, all direct REST access is denied by default!
   ```
   Data access is only possible through execution of the `pull_watermelondb_changes` and `push_watermelondb_changes` functions which run with `SECURITY DEFINER` privileges.
3. **Pinger Table Exceptions**: The `active_devices` table has a permissive public RLS policy ([20260603000000_secure_tenant_isolation.sql:L620-L637](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/supabase/migrations/20260603000000_secure_tenant_isolation.sql#L620-L637)) allowing anonymous terminals to write pings and fetch remote revocation statuses.

---

## Deletion Logging

Since deleted records are physically removed from primary tables, client terminals must know which records were deleted to update their local IndexedDB. 
- A PostgreSQL database trigger function `record_deletion()` ([20260603000000_secure_tenant_isolation.sql:L10-L32](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/supabase/migrations/20260603000000_secure_tenant_isolation.sql#L10-L32)) intercepts `DELETE` events on all core tables.
- It extracts the `business_id` and records the deletion event in the `deleted_records` table:
  ```sql
  INSERT INTO deleted_records (table_name, record_id, deleted_at, business_id)
  VALUES (TG_TABLE_NAME, OLD.id, floor(extract(epoch from clock_timestamp()) * 1000)::bigint, v_business_id);
  ```

---

## Image Upload Queue

Product and business logo files are hosted on Supabase Storage within the `business-logos` bucket.
- **Upload Controller**: [sync.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/services/sync.ts#L97-L117)
- **Local Upload Queue**: [uploadQueue.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/services/uploadQueue.ts)
  To ensure offline operation, image uploads are queued locally if the terminal is offline. They are processed sequentially when the browser detects that connection is restored.
