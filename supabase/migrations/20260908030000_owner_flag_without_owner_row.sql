-- =========================================================================
-- OWNERSHIP MUST NOT DEPEND ON THE owners ROW EXISTING
-- 20260908030000_owner_flag_without_owner_row.sql
--
-- 20260908010000 added is_owner to get_entitlement, but computed it inside a
-- subquery that INNER JOINs owners. The owners row is minted lazily by
-- get_or_create_owner during login, so any business whose owner has not been
-- through that path has no row — 8 of 12 in production right now. For those,
-- the whole subquery returns no rows, the COALESCE fallback fires, and
-- is_owner comes back false even when the caller supplies the correct owner
-- phone. Which reproduces exactly the bug it was written to fix.
--
-- Ownership is a property of businesses.phone_number and the caller's phone.
-- It has nothing to do with the owners table, which exists to carry the
-- RevenueCat app user id and the subscription. LEFT JOIN, so the entitlement
-- fields stay null until there is a subscription while ownership answers
-- from the business alone.
-- =========================================================================

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
     LEFT JOIN public.owners o
       ON o.phone = public.normalize_phone_pg(b.phone_number)
     LEFT JOIN public.subscriptions s
       ON s.owner_id = o.id
     WHERE b.id = client_business_id),
    json_build_object('is_pro', false, 'is_trial', false, 'is_owner', false));
$$;

GRANT EXECUTE ON FUNCTION public.get_entitlement(text, text) TO anon, authenticated;
