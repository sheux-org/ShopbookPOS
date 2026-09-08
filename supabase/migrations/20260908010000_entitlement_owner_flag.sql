-- =========================================================================
-- OWNERSHIP BECOMES A SERVER ANSWER
-- 20260908010000_entitlement_owner_flag.sql
--
-- "Is this session the owner of the active business?" was answered in three
-- places, from three different inputs, and two of them disagreed with this
-- database. check_phone_registered checks businesses BEFORE employees, so it
-- answers 'owner' correctly. The client's local match checked employees
-- first, so an owner — who also has an employees row created at
-- registration — came back as staff. A helper then tried to correct for that
-- by comparing the user's phone against the active business's phone, which
-- only works once the local database has actually been populated.
--
-- On a fresh install it has not been. The business list falls back to a
-- placeholder whose phone is the empty string, the comparison fails, and the
-- owner is shown "Owner account required" on the paywall they must pass to
-- reach the sync that would have populated it. Nobody can subscribe.
--
-- The fix is to stop deriving it on the client. get_entitlement already
-- resolves businesses -> owners by phone and is already called on mount, on
-- foreground and on business switch; it just needs the caller's phone to
-- answer the ownership question at the same time.
--
-- Deliberately NOT stored on the auth session: that store is persisted, so a
-- new field there would hydrate as undefined for every session that already
-- exists and lock those owners out until they reinstalled. The entitlement
-- cache is refreshed unconditionally on every launch, so sessions created
-- before this migration correct themselves with no migration path at all.
-- =========================================================================

-- The single-argument form is dropped rather than overloaded: with a DEFAULT
-- on the second parameter, an overload would make every existing one-argument
-- call ambiguous and fail. Dropping and replacing means the currently shipped
-- mobile build and the deployed web terminal keep working untouched — they
-- pass one argument, get NULL for the phone, and read is_owner as false,
-- which is exactly what they did before this column existed.
DROP FUNCTION IF EXISTS public.get_entitlement(text);

CREATE OR REPLACE FUNCTION public.get_entitlement(
  client_business_id text,
  client_phone text DEFAULT NULL
)
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
        -- Ownership is a property of the business, not of the employees row.
        -- An owner always has both; only this comparison distinguishes them.
        'is_owner',
          COALESCE(
            public.normalize_phone_pg(client_phone) <> ''
            AND public.normalize_phone_pg(client_phone)
                = public.normalize_phone_pg(b.phone_number),
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
    json_build_object('is_pro', false, 'is_trial', false, 'is_owner', false));
$$;

GRANT EXECUTE ON FUNCTION public.get_entitlement(text, text) TO anon, authenticated;

-- =========================================================================
-- VERIFY (read-only)
-- =========================================================================
SELECT public.get_entitlement('does-not-exist')            AS unknown_business;
SELECT public.get_entitlement('does-not-exist', '0771234567') AS unknown_with_phone;
