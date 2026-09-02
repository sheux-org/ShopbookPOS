# RevenueCat Integration — Build Plan

Companion to `01-audit.md` (findings) and `03-store-and-revenuecat-configuration.md` (dashboard work). This document is the engineering contract: architecture, phases, file-level changes, and acceptance criteria.

## 1. Target architecture

```
                     ┌────────────────────────────────────────────────┐
                     │  App Store / Google Play (auto-renewable subs) │
                     └───────────────▲───────────────────┬────────────┘
                purchase / restore   │                   │ server notifications
                                     │                   ▼
┌───────────────────┐   SDK   ┌──────┴────────┐  webhook  ┌──────────────────────────┐
│ Mobile (OWNER     │◄───────►│  RevenueCat   │──────────►│ Supabase Edge Function   │
│ session only)     │         │  entitlement  │           │ revenuecat-webhook        │
│ Purchases.logIn   │         │  "pro"        │◄──────────│ (re-fetch subscriber,     │
│ (owners.id)       │         └───────────────┘  REST v1  │  upsert subscriptions)    │
└───────┬───────────┘                                     └────────────┬─────────────┘
        │ instant unlock after purchase                                │ service role
        │                                                              ▼
        │            get_entitlement(business_id) RPC        ┌───────────────────────┐
        └──────────────────────────┬────────────────────────►│ owners, subscriptions │
                                   │                         └───────────────────────┘
      ┌────────────────────────────┼──────────────────────────────┐
      │ Mobile (staff session)     │ Web (owner or staff)          │
      │ reads RPC, caches offline  │ reads RPC, blocks when !pro   │
      └────────────────────────────┴───────────────────────────────┘
```

Rules that fall out of this:

- `subscriptions.expires_at` (server) is the truth. `CustomerInfo` on the owner's phone is a fast path, never the only path.
- Every consumer resolves entitlement through **one** function: `get_entitlement(client_business_id)`.
- Mobile persists the last known entitlement `{ isPro, expiresAt, checkedAt }` and treats it as valid offline until `expiresAt`. No grace beyond that on the client — grace is expressed server-side by the webhook (billing-issue grace period extends `expires_at`).
- Bank-transfer customers: ops → RevenueCat dashboard → _Grant promotional entitlement_ (`pro`, duration = plan) → webhook → same table. App code has zero knowledge of bank transfers.

## 2. Identity

| Session        | RevenueCat App User ID | Reads entitlement via                                                    |
| -------------- | ---------------------- | ------------------------------------------------------------------------ |
| Owner (mobile) | `owners.id` (uuid)     | SDK `CustomerInfo` **and** RPC (RPC wins on conflict once webhook lands) |
| Staff (mobile) | never configured       | RPC only                                                                 |
| Web (any)      | never configured       | RPC only                                                                 |

`isOwner` is **not** `activeEmployeeId === 'owner'` — registration creates an `employees` row (role `admin`) with the owner's phone, and `useVerifyOtp` matches that row first. Define it once:

```ts
// mobile/utils/business.ts (add)
export const isBusinessOwner = (userPhone: string | null, business: { phone: string }) =>
  !!userPhone && normalizePhone(userPhone) === normalizePhone(business.phone);
```

`owners.id` is obtained with `get_or_create_owner(input_phone)` (SECURITY DEFINER, same trust model as `fetch_user_businesses`). Owners are created lazily on first owner login after this ships.

## 3. Data model (Supabase)

```sql
-- supabase/migrations/2026XXXX_revenuecat_entitlements.sql
create extension if not exists pgcrypto;

create table public.owners (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,               -- normalize_phone_pg() output
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  owner_id uuid primary key references public.owners(id) on delete cascade,
  entitlement text not null default 'pro',
  is_active boolean not null default false,
  expires_at timestamptz,
  will_renew boolean not null default false,
  product_id text,
  store text,                                -- APP_STORE | PLAY_STORE | PROMOTIONAL | ...
  period_type text,                          -- NORMAL | TRIAL | INTRO | PROMOTIONAL
  environment text,                          -- PRODUCTION | SANDBOX
  management_url text,
  rc_last_event_id text,
  updated_at timestamptz not null default now()
);

create table public.subscription_events (   -- idempotency + audit
  id text primary key,                       -- RevenueCat event.id
  owner_id uuid references public.owners(id) on delete set null,
  type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table public.owners enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
-- no policies: only service role (webhook) and SECURITY DEFINER RPCs touch these.

alter table public.app_config add column iap_enabled boolean not null default false;

create or replace function public.get_or_create_owner(input_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare clean text := public.normalize_phone_pg(input_phone); oid uuid;
begin
  if clean is null or clean = '' then raise exception 'phone required'; end if;
  insert into owners(phone) values (clean)
    on conflict (phone) do update set phone = excluded.phone
    returning id into oid;
  return oid;
end $$;
grant execute on function public.get_or_create_owner(text) to anon, authenticated;

create or replace function public.get_entitlement(client_business_id text)
returns json language sql security definer set search_path = public stable as $$
  select coalesce(
    (select json_build_object(
        'is_pro', coalesce(s.is_active and (s.expires_at is null or s.expires_at > now()), false)
                  or o.created_at + interval '14 days' > now(),
        'is_trial', not coalesce(s.is_active and (s.expires_at is null or s.expires_at > now()), false)
                    and o.created_at + interval '14 days' > now(),
        'trial_ends_at', o.created_at + interval '14 days',
        'expires_at', s.expires_at, 'will_renew', s.will_renew,
        'product_id', s.product_id, 'store', s.store, 'management_url', s.management_url,
        'owner_id', o.id)
     from businesses b
     join owners o on o.phone = public.normalize_phone_pg(b.phone_number)
     left join subscriptions s on s.owner_id = o.id
     where b.id = client_business_id),
    json_build_object('is_pro', false, 'is_trial', false));
$$;
grant execute on function public.get_entitlement(text) to anon, authenticated;
```

`is_pro` is computed at read time from `expires_at`, so an expiry takes effect even if the `EXPIRATION` webhook is delayed. The 14-day trial (website promise) is the `owners.created_at` clause — no trial table, no store intro offer, nothing for the client to track. A business whose owner has never logged in since release has no `owners` row and resolves to `is_pro=false`; the owner's first login creates it and starts the trial.

## 4. Webhook (Supabase Edge Function)

`supabase/functions/revenuecat-webhook/index.ts` — Deno, deployed with `--no-verify-jwt` (RevenueCat doesn't send a Supabase JWT). Secrets: `RC_WEBHOOK_SIGNING_SECRET` (HMAC signing secret, preferred), `RC_WEBHOOK_AUTH` (shared header value, fallback), `RC_SECRET_API_KEY` (**v1** secret key — the subscriber re-fetch in step 5 is a v1 endpoint), `SUPABASE_SERVICE_ROLE_KEY`.

Algorithm (deliberately event-type-agnostic):

1. Authenticate, or `401`. Read the body **once as text** — the signature covers raw bytes, and re-serialising parsed JSON changes them.
   - **Preferred:** verify `X-RevenueCat-Webhook-Signature: t=<unix>,v1=<hmac-sha256>`. Compute HMAC-SHA256 over `"{timestamp}.{raw body}"` with `RC_WEBHOOK_SIGNING_SECRET`, compare in constant time, and reject timestamps outside ±5 minutes (replay window).
   - **Fallback:** when no signing secret is configured, compare the `Authorization` header against `RC_WEBHOOK_AUTH`, also in constant time.
   - Both paths are implemented; the signature is used whenever the secret is set.
2. Parse `{ event }`. `type === 'TEST'` → `200`.
3. Collect app user ids: `[event.app_user_id, event.original_app_user_id, ...event.transferred_to ?? [], ...event.transferred_from ?? []]`, keep only those that parse as UUID (ignores `$RCAnonymousID:` aliases).
4. Insert `subscription_events` (`on conflict (id) do nothing`); if the row already existed → `200` (retry of a processed event).
5. For each uuid: `GET https://api.revenuecat.com/v1/subscribers/{id}` with the **secret** key → read `subscriber.entitlements.pro` (`expires_date`, `product_identifier`, `purchase_date`) and `subscriber.subscriptions[product_identifier]` (`store`, `period_type`, `unsubscribe_detected_at`, `billing_issues_detected_at`, `grace_period_expires_date`). Upsert `subscriptions`:
   - `expires_at = max(expires_date, grace_period_expires_date)`
   - `is_active = expires_at > now()` (or `true` when `expires_date` is null = lifetime/promotional-forever)
   - `will_renew = unsubscribe_detected_at is null and billing_issues_detected_at is null`
6. Always `200` after a successful upsert; `500` on DB/API failure so RevenueCat retries.

Re-fetching the subscriber instead of interpreting each event type is what makes this correct under out-of-order delivery, `TRANSFER`, promotional grants, and refunds with one code path. It costs one REST call per event (rate limit is generous; volume is tiny).

## 5. Mobile changes

### 5.1 Dependencies / config

- `pnpm --filter shopbook-pos add react-native-purchases@10.8.1` (no config plugin needed; `BILLING` permission is merged by the Play Billing library; IAP capability is on by default for explicit App IDs).
- `.env` / EAS secrets: `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, optional `EXPO_PUBLIC_REVENUECAT_TEST_KEY` (Expo Go / simulator preview). Public SDK keys are safe to ship in the bundle.
- New dev build required (`eas build --profile development`); Expo Go keeps working in Preview API mode with the `test_` key.

### 5.2 New files

```
mobile/services/purchases.ts          # thin RC wrapper: configure, logIn/logOut, offerings, purchase, restore, manage
mobile/stores/useEntitlementStore.ts  # { isPro, expiresAt, willRenew, store, managementUrl, checkedAt, source } persisted
mobile/hooks/useEntitlementSync.ts    # on login / app foreground / after purchase: RPC + (owner) CustomerInfo listener
```

`services/purchases.ts` (shape):

```ts
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';
export const ENTITLEMENT_ID = 'pro';
export const OFFERING_ID = 'default';

export function configurePurchases() {
  const apiKey = Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  });
  if (!apiKey) return false;
  Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
  return true;
}
export const loginPurchases = (ownerId: string) => Purchases.logIn(ownerId);
export const logoutPurchases = () => Purchases.logOut();
export const getProPackages = async () =>
  (await Purchases.getOfferings()).current?.availablePackages ?? [];
export const purchase = (pkg: PurchasesPackage) => Purchases.purchasePackage(pkg);
export const restore = () => Purchases.restorePurchases();
export const manage = async (managementUrl?: string | null) =>
  Platform.OS === 'ios'
    ? Purchases.showManageSubscriptions()
    : Linking.openURL(managementUrl ?? 'https://play.google.com/store/account/subscriptions');
// showManageSubscriptions() is iOS-only in react-native-purchases; Android uses CustomerInfo.managementURL.
export const isPro = (info: CustomerInfo) => ENTITLEMENT_ID in info.entitlements.active;
```

`useEntitlementStore` replaces `isPremium` everywhere. It is written from two sources: `rpc` (`get_entitlement`) and `sdk` (owner device `CustomerInfo`). Precedence: the newer `checkedAt` wins, except a positive SDK result right after a purchase is kept until the next RPC confirms (webhook latency is seconds; RPC re-check runs 5 s after purchase and on next foreground).

### 5.3 Wiring

- `app/_layout.tsx`: `configurePurchases()` once on mount (RootLayout `useEffect`).
- `hooks/useAuth.ts` `onSuccess` (both mutations): if `isBusinessOwner(phone, business)` → `get_or_create_owner(phone)` → `loginPurchases(ownerId)`; always → `useEntitlementStore.refresh(businessId)`.
- `useAuthStore.logout`: `logoutPurchases()` (ignore errors when not configured) and `useEntitlementStore.reset()`.
- `useBusinessStore.setActiveBusiness`: `refresh(id)` (owner may own several; entitlement is per owner so result is the same, but staff can be attached to a different owner's business).
- App foreground (`AppState` → `active`) and after `syncDatabase` success: `refresh`.

### 5.4 Gates (mechanical)

Replace `useSettingsStore((s) => s.isPremium)` with `useEntitlementStore((s) => s.isPro)` at the 11 call sites in the audit table. Then delete `isPremium`, `setPremium`, and the `Proxy` wrapper from `mobile/stores/useSettingsStore.ts` (export `useSettingsStoreRaw` as `useSettingsStore` again). Same deletion in `web/src/stores/settingsStore.ts`.

### 5.5 Paywall — `premium-plans.tsx` rewrite (one screen)

Keep the existing visual language (tabs 1M/3M/1Y, one detail card, feature list). Change what feeds it:

- Packages from `getProPackages()`; map `$rc_monthly → 1 Month`, `$rc_three_month → 3 Months`, `$rc_annual → 1 Year`. Price = `pkg.product.priceString`; per-month equivalent = `pkg.product.price / months`; saving % = `1 − (perMonth / monthlyPerMonth)` — with the website prices this renders **Save 14%** (annual) and **Save 5%** (quarterly), not 25%. No strike-through anchors. Hide the badge when saving < 5%.
- CTA "Subscribe · {priceString} / {period}" → `purchase(pkg)`. On `userCancelled` do nothing; on success → `useEntitlementStore.setFromSdk(customerInfo)` → success state (diamond card "You're on Pro") → `router.back()` after 1.2 s so the user lands on the feature they were trying to use.
- Mandatory footer: "Auto-renews until cancelled. Cancel anytime in {App Store|Google Play}." · **Restore purchases** · **Terms of Use** · **Privacy Policy** (URLs from `app_config`, see §3 additions in config doc).
- During trial (`is_trial`): keep the plan selector and CTA; banner "Free trial — ends in N days" above it (N from `trial_ends_at`). Subscribing during the trial starts billing immediately (store rules) — say so on the CTA line.
- When already Pro: replace the plan card with the _manage_ card: plan name, `expires_at` as "Renews on …" / "Expires on …" (`will_renew`), buttons **Manage subscription** (`manage()`), **Restore**. No "Downgrade".
- When session is staff (`!isBusinessOwner`): no purchase CTA; card says "Ask {business.name}'s owner ({masked phone}) to upgrade." Keep feature list.
- When `app_config.iap_enabled === false` or `getProPackages()` is empty/throws: show feature list + "Subscriptions are coming soon" — never a dead button.
- Delete `payment-select.tsx` and its `Stack.Screen`. Remove `premium.downgrade` strings; add `premium.restore`, `premium.manage`, `premium.terms`, `premium.privacy`, `premium.autoRenewNotice`, `premium.askOwner`, `premium.comingSoon` in `en/si/ta`.

### 5.6 `PremiumUpgradeModal`

Unchanged except: the "Upgrade Now" button label becomes "See Pro plans" for staff (it still opens the plans screen, which explains who can upgrade).

## 6. Web changes

- `web/src/hooks/useEntitlement.ts`: `useQuery(['entitlement', businessId], () => supabase.rpc('get_entitlement', …))`, `staleTime` 5 min, refetch on window focus.
- `web/src/components/layout/ProBlocker.tsx` (sibling of `SyncBlocker`/`MobileBlocker`): when `is_pro === false` render a full-page card: "Web terminal is a Shopbook POS Pro feature — subscribe from the mobile app (Profile → Shopbook POS Pro)". No purchase on web (no Stripe in Sri Lanka).
- Mount it in the authenticated layout after `useAppAuthGuard`. Remove `isPremium/setPremium` from `settingsStore`.

## 7. Ops runbook (bank transfer / manual activation)

1. Customer pays by bank transfer and sends proof on WhatsApp (channel lives on the website, not in the apps).
2. Ops looks up the owner: Supabase → `owners` by normalized phone → copy `id`.
3. RevenueCat dashboard → Customers → search `id`. The customer exists once the owner has logged in on a build containing this change.

   If the customer does not exist yet, grant via the **v2** API — note this is a _different key_ from the webhook's v1 one, and v1 keys do **not** work on v2 endpoints:

   ```
   POST https://api.revenuecat.com/v2/projects/{project_id}/customers/{customer_id}/actions/grant_entitlement
   Authorization: Bearer <v2 secret key>   # needs customer_information:customers:read_write
   Content-Type: application/json

   { "entitlement_id": "pro", "expires_at": <ms since epoch> }
   ```

   `expires_at` is an absolute millisecond timestamp, not a duration — compute it from the plan bought (now + 1 / 3 / 12 months).

4. _Grant promotional entitlement_ → `pro`, duration = plan bought.
5. Webhook fires → `subscriptions` updated → owner's and staff's devices unlock on next foreground/refresh (≤ 5 min on web).
6. To revoke: RevenueCat → customer → _Revoke_ promotional entitlement.

## 8. Phases, ordering, estimates

| #   | Phase                                                      | Depends on                     | Output                                                                                                 | Est.                              |
| --- | ---------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------- |
| 0   | Accounts & decisions (config doc §1–§2)                    | —                              | Paid Apps Agreement active, Play merchant profile, RC project, Terms/Privacy URLs live, price sign-off | 1–3 days elapsed (mostly waiting) |
| 1   | Backend                                                    | 0 (RC project for the API key) | migration, edge function, `iap_enabled`, webhook test event passing                                    | 1 day                             |
| 2   | Mobile SDK + entitlement store + gates + Proxy removal     | 1                              | dev build, gates driven by RPC; owner login → RC customer visible in dashboard                         | 1 day                             |
| 3   | Paywall rewrite, delete payment-select, strings            | 2 + RC offerings configured    | purchase in sandbox unlocks within 5 s; restore works; manage opens store                              | 1.5 days                          |
| 4   | Web entitlement + blocker                                  | 1                              | web blocked for non-Pro, unblocked ≤ 5 min after purchase                                              | 0.5 day                           |
| 5   | QA matrix (§9) + docs rewrite (`PREMIUM_PLANS.md`, README) | 3, 4                           | signed-off matrix                                                                                      | 1 day                             |
| 6   | Store submission + monitoring                              | 5                              | approved builds, RC alerts, `iap_enabled=true`                                                         | elapsed                           |

Phases 1 and 2 can run in parallel with the dashboard work in Phase 0 once the RevenueCat project exists (SDK keys and the Test Store are available immediately).

## 9. QA matrix (must pass before submission)

| Scenario                                   | iOS (sandbox) | Android (license tester) | Expected                                                                                                                             |
| ------------------------------------------ | ------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Fresh owner, buy monthly                   | ✔             | ✔                        | store sheet → success card → `subscriptions.is_active=true` → gates open; RC customer shows `pro`                                    |
| Buy quarterly / annual                     | ✔             | ✔                        | correct `expires_at`; savings % matches store prices                                                                                 |
| Cancel from store, keep using until expiry | ✔             | ✔                        | `will_renew=false`, still Pro until `expires_at`; manage card says "Expires on"                                                      |
| Expiry (sandbox accelerated)               | ✔             | ✔                        | `EXPIRATION` → gates close on next refresh; offline device closes at `expires_at`                                                    |
| Billing issue → grace                      | —             | ✔ (Play test cards)      | still Pro through `grace_period_expires_date`                                                                                        |
| Reinstall + Restore                        | ✔             | ✔                        | Pro restored without re-purchase                                                                                                     |
| Owner logs in on 2nd phone                 | ✔             | ✔                        | Pro via RPC before any SDK call; `logIn` aliases nothing new                                                                         |
| Staff logs in (different phone)            | ✔             | ✔                        | Pro via RPC; paywall shows "ask owner"; no RC customer created                                                                       |
| Web login for that business                | —             | —                        | blocker absent when Pro, present when not; flips ≤ 5 min                                                                             |
| Promotional grant from RC dashboard        | —             | —                        | webhook → Pro on all devices; revoke → closes                                                                                        |
| `iap_enabled=false`                        | ✔             | ✔                        | plans screen shows "coming soon", no purchase CTA                                                                                    |
| New owner registers                        | ✔             | ✔                        | `is_trial=true`, all gates open, banner shows 14 days; day 15 (clock-shift the `owners.created_at` row) → gates close, paywall shown |
| Existing owner first login after release   | ✔             | ✔                        | `owners` row created, 14-day trial starts, no regression for current users                                                           |
| Airplane mode, previously Pro              | ✔             | ✔                        | remains Pro until cached `expires_at`                                                                                                |
| Purchase with webhook endpoint down        | ✔             | ✔                        | device unlocks from SDK; RC retries; RPC catches up; no double-processing (`subscription_events`)                                    |

## 10. Out of scope (explicitly)

- Store-level introductory offers (the 14-day trial is app-level, see §3). Adding a store intro offer later needs no code change beyond copy.
- Per-plan feature tiering (audit P1-9) — single `pro` entitlement by decision.
- RevenueCat Paywalls (remote-configured UI) — the existing custom paywall is kept.
- Server-side gating of the sync RPCs (see audit P2-2 — product decision first).
- Replacing the anon-key trust model (audit P3-2).
- Web purchases (blocked by Stripe availability).
