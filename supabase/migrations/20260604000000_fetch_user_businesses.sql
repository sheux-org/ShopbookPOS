-- -------------------------------------------------------------------------
-- FUNCTION: `fetch_user_businesses` RPC (Retrieve all businesses matching user phone)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_user_businesses(input_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_input text;
  matched_businesses json;
  matched_employees json;
  result json;
BEGIN
  clean_input := public.normalize_phone_pg(input_phone);

  -- 1. Fetch matching employees
  SELECT coalesce(
    json_agg(t),
    '[]'::json
  ) INTO matched_employees
  FROM (
    SELECT id, business_id, name, role, phone, email, created_at, updated_at
    FROM public.employees
    WHERE public.normalize_phone_pg(phone) = clean_input
  ) t;

  -- 2. Fetch matching businesses (either owned or where the user is an employee)
  SELECT coalesce(
    json_agg(b),
    '[]'::json
  ) INTO matched_businesses
  FROM (
    SELECT id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at
    FROM public.businesses
    WHERE public.normalize_phone_pg(phone_number) = clean_input
       OR id IN (
         SELECT business_id 
         FROM public.employees 
         WHERE public.normalize_phone_pg(phone) = clean_input
       )
  ) b;

  SELECT json_build_object(
    'businesses', matched_businesses,
    'employees', matched_employees
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_user_businesses(text) TO anon, authenticated;
