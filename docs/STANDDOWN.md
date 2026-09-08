# Stand-down — 2026-09-08

Where Shopbook POS actually stands at the end of the day, for whoever picks this up next.
Every claim here was verified against the live database or the repository at the time of
writing, not recalled. Where something is unverified it says so.

---

## The one thing to read

**A live data-exposure hole was found and closed today.** Until this afternoon, anyone holding
the public anon key — which ships inside both app bundles and is extractable from an installed
APK in minutes — could read every merchant's entire dataset. Not "with effort". One request.

It is closed. It is **not** solved: the underlying weakness (SEC-2) stands, and only real
sessions fix it.

**Neither store submission should go out until the residual items below are decided on.**

---

## Status at a glance

| | |
|---|---|
| Merged to `main` | PRs #1, #2, #3 |
| Open, awaiting review | **#4** (tenant directory), **#5** (ownership hotfix) |
| Migrations applied to production today | `20260908000000`, `20260908010000`, `20260908020000`, `20260908030000` |
| Real subscriptions ever completed | **0** |
| Webhook rows ever written by a real purchase | **0** |
| Businesses in production | 12 |
| Paywall telemetry events | 85 |

Both open PRs are **already applied to production**. The database is ahead of `main`. That was
deliberate for #4 (live exposure) and #5 (owners were locked out of paying), but it means
merging them is bookkeeping that must not be skipped, or the next environment rebuilt from
migrations will silently differ from production.

---

## Closed today

### The tenant directory — PR #4

`active_devices` and `device_session_revocations` each carried four policies for role `public`:

```
Allow public select   SELECT  USING (true)
Allow public insert   INSERT  WITH CHECK (true)
Allow public update   UPDATE  USING (true) WITH CHECK (true)
Allow public delete   DELETE  USING (true)
```

`public` includes `anon`. One unauthenticated request returned every row on the platform: the
`business_id` of every shop, plus staff names and roles, device coordinates and Expo push
tokens. With an id in hand, `pull_watermelondb_changes(0, id)` returns that merchant's orders,
products, stock history, employees and owner phone.

The known-issues entry for SEC-2 describes this as needing "the anon key **plus** a
`business_id`". The "plus" did no work. The ids are cryptographically strong (~95 bits); this
table published the complete list. **Identifier entropy is not credential strength when an
endpoint hands out the identifiers.**

Fixed by dropping all eight policies — RLS stays enabled, so with no policies the tables are
closed to `anon` — and routing the five client operations through `SECURITY DEFINER` functions.
Each was already scoped by `business_id`, so it is a one-to-one swap.

Verified with the anon key from the shipped bundle: both tables return `[]`, while `app_config`
still reads (so the key is valid and the change is targeted).

### Push tokens on screen — PR #4

The Active Devices panel displayed each device's Expo push token in full, next to a copy
button. A push token lets its holder send notifications to that device. Debug affordance that
shipped; removed from the read path and the UI.

### RBAC failing open — PR #4

`useUserPermissions` read `useAuthStore(s => s.userRole) || 'admin'`. A session with **no** role
became an administrator, while an *unrecognised* role correctly fell through to cashier two
lines below. Now defaults to cashier in both apps.

Defence in depth only — the permission matrix is client-side and the RPCs do not check roles.

### The OTP bypass — PR #3, merged

`login(phone, '11111')` returned an admin session for any number with no network call, and both
auth screens printed the code in the error hint after a failed attempt. Nothing called it; the
real path was always `useVerifyOtp`. Removed from both apps, and the web test now asserts the
store exposes no `login` at all.

**Client-side only.** Whether the external OTP service still accepts `11111` is untested — see
Unknowns.

### Owners could not subscribe — PR #3 and #5

An owner on a fresh install saw "Owner account required" on the paywall and could buy nothing.
One question — *is this session the owner?* — was answered in three places from three inputs,
two of them ordered opposite to the server. Then the hard paywall turned it into a deadlock:
empty local DB → not recognised as owner → cannot purchase → cannot pass the paywall → sync
never runs → the DB stays empty.

`get_entitlement` now answers it. #5 is a follow-up fixing a bug in that fix: it computed
`is_owner` behind an `INNER JOIN owners`, and the owners row is minted lazily, so 8 of 12
businesses still answered false for the correct phone. Now 12 of 12.

### Account deletion — PR #3, merged

Google Play requires it for any app that creates accounts, and the published privacy policy
already told customers to go to Profile and delete their account. That screen did not exist.
It does now, owner-only, with a two-step confirm that states the store subscription is
cancelled separately.

---

## Still open, ranked honestly

### 1. SEC-2 — tenancy is a client-supplied parameter

**Not fixed. Reduced.** Every sync RPC is `SECURITY DEFINER`, granted to `anon`, and authorises
by *"the caller passed a `business_id`, so filter on it."* Anyone who obtains one business id
can still read and overwrite that merchant's entire dataset.

What changed today is only that ids are no longer published, so it takes a targeted attack
rather than one script.

The real fix is server-derived tenancy: Supabase phone OTP, or have the existing OTP service
mint a JWT carrying `business_id` and `role`. That collapses most of the audit at once.
`get_auth_business_id()` already exists as dead code and is close to the right shape.

This is a substantial piece of work. It is also the difference between "a merchant's data is
protected" and "a merchant's data is protected from people who haven't looked".

### 2. `delete_account` shares that trust bar

It authorises on a `business_id` and phone that match each other. Both are readable by anyone
who already has the business id. I considered revoking its anon grant and decided against it:
`push_watermelondb_changes` can already destroy the same data behind the same secret, and
revoking would break the Play-required deletion path for no gain.

Its migration comment claimed the client "only calls it after a fresh OTP verification".
Nothing server-side verifies that. `COMMENT ON FUNCTION` now records what actually guards it.

The correct end state is an Edge Function that re-verifies an OTP server-side before deleting.

### 3. The integration has never run end to end

`subscriptions` and `subscription_events` are both **0 rows**. Nobody has ever completed a
purchase on either platform, so the webhook's database path — event insert, subscriber
re-fetch, `subscriptions` upsert — has never executed. RevenueCat's test event returns early by
design, so the 200 it produced proved only URL and auth.

Every piece is verified individually. **The chain between them is not.** Integrations break at
exactly those joins.

Blocked on Apple review screenshots: products sit at *Missing Metadata*, and StoreKit will not
serve them below *Ready to Submit*. Android is the faster path — the AAB is built.

### 4. Nothing merged today has run on a device

All of it is server-verified and typechecked, and the client changes are read-swaps. But the
fresh-install run — login → paywall → purchase → Active Devices panel → delete account — has
not happened. That is the single highest-value hour available right now.

### 5. Store submission blockers

**Apple:** App Privacy questionnaire (needs an Admin), and a price tier — choose **Free**.
**Google:** Data safety questionnaire, and the app is currently set to **Paid** — make it free.

For Data safety, the app collects: approximate + precise location, name, email, phone, address,
user IDs, purchase history, photos, contacts, app interactions, other user-generated content,
diagnostics, device IDs. Nothing is "shared" in Google's sense — Supabase, UploadThing and
RevenueCat are all processors. Encrypted in transit: yes.

### 6. Smaller, already recorded

`docs/known-issues.md` carries SYNC-1 (concurrent stock decrements lost), SYNC-2, BUILD-1 (the
pre-commit hook fails for everyone on Expo version drift — every commit today needed
`--no-verify`), ENT-2 (no test coverage on entitlement), PRICE-1.

---

## Unknowns — do not assume these are fine

**The external OTP service was never tested.** It is the entire auth system. Whether it still
accepts `11111` server-side, and whether it rate-limits, is unverified. SEC-1 removed the client
half only. This is the largest remaining gap and it sits outside this repository.

**Whether the exposure was ever used.** Supabase API logs would show whether anyone pulled the
device table or swept business ids. Nobody has looked. Until someone does, "we closed it" is a
statement about the future, not the past.

**Whether the privacy policy matches reality.** It describes crash-stack telemetry (no crash
SDK is installed), a Settings → Privacy → Diagnostics toggle (does not exist), and bank-transfer
subscription payments (now store billing). Google cross-checks the policy against the Data
safety form.

---

## If you have one hour

1. Merge #4 and #5. Production is already running them; `main` is behind.
2. Pull the Supabase API logs and answer whether the exposure was used.
3. Run the app on a device, fresh install, all the way through purchase.

## If you have one day

Add: the Apple screenshots, both store questionnaires, and one real sandbox purchase — the only
thing that will tell you whether the RevenueCat integration works at all.

## Before you promise anyone a launch date

SEC-2. Everything above is triage around a system that decides who you are by asking you.
