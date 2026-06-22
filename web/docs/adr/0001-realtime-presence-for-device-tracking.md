# 0001 — Use Supabase Realtime Presence for live device tracking instead of database polling

- **Status:** Accepted
- **Date:** 2026-06-06 (recorded 2026-06-22)
- **Deciders:** Web Terminal team
- **Supersedes:** the original DB-ping device tracker (`feat: implement web device tracking`, commit `d11d827`)

## Context

The Web Terminal shows store admins which devices are logged into their business in real time (the _Active Devices_ modal), and lets an admin remotely log a device out. Each device reports its model, battery, and approximate location, and must disappear from "online" promptly when it closes, sleeps, or loses network.

The first implementation made every logged-in terminal write a "ping" row into the `active_devices` table on a ~30-second interval. The admin modal then polled that table to decide who was online. This had real costs:

- **Write amplification.** N terminals × one write every 30s, indefinitely, against a cloud Postgres that exists primarily as a sync source of truth — pure overhead, paid continuously even when nothing changes.
- **Stale "online" state.** Liveness was inferred from "last ping < threshold". A crashed or backgrounded tab kept looking online until its row aged out, so the modal lied for up to a ping interval.
- **No instant logout.** Remote revocation also had to travel through table writes + polling, adding latency to a security-sensitive action.
- **Coupling to the sync path.** Presence churn competed with, and muddied, the actual data-sync traffic on the same table.

The app already depends on Supabase Realtime (the data-sync layer uses Realtime **Broadcast** for reactive pulls — see [`docs/synchronization_broadcast.md`](../../../docs/synchronization_broadcast.md)). Supabase Realtime also offers **Presence**, a CRDT-backed, connection-bound liveness primitive that is purpose-built for "who is here right now".

## Decision

Track live device presence over a **Supabase Realtime Presence** channel, scoped per business (`devices:{businessId}`), and stop polling the database for liveness.

- Each terminal subscribes to its business channel and calls `channel.track(state)` with its presence payload (device id, model, battery, location, role). Liveness is the Realtime connection itself — when the socket drops, Supabase removes the entry and emits `leave`. No timestamps, no thresholds.
- Presence is refreshed **on events, not on a timer**: initial login, browser `online`, and `visibilitychange → visible` re-track; `offline` and `visibilitychange → hidden` tear down.
- Remote logout is a **Broadcast** `session_revoke` event on the same channel for instant effect, backed by a `device_session_revocations` row so a revoked device cannot silently reconnect (checked via `checkDeviceRevoked` on (re)subscribe).
- The `active_devices` table is **demoted to an offline snapshot store**: a single `is_online: false` row is written only at teardown, so the admin can still see "Recently Offline (24h)". It is no longer the source of truth for "online".

Implementation: [`src/services/devicePresence.ts`](../../src/services/devicePresence.ts) (channel + presence + revoke), [`src/hooks/useActiveDeviceTracker.ts`](../../src/hooks/useActiveDeviceTracker.ts) (event-driven lifecycle), [`src/components/profile/ActiveDevicesModal.tsx`](../../src/components/profile/ActiveDevicesModal.tsx) (admin view). Schema: [`supabase/migrations/20260606000000_device_session_revocations.sql`](../../../supabase/migrations/20260606000000_device_session_revocations.sql), which also runs a one-time cleanup of stale `is_online = true` rows left by the old ping system.

## Options considered

1. **Keep the 30s DB ping (status quo).** Simple, already worked. Rejected: continuous write cost, stale-online window, and slow revocation — all listed above.
2. **Shorten the ping interval / add a Postgres TTL.** Cheaper to build, reduces staleness. Rejected: trades staleness for _more_ write amplification, and still can't detect an abruptly-closed tab faster than the interval.
3. **Realtime Presence + Broadcast revoke (chosen).** Connection-bound liveness, near-zero steady-state writes, instant join/leave and instant revoke. Cost: liveness now lives in Realtime, not in queryable SQL, so a small snapshot table is needed for offline history.

## Consequences

**Positive**

- Steady-state DB writes for presence drop to ~zero; cost scales with _change_, not with headcount × time.
- "Online now" reflects real socket state — a closed tab leaves within seconds.
- Remote logout is instant (broadcast) and durable against reconnect (revocation row).
- Presence traffic is off the data-sync table; concerns are cleanly separated.

**Negative / trade-offs**

- Live presence is **not SQL-queryable** — it exists only in the channel's in-memory presence state. Anything that needs a historical or server-side view (e.g. "recently offline") must read the `active_devices` snapshot, which is best-effort (written on a clean teardown; a hard crash may skip it).
- Correctness now depends on the Realtime WebSocket and on browser lifecycle events (`online`/`offline`/`visibilitychange`) firing reliably across browsers.
- Module-level singleton channel state in `devicePresence.ts` means the tracker and the admin observer must coordinate channel reuse/teardown carefully.

**Follow-ups**

- The web docs still describe the old "Session Pinger" model in places — [`docs/architecture.md`](../architecture.md) (folder-structure comment and the Header section), [`docs/synchronization.md`](../synchronization.md) ("Pinger Table Exceptions"), and [`docs/README.md`](../README.md) ("Session Pinger" quick link). These should be reconciled with [`docs/features.md`](../features.md) §2, which already documents the presence model. (Documentation drift only — not tracked here.)
