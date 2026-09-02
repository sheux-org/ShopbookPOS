# Store & RevenueCat Configuration Guide

Everything that has to be clicked, signed, or uploaded outside the codebase, in the order it has to happen. Owner of each step is a role, not a person. Tick boxes are meant to be copied into the tracking issue.

Identifiers used throughout (change here → change everywhere):

| Thing                                                                     | Value                                                                                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| iOS bundle id / Android package                                           | `lk.shopbook.pos`                                                                                                    |
| Entitlement                                                               | `pro`                                                                                                                |
| Offering                                                                  | `default`                                                                                                            |
| iOS product ids                                                           | `lk.shopbook.pos.pro.monthly`, `lk.shopbook.pos.pro.quarterly`, `lk.shopbook.pos.pro.annual`                         |
| iOS subscription group                                                    | `Shopbook POS Pro`                                                                                                   |
| Android subscription product                                              | `pro` with base plans `monthly`, `quarterly`, `annual` (RevenueCat ids `pro:monthly`, `pro:quarterly`, `pro:annual`) |
| Packages                                                                  | `$rc_monthly`, `$rc_three_month`, `$rc_annual`                                                                       |
| Prices (LKR, final — [website](https://shopbook-pos-website.vercel.app/)) | 3,500 / 10,000 / 36,000 per period                                                                                   |
| Terms / Privacy                                                           | `https://shopbook-pos-website.vercel.app/terms`, `https://shopbook-pos-website.vercel.app/privacy`                   |
| Trial                                                                     | 14 days, app-level (no store offer needed)                                                                           |

Price note: Google Play bills Sri Lankan buyers in **LKR** — enter those numbers directly. Apple's Sri Lanka storefront bills in **USD**; pick the nearest Apple price points to the LKR targets at the rate on the day you set them (at ~LKR 300/USD that is roughly $11.99 / $34.99 / $119.99 — **verify the rate before entering**). Apple will derive the other storefronts automatically from the base price.

---

## 1. Legal & finance prerequisites (blocking everything)

- [ ] **Business entity**: SHOPBOOK TECHNOLOGIES (PVT) LTD is the seller on both stores (must match bank account name).
- [ ] **Terms of Service** and **Privacy Policy** exist at `https://shopbook-pos-website.vercel.app/terms` and `/privacy`. Both stores require them for auto-renewable subscriptions and the paywall links to them. Confirm the Terms page covers auto-renewal, cancellation and refunds-via-store wording (Apple reviewers read it). When the custom domain goes live, update `app_config.terms_url/privacy_url` — no app release needed.
- [ ] **Resolve the "Save 25%" claim** (audit P1-8) before entering store prices: either keep Rs 3,500 monthly and change the site/app copy to "Save 14%", or set monthly to Rs 4,000. Store listings, website and paywall must agree.
- [ ] Decide **VAT / tax treatment** with the accountant. Apple and Google act as merchant of record for the buyer, collect any applicable buyer-side taxes, and pay out net of commission (Apple 30% → **15% if enrolled in the App Store Small Business Program**; Google 15% for subscriptions). Enrolment in Apple's Small Business Program is a separate form in App Store Connect — do it before the first sale.
- [ ] Bank account able to receive USD (Apple pays in the currency of the bank account's country if supported; otherwise USD) and Google payouts (Google Payments profile in LKR/USD).

## 2. Apple — App Store Connect

- [ ] **Developer Program** membership is an _Organization_ account (needs D-U-N-S for the Pvt Ltd). Individual accounts can sell IAP but show a person's name as seller.
- [ ] **Agreements, Tax, and Banking** → accept the **Paid Apps Agreement**; add bank account; complete tax forms (W-8BEN-E for a non-US company). Status must be _Active_ — products cannot be tested in sandbox until it is.
- [ ] **App record** for `lk.shopbook.pos` exists (fix `app_config.ios_url` once the real numeric id is known).
- [ ] **Subscriptions** (App Store Connect → app → Subscriptions):
  - [ ] Create subscription group `Shopbook POS Pro`.
  - [ ] Create 3 auto-renewable subscriptions with the product ids above, durations 1 month / 3 months / 1 year.
  - [ ] Set base price per product (Sri Lanka storefront, USD) → Apple auto-fills other storefronts; review any storefront you actively sell in.
  - [ ] _Optional, later:_ Introductory Offer → Free trial 2 weeks per subscription, if you ever want a store-level trial in addition to the app-level one.
  - [ ] Localizations: display name + description (English at least; Sinhala/Tamil optional).
  - [ ] Review screenshot per subscription (a screenshot of the paywall is fine) — required before _Ready to Submit_.
  - [ ] Subscription group localization (group display name shown in the Manage Subscriptions sheet).
- [ ] **In-App Purchase Key** (App Store Connect → Users and Access → Integrations → In-App Purchase): generate key, download `.p8` **once**, note **Key ID** and **Issuer ID**. This is what RevenueCat needs for StoreKit 2 (not the legacy shared secret; generate the _App-Specific Shared Secret_ as well only if RevenueCat's dashboard asks for it as a fallback).
- [ ] **App Store Server Notifications** (app → App Information → App Store Server Notifications): set **Production** and **Sandbox** URLs to the value RevenueCat shows under _Project → Apps → iOS app → Apple Server Notifications_ (Version 2). This is how cancellations/renewals reach RevenueCat within seconds instead of on the next SDK call.
- [ ] **Sandbox testers** (Users and Access → Sandbox): create at least two Apple IDs. On the test device: Settings → App Store → Sandbox Account. Optionally set _Subscription Renewal Rate_ to accelerated (monthly = 5 min) for expiry tests.
- [ ] **App Privacy** questionnaire: _Purchase History_ → collected, linked to identity (App User ID maps to an owner on your server), not used for tracking. _Identifiers → User ID_ → collected.
- [ ] **App Review notes** for the submission that introduces IAP: sandbox owner phone + universal OTP so the reviewer can reach the paywall; sentence explaining that staff logins intentionally cannot purchase; mention that bank transfer is not offered in-app.
- [ ] **Capabilities**: In-App Purchase is enabled by default on the App ID; nothing to add in `app.json`. EAS handles signing.

## 3. Google — Play Console & Google Cloud

- [ ] **Play Console developer account** for the company (already exists if the Android build has shipped; verify it is an _organization_ account).
- [ ] **Payments profile / merchant account** (Play Console → Setup → Payments profile). Sri Lanka is a supported merchant location. Complete identity/business verification; payouts require a bank account; status must be _Verified_ before subscriptions can be created.
- [ ] **Subscriptions** (Play Console → app → Monetize → Products → Subscriptions):
  - [ ] Create subscription product id `pro`, name "Shopbook POS Pro", description.
  - [ ] Base plans: `monthly` (P1M), `quarterly` (P3M), `annual` (P1Y); type _auto-renewing_; grace period 7 days (Play default 3 — 7 is friendlier for a POS that must not lock a till); account hold on.
  - [ ] Prices: LKR 3,500 / 10,000 / 36,000 for Sri Lanka; let Play auto-convert the rest, then _Activate_ each base plan.
  - [ ] _Optional, later:_ Offer → Free trial P14D on each base plan (store-level trial), eligibility _new customer_.
- [ ] **Google Cloud project + service account** for RevenueCat (this is the fiddly part; the RevenueCat script does it end-to-end):
  1. Google Cloud Console → create/choose project → **enable** _Google Play Android Developer API_, _Google Play Developer Reporting API_, _Cloud Pub/Sub API_.
  2. Create service account `revenuecat-service-account`; grant roles **Pub/Sub Editor** and **Monitoring Viewer**; create a JSON key and download it.
  3. Play Console → Users and permissions → _Invite new user_ with the service account email → app-level permissions: **View app information and download bulk reports**, **View financial data, orders, and cancellation survey responses**, **Manage orders and subscriptions**. Status must be _Active_ (accept the invite if required).
  4. Wait — Google credentials can take **up to 36 hours** to become valid. Plan around it.
- [ ] **Real-time developer notifications** (Play Console → app → Monetize → Monetization setup): after RevenueCat has the JSON key, RevenueCat shows a Pub/Sub topic to paste here (or creates it). Click _Send test notification_ — if it fails, grant `google-play-developer-notifications@system.gserviceaccount.com` the **Pub/Sub Publisher** role on the topic in Cloud Console.
- [ ] **License testers** (Play Console → Setup → License testing): add the Google accounts used on test devices → _License response: RESPOND_NORMALLY_. Test purchases are free and renew on an accelerated schedule.
- [ ] **Testing track**: subscriptions only work in a build that is _installed from Play_ (internal testing track is enough) with the tester's account opted in, signed with the Play upload key (EAS `production`/store profile, `app-bundle`). Side-loaded dev builds can't complete a Play purchase.
- [ ] **Data safety** form: _Purchase history_ collected, _User IDs_ collected; not shared for advertising.
- [ ] Fix `app_config.android_url` to `https://play.google.com/store/apps/details?id=lk.shopbook.pos`.

## 4. RevenueCat dashboard

- [ ] Create account (company email) → **Project** "Shopbook POS".
- [ ] **Apps**: add _App Store_ app (bundle `lk.shopbook.pos`; upload the `.p8`, Key ID, Issuer ID) and _Play Store_ app (package `lk.shopbook.pos`; upload the service-account JSON). Keep the auto-created **Test Store** app — it's what runs in Expo Go / simulators with the `test_` key.
- [ ] Copy the three **public SDK keys** (`appl_…`, `goog_…`, `test_…`) into EAS secrets / `.env` as `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_REVENUECAT_TEST_KEY`.
- [ ] Create a **v1 secret API key** (Project → API keys → _Secret_; permissions: read subscribers; for ops grants also _write_) → Supabase secret `RC_SECRET_API_KEY`. Never ship this in an app.
- [ ] **Entitlements**: `pro` — "Shopbook POS Pro".
- [ ] **Products** (Product catalog): import from the stores once they exist — 3 iOS, 3 Android (`pro:monthly` …), plus 3 Test Store products with the same LKR prices. Attach all to entitlement `pro`.
- [ ] **Offering** `default` (mark _current_): packages `$rc_monthly`, `$rc_three_month`, `$rc_annual`, each with the iOS + Android (+ Test Store) product attached.
- [ ] **Webhook** (Integrations → Webhooks): URL `https://<project-ref>.functions.supabase.co/revenuecat-webhook`; _Authorization header value_ = a long random string → Supabase secret `RC_WEBHOOK_AUTH`; environment _Production + Sandbox_; all event types. Use _Send test event_ after the function is deployed.
- [ ] **Project settings → Restore behavior**: _Transfer to new App User ID_ (default). Rationale: an owner who changes phone number and re-registers should be able to restore; transfer events are handled by the webhook.
- [ ] **Alerts**: enable email for _Billing issues_ and _Webhook failures_.
- [ ] Dashboard users: add ops person with _Customer support_ role for promotional grants (§ build plan runbook).

## 5. Supabase

- [ ] Apply migration from build plan §3 (`owners`, `subscriptions`, `subscription_events`, RPCs, `app_config.iap_enabled`).
- [ ] Add columns `app_config.terms_url`, `app_config.privacy_url` (text) seeded with `https://shopbook-pos-website.vercel.app/terms` and `/privacy` — the paywall reads them so legal links can change without a release.
- [ ] Deploy Edge Function: `supabase functions deploy revenuecat-webhook --no-verify-jwt`.
- [ ] Secrets: `supabase secrets set RC_WEBHOOK_AUTH=… RC_SECRET_API_KEY=…` (`SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL` are injected automatically).
- [ ] Verify with RevenueCat _Send test event_ → `subscription_events` gets a `TEST` row (or the function returns 200 without writing — either is acceptable, but decide and assert it in the QA matrix).

## 6. EAS / app build

- [ ] `eas secret:create` (or EAS environment variables) for the three `EXPO_PUBLIC_REVENUECAT_*` keys per environment (development / preview / production).
- [ ] New **development build** after adding `react-native-purchases` (native module). iOS simulator builds can use a **StoreKit configuration file** for fully offline purchase testing if desired (Xcode scheme → StoreKit Configuration); not required.
- [ ] Bump `ios.buildNumber` / `android.versionCode`; the paywall build must go to **TestFlight** (iOS sandbox works there) and **Play internal testing**.
- [ ] Keep `app_config.iap_enabled=false` until both stores have approved the subscription products, then flip it — no release needed.

## 7. Go-live checklist

- [ ] Apple: subscriptions _Ready to Submit_ and attached to the app version; version submitted with the review notes.
- [ ] Google: base plans _Active_; app version with billing library in production or a promoted track.
- [ ] RevenueCat: both apps show _Store credentials: valid_; Apple Server Notifications and Play RTDN show _Connected_; webhook shows recent 200s.
- [ ] Supabase: `get_entitlement` returns `is_pro=true` for a sandbox purchase; web blocker flips.
- [ ] `iap_enabled=true`.
- [ ] Ops runbook (build plan §7) shared with the WhatsApp/bank-transfer team; website pricing page updated with bank details (they leave the app).
- [ ] `mobile/doc/PREMIUM_PLANS.md` and `README.md` rewritten to describe the real flow.

## Sources

- RevenueCat: [Quickstart](https://www.revenuecat.com/docs/getting-started/quickstart), [Play service credentials](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials), [Play checklist](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials/google-play-checklists), [App Store shared secret / IAP key](https://www.revenuecat.com/docs/service-credentials/itunesconnect-app-specific-shared-secret), [Google server notifications](https://www.revenuecat.com/docs/platform-resources/server-notifications/google-server-notifications), [Webhooks events & fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields), [Sandbox: App Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/apple-app-store), [Identifying customers](https://www.revenuecat.com/docs/customers/identifying-customers), [Apple App Privacy](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy), [react-native-purchases](https://github.com/revenuecat/react-native-purchases)
- Apple: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Receiving payments](https://www.developer.apple.com/help/app-store-connect/getting-paid/overview-of-receiving-payments)
- Google: [Supported locations for developer & merchant registration](https://support.google.com/googleplay/android-developer/answer/9306917), [Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818), [Alternative billing regions](https://support.google.com/googleplay/android-developer/answer/15582165)
- Reference implementations reviewed: [raj457036/CopyCat-Clipboard `rc_webhook`](https://github.com/raj457036/CopyCat-Clipboard/blob/main/supabase/functions/rc_webhook/index.ts) (Supabase edge webhook, expiry-max upsert), [Chessever `revenuecat-webhook`](https://github.com/Chessever/chessever-frontend/blob/main/supabase/functions/revenuecat-webhook/index.ts) (race-safe upsert), [8xsocial/template-mobile `lib/purchases.ts`](https://github.com/8xsocial/template-mobile/blob/main/lib/purchases.ts) (Expo Go guard, logIn after auth), [admbtlr/reams `AuthProvider`](https://github.com/admbtlr/reams/blob/main/components/AuthProvider.tsx) (configure with user id after session)
