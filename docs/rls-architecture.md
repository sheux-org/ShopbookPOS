# Row-Level Security and tenant isolation

> Status: describes production as of 2026-09-08, after `20260908100000_server_derived_tenancy.sql`.
> The earlier version of this document claimed the anon key could not reach merchant data. That was false: every RPC took the tenant from a client parameter. See `tenant-isolation-audit.md` for the findings this design closes.

## Identity

Login is Supabase Auth phone OTP. Supabase generates, stores, expires and rate-limits the code; delivery goes through the **Send SMS** auth hook to `mini-pos-sync-server`, which sends it via text.lk. A successful `verifyOtp` yields a session whose JWT carries `role: authenticated` and the verified `phone`. supabase-js persists and refreshes it (AsyncStorage on mobile, localStorage on web). The apps never mint or store a token of their own.

The database reads that claim through `auth_phone()`, which is `normalize_phone_pg(auth.jwt() ->> 'phone')`. Membership is the existing data:

| Helper                      | True when                                                                 |
| --------------------------- | ------------------------------------------------------------------------- |
| `is_owner_of(business_id)`  | `businesses.phone_number` matches the caller's phone                      |
| `is_member_of(business_id)` | owner, or an `employees` row for that business matches the caller's phone |

Both are `SECURITY DEFINER`, `STABLE`, with `search_path = public`, and are the only place authorization logic lives.

## Tables

RLS is enabled on all 14 public tables. `anon` and `authenticated` hold **no table privileges** except `SELECT` on `app_config` (force-update flag, kill switch, legal URLs). Default privileges are altered so new tables start closed. `v_subscription_events` runs as `security_invoker`. Direct PostgREST access to a data table returns `42501` for every client role.

## Functions

Every RPC is `SECURITY DEFINER`, executable by `authenticated` only, and starts with a membership check:

| RPC                                                             | Check                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pull_watermelondb_changes(last_pulled_at, client_business_id)` | `require_member`                                                                                                                                                                                                                                |
| `push_watermelondb_changes(changes, client_business_id)`        | member, or a non-member registering their own shop (a `businesses` row carrying their phone). Business rows must name the calling tenant; only the owner can change `phone_number` or delete the business; every delete is scoped to the tenant |
| `fetch_user_businesses()`                                       | phone from JWT                                                                                                                                                                                                                                  |
| `check_phone_registered(phone, …)`                              | full detail for the caller's own phone, `{exists}` only for any other                                                                                                                                                                           |
| `get_or_create_owner()`                                         | phone from JWT                                                                                                                                                                                                                                  |
| `get_entitlement(client_business_id)`                           | `require_member`; `is_owner` computed server-side                                                                                                                                                                                               |
| `delete_account(client_business_id)`                            | `require_owner`; also deletes the auth user                                                                                                                                                                                                     |
| `log_paywall_event(…)`                                          | authenticated; member when a business id is given                                                                                                                                                                                               |
| presence and revocation functions                               | `require_member`                                                                                                                                                                                                                                |

The `client_business_id` parameter still exists because a phone can belong to several businesses. It names which one the client is talking about; it no longer proves anything.

## Realtime

Channels `sync:{business_id}` and `devices:{business_id}` are private. Two policies on `realtime.messages` allow `authenticated` to read and write broadcast and presence only when `is_member_of(split_part(realtime.topic(), ':', 2))`.

## Test login

Supabase test OTP: `0717133074` accepts `111111` until 2027-09-08. No SMS is sent for that number.

## Still open

- RBAC is client-side. Any member can call any RPC; a cashier is not stopped by the server from editing products. (`TEN-9`, `SEC-3`)
- The UploadThing route has no auth. (`TEN-12`)
- One local SQLite holds every business the device has opened. (`TEN-10`)
- Adding a staff row with someone's phone grants that person membership by design; there is no invite acceptance.
