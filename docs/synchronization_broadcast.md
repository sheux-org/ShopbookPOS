# Real-Time Database Synchronization Using Supabase Realtime Broadcast and WatermelonDB

This document outlines the technical design and functionality of the real-time and reliable database synchronization (Sync) mechanism between the Web Terminal and the Mobile App in the **Shopbook POS** system.

---

## 1. System Architecture

The Shopbook POS system operates by integrating a highly efficient, locally-running database (**WatermelonDB**) with a centralized cloud database (**Supabase**).

- **Client Level (Local)**: On both the Web and Mobile terminals, all data reads and writes are performed through the local WatermelonDB. This enables seamless, uninterrupted checkouts even when offline (no internet connection).
- **Cloud Level**: The Supabase PostgreSQL database serves as the system's central Single Source of Truth (SSoT).
- **Real-Time Channel**: Supabase Realtime Broadcast technology is utilized for instantaneous communication and event broadcasting between devices.

---

## 2. Live Sync Workflow (Supabase Realtime Broadcast)

Whenever a device mutates data, it immediately notifies all other devices within the same business group, prompting them to fetch (Pull) the latest changes.

```
+-------------------+                    +-------------------+
|  Device A (Web)   |                    | Device B (Mobile) |
+---------┬---------+                    +---------┬---------+
          │                                        │
          │ 1. User updates record                 │
          │ 2. pushChanges to Supabase             │
          ├────────────────────────────────────────> [Supabase DB]
          │ 3. Broadcast ("sync_trigger")          │
          ├────────────────────────────────────────> [Supabase Realtime]
          │                                        │
          │         4. Receive Broadcast           │
          │<───────────────────────────────────────┤
          │         5. background pullChanges()    │
          │          (Sync local database)         │
          │                                        ▼
```

### Step-by-Step Workflow:

1.  **Data Mutation**: A user on the Web Terminal updates a product, record, or order.
2.  **Push Cycle**: The `syncDatabase()` function (defined in [web sync.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/services/sync.ts) on web, and [mobile sync.ts](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/mobile/services/sync.ts) on mobile) pushes local mutations to Supabase using the `push_watermelondb_changes` RPC.
3.  **Broadcast Event**: Once the push cycle completes successfully, the device sends a lightweight `sync_trigger` event over the scoped Supabase Broadcast channel:

    ```typescript
    import { supabase } from '../services/sync';

    // Broadcast trigger
    await supabase.channel(`sync:${businessId}`).send({
      type: 'broadcast',
      event: 'sync_trigger',
      payload: {
        senderId: 'device-unique-uuid-1', // Unique client identifier for the device
        businessId: 'active-business-id', // Active business ID
        timestamp: Date.now(),
      },
    });
    ```

4.  **Receive & Background Pull**: The Realtime Listener running on the Mobile App (registered in [\_layout.tsx](<file:///Users/shenux/Desktop/Shopbook/shopbook-pos/mobile/app/(tabs)/_layout.tsx>)) or Web Terminal (registered in [layout.tsx](file:///Users/shenux/Desktop/Shopbook/shopbook-pos/web/src/app/layout.tsx)) receives this message. If the received `businessId` matches the locally active business, the receiver triggers a background `syncDatabase(false)` (pull-only sync) to fetch and apply the latest remote changes locally without forcing a full page reload.

---

## 3. Network Transition (Offline-to-Online Behavior)

Since POS systems typically operate in environments prone to network disruptions, the transition between offline and online states must be fully automated and seamless.

### 1. Offline Behavior

- All data additions, modifications, and deletions (CRUD operations) performed by the user are immediately saved to the local WatermelonDB.
- WatermelonDB flags these local mutations as **dirty records (pending synchronization)**.

### 2. Connection Monitoring (Network Listeners)

- **Mobile (React Native)**: Monitors network status using `@react-native-community/netinfo`.
- **Web (Next.js)**: Listens for the browser's `online` event to detect reconnection.
  ```typescript
  // Web (app/layout.tsx)
  useEffect(() => {
    const handleOnline = () => {
      console.log('Network status: online. Triggering auto-sync...');
      syncDatabase(); // Auto-trigger full sync on reconnection
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
  ```

### 3. Auto-Trigger Sync Workflow

Once a connection is established, `syncDatabase()` triggers automatically:

1.  **Pull Phase**: Retrieves all remote mutations that occurred during the offline period and applies them locally.
2.  **Conflict Resolution**: Automatically resolves any conflicts locally on the client-side.
3.  **Push Phase**: Pushes all pending local changes (accumulated while offline) to the Supabase database.
4.  **Broadcast Event**: Dispatches a broadcast event to notify other active devices upon a successful push.

---

## 4. Sync Loop Prevention

One of the most critical challenges in real-time broadcast synchronization is preventing infinite loops.

> [!WARNING]
> **How loops are created**: Device A pushes a change -> broadcasts notification -> Device B receives notification, pulls the change, and writes it to its local database -> Device B's local database change gets treated as a new change, triggering a push -> broadcasts notification -> Device A receives notification, pulls, and pushes... This infinite cycle degrades network bandwidth and server performance.

### Prevention Strategies:

1.  **Sender ID Filtering (Client Identification)**:
    Each device generates a session-specific unique `clientId` (UUID) on startup. When a broadcast message is received, the client compares the message's `senderId` with its own `clientId` and discards it if they match.

    ```typescript
    const myClientId = getClientId(); // Unique identifier generated per instance session

    supabase
      .channel(`sync:${activeBusinessId}`)
      .on('broadcast', { event: 'sync_trigger' }, ({ payload }) => {
        if (payload.senderId === myClientId) {
          return; // Ignore events sent by this client instance
        }
        if (payload.businessId !== activeBusinessId) {
          return; // Ignore events for different business scopes
        }

        // Perform a background sync (pull-only)
        syncDatabase(false);
      });
    ```

2.  **Push-Only Broadcast Triggers**:
    A broadcast event is sent **only after a device successfully completes a push cycle** containing local updates. Pull-only operations must never trigger a broadcast.

3.  **WatermelonDB Internal Behavior (Non-Dirty Remote Writes)**:
    WatermelonDB's built-in synchronization adapter does not mark incoming pulled records as dirty. Since changes written to the local database from a remote pull do not set the dirty flags, the app never tries to push them back to the server.

---

## 5. Network Request Optimization

To conserve network bandwidth and improve speed, especially in regions with spotty connections, network requests are minimized:

- **Reactive Sync vs. Polling**: Polling-based sync (fetching changes every 10 to 30 seconds) is avoided. Instead, updates occur reactively only when a broadcast event signaling real database modifications is received.
- **Minimal Payload Size**: Broadcast events carry a minimal payload containing only structural metadata (`senderId`, `businessId`, and a timestamp) instead of the actual changed records. The actual data transfer happens over secure and optimized PostgreSQL RPC calls (`pull_watermelondb_changes`), keeping broadcast overhead near zero.

---

## 6. Conflict Resolution (Offline-to-Online Transitions)

> [!IMPORTANT]
> **What is a Sync Conflict?**
> A sync conflict occurs when User A (Mobile) and User B (Web) modify the same record (e.g., Order #1001) concurrently while offline.
>
> - User A cancels the order (Status: `cancelled`).
> - User B processes the order (Status: `processed`).
>   When both clients reconnect and push their edits, the server and clients must determine the final valid state.

### Conflict Resolution Strategy:

WatermelonDB handles conflict resolution on the client side during the pull phase. If an incoming remote change conflicts with a pending local change, WatermelonDB runs a resolver to decide which version to save.

#### 1. Last-Write-Wins (LWW) - Default Strategy

The default behavior is the Last-Write-Wins strategy, which relies on the `updated_at` timestamp. The record with the most recent timestamp is persisted.

#### 2. POS Domain Rules (Business Logic Conflict Resolution)

For commerce and checkout domains, domain-specific rules override pure LWW:

- **Cancellation Precedence**: Once an order status is marked as `cancelled`, that state takes precedence over other status transitions (e.g., changing from `cancelled` back to `processed` is denied).
- **Delta-Based Inventory Adjustments**: For inventory stocks, direct value overwrites are avoided. Instead, the net difference (e.g., +5 or -2) is applied to the server's stock balance, preventing inventory loss.

#### 3. Client-Side Resolver Code Example:

```typescript
import { Database } from '@nozbe/watermelondb';

// Custom conflict resolver supplied to WatermelonDB's pullChanges cycle
function resolveOrderConflict(localRecord, remoteRecord) {
  // Business Rule: A cancellation status cannot be overwritten
  if (localRecord.status === 'cancelled' || remoteRecord.status === 'cancelled') {
    return {
      ...remoteRecord,
      status: 'cancelled',
      updated_at: Math.max(localRecord.updatedAt, remoteRecord.updatedAt),
    };
  }

  // Fall back to Last-Write-Wins (LWW)
  return localRecord.updatedAt > remoteRecord.updatedAt ? localRecord : remoteRecord;
}
```

---

## 7. Multi-User & Multi-Tenant Scoping

The system cleanly handles real-time synchronization across multiple users (e.g., cashiers, managers) and different businesses (e.g., branches or distinct tenants):

### 1. Multi-Cashier Synchronization (Within the Same Business)

- **Instant Updates**: Yes, all 5 cashiers and the manager logged into the same business receive sync broadcasts simultaneously.
- **Example**: If the admin or one cashier updates a product price on their device, that change pushes instantly and triggers broadcasts. The catalog on the other 4 cashiers' devices and the manager's screen updates reactively in the background, without requiring a manual page refresh.

### 2. Business-Scoped Channels (Tenant Isolation)

- Realtime Broadcast channels are scoped dynamically using the business ID prefix: `sync:${activeBusinessId}`.
- **Business A** devices subscribe and broadcast to `sync:BusinessA`.
- **Business B** devices subscribe and broadcast to `sync:BusinessB`.
- This structure ensures Business A broadcasts never leak to Business B. Data leakage at the network broadcast layer is physically impossible.

### 3. Multi-Branch Swapping

- When a user (e.g., Admin) switches branches or businesses inside the app:
  1.  The app unsubscribes from the previous branch's broadcast channel: `sync:${oldBusinessId}`.
  2.  The app subscribes to the new branch's broadcast channel: `sync:${newBusinessId}`.
  3.  A complete synchronization cycle is run to align the local WatermelonDB database with the new branch's data state.
- From that moment onward, the device only receives updates and broadcasts for the newly selected active branch.

### 4. Security Isolation for Distinct Users/Tenants

- In addition to broadcast channel scoping, database operations are guarded by **Row Level Security (RLS)** in Supabase.
- Even if a user attempts to spoof real-time broadcasts or request data belonging to another business ID, the server-side PostgreSQL RPC function (`pull_watermelondb_changes`) enforces strict permission checks:
  ```sql
  -- Security assertion within the PostgreSQL Sync function
  IF (r->>'business_id') != client_business_id THEN
    RAISE EXCEPTION 'Unauthorized database operation';
  END IF;
  ```
- This zero-trust architecture ensures data is fully isolated and secure from unauthorized access or cross-tenant modification.

---

## 8. Summary

By leveraging Supabase Broadcast channels and WatermelonDB client sync, the Shopbook POS system achieves:

1.  **Fully Functional Offline Mode**: The POS remains fully operational for checkout and CRUD tasks without internet access.
2.  **Automatic Synchronization**: Reconnection immediately triggers automatic data pulling, conflict resolution, and data pushing.
3.  **Network Efficiency**: Eliminates polling overhead in favor of reactive, low-overhead sync triggers.
4.  **Instant Multi-Device Sync**: Synchronizes all active cashier and management terminals within sub-second latency.
5.  **Robust Sync Integrity**: Prevents synchronization loops and data loss during concurrent offline changes.
