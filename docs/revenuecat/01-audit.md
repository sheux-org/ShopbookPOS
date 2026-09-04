# RevenueCat Integration — Audit of the Current Setup

Branch audited: `dev` @ `f23870f` (2026-09-01). Scope: everything that touches "Pro" / premium / payment in `mobile/`, `web/`, and `supabase/`.

## 1. Verdict

**Payments are not "complete minus RevenueCat". Nothing in the current code can take money.** What exists is a UI shell (plans screen, payment-method screen, upgrade modal) wired to a local boolean that is, right now, hard-forced to `true` for every user. There is no server-side notion of a subscription at all. RevenueCat is not installed.

Beyond the missing SDK, the current design has two things that will get the app **rejected by Apple and Google** and one thing that makes the entitlement **trivially bypassable**. Those must change before any payment code is added — details in §3.

## 2. What exists today (inventory)

| Area             | File                                                                        | State                                                                                                                                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Premium flag     | `mobile/stores/useSettingsStore.ts:52-72`                                   | `useSettingsStore` is wrapped in a `Proxy` that returns `isPremium = true` for every selector and `getState()`. `isPremium` is also excluded from `partialize`, so it never persists. **Every user is Pro, unconditionally.**                                                                                       |
| Web premium flag | `web/src/stores/settingsStore.ts:47`                                        | `isPremium: true` hard-coded ("Exclusively premium web client"). Nothing checks a server.                                                                                                                                                                                                                           |
| Plans screen     | `mobile/app/(modules)/profile/premium-plans.tsx`                            | Three hard-coded LKR plans (1M Rs 3,500 / 3M Rs 10,000 / 1Y Rs 36,000) with fabricated strike-through "original" prices. "Downgrade" button calls `setPremium(false)` locally. No Restore, no Terms/Privacy links.                                                                                                  |
| Payment screen   | `mobile/app/(modules)/profile/payment-select.tsx`                           | "Card via RevenueCat" = `Alert.alert` → `setPremium(true)`. "Bank transfer" = Seylan Bank details + WhatsApp deep link to +94 78 247 0168.                                                                                                                                                                          |
| Upgrade modal    | `mobile/components/common/PremiumUpgradeModal.tsx`                          | Feature list + "Upgrade Now" → `/profile/premium-plans`. Fine as a locked-feature interstitial.                                                                                                                                                                                                                     |
| Feature gates    | 11 call sites (see §2.1)                                                    | All read `useSettingsStore((s) => s.isPremium)` and open `PremiumUpgradeModal` when false. Gate placement is sensible; the _source_ of the boolean is the problem.                                                                                                                                                  |
| Backend          | `supabase/migrations/*`, `supabase_migration.sql`                           | Tables: `businesses, employees, products, orders, order_items, inventory_logs, deleted_records, active_devices, app_config`. **No subscription / entitlement / owner table.** No Edge Functions directory.                                                                                                          |
| Identity         | `mobile/hooks/useAuth.ts`, `mobile/stores/useAuthStore.ts`                  | Phone + OTP via an external Vercel service (`mini-pos-sync-server.vercel.app`). No Supabase Auth session (`persistSession: false`, anon key). The tenant key is `business_id`; the _owner_ is identified only by `businesses.phone_number`. Owner and staff both log in through the same path.                      |
| Native build     | `mobile/app.json`, `mobile/eas.json`                                        | Expo SDK 54 / RN 0.81.5, `expo-dev-client` present, EAS project configured, bundle/package `lk.shopbook.pos`. No IAP library, no `BILLING` permission, no StoreKit config.                                                                                                                                          |
| Store metadata   | `supabase/migrations/20260523000000_add_app_config.sql:6-7`                 | `android_url` points at `com.pasanpahasara.shopbookpos` (does **not** match `lk.shopbook.pos`); `ios_url` is the placeholder `id6470000000`. Suggests the iOS app is not yet listed.                                                                                                                                |
| Docs             | `mobile/doc/PREMIUM_PLANS.md`                                               | Describes the mock flow as if real ("RevenueCat Mock"). Must be rewritten after the integration.                                                                                                                                                                                                                    |
| Public pricing   | [shopbook-pos-website.vercel.app](https://shopbook-pos-website.vercel.app/) | Finalised: **Rs 3,500 / month**, **Rs 10,000 / quarter** (popular), **Rs 36,000 / year** ("Save 25%"). Advertises a **free 14-day trial** ("install… print your first receipt in minutes"), says subscriptions activate in the mobile app, lists different feature bullets per plan, links `/terms` and `/privacy`. |

### 2.1 Feature gates (all read `isPremium`)

| Feature                                | File:line                                                               |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Camera barcode scan (POS)              | `mobile/components/screens/PosScreen.tsx:313`                           |
| Camera barcode scan (Home)             | `mobile/components/screens/HomeScreen.tsx:189`                          |
| Camera barcode scan (Search)           | `mobile/components/screens/SearchScreen.tsx:51`                         |
| Camera barcode scan (Stocks)           | `mobile/components/screens/StocksScreen.tsx:125`                        |
| Camera barcode scan (Manage items)     | `mobile/components/screens/ManageItemsScreen.tsx:63`                    |
| Branch switching                       | `mobile/components/screens/HomeScreen.tsx:333`                          |
| Thermal print (tender)                 | `mobile/components/screens/PaymentTenderScreen.tsx:201`                 |
| Thermal print (order history)          | `mobile/components/screens/OrderHistoryScreen.tsx:275`                  |
| Printer pairing                        | `mobile/app/(modules)/profile/bluetooth-printer.tsx:52`                 |
| Cloud sync + PDF/CSV exports           | `mobile/components/screens/insights/InsightsScreen.tsx:105,151,164,213` |
| Staff mgmt etc. (`checkPremiumAction`) | `mobile/components/screens/ProfileScreen.tsx:45`                        |

Web has **no gates** — web access itself is the Pro feature, and it is currently open to any registered phone.

## 3. Findings

Severity: **P0** = blocks store approval or makes billing meaningless; **P1** = must fix in the same project; **P2** = should fix; **P3** = note.

### P0-1 — In-app bank transfer + WhatsApp activation violates both stores' payment policies

`payment-select.tsx` shows bank account details and a WhatsApp CTA to unlock digital features. Apple Guideline 3.1.1 requires IAP for unlocking app functionality and prohibits "other mechanisms" (license keys, external payment) inside the app; Google Play's Payments policy requires Google Play Billing for digital goods, and alternative billing is only permitted in a fixed list of countries (EEA, AU, BR, IN, ID, JP, ZA, KR, US, UK) — **Sri Lanka is not on it**. Shipping this screen in a store build is a guaranteed rejection.
_Resolution:_ remove the bank-transfer path from the store-distributed apps entirely. Keep bank transfer as an **out-of-band sales channel** (website / WhatsApp), and activate those customers through RevenueCat _promotional entitlements_ so the app never knows the difference (§ build plan, Phase 1 & ops runbook).

### P0-2 — Entitlement is a client-side boolean, forced on, never persisted

`useSettingsStore.ts:52-72`. Even after removing the Proxy, a `zustand` flag in AsyncStorage is not an entitlement: any rooted device, any dev, or a simple `setState` unlocks Pro; staff devices have no way to learn the owner paid; web can't see it at all.
_Resolution:_ server-side entitlement (`subscriptions` table fed by RevenueCat webhook) is the single source of truth; mobile keeps a persisted cache with an expiry for offline use; RevenueCat `CustomerInfo` on the _owner's_ device is used only for instant unlock right after purchase.

### P0-3 — No stable, non-PII customer identifier for RevenueCat

The only owner identity is a phone number. RevenueCat explicitly recommends against PII / guessable App User IDs (phone numbers are both). Without a stable ID, purchases can't follow the owner across devices, reinstalls, or to the web.
_Resolution:_ introduce an `owners` table (`id uuid`, `phone` unique) and use `owners.id` as the RevenueCat App User ID.

### P1-1 — Paywall is missing Apple/Google mandatory elements

Apple 3.1.2 / App Review consistently rejects auto-renewable subscription paywalls that lack: subscription length, price per period, **Restore Purchases**, and links to **Terms of Use (EULA)** and **Privacy Policy**. Google's Subscriptions policy needs equivalent disclosure (price, billing period, how to cancel). `premium-plans.tsx` has none of these.

### P1-2 — Fabricated "original price" strike-throughs

`Rs. 5,000 → Rs. 3,500`, `Rs. 48,000 → Rs. 36,000` are not prices that ever existed. Apple 2.3.1 (misleading metadata/pricing) and general consumer law risk. Every reference paywall on Mobbin (Notion, Amie, GO Club, Linktree, Sunlitt) shows savings **derived from the monthly price** ("Save 40%", "$1.25/mo billed yearly"). Compute savings from real store prices; drop the fake anchors.

### P1-3 — Prices are hard-coded LKR strings

Apple's Sri Lanka storefront bills in **USD**; Google Play Sri Lanka bills in **LKR**. Hard-coded "Rs. 3,500" will be wrong on iOS and drift on Android. Prices must come from `package.product.priceString` (store-localised).

### P1-4 — "Downgrade" flips a local flag

An App Store subscription can only be cancelled through the store. The button must become "Manage subscription" → iOS `Purchases.showManageSubscriptions()`, Android `Linking.openURL(customerInfo.managementURL)`.

### P1-5 — Two-step checkout (plans → "choose how to pay") is an IAP anti-pattern

The second screen exists only because of the bank-transfer option. With IAP the store sheet _is_ the payment step. Every reference flow (mymind, Amie, MasterClass, Reddit, Numo) is: locked feature → one paywall → native store sheet → success state → back to the feature. Collapse to one screen; delete `payment-select.tsx`.

### P1-6 — Staff devices need the owner's entitlement, not their own

Multi-branch, staff accounts and printing are used by cashiers, who never buy anything. Entitlement must resolve **per business → owner**, not per device. The current per-device flag can't express this.

### P1-7 — The website promises a free 14-day trial; nothing implements one

There is no trial logic in the app or backend, and no introductory offer configured (there are no store products yet). A trial can be either store-level (intro offer: user subscribes with a payment method, is charged after 14 days) or app-level (new owners are Pro for 14 days from registration, no payment method). The website copy — "install on your phone… print your first receipt in minutes" — describes the app-level kind, and it is the right one for this market (low card penetration, POS must work on day one). Both stores allow an app-side trial as long as the paid subscription itself goes through IAP.
_Resolution:_ `get_entitlement` returns `is_pro = true` while `owners.created_at + 14 days > now()`, with `trial_ends_at` so the paywall can show "Trial ends in N days". Existing owners get their `owners` row on first login after release, so the switch from "everyone is Pro" to gated is itself cushioned by 14 days. Store-level intro offers can be layered on later without code changes.

### P1-8 — "Save 25%" is not supported by the monthly price

Website and app both claim 25% on the annual plan. 12 × Rs 3,500 = Rs 42,000; Rs 36,000 is a **14.3%** saving. The quarterly plan saves **4.8%** (Rs 10,500 → 10,000), not the "Rs 2,000" the app shows. The 25% only holds against the fabricated Rs 48,000 anchor (P1-2). Apple 2.3.1 and consumer-protection law treat this as misleading. Two honest fixes: change the claim to "Save 14%", or set monthly to Rs 4,000 so 25% is true. **Product decision needed before store prices are entered** — the paywall will compute the real percentage from store prices either way.

### P1-9 — Website lists different features per plan; the app has one entitlement

Website: 1 Month omits staff roles; 3 Months adds "staff roles with PINs" and priority WhatsApp support; 1 Year adds "unlimited multi-outlets", "dedicated setup", "custom branded receipts". The app gates every Pro feature behind a single `isPremium`, and the plans screen lists the same 8 features for all three. Feature-by-duration tiering is technically possible (one entitlement per product) but is unusual, hurts upgrades, and none of the differentiators on the 1-year card are code-gated features (setup and branded receipts are services). **Decision recorded:** one entitlement `pro`, every plan unlocks every feature; the website's per-plan bullets are marketing emphasis, and "dedicated setup / custom receipts" are fulfilled by ops. If the product owner wants real tiering, that becomes a separate entitlement design (`pro`, `pro_multi_outlet`) and is out of this plan's scope.

### P2-1 — Web has no entitlement check

`web/src/stores/settingsStore.ts:47`. Web access is listed as a Pro feature but is unconditionally open. Web must read the same server entitlement (by `activeBusinessId`) and block when not Pro. Web **cannot sell** the subscription: RevenueCat Web Billing requires a Stripe account and Stripe does not onboard Sri Lankan entities. Web only _consumes_ entitlement.

### P2-2 — "Cloud sync is Pro" contradicts how registration and login work

`useRegisterUser` pushes the new business to Supabase immediately, `useVerifyOtp` relies on Supabase to discover accounts, and phone uniqueness is checked in the cloud. So sync is already a free-tier dependency. Gating the sync RPCs server-side would break onboarding. **Product decision needed:** either (a) keep "cloud backup" as a soft (client-side) gate as today, or (b) split "account sync" (free, minimal) from "full data backup/sync" (Pro). The build plan assumes (a) and does not gate the sync RPCs.

### P2-3 — `app_config` store URLs are wrong

Android package mismatch (`com.pasanpahasara.shopbookpos` vs `lk.shopbook.pos`) and placeholder iOS id. Force-update deep links currently go nowhere. Fix when store listings exist.

### P3-1 — Documentation describes the mock as real

`mobile/doc/PREMIUM_PLANS.md` and `README.md:71` ("RevenueCat checkout or bank slip WhatsApp submission"). Rewrite after Phase 3.

### P3-2 — Server auth model is anon-key + `SECURITY DEFINER` RPCs

Every RPC (`pull/push_watermelondb_changes`, `fetch_user_businesses`, `check_phone_registered`) is callable by anyone holding the public anon key with a guessed `business_id`. This predates and is out of scope for the RevenueCat work, but it bounds how "secure" server-side entitlement can be: the webhook and the subscriptions table are protected (service role only), while the _read_ RPC is as open as the rest. Noted so nobody assumes the entitlement RPC is stronger than the data it guards.

## 4. External constraints verified

| Question                                                       | Answer                                                                                                                                                 | Source                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Can a Sri Lankan entity sell IAP on Google Play?               | **Yes.** Sri Lanka is listed for developer _and_ merchant registration; buyers pay in LKR.                                                             | [Play Console: supported locations](https://support.google.com/googleplay/android-developer/answer/9306917)                                                                                                                          |
| Can a Sri Lankan entity sell IAP on the App Store?             | **Yes.** Sri Lanka storefront exists (prices in USD). Needs Paid Apps Agreement + bank + tax forms in App Store Connect.                               | [App Store Connect: receiving payments](https://www.developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments)                                                                                          |
| Does RevenueCat work for Sri Lankan developers?                | **Yes** for App Store + Play Store. **No** for Web Billing (needs Stripe; Stripe is not available in Sri Lanka).                                       | [RevenueCat country support](https://community.revenuecat.com/featured-articles-55/is-revenuecat-supported-in-my-country-5422), [Stripe supported countries](https://dodopayments.com/blogs/stripe-supported-countries-alternatives) |
| Is alternative billing (bank transfer) allowed in-app on Play? | **No** — not in Sri Lanka.                                                                                                                             | [Play: alternative billing countries](https://support.google.com/googleplay/android-developer/answer/15582165)                                                                                                                       |
| Is external payment for digital unlocks allowed on iOS?        | **No** (3.1.1). Content bought elsewhere may be _used_ in-app (3.1.3(b)) as long as IAP is also offered, and the app must not steer to it.             | [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)                                                                                                                                                    |
| RevenueCat cost                                                | Free up to $2,500 MTR/month, then ~1% of tracked revenue.                                                                                              | [RevenueCat pricing](https://www.revenuecat.com/blog/company/navigating-revenuecats-new-pricing-for-existing-users)                                                                                                                  |
| SDK compatibility                                              | `react-native-purchases@10.8.1` (peer RN ≥ 0.73) — fine on RN 0.81 / Expo 54 with a dev build. Expo Go only runs the _Preview API_ with a `test_` key. | npm registry; [react-native-purchases README](https://github.com/revenuecat/react-native-purchases)                                                                                                                                  |
| App User ID guidance                                           | Non-guessable, non-PII (UUID v4), ≤100 chars.                                                                                                          | [Identifying customers](https://www.revenuecat.com/docs/customers/identifying-customers)                                                                                                                                             |

## 5. What other apps do (Mobbin) vs Shopbook

Reference screens examined: [Notion](https://mobbin.com/screens/84fda203-97f7-4344-b563-e41aaf2687f2), [Amie](https://mobbin.com/screens/15c900cf-2be4-4f69-ab22-663e81228392), [GO Club](https://mobbin.com/screens/8b81d613-fe17-43b2-9471-a17613425fb6), [Linktree](https://mobbin.com/screens/814d8a04-df2c-47df-bb28-dc4d1db4a1cc), [Medium](https://mobbin.com/screens/3d3dacc9-5966-4fec-9d2d-dfe283835421); manage screens: [Ahead](https://mobbin.com/screens/f22a1c1c-fda3-4038-b0d1-3a12a3ec8332), [OpenPhone](https://mobbin.com/screens/034178d9-071a-49b1-89fe-41d21caab5e0), [Mimo](https://mobbin.com/screens/d7916dc6-d8cc-4969-8484-b2eb5cc508e5), [Lyft](https://mobbin.com/screens/3c6731e6-7f2f-4356-b270-79a58a95cae8); flows: [mymind](https://mobbin.com/flows/e5893443-6b29-4cfb-813d-156ee8142960), [Amie](https://mobbin.com/flows/04fa1de6-7862-47f1-a98b-8a015e920df1), [Reddit](https://mobbin.com/flows/fed7b538-c4de-4489-bfc1-da04f7fcabf0).

| Pattern in the field                                                       | Shopbook today                                     | Change                                                   |
| -------------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| One paywall screen: plan selector + one CTA                                | Plans screen → separate "choose how to pay" screen | Merge; delete payment-select                             |
| "Restore" link (top-right or under CTA)                                    | Absent                                             | Add                                                      |
| Terms / Privacy links under CTA                                            | Absent                                             | Add (also required)                                      |
| Auto-renew disclosure line ("Cancel anytime", renews until cancelled)      | Absent                                             | Add                                                      |
| Savings shown relative to monthly ("Save 40%", "$1.25/mo billed yearly")   | Fabricated strike-through anchor price             | Compute from store prices                                |
| Prices come from the store, localised                                      | Hard-coded LKR strings                             | `priceString` from offerings                             |
| Manage screen: plan, next billing date, "Manage/Cancel" → store, "Restore" | "Downgrade" flips a flag                           | Manage screen backed by `CustomerInfo` + store deep link |
| After purchase: success state, then return to what was locked              | Toast + `dismissAll` → `/profile`                  | Success state; `router.back()` to the locked feature     |
| Locked-feature interstitial explains _why_ and shows the feature list      | `PremiumUpgradeModal` — already good               | Keep                                                     |
| Staff/team members see "ask your admin" rather than a paywall              | Every role sees the paywall                        | Owner-only paywall; staff see an info state              |

Shopbook's tab-per-period selector (1M / 3M / 1Y) with one detail card is a valid variant of the period toggle (Notion, Medium, Epidemic Sound) — keep the layout, change the data source and add the mandatory elements.

## 6. Decisions recorded for the build plan

1. **Subscription model:** auto-renewable subscriptions on both stores (1 month / 3 months / 1 year), one entitlement `pro`. Not prepaid/non-renewing — RevenueCat's lifecycle handling (grace, billing retry, renewals, cancellations) only applies to auto-renewables, and it's what both stores' UIs are built around.
2. **Scope of entitlement:** per **owner** (phone → `owners.id`), covering all of that owner's businesses and all staff devices.
3. **Source of truth:** Supabase `subscriptions` row written by the RevenueCat webhook (which re-fetches the subscriber from RevenueCat's REST API, so event ordering can't corrupt state). Clients read via one RPC keyed by `business_id`.
4. **Who talks to RevenueCat SDK:** only the owner's device, only when logged in as the owner. Staff and web never call the SDK.
5. **Bank transfer:** stays as a sales channel outside the apps; ops grants a promotional entitlement in RevenueCat → webhook → everyone unlocks. No special-casing in app code.
6. **Web:** consumes entitlement; cannot sell (no Stripe in Sri Lanka).
7. **Kill switch:** `app_config.iap_enabled` — paywall hides purchase CTAs when false, so the release can ship before the store products are approved.
8. **Trial:** app-level, 14 days from `owners.created_at`, computed in `get_entitlement`. No payment method required. Store intro offers optional later.
9. **Prices (final, from the website):** Rs 3,500 / 10,000 / 36,000. Savings copy must be computed (14% annual, 5% quarterly) unless pricing is changed to make 25% true.
10. **Legal URLs:** `https://pos.shopbook.lk/terms` and `https://pos.shopbook.lk/privacy` (both live in `app_config` so no release is needed).
