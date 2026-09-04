# Project KT — iOS subscriptions via RevenueCat

**Scope:** this is a focused KT. It covers one slice of Shopbook POS — how paid subscriptions work on the iOS Expo app, and the exact procedure to stand them up from nothing. It deliberately skips the POS domain, the WatermelonDB sync engine, and the web client except where they touch billing. For the whole-repo picture start at [`README.md`](README.md) and [`docs/architecture.md`](docs/architecture.md).

Written 2026-09-04 against `dev`. Verified by doing it: the Apple side described here was executed end to end on this repo, not summarised from documentation.

---

## 1. What this is

Shopbook POS is a point-of-sale app for small Sri Lankan retailers — Expo/React Native on phones, a Next.js web terminal, Supabase behind both. Most of it is free. A set of features (cloud sync, thermal printing, camera barcode scanning, multi-outlet, staff accounts, the web terminal) sit behind **Shopbook POS Pro**, a subscription sold through the App Store and Google Play with RevenueCat in the middle.

The thing that makes this non-obvious: **entitlement is scoped to the shop owner, not the device or the logged-in user.** A cashier on a till in a second branch gets Pro because the *owner* of that business pays, and that cashier never sees a paywall they could act on. That single decision shapes the whole design.

Before commit `dc823e1` none of this was real — `isPremium` was a client-side boolean forced `true` for every user by a Proxy. If you find yourself reading old code or docs that assume that, they predate the rework. See [`docs/revenuecat/01-audit.md`](docs/revenuecat/01-audit.md) for what was there and why it changed.

---

## 2. Get it running

Prerequisites: Node with pnpm (repo is a pnpm workspace, root `package.json`), Xcode with an iOS simulator, and a RevenueCat account with access to the *Shopbook POS* project.

```bash
pnpm install                      # from repo root
cp mobile/.env.example mobile/.env
```

Fill `mobile/.env` — the variable names are documented in [`mobile/.env.example`](mobile/.env.example):

| Variable | Where it comes from |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | same page |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat → Apps → your iOS app → Public API Key (`appl_…`) |
| `EXPO_PUBLIC_REVENUECAT_TEST_KEY` | RevenueCat → Apps → Test Store → Public API Key (`test_…`) |

All four are public/anon keys and safe in the bundle. `mobile/.env` is gitignored (root `.gitignore:10`). Never commit a `.p8`.

Then:

```bash
cd mobile
npx expo run:ios --device <simulator-udid>   # first run: prebuild + pod install + compile, 10-20 min
```

`react-native-purchases` and WatermelonDB are native modules, so **Expo Go will not work** — you need a dev build. Later runs are just `npx expo start`.

**Which key to use when.** `configurePurchases()` (`mobile/services/purchases.ts:35`) picks the platform key and falls back to the test key:

- `EXPO_PUBLIC_REVENUECAT_IOS_KEY` set → real App Store products. Product metadata *does* resolve on the simulator; completing a purchase needs a physical device with a sandbox Apple ID.
- iOS key absent → Test Store. Purchases complete in a modal, on the simulator, with no Apple involvement. This is how you iterate on paywall UI.

> **Run the bootstrap once yourself and fix this section if it has drifted.** These commands were correct on 2026-09-04; Expo majors move fast.

---

## 3. How entitlement flows

Two independent paths write the same state, and the server always wins.

```
                    ┌──────────────────────────────┐
                    │  App Store (auto-renewable)  │
                    └───────▲──────────────┬───────┘
       purchase / restore   │              │ server notifications (V2)
                            │              ▼
┌──────────────────┐  SDK   │        ┌───────────────┐   webhook   ┌────────────────────────┐
│ Mobile — OWNER   │◄───────┴───────►│  RevenueCat   │────────────►│ supabase/functions/    │
│ session only     │                 │ entitlement   │◄────────────│ revenuecat-webhook     │
│ Purchases.logIn  │                 │ shopbook_pos_ │  REST v1    │ (re-fetch subscriber)  │
│  (owners.id)     │                 │ pro           │             └───────────┬────────────┘
└────────┬─────────┘                 └───────────────┘                         │ service role
         │ optimistic unlock                                                   ▼
         │                     get_entitlement(business_id)         ┌──────────────────────┐
         └────────────────────────────┬───────────────────────────► │ owners, subscriptions│
                                      │                             └──────────────────────┘
        ┌─────────────────────────────┼──────────────────────────┐
        │ Mobile — staff session      │ Web (owner or staff)     │
        │ RPC only, cached offline    │ RPC only, blocks if !pro │
        └─────────────────────────────┴──────────────────────────┘
```

**Files, in the order a request touches them:**

| File | Role |
|---|---|
| `mobile/services/purchases.ts` | the only file that imports the RevenueCat SDK — configure, logIn, offerings, purchase, restore, manage |
| `mobile/services/entitlement.ts` | post-login bootstrap: mints `owners.id`, hands it to RevenueCat, refreshes cache |
| `mobile/stores/useEntitlementStore.ts` | persisted `{isPro, isTrial, expiresAt, …}`; two writers, `rpc` and `sdk` |
| `mobile/hooks/useEntitlement.ts` | `useEntitlementSync()` (mount / business switch / foreground) and `useIsPro()` |
| `mobile/app/(modules)/profile/premium-plans.tsx` | the paywall, ~960 lines, five mutually exclusive states |
| `supabase/migrations/20260901000000_revenuecat_entitlements.sql` | `owners`, `subscriptions`, `subscription_events`, `get_or_create_owner`, `get_entitlement` |
| `supabase/functions/revenuecat-webhook/index.ts` | Deno edge function; HMAC verify, idempotent, re-fetches the subscriber |
| `web/src/hooks/useEntitlement.ts`, `web/src/components/layout/ProBlocker.tsx` | web consumes entitlement; mounted at `web/src/app/layout.tsx:239` |

**Three rules that fall out of the design, and that you will break if you don't know them:**

1. `subscriptions.expires_at` on the server is the truth. `CustomerInfo` from the SDK is a fast path for the moment after purchase, never the only path.
2. `setFromSdk()` (`useEntitlementStore.ts`) **only ever turns Pro on**. A missing entitlement in `CustomerInfo` can mean the store sheet was cancelled — only the RPC is allowed to revoke.
3. `is_pro` is computed at *read* time from `expires_at`, so an expiry takes effect even if the `EXPIRATION` webhook is late or lost. There is no expiry job, and there shouldn't be one.

---

## 4. Vocabulary

You will hear these in the same sentence and they are not interchangeable.

| Term | Means |
|---|---|
| **Product** | One purchasable SKU in a store. iOS: `lk.shopbook.pos.pro.monthly`. Android: base plan `monthly` under subscription `pro`. |
| **Entitlement** | What a product unlocks. We have exactly one: `shopbook_pos_pro`. Products attach to it. |
| **Offering / Package** | RevenueCat's indirection so the app doesn't hardcode product IDs. Offering `default`, packages `$rc_monthly` / `$rc_three_month` / `$rc_annual`. |
| **App User ID** | The identity RevenueCat tracks. Ours is `owners.id` (uuid) — deliberately not a phone number. |
| **Storefront** | Apple's per-country bundle of currency + price points. **Sri Lanka's storefront bills in USD**; Google Play bills the same market in LKR. |
| **Test Store** | RevenueCat's fake store. Products and prices defined in their dashboard, purchases complete in a modal. Simulator-friendly. |
| **Owner vs staff** | `isBusinessOwner(userPhone, business.phone)` in `mobile/utils/business.ts`. Not `activeEmployeeId === 'owner'` — registration creates an employees row with the owner's own phone, so that check lies. |
| **`iap_enabled`** | Kill switch column on `app_config`. Paywall hides purchase CTAs while false. |

---

## 5. The runbook

This is the procedure, in dependency order. **Start with B3** — it begins a 36-hour wait at Google that nothing accelerates; do the Apple track while it runs.

### Part A — Apple (App Store Connect)

**A1. Confirm the Paid Apps agreement.** Business → Agreements, Tax, and Banking. There are *separate rows* for Free Apps and Paid Apps. Until Paid Apps reads **Active**, you cannot create a subscription product or test one in sandbox, and the errors don't say so. Bank account and W-8BEN-E attach to that agreement specifically.

**A2. Subscription group.** App → Monetization → Subscriptions → **+** next to Subscription Groups. Reference name is internal; add a **Localization** too — that display name is the heading in the customer's iOS Settings → Subscriptions.

All durations must live in **one group**. That is what makes monthly→annual an upgrade rather than two parallel subscriptions.

**A3. The three products.**

| Duration | Product ID | Reference name |
|---|---|---|
| 1 month | `lk.shopbook.pos.pro.monthly` | Pro Monthly |
| 3 months | `lk.shopbook.pos.pro.quarterly` | Pro Quarterly |
| 1 year | `lk.shopbook.pos.pro.annual` | Pro Annual |

Each needs four things or it sits in *Missing Metadata*: duration, price, localization (display name + description), and a **review screenshot**. Screenshots of the app's own paywall are accepted — there are current ones in `screenshots/app-store-review/`.

**A4. Order the levels.** In the group, **Level 1 is the highest tier** — Apple's own wording is "descending order, starting with the option that offers the highest level of service". Set Annual = 1, Quarterly = 2, Monthly = 3. Get this backwards and monthly→annual is treated as a *downgrade*: deferred to the next renewal, so you wait up to a month for the money and they can cancel meanwhile.

**A5. In-App Purchase key.** Users and Access → Integrations → In-App Purchase → **+**. Download the `.p8` (**once, ever**), note **Key ID** and **Issuer ID**.

**A6. App Store Connect API key.** Same Integrations tab, *App Store Connect API* section, **Team Keys** (not Individual — those die with your user account). Role: App Manager. A **second, different** `.p8`. This is what lets RevenueCat import products and auto-apply price changes.

**A7. Server notifications.** Easiest path: after Part C, RevenueCat's iOS app page has an **Apply in App Store Connect** button that sets the Production and Sandbox V2 notification URLs for you using the API key from A6. Manual fallback: App Information → App Store Server Notifications, paste RevenueCat's URL into both fields, Version 2.

**A8. Sandbox testers.** Users and Access → Sandbox. Sign in under Settings → App Store → *Sandbox Account* on the device, not iCloud. Set an accelerated renewal rate so a monthly subscription expires in minutes.

### Part B — Google (Play Console + Cloud)

**B1.** Payments profile → **Verified**. A free app never needed one.

**B2.** Monetize → Products → Subscriptions. One product `pro`, base plans `monthly` (P1M), `quarterly` (P3M), `annual` (P1Y). Grace period **7 days** (default 3 — a POS should not lock a till over this morning's failed card), account hold on. Prices in **LKR**. Then **Activate** each base plan; an inactive plan is invisible to the SDK and looks exactly like a broken integration.

**B3.** Google Cloud service account. RevenueCat publish a Cloud Shell script that enables the APIs (`androidpublisher`, `playdeveloperreporting`, `pubsub`), creates the account, grants `roles/pubsub.editor` + `roles/monitoring.viewer`, and emits the JSON key — see their [Play service credentials guide](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials). Far less error-prone than clicking.

**B4.** Play Console → Users and permissions → invite the service-account email with *view app information*, *view financial data*, *manage orders and subscriptions*. Status must reach **Active**.

**B5.** Monetize → Monetization setup → paste RevenueCat's Pub/Sub topic → *Send test notification*. If it fails, grant `google-play-developer-notifications@system.gserviceaccount.com` the **Pub/Sub Publisher** role on that topic.

**B6.** License testers + a release on the **internal testing** track. A Play purchase only completes in a build installed *from Play* — a side-loaded APK cannot, and a Draft app cannot be bought from at all.

### Part C — RevenueCat

**C1.** Sidebar → **Apps** → + New → App Store. Bundle `lk.shopbook.pos`. Upload the A5 `.p8` under *In-app purchase key configuration* with Key ID + Issuer ID. Add the A6 key under *App Store Connect API*. Leave *App-specific shared secret (Legacy)* collapsed — see gotcha 6.

**C2.** Apps → + New → Play Store. Package `lk.shopbook.pos`, upload the B3 JSON. Expect "credentials invalid" for up to 36 hours; that is normal.

**C3.** Product catalog → Products → import from the store. Then **Attach** entitlement `shopbook_pos_pro` to every product — a purchase with no entitlement attached succeeds and grants nothing.

**C4.** Offerings → `default` → add each store product to its package alongside the Test Store one:

| Package | iOS | Android |
|---|---|---|
| `$rc_monthly` | `lk.shopbook.pos.pro.monthly` | `pro:monthly` |
| `$rc_three_month` | `lk.shopbook.pos.pro.quarterly` | `pro:quarterly` |
| `$rc_annual` | `lk.shopbook.pos.pro.annual` | `pro:annual` |

A package holds one product per store, so Test Store and App Store coexist and the SDK picks by key.

### Part D — Backend and app

**D1.** Apply `supabase/migrations/20260901000000_revenuecat_entitlements.sql`. No Supabase CLI is configured in this repo; the SQL Editor works. Wrap in `BEGIN`/`COMMIT` when pasting — the CLI does that for you, the editor does not.

**D2.** Deploy the webhook:

```bash
supabase functions deploy revenuecat-webhook --no-verify-jwt
supabase secrets set RC_WEBHOOK_SIGNING_SECRET=… RC_WEBHOOK_AUTH=… RC_SECRET_API_KEY=…
```

`RC_SECRET_API_KEY` must be a **v1** secret key — the subscriber re-fetch is a v1 endpoint. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically. Register the function URL in RevenueCat → Integrations → Webhooks and copy its signing secret back into the secret above.

**D3.** Put the `appl_` / `goog_` keys into `mobile/.env` locally and EAS secrets for builds. New native build required.

**D4.** Flip the switch when the stores approve: `UPDATE public.app_config SET iap_enabled = true WHERE id = 1;`

### Verify

```bash
# offerings resolve for a given platform key
curl -s "https://api.revenuecat.com/v1/subscribers/probe/offerings" \
  -H "Authorization: Bearer $RC_PUBLIC_KEY" -H "X-Platform: ios" | jq
```

Three packages with the right `platform_product_identifier` means the store is wired. Zero packages with a valid offering means products aren't attached yet — that exact symptom cost an hour on 2026-09-04.

```sql
SELECT public.get_entitlement('<business_id>');   -- {"is_pro":true,"is_trial":true,...}
```

Full pre-submission matrix: [`docs/revenuecat/02-build-plan.md` §9](docs/revenuecat/02-build-plan.md) — 15 scenarios including grace period, restore after reinstall, staff login, promotional grant, and `iap_enabled=false`.

---

## 6. Where work happens

Billing is new code, so it isn't in the repo-wide hotspot list (which is dominated by `components/screens/*` and `web/src/app/layout.tsx`). Everything billing-related landed in three commits:

- `dc823e1` — the implementation, 37 files
- `3f097b1` / `7012eb9` — the defect register and corrections to it
- `290f81e` — the audit, build plan and store config docs

Expect your changes to land in `mobile/app/(modules)/profile/premium-plans.tsx` (the paywall churns most — pricing presentation changed three times on 2026-09-04 alone) and `mobile/stores/useEntitlementStore.ts` (any change to precedence or caching).

The 11 feature gates are mechanical — each screen calls `useIsPro()`. Adding a gate is one hook call plus the `PremiumUpgradeModal`; don't invent a second mechanism.

---

## 7. Conventions

- **pnpm workspace.** Run scripts from root (`pnpm dev:mobile`) or filter (`pnpm --filter shopbook-pos …`).
- **No comments unless the code can't say it.** The billing files carry doc comments only where a constraint is invisible — why `setFromSdk` never revokes, why the owners row is minted before the SDK is configured. Match that density.
- **Prices never live in code.** `PERIODS` in `premium-plans.tsx` holds labels and month counts only; every figure comes from the store. If you're typing a price into a `.tsx`, stop.
- **Tests:** the web workspace has a suite; **`mobile/` has no test runner at all.** None of the billing logic is covered — that's [`docs/known-issues.md` ENT-2](docs/known-issues.md). The SQL surface is the cheapest thing to pin first.
- **Pre-commit** (`.husky/pre-commit`) runs prettier, web typecheck, a full Next.js build, and `expo-doctor`. See gotcha 12.

---

## 8. Gotchas & tribal knowledge

Most of these cost real time. They are in rough order of how likely you are to hit them.

1. **`fetchAppConfig()` fails closed and takes everything with it.** It selects named columns; if one is missing the whole query errors and returns `null`, so `iap_enabled` reads false and the paywall shows "coming soon" with no useful message. Adding a column to that `SELECT` before it exists in the database is the failure mode. Observed live: `column app_config.iap_enabled does not exist`.

2. **The anon key cannot write to `app_config`.** RLS blocks it, and PostgREST returns `204` with zero rows affected — indistinguishable from success. Any config change needs the SQL Editor or a service-role path. Don't trust a `204`.

3. **Package identifiers are matched literally.** `premium-plans.tsx` looks for `$rc_monthly`, `$rc_three_month`, `$rc_annual`. Rename one in RevenueCat and the paywall silently falls back to "coming soon" — no error anywhere.

4. **RevenueCat product prices are immutable after save.** Their docs: *"Once a product is saved, existing prices cannot be edited."* The v2 API only updates `display_name`. Changing a Test Store price means delete → recreate → re-attach entitlement → re-add to the offering.

5. **Apple product IDs are permanent.** Not renameable, not reusable, not even after deleting the product.

6. **The shared secret is legacy.** `react-native-purchases@10.8.1` → `PurchasesHybridCommon 18.33.1` → `purchases-ios` v5+, which is StoreKit 2. RevenueCat's form labels it "App-specific shared secret (Legacy)" and warns that on v5.x+ *transactions fail to be recorded* without the **In-App Purchase key**. Don't go hunting for the shared secret; you need the `.p8`.

7. **There are two different `.p8` files** — In-App Purchase key and App Store Connect API key — and they slot into different RevenueCat fields. Name them on disk when you download.

8. **The simulator does more than expected, but not everything.** With the `appl_` key it resolves real App Store *product metadata* (prices render correctly). It cannot complete a sandbox *purchase* — that needs a physical device with a sandbox Apple ID. Test Store exists to cover the gap.

9. **StoreKit won't return products below "Ready to Submit".** *Missing Metadata* is usually just the review screenshot. Symptom is again "coming soon" with no error.

10. **Your first subscription group ships with an app version.** Apple states it on the product page. You cannot get products approved standalone, which means the paywall and the build are reviewed together — a rejection hits both.

11. **`get_entitlement` inner-joins `businesses → owners`.** No `owners` row ⇒ `is_pro: false`, regardless of what RevenueCat thinks. The row is minted by `bootstrapEntitlement` on *owner login only* — a staff-only till never creates one. This is [ENT-1](docs/known-issues.md) and it is an unresolved commercial decision, not a bug: on release day every existing shop is locked out until its owner personally signs in.

12. **The pre-commit hook fails for everyone**, because `expo-doctor` flags upstream Expo patch drift that nothing in the working tree caused. The RevenueCat commits were made with `--no-verify` for this reason. Fix is `npx expo install --fix` in `mobile/`. See [BUILD-1](docs/known-issues.md).

13. **`mobile/ios/` and `mobile/android/` are not gitignored.** Root `.gitignore` has `/ios` and `/android`, which only match at repo root. `expo prebuild` will dump a native project into the tree as untracked files. Delete it after, or add the entries.

14. **Currency differs by store, in the same country.** Apple's Sri Lanka storefront bills **USD**; Google Play bills **LKR**. `premium-plans.tsx` branches on `currencyCode === 'LKR'` and converts for display otherwise. The conversion rate is a constant in that file and will drift — it is display-only, and the store's own charge is what the customer pays.

15. **The server overrides the optimistic unlock ~5 s after purchase.** By design (`premium-plans.tsx` schedules `refreshEntitlement` on a timer). If the webhook isn't deployed, a real purchase unlocks and then reverts, because the server has no `subscriptions` row. Not a bug — but it looks exactly like one.

16. **`11111` is a hardcoded OTP that grants an *admin* session** for any phone number, and it ships in the bundle ([SEC-1](docs/known-issues.md)). It's a web-side client bypass; mobile's `useVerifyOtp` calls the real service, so it does *not* work there. Must be gone before store submission.

---

## 9. Where decisions live

- **[`docs/revenuecat/01-audit.md`](docs/revenuecat/01-audit.md)** — findings P0-1…P3-2 with severity, and **§6 records the ten binding decisions** (auto-renewables, one entitlement, per-owner scope, webhook re-fetch, bank transfer as promotional grants, no web sales, kill switch, 14-day app-level trial). Don't re-litigate these without the user.
- **[`docs/revenuecat/02-build-plan.md`](docs/revenuecat/02-build-plan.md)** — the engineering contract: target architecture, phase order, QA matrix §9, and §10's explicit out-of-scope list.
- **[`docs/revenuecat/03-store-and-revenuecat-configuration.md`](docs/revenuecat/03-store-and-revenuecat-configuration.md)** — the dashboard checklist this runbook is the executed version of.
- **[`docs/known-issues.md`](docs/known-issues.md)** — live defect register, one row per issue with status. **This is the live-state doc; check it before assuming something is broken or fixed.** Two entries are `decision-needed` and block launch: ENT-1 (grandfathering) and PRICE-1 (the savings claim).
- No ADR directory and no RFC process. Decisions live in the `docs/revenuecat/` files above and in commit messages; there is no issue tracker referenced anywhere in the repo. If you make a call worth keeping, add it to the audit's §6 rather than inventing a new home.

---

## 10. Suggested skills

- **`diagnose`** — for "the paywall shows coming soon and I don't know why". That symptom has at least four distinct causes (gotchas 1, 3, 8, 9) and guessing between them wastes an afternoon.
- **`code-understand`** — before changing `useEntitlementStore.ts`. The precedence rules between `rpc` and `sdk` are load-bearing and subtle.
- **`tdd`** — if you take on ENT-2. Start with `supabase/tests/entitlement.test.sql` covering `get_entitlement` across no-owner / trial / paid / expired; it needs no new tooling.
- **`zero-tech-debt`** — if you touch the trial length or the FX constant. Both are hardcoded in places that will need to change without a release, and the `app_config` pattern already exists for exactly that.
- Not `improve-codebase-architecture` — the entitlement design is settled and documented. Argue with §6 of the audit, not with the code.

---

**This document is only as trustworthy as its last verification.** The Apple procedure in §5 was executed on 2026-09-04 and is accurate as of then; the Google procedure was assembled from RevenueCat's current docs but has **not** been executed against this project. Console UIs move. When you hit drift, fix it here — you are the next person's evidence.
