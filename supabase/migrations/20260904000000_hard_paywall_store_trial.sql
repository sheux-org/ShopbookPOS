-- =========================================================================
-- HARD PAYWALL + STORE-GRANTED TRIAL
-- 20260904000000_hard_paywall_store_trial.sql
--
-- The app moves to a hard paywall: no access without an entitlement. The
-- trial is granted by the STORE as an introductory offer, not by us — the
-- customer confirms a plan with a payment method, gets N days free, and is
-- billed automatically unless they cancel.
--
-- That makes the previous app-level trial actively harmful: it granted Pro
-- for 14 days from owners.created_at, so every new signup would walk past
-- the paywall without a card and the gate would never fire.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. get_entitlement — entitlement now comes only from a real subscription.
--
--    is_trial is read from subscriptions.period_type, which the webhook
--    already writes from RevenueCat's subscriber payload ('TRIAL' during an
--    introductory offer, 'NORMAL' once it converts). During a trial the
--    store still reports expires_at, so the client shows the countdown from
--    that and no separate trial_ends_at is needed.
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
          COALESCE(s.is_active AND (s.expires_at IS NULL OR s.expires_at > now()), false),
        'is_trial',
          COALESCE(
            s.period_type = 'TRIAL'
            AND s.is_active
            AND (s.expires_at IS NULL OR s.expires_at > now()),
            false),
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

-- -------------------------------------------------------------------------
-- 2. paywall_events — the half of the funnel RevenueCat cannot see.
--
--    RevenueCat reports everything from purchase intent onward. It knows
--    nothing about people who saw the paywall and left, which on a hard
--    paywall is the number that decides whether the business works.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.paywall_events (
  id bigserial PRIMARY KEY,
  event text NOT NULL,            -- viewed | plan_selected | purchase_started
                                  -- | purchase_cancelled | purchase_failed
                                  -- | purchase_succeeded | restore_attempted
  business_id text,
  owner_id uuid REFERENCES public.owners(id) ON DELETE SET NULL,
  package_id text,                -- $rc_monthly | $rc_three_month | $rc_annual
  product_id text,
  platform text,                  -- ios | android | web
  app_version text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paywall_events_created ON public.paywall_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paywall_events_business ON public.paywall_events(business_id, created_at DESC);

ALTER TABLE public.paywall_events ENABLE ROW LEVEL SECURITY;
-- No policies: writes go through the SECURITY DEFINER function below, reads
-- are for the service role only. The anon key must never read this back.

-- -------------------------------------------------------------------------
-- 3. log_paywall_event — the only write path.
--
--    A function rather than a table grant so the client cannot invent
--    columns, cannot read anything back, and the event vocabulary stays
--    closed. Same trust model as the other anon-callable RPCs: the worst an
--    attacker achieves is junk telemetry, never entitlement.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_paywall_event(
  input_event text,
  input_business_id text DEFAULT NULL,
  input_package_id text DEFAULT NULL,
  input_product_id text DEFAULT NULL,
  input_platform text DEFAULT NULL,
  input_app_version text DEFAULT NULL,
  input_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_owner uuid;
BEGIN
  IF input_event NOT IN (
    'viewed', 'plan_selected', 'purchase_started', 'purchase_cancelled',
    'purchase_failed', 'purchase_succeeded', 'restore_attempted'
  ) THEN
    RAISE EXCEPTION 'unknown paywall event: %', input_event;
  END IF;

  SELECT o.id INTO resolved_owner
  FROM public.businesses b
  JOIN public.owners o ON o.phone = public.normalize_phone_pg(b.phone_number)
  WHERE b.id = input_business_id;

  INSERT INTO public.paywall_events (
    event, business_id, owner_id, package_id, product_id,
    platform, app_version, metadata
  ) VALUES (
    input_event, input_business_id, resolved_owner, input_package_id,
    input_product_id, input_platform, input_app_version,
    COALESCE(input_metadata, '{}'::jsonb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.log_paywall_event(
  text, text, text, text, text, text, jsonb
) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- 4. v_subscription_events — flattens the raw webhook payloads.
--
--    subscription_events already stores RevenueCat's event object verbatim,
--    so trial starts, conversions and cancellations are all in there. This
--    view exists so a dashboard can read columns instead of digging through
--    jsonb, without adding a second write path that could drift.
--
--    Deliberately NOT granted to anon — the service role reads it.
-- -------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_subscription_events AS
SELECT
  e.id,
  e.owner_id,
  e.type,
  e.payload ->> 'product_id'                                    AS product_id,
  e.payload ->> 'period_type'                                   AS period_type,
  e.payload ->> 'store'                                         AS store,
  e.payload ->> 'environment'                                   AS environment,
  e.payload ->> 'country_code'                                  AS country_code,
  e.payload ->> 'currency'                                      AS currency,
  NULLIF(e.payload ->> 'price', '')::numeric                    AS price,
  NULLIF(e.payload ->> 'takehome_percentage', '')::numeric      AS takehome_percentage,
  e.payload ->> 'presented_offering_id'                         AS offering_id,
  e.payload ->> 'cancel_reason'                                 AS cancel_reason,
  to_timestamp(NULLIF(e.payload ->> 'purchased_at_ms', '')::bigint / 1000)  AS purchased_at,
  to_timestamp(NULLIF(e.payload ->> 'expiration_at_ms', '')::bigint / 1000) AS expires_at,
  e.received_at
FROM public.subscription_events e;

-- -------------------------------------------------------------------------
-- 5. The App Store record now exists, so the force-update deep link can point
--    at it. Guarded on the placeholder so a corrected value is never clobbered.
--    (known-issues CFG-1, iOS half.)
-- -------------------------------------------------------------------------
UPDATE public.app_config
SET ios_url = 'https://apps.apple.com/app/id6794647713'
WHERE id = 1
  AND ios_url = 'https://apps.apple.com/app/id6470000000';

-- =========================================================================
-- VERIFY (read-only)
-- =========================================================================
SELECT ios_url, android_url, iap_enabled FROM public.app_config WHERE id = 1;
SELECT public.get_entitlement('does-not-exist')  AS should_be_not_pro;
SELECT to_regclass('public.paywall_events')      AS paywall_events,
       to_regclass('public.v_subscription_events') AS funnel_view;
