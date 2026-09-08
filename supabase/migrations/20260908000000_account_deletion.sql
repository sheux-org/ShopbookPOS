-- =========================================================================
-- ACCOUNT AND DATA DELETION
-- 20260908000000_account_deletion.sql
--
-- Google Play requires an in-app path to delete the account and its data,
-- and the published policy at pos.shopbook.lk/privacy already names one
-- (Profile -> Delete Account). This is the server half of it.
--
-- Ownership is keyed by phone, not a foreign key: businesses carry the
-- owner's phone_number and owners.phone is its normalized form, which is
-- the same join get_entitlement and fetch_user_businesses already use.
-- =========================================================================

-- -------------------------------------------------------------------------
-- delete_account — purge an owner and every shop registered to their phone.
--
--    Both the business id and the phone must be supplied and must resolve to
--    the same owner. That is the same trust bar as push_watermelondb_changes,
--    which already lets anyone holding a business id rewrite or empty the
--    shop; this adds no reach that an attacker did not already have, and the
--    client only calls it after a fresh OTP verification.
--
--    Cascades do most of the work: businesses -> employees, orders ->
--    order_items, products -> inventory_logs, and owners -> subscriptions.
--    The tables keyed by a bare business_id text column have no foreign key
--    and are cleared explicitly.
--
--    paywall_events and subscription_events are ON DELETE SET NULL by
--    design. The rows survive with no owner attached, which is what the
--    privacy policy describes as anonymized records kept for the statutory
--    retention period, and it keeps revenue history from developing holes.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_account(
  input_business_id text,
  input_phone text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized  text := public.normalize_phone_pg(input_phone);
  owner_row   public.owners%ROWTYPE;
  target_ids  text[];
  deleted_businesses int;
BEGIN
  IF input_business_id IS NULL OR normalized IS NULL OR normalized = '' THEN
    RAISE EXCEPTION 'business id and phone are both required';
  END IF;

  SELECT o.* INTO owner_row
  FROM public.owners o
  WHERE o.phone = normalized;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no account matches that phone';
  END IF;

  -- The supplied business must belong to the phone that was verified.
  -- Without this check any known business id would delete any account.
  IF NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = input_business_id
      AND public.normalize_phone_pg(b.phone_number) = normalized
  ) THEN
    RAISE EXCEPTION 'that shop is not registered to this phone';
  END IF;

  SELECT array_agg(b.id) INTO target_ids
  FROM public.businesses b
  WHERE public.normalize_phone_pg(b.phone_number) = normalized;

  DELETE FROM public.active_devices             WHERE business_id = ANY(target_ids);
  DELETE FROM public.device_session_revocations WHERE business_id = ANY(target_ids);

  DELETE FROM public.businesses WHERE id = ANY(target_ids);
  GET DIAGNOSTICS deleted_businesses = ROW_COUNT;

  -- Last, not first: the record_deletion() trigger writes a tombstone into
  -- deleted_records for every row the cascade removes, so clearing this table
  -- before the businesses go just refills it. The tombstones exist to tell
  -- other devices to drop local copies, and there is no account left to sync.
  DELETE FROM public.deleted_records WHERE business_id = ANY(target_ids);

  DELETE FROM public.owners WHERE id = owner_row.id;

  RETURN json_build_object(
    'deleted', true,
    'businesses_deleted', deleted_businesses,
    'owner_id', owner_row.id);
END $$;

GRANT EXECUTE ON FUNCTION public.delete_account(text, text) TO anon, authenticated;

-- =========================================================================
-- VERIFY (read-only)
-- =========================================================================
SELECT to_regprocedure('public.delete_account(text, text)') AS delete_account_fn;
