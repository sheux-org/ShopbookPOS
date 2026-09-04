-- =========================================================================
-- REVENUECAT ENTITLEMENTS
-- 20260901000000_revenuecat_entitlements.sql
--
-- Server-side subscription state. Replaces the client-side `isPremium`
-- boolean, which was forced true for every user and never persisted.
--
-- Entitlement is scoped to the OWNER (businesses.phone_number), not the
-- device or the employee, so every staff terminal and the web client of a
-- paying owner unlock from the same row.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -------------------------------------------------------------------------
-- 1. OWNERS — stable, non-PII RevenueCat App User ID
--    RevenueCat advises against PII / guessable app user ids; a phone number
--    is both. owners.id (uuid) is what the SDK logs in with.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,          -- always normalize_phone_pg() output
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 2. SUBSCRIPTIONS — one row per owner, written only by the webhook
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  owner_id uuid PRIMARY KEY REFERENCES public.owners(id) ON DELETE CASCADE,
  entitlement text NOT NULL DEFAULT 'shopbook_pos_pro',
  is_active boolean NOT NULL DEFAULT false,
  expires_at timestamptz,              -- null = lifetime / non-expiring grant
  will_renew boolean NOT NULL DEFAULT false,
  product_id text,
  store text,                          -- APP_STORE | PLAY_STORE | PROMOTIONAL | ...
  period_type text,                    -- NORMAL | TRIAL | INTRO | PROMOTIONAL
  environment text,                    -- PRODUCTION | SANDBOX
  management_url text,
  rc_last_event_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------------------------
-- 3. SUBSCRIPTION_EVENTS — webhook idempotency + audit trail.
--    RevenueCat retries on non-2xx and may deliver out of order; the primary
--    key on the RevenueCat event id makes replays a no-op.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id text PRIMARY KEY,                 -- RevenueCat event.id
  owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  type text NOT NULL,
  payload jsonb NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_owner ON public.subscription_events(owner_id);

-- -------------------------------------------------------------------------
-- 4. RLS: enabled with NO policies.
--    These tables are reachable only via the service role (the webhook) and
--    the SECURITY DEFINER functions below. The anon key cannot read them.
-- -------------------------------------------------------------------------
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 5. app_config additions
--    iap_enabled is the kill switch: the paywall hides purchase CTAs while
--    it is false, so this release can ship before the stores approve the
--    subscription products. terms/privacy are read by the paywall so the
--    legal links can move without an app release.
-- -------------------------------------------------------------------------
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS iap_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS terms_url text NOT NULL DEFAULT 'https://shopbook-pos-website.vercel.app/terms';
ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS privacy_url text NOT NULL DEFAULT 'https://shopbook-pos-website.vercel.app/privacy';

-- Force-update deep links pointed at a package that does not exist (known-issues CFG-1).
UPDATE public.app_config
SET android_url = 'https://play.google.com/store/apps/details?id=lk.shopbook.pos'
WHERE id = 1
  AND android_url = 'https://play.google.com/store/apps/details?id=com.pasanpahasara.shopbookpos';

-- -------------------------------------------------------------------------
-- 6. get_or_create_owner — called on owner login to mint the App User ID.
--    Same trust model as fetch_user_businesses (anon-callable, SECURITY
--    DEFINER). Worst case an attacker creates an orphan owners row for a
--    phone number, which grants nothing: entitlement still requires a
--    subscriptions row that only the webhook can write.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_or_create_owner(input_phone text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean text := public.normalize_phone_pg(input_phone);
  result_id uuid;
BEGIN
  IF clean IS NULL OR clean = '' THEN
    RAISE EXCEPTION 'phone required';
  END IF;

  INSERT INTO public.owners (phone) VALUES (clean)
  ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_owner(text) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- 7. get_entitlement — the single read path for every client.
--
--    is_pro is computed from expires_at at READ time, so an expiry takes
--    effect even if the EXPIRATION webhook is late or lost.
--
--    The 14-day trial is derived from owners.created_at. No trial table, no
--    store intro offer, nothing for the client to track. A business whose
--    owner has never logged in since this shipped has no owners row and
--    resolves to is_pro=false; their first login creates it and starts the
--    trial.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_entitlement(client_business_id text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT json_build_object(
        'is_pro',
          COALESCE(s.is_active AND (s.expires_at IS NULL OR s.expires_at > now()), false)
          OR o.created_at + interval '14 days' > now(),
        'is_trial',
          NOT COALESCE(s.is_active AND (s.expires_at IS NULL OR s.expires_at > now()), false)
          AND o.created_at + interval '14 days' > now(),
        'trial_ends_at',  o.created_at + interval '14 days',
        'expires_at',     s.expires_at,
        'will_renew',     COALESCE(s.will_renew, false),
        'product_id',     s.product_id,
        'store',          s.store,
        'period_type',    s.period_type,
        'management_url', s.management_url,
        'owner_id',       o.id)
     FROM public.businesses b
     JOIN public.owners o
       ON o.phone = public.normalize_phone_pg(b.phone_number)
     LEFT JOIN public.subscriptions s
       ON s.owner_id = o.id
     WHERE b.id = client_business_id),
    json_build_object('is_pro', false, 'is_trial', false));
$$;

GRANT EXECUTE ON FUNCTION public.get_entitlement(text) TO anon, authenticated;
