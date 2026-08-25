-- =========================================================================
-- MIGRATION: PHONE UNIQUENESS VALIDATION & CASCADE VERIFICATION
-- =========================================================================

-- 1. Helper function: normalize_phone_pg
CREATE OR REPLACE FUNCTION public.normalize_phone_pg(phone_str text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
BEGIN
  IF phone_str IS NULL THEN
    RETURN '';
  END IF;
  cleaned := regexp_replace(phone_str, '\D', '', 'g');
  IF cleaned LIKE '94%' THEN
    cleaned := substr(cleaned, 3);
  END IF;
  IF cleaned LIKE '0%' THEN
    cleaned := substr(cleaned, 2);
  END IF;
  RETURN cleaned;
END;
$$;

GRANT EXECUTE ON FUNCTION public.normalize_phone_pg(text) TO anon, authenticated;

-- 2. RPC function: check_phone_registered
-- Checks whether a phone number is registered anywhere (business owner or employee)
-- Optional exclude parameters allow updating an existing employee or business without false conflict.
CREATE OR REPLACE FUNCTION public.check_phone_registered(
  input_phone text,
  exclude_employee_id text DEFAULT NULL,
  exclude_business_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_input text;
  matched_biz record;
  matched_emp record;
BEGIN
  clean_input := public.normalize_phone_pg(input_phone);

  IF clean_input IS NULL OR clean_input = '' THEN
    RETURN json_build_object('exists', false);
  END IF;

  -- 1. Check in businesses table (business owner phone)
  SELECT id, name, phone_number INTO matched_biz
  FROM public.businesses
  WHERE public.normalize_phone_pg(phone_number) = clean_input
    AND (exclude_business_id IS NULL OR id != exclude_business_id)
  LIMIT 1;

  IF matched_biz.id IS NOT NULL THEN
    RETURN json_build_object(
      'exists', true,
      'type', 'owner',
      'role', 'admin',
      'name', 'Owner / Admin',
      'business_id', matched_biz.id,
      'business_name', matched_biz.name
    );
  END IF;

  -- 2. Check in employees table
  SELECT e.id, e.business_id, e.name, e.role, b.name as business_name INTO matched_emp
  FROM public.employees e
  LEFT JOIN public.businesses b ON b.id = e.business_id
  WHERE public.normalize_phone_pg(e.phone) = clean_input
    AND (exclude_employee_id IS NULL OR e.id != exclude_employee_id)
  LIMIT 1;

  IF matched_emp.id IS NOT NULL THEN
    RETURN json_build_object(
      'exists', true,
      'type', 'employee',
      'role', matched_emp.role,
      'name', matched_emp.name,
      'employee_id', matched_emp.id,
      'business_id', matched_emp.business_id,
      'business_name', matched_emp.business_name
    );
  END IF;

  RETURN json_build_object('exists', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_phone_registered(text, text, text) TO anon, authenticated;

-- Also create check_synced_account alias for backwards compatibility
CREATE OR REPLACE FUNCTION public.check_synced_account(input_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.check_phone_registered(input_phone, NULL, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_synced_account(text) TO anon, authenticated;
