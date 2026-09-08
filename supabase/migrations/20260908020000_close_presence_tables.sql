-- =========================================================================
-- CLOSE THE TENANT DIRECTORY
-- 20260908020000_close_presence_tables.sql
--
-- active_devices and device_session_revocations carried permissive policies
-- for role `public`:
--
--   Allow public select   SELECT  USING (true)
--   Allow public insert   INSERT  WITH CHECK (true)
--   Allow public update   UPDATE  USING (true) WITH CHECK (true)
--   Allow public delete   DELETE  USING (true)
--
-- `public` includes `anon`, and the anon key ships in both client bundles.
-- So one unauthenticated SELECT returned every row: the business_id of every
-- shop on the platform, plus staff names and roles, device GPS coordinates
-- and Expo push tokens.
--
-- That is what made the known SEC-2 weakness self-service. SEC-2 assumes an
-- attacker must first obtain a business_id; the ids are strong (WatermelonDB,
-- ~95 bits) but this table published the complete list, so the entropy bought
-- nothing. With the directory closed, reaching another merchant's data
-- requires knowing their business_id, which is the same bar as every other
-- RPC here. That is a real reduction, not a fix: tenancy is still a
-- client-supplied parameter, and only server-derived sessions close it.
--
-- Every client call was already scoped by business_id, so these functions are
-- a one-to-one replacement for the table access they retire. They are not
-- authorization — they are SECURITY DEFINER and take the tenant from the
-- caller, exactly like pull_watermelondb_changes. The single thing they
-- change is that no endpoint enumerates tenants any more.
-- =========================================================================

DROP POLICY IF EXISTS "Allow public select" ON public.active_devices;
DROP POLICY IF EXISTS "Allow public insert" ON public.active_devices;
DROP POLICY IF EXISTS "Allow public update" ON public.active_devices;
DROP POLICY IF EXISTS "Allow public delete" ON public.active_devices;

DROP POLICY IF EXISTS "Allow public select" ON public.device_session_revocations;
DROP POLICY IF EXISTS "Allow public insert" ON public.device_session_revocations;
DROP POLICY IF EXISTS "Allow public update" ON public.device_session_revocations;
DROP POLICY IF EXISTS "Allow public delete" ON public.device_session_revocations;

-- RLS stays enabled on both. With no policies left, direct table access by
-- anon is closed and the functions below are the only way in.

-- -------------------------------------------------------------------------
-- Presence: written by the device it describes, read per business.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_device_presence(
  input_record_id text,
  input_business_id text,
  input_device_id text,
  input_employee_id text,
  input_employee_name text,
  input_role text,
  input_device_model text,
  input_battery_level integer,
  input_is_online boolean,
  input_latitude numeric,
  input_longitude numeric,
  input_location_name text,
  input_push_token text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.active_devices (
    id, business_id, employee_id, employee_name, role, device_id,
    device_model, battery_level, is_online, latitude, longitude,
    location_name, push_token, last_active_at
  ) VALUES (
    input_record_id, input_business_id, input_employee_id, input_employee_name,
    input_role, input_device_id, input_device_model, input_battery_level,
    input_is_online, input_latitude, input_longitude, input_location_name,
    input_push_token, now()
  )
  ON CONFLICT (id) DO UPDATE SET
    business_id   = EXCLUDED.business_id,
    employee_id   = EXCLUDED.employee_id,
    employee_name = EXCLUDED.employee_name,
    role          = EXCLUDED.role,
    device_id     = EXCLUDED.device_id,
    device_model  = EXCLUDED.device_model,
    battery_level = EXCLUDED.battery_level,
    is_online     = EXCLUDED.is_online,
    latitude      = EXCLUDED.latitude,
    longitude     = EXCLUDED.longitude,
    location_name = EXCLUDED.location_name,
    push_token    = EXCLUDED.push_token,
    last_active_at = now();
$$;

CREATE OR REPLACE FUNCTION public.delete_device_presence(
  input_business_id text,
  input_device_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.active_devices
  WHERE business_id = input_business_id
    AND device_id = input_device_id;
$$;

-- Push tokens are deliberately NOT returned. The panel did display them, in
-- full, next to a copy button — a debug affordance that shipped. A push token
-- lets its holder send notifications to that device, so it is credential-like
-- and has no business on screen. The device still reports its token here for
-- the server to use; only the read path drops it, and the UI block is gone.
CREATE OR REPLACE FUNCTION public.list_offline_devices(
  input_business_id text,
  input_hours integer DEFAULT 24
)
RETURNS TABLE (
  id text,
  business_id text,
  employee_id text,
  employee_name text,
  role text,
  device_id text,
  device_model text,
  battery_level integer,
  is_online boolean,
  latitude numeric,
  longitude numeric,
  location_name text,
  last_active_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT d.id, d.business_id, d.employee_id, d.employee_name, d.role,
         d.device_id, d.device_model, d.battery_level, d.is_online,
         d.latitude, d.longitude, d.location_name, d.last_active_at
  FROM public.active_devices d
  WHERE d.business_id = input_business_id
    AND d.is_online = false
    AND d.last_active_at >= now() - make_interval(hours => input_hours)
  ORDER BY d.last_active_at DESC;
$$;

-- -------------------------------------------------------------------------
-- Session revocation.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_device_session(
  input_business_id text,
  input_device_id text,
  input_revoked_by_device_id text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.device_session_revocations (
    business_id, device_id, revoked_at, revoked_by_device_id
  ) VALUES (
    input_business_id, input_device_id, now(), input_revoked_by_device_id
  )
  ON CONFLICT (business_id, device_id) DO UPDATE SET
    revoked_at = now(),
    revoked_by_device_id = EXCLUDED.revoked_by_device_id;
$$;

CREATE OR REPLACE FUNCTION public.is_device_revoked(
  input_business_id text,
  input_device_id text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.device_session_revocations
    WHERE business_id = input_business_id
      AND device_id = input_device_id);
$$;

GRANT EXECUTE ON FUNCTION public.upsert_device_presence(
  text, text, text, text, text, text, text, integer, boolean,
  numeric, numeric, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_device_presence(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_offline_devices(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_device_session(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_device_revoked(text, text) TO anon, authenticated;

-- -------------------------------------------------------------------------
-- Correct the record on delete_account.
--
-- Its migration comment claims "the client only calls it after a fresh OTP
-- verification". That describes an intention, not a control: nothing
-- server-side verifies it, and it read as though it were one.
-- -------------------------------------------------------------------------
COMMENT ON FUNCTION public.delete_account(text, text) IS
  'Purges an owner and every business registered to their phone. Authorization '
  'is the caller''s knowledge of a matching business_id and phone — the same '
  'client-supplied trust bar as push_watermelondb_changes, which can already '
  'destroy the same data. No OTP is verified server-side. Closing this '
  'properly requires server-derived sessions (SEC-2).';

-- =========================================================================
-- VERIFY (read-only)
-- =========================================================================
SELECT tablename, count(*) AS remaining_public_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('active_devices', 'device_session_revocations')
GROUP BY tablename;
