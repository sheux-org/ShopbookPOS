# Shopbook POS Pro — Entitlement & Purchase Architecture

How the Pro tier is sold, granted, and enforced. Replaces the previous version of
this document, which described a mock checkout as if it were real.

Related: [`docs/architecture.md`](../../docs/architecture.md),
[`docs/revenuecat/`](../../docs/revenuecat/) (audit, build plan, store setup).

## 1. Where entitlement comes from

```
App Store / Google Play  ──►  RevenueCat  ──►  revenuecat-webhook (Supabase Edge Function)
                                                        │ service role
                                                        ▼
                                          owners · subscriptions · subscription_events
                                                        │
                                   get_entitlement(business_id)  ◄── mobile & web
```

`subscriptions.expires_at` on the server is the source of truth. The RevenueCat
SDK on the **owner's** device is a fast path used only to unlock immediately
after a purchase, before the webhook lands.

Three rules follow:

1. **Entitlement is per owner, not per device.** It is resolved through
   `businesses.phone_number → owners.phone`, so every staff terminal and the web
   client of a paying owner unlock from one row. Cashiers never buy anything.
2. **`is_pro` is computed at read time** from `expires_at`, so an expiry takes
   effect even if the `EXPIRATION` webhook is late or lost.
3. **Only the owner's device talks to the RevenueCat SDK.** Staff and web read
   the RPC and never call `Purchases.configure`.

## 2. Free trial

14 days, derived from `owners.created_at` in `get_entitlement`. No trial table,
no store introductory offer, nothing for the client to track. An owner's first
login after this shipped creates the `owners` row and starts the clock.

## 3. Client API

```ts
import { useIsPro, useIsBusinessOwner } from '@/hooks/useEntitlement';

const isPro = useIsPro();          // the gate every premium feature reads
const isOwner = useIsBusinessOwner();  // may this session purchase?
```

`useIsBusinessOwner()` compares the session phone against the business's phone.
It is **not** `activeEmployeeId === 'owner'` — registration also creates an
`employees` row with the owner's phone, and `useVerifyOtp` matches employees
first, so an owner logs in identified as staff.

Non-hook read, for services and event handlers:

```ts
import { getIsPro } from '@/stores/useEntitlementStore';
```

There is no `setPremium`. Entitlement cannot be set from the client — that was
the point of the change.

## 4. Offline behaviour

`useEntitlementStore` persists `{ isPro, expiresAt, trialEndsAt, ... }` to
AsyncStorage. On rehydration the cached expiry is re-evaluated, so a device that
has been offline past the subscription end date locks correctly rather than
staying Pro forever. Billing-issue grace is expressed **server-side** by the
webhook extending `expires_at`; the client adds no grace of its own.

## 5. Purchase flow

One screen: `/profile/premium-plans`.

1. `getProPackages()` returns the current RevenueCat offering.
   `$rc_monthly` / `$rc_three_month` / `$rc_annual` map to the three period tabs.
2. Prices come from `pkg.product.priceString` — store-localised. iOS bills the
   Sri Lanka storefront in **USD**, Play bills in **LKR**; hard-coding either is
   wrong on the other platform.
3. Savings are computed from the real monthly price
   (`1 − perMonth / monthlyPerMonth`). There are no strike-through anchor prices.
4. `purchasePackage()` → the native store sheet → on success `setFromSdk()`
   unlocks instantly, a server re-check runs 5 s later, and the screen returns
   to whatever feature the user was trying to reach.

There is **no in-app bank transfer**. Apple 3.1.1 and Google Play's Payments
policy both require store billing for digital unlocks, and Play's alternative
billing programme does not cover Sri Lanka. Bank-transfer customers are sold to
outside the app and activated with a RevenueCat promotional entitlement — the
app code has no knowledge of them. Runbook: `docs/revenuecat/02-build-plan.md` §7.

## 6. States the paywall must handle

| Condition | UI |
|---|---|
| Subscribed | Manage card: renews/expires date, *Manage subscription*, *Restore* |
| On trial | Trial banner + plans |
| Staff session | No purchase CTA — "ask the owner of {business}" |
| `iap_enabled = false`, or no packages | Feature list + "coming soon". Never a dead button. |
| Purchase cancelled | Nothing — `userCancelled` is not an error |

Every state also renders the store-mandated footer: auto-renew disclosure,
**Restore purchases**, **Terms of Use**, **Privacy Policy**. Apple 3.1.2 rejects
subscription paywalls missing any of these. The legal URLs come from
`app_config.terms_url` / `privacy_url` so they can change without a release.

## 7. Kill switch

`app_config.iap_enabled` defaults to **false**. The integration ships dark; flip
the column to `true` once both stores have approved the subscription products.
No app release required.

## 8. File reference

| Concern | File |
|---|---|
| SDK wrapper | `mobile/services/purchases.ts` |
| Entitlement cache | `mobile/stores/useEntitlementStore.ts` |
| Hooks (`useIsPro`, sync, owner test) | `mobile/hooks/useEntitlement.ts` |
| Post-login bootstrap | `mobile/services/entitlement.ts` |
| Paywall | `mobile/app/(modules)/profile/premium-plans.tsx` |
| Locked-feature interstitial | `mobile/components/common/PremiumUpgradeModal.tsx` |
| Schema + RPCs | `supabase/migrations/20260901000000_revenuecat_entitlements.sql` |
| Webhook | `supabase/functions/revenuecat-webhook/index.ts` |
| Web read path | `web/src/hooks/useEntitlement.ts` |
| Web gate | `web/src/components/layout/ProBlocker.tsx` |

## 9. Gated features

Eleven call sites read `useIsPro()`: camera barcode scanning (POS, Home, Search,
Stocks, Manage Items), branch switching, thermal printing (tender, order
history), printer pairing, cloud sync + PDF/CSV exports, and staff management.
Web access is itself a Pro feature, gated by `ProBlocker`.
