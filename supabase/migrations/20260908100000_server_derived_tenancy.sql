-- =========================================================================
-- SERVER-DERIVED TENANCY
-- 20260908100000_server_derived_tenancy.sql
--
-- Until now every RPC took the tenant from its caller: "I am business X"
-- was a parameter, and the anon key that ships in both app bundles was
-- enough to read and rewrite any shop whose id you knew (SEC-2, TEN-2..8).
--
-- Identity now comes from Supabase Auth. Phone OTP login yields a JWT whose
-- `phone` claim the database reads through auth.jwt(). Membership is the
-- existing data: businesses.phone_number (owner) and employees.phone
-- (staff). Every RPC checks it, every Realtime channel checks it, and the
-- anon role can no longer execute anything but read app_config.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Identity helpers
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_phone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.normalize_phone_pg(auth.jwt() ->> 'phone');
$$;

CREATE OR REPLACE FUNCTION public.require_auth_phone()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p text := public.auth_phone();
BEGIN
  IF p IS NULL OR p = '' THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_owner_of(bid text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_phone() <> ''
     AND EXISTS (
       SELECT 1 FROM public.businesses b
       WHERE b.id = bid
         AND public.normalize_phone_pg(b.phone_number) = public.auth_phone());
$$;

CREATE OR REPLACE FUNCTION public.is_member_of(bid text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_owner_of(bid)
      OR (public.auth_phone() <> ''
          AND EXISTS (
            SELECT 1 FROM public.employees e
            WHERE e.business_id = bid
              AND public.normalize_phone_pg(e.phone) = public.auth_phone()));
$$;

CREATE OR REPLACE FUNCTION public.require_member(bid text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF bid IS NULL OR bid = '' OR NOT public.is_member_of(bid) THEN
    RAISE EXCEPTION 'not a member of this business' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_owner(bid text)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF bid IS NULL OR bid = '' OR NOT public.is_owner_of(bid) THEN
    RAISE EXCEPTION 'not the owner of this business' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_employees_normalized_phone
  ON public.employees (public.normalize_phone_pg(phone));
CREATE INDEX IF NOT EXISTS idx_businesses_normalized_phone
  ON public.businesses (public.normalize_phone_pg(phone_number));

DROP FUNCTION IF EXISTS public.get_auth_business_id();

-- -------------------------------------------------------------------------
-- 2. Sync. Same bodies as before; the tenant is now checked against the
--    caller's phone, and every delete is scoped to that tenant.
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pull_watermelondb_changes(last_pulled_at bigint, client_business_id text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  current_time_ms bigint;
  result json;
BEGIN
  PERFORM public.require_member(client_business_id);

  current_time_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

  SELECT json_build_object(
    'changes', json_build_object(
      'businesses', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at FROM businesses WHERE server_updated_at > last_pulled_at AND created_at >= updated_at AND id = client_business_id) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at FROM businesses WHERE server_updated_at > last_pulled_at AND created_at < updated_at AND id = client_business_id) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'businesses' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'employees', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, name, role, phone, email, created_at, updated_at FROM employees WHERE server_updated_at > last_pulled_at AND created_at >= updated_at AND business_id = client_business_id) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, name, role, phone, email, created_at, updated_at FROM employees WHERE server_updated_at > last_pulled_at AND created_at < updated_at AND business_id = client_business_id) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'employees' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'products', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, name, sku, quick_code, barcode, category, unit_type, cost_price, price, stock_count, low_stock_alert, icon, is_favorite, created_at, updated_at FROM products WHERE server_updated_at > last_pulled_at AND created_at >= updated_at AND business_id = client_business_id) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, name, sku, quick_code, barcode, category, unit_type, cost_price, price, stock_count, low_stock_alert, icon, is_favorite, created_at, updated_at FROM products WHERE server_updated_at > last_pulled_at AND created_at < updated_at AND business_id = client_business_id) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'products' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'orders', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, invoice_number, total_amount, status, payment_method, bank_name, card_last_four, discount_type, discount_value, tax_rate, tax_value, created_at, updated_at FROM orders WHERE server_updated_at > last_pulled_at AND created_at >= updated_at AND business_id = client_business_id) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, invoice_number, total_amount, status, payment_method, bank_name, card_last_four, discount_type, discount_value, tax_rate, tax_value, created_at, updated_at FROM orders WHERE server_updated_at > last_pulled_at AND created_at < updated_at AND business_id = client_business_id) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'orders' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'order_items', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, order_id, product_id, name, quantity, price, created_at, updated_at FROM order_items WHERE server_updated_at > last_pulled_at AND created_at >= updated_at AND order_id IN (SELECT id FROM orders WHERE business_id = client_business_id)) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, order_id, product_id, name, quantity, price, created_at, updated_at FROM order_items WHERE server_updated_at > last_pulled_at AND created_at < updated_at AND order_id IN (SELECT id FROM orders WHERE business_id = client_business_id)) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'order_items' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'inventory_logs', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, product_id, type, quantity, reason, created_at, updated_at FROM inventory_logs WHERE server_updated_at > last_pulled_at AND created_at >= updated_at AND product_id IN (SELECT id FROM products WHERE business_id = client_business_id)) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, product_id, type, quantity, reason, created_at, updated_at FROM inventory_logs WHERE server_updated_at > last_pulled_at AND created_at < updated_at AND product_id IN (SELECT id FROM products WHERE business_id = client_business_id)) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'inventory_logs' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      )
    ),
    'timestamp', current_time_ms
  ) INTO result;

  RETURN result;
END;
$$;


CREATE OR REPLACE FUNCTION public.push_watermelondb_changes(changes json, client_business_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  table_name text;
  table_changes json;
  created_records json;
  updated_records json;
  deleted_ids json;
  r json;
BEGIN
  IF client_business_id IS NULL OR client_business_id = '' THEN
    RAISE EXCEPTION 'client_business_id is required for push';
  END IF;

  -- Members push freely. The one thing a non-member may push is the
  -- registration of their own shop: a businesses row carrying their phone.
  IF NOT public.is_member_of(client_business_id) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM json_array_elements(
             COALESCE(changes->'businesses'->'created', '[]'::json)) x
      WHERE x->>'id' = client_business_id
        AND public.normalize_phone_pg(x->>'phone_number') = public.auth_phone()
      UNION ALL
      SELECT 1
      FROM json_array_elements(
             COALESCE(changes->'businesses'->'updated', '[]'::json)) x
      WHERE x->>'id' = client_business_id
        AND public.normalize_phone_pg(x->>'phone_number') = public.auth_phone()
    ) THEN
      RAISE EXCEPTION 'not a member of this business' USING ERRCODE = '42501';
    END IF;
  END IF;

  FOR table_name, table_changes IN SELECT * FROM json_each(changes) LOOP
    created_records := table_changes->'created';
    updated_records := table_changes->'updated';
    deleted_ids := table_changes->'deleted';

    -- -------------------------------------------------------------
    -- BUSINESSES TABLE UPSERT / DELETE
    -- -------------------------------------------------------------
    IF table_name = 'businesses' THEN
      -- Upsert created
      IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
          IF (r->>'id') IS DISTINCT FROM client_business_id
             OR NOT (public.is_member_of(r->>'id')
                     OR public.normalize_phone_pg(r->>'phone_number') = public.auth_phone()) THEN
            RAISE EXCEPTION 'unauthorized business push' USING ERRCODE = '42501';
          END IF;

          INSERT INTO businesses (id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at)
          VALUES (
            (r->>'id'),
            (r->>'name'),
            (r->>'business_type'),
            (r->>'address'),
            (r->>'phone_number'),
            (r->>'tax_id'),
            (r->>'operating_hours'),
            (r->>'logo_uri'),
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            business_type = EXCLUDED.business_type,
            address = EXCLUDED.address,
            phone_number = CASE WHEN public.is_owner_of(businesses.id)
                                THEN EXCLUDED.phone_number
                                ELSE businesses.phone_number END,
            tax_id = EXCLUDED.tax_id,
            operating_hours = EXCLUDED.operating_hours,
            logo_uri = EXCLUDED.logo_uri,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Upsert updated
      IF updated_records IS NOT NULL AND json_array_length(updated_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(updated_records) LOOP
          IF (r->>'id') IS DISTINCT FROM client_business_id
             OR NOT (public.is_member_of(r->>'id')
                     OR public.normalize_phone_pg(r->>'phone_number') = public.auth_phone()) THEN
            RAISE EXCEPTION 'unauthorized business push' USING ERRCODE = '42501';
          END IF;

          INSERT INTO businesses (id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at)
          VALUES (
            (r->>'id'),
            (r->>'name'),
            (r->>'business_type'),
            (r->>'address'),
            (r->>'phone_number'),
            (r->>'tax_id'),
            (r->>'operating_hours'),
            (r->>'logo_uri'),
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            business_type = EXCLUDED.business_type,
            address = EXCLUDED.address,
            phone_number = CASE WHEN public.is_owner_of(businesses.id)
                                THEN EXCLUDED.phone_number
                                ELSE businesses.phone_number END,
            tax_id = EXCLUDED.tax_id,
            operating_hours = EXCLUDED.operating_hours,
            logo_uri = EXCLUDED.logo_uri,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Delete records
      IF deleted_ids IS NOT NULL AND json_array_length(deleted_ids) > 0 THEN
        DELETE FROM businesses
        WHERE id IN (SELECT json_array_elements_text(deleted_ids))
          AND id = client_business_id
          AND public.is_owner_of(id);
      END IF;

    -- -------------------------------------------------------------
    -- EMPLOYEES TABLE UPSERT / DELETE
    -- -------------------------------------------------------------
    ELSIF table_name = 'employees' THEN
      -- Upsert created
      IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
          -- Multi-tenant filter: Skip records belonging to another business slice during this sync
          IF (r->>'business_id') IS NOT NULL AND (r->>'business_id') != client_business_id THEN
            CONTINUE;
          END IF;

          INSERT INTO employees (id, business_id, name, role, phone, email, created_at, updated_at)
          VALUES (
            (r->>'id'),
            COALESCE(r->>'business_id', client_business_id),
            (r->>'name'),
            (r->>'role'),
            (r->>'phone'),
            (r->>'email'),
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            business_id = EXCLUDED.business_id,
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Upsert updated
      IF updated_records IS NOT NULL AND json_array_length(updated_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(updated_records) LOOP
          -- Multi-tenant filter: Skip records belonging to another business slice during this sync
          IF (r->>'business_id') IS NOT NULL AND (r->>'business_id') != client_business_id THEN
            CONTINUE;
          END IF;

          INSERT INTO employees (id, business_id, name, role, phone, email, created_at, updated_at)
          VALUES (
            (r->>'id'),
            COALESCE(r->>'business_id', client_business_id),
            (r->>'name'),
            (r->>'role'),
            (r->>'phone'),
            (r->>'email'),
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            business_id = EXCLUDED.business_id,
            name = EXCLUDED.name,
            role = EXCLUDED.role,
            phone = EXCLUDED.phone,
            email = EXCLUDED.email,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Delete records
      IF deleted_ids IS NOT NULL AND json_array_length(deleted_ids) > 0 THEN
        DELETE FROM employees
        WHERE id IN (SELECT json_array_elements_text(deleted_ids))
          AND business_id = client_business_id;
      END IF;

    -- -------------------------------------------------------------
    -- PRODUCTS TABLE UPSERT / DELETE
    -- -------------------------------------------------------------
    ELSIF table_name = 'products' THEN
      -- Upsert created
      IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
          -- Multi-tenant filter: Skip records belonging to another business slice during this sync
          IF (r->>'business_id') IS NOT NULL AND (r->>'business_id') != client_business_id THEN
            CONTINUE;
          END IF;

          INSERT INTO products (id, business_id, name, sku, quick_code, barcode, category, unit_type, cost_price, price, stock_count, low_stock_alert, icon, is_favorite, created_at, updated_at)
          VALUES (
            (r->>'id'),
            COALESCE(r->>'business_id', client_business_id),
            (r->>'name'),
            (r->>'sku'),
            (r->>'quick_code'),
            (r->>'barcode'),
            (r->>'category'),
            (r->>'unit_type'),
            (r->>'cost_price')::numeric,
            (r->>'price')::numeric,
            (r->>'stock_count')::integer,
            (r->>'low_stock_alert')::integer,
            (r->>'icon'),
            (COALESCE((r->>'is_favorite')::boolean, false)),
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            business_id = EXCLUDED.business_id,
            name = EXCLUDED.name,
            sku = EXCLUDED.sku,
            quick_code = EXCLUDED.quick_code,
            barcode = EXCLUDED.barcode,
            category = EXCLUDED.category,
            unit_type = EXCLUDED.unit_type,
            cost_price = EXCLUDED.cost_price,
            price = EXCLUDED.price,
            stock_count = EXCLUDED.stock_count,
            low_stock_alert = EXCLUDED.low_stock_alert,
            icon = EXCLUDED.icon,
            is_favorite = EXCLUDED.is_favorite,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Upsert updated
      IF updated_records IS NOT NULL AND json_array_length(updated_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(updated_records) LOOP
          -- Multi-tenant filter: Skip records belonging to another business slice during this sync
          IF (r->>'business_id') IS NOT NULL AND (r->>'business_id') != client_business_id THEN
            CONTINUE;
          END IF;

          INSERT INTO products (id, business_id, name, sku, quick_code, barcode, category, unit_type, cost_price, price, stock_count, low_stock_alert, icon, is_favorite, created_at, updated_at)
          VALUES (
            (r->>'id'),
            COALESCE(r->>'business_id', client_business_id),
            (r->>'name'),
            (r->>'sku'),
            (r->>'quick_code'),
            (r->>'barcode'),
            (r->>'category'),
            (r->>'unit_type'),
            (r->>'cost_price')::numeric,
            (r->>'price')::numeric,
            (r->>'stock_count')::integer,
            (r->>'low_stock_alert')::integer,
            (r->>'icon'),
            (COALESCE((r->>'is_favorite')::boolean, false)),
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            business_id = EXCLUDED.business_id,
            name = EXCLUDED.name,
            sku = EXCLUDED.sku,
            quick_code = EXCLUDED.quick_code,
            barcode = EXCLUDED.barcode,
            category = EXCLUDED.category,
            unit_type = EXCLUDED.unit_type,
            cost_price = EXCLUDED.cost_price,
            price = EXCLUDED.price,
            stock_count = EXCLUDED.stock_count,
            low_stock_alert = EXCLUDED.low_stock_alert,
            icon = EXCLUDED.icon,
            is_favorite = EXCLUDED.is_favorite,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Delete records
      IF deleted_ids IS NOT NULL AND json_array_length(deleted_ids) > 0 THEN
        DELETE FROM products
        WHERE id IN (SELECT json_array_elements_text(deleted_ids))
          AND business_id = client_business_id;
      END IF;

    -- -------------------------------------------------------------
    -- ORDERS TABLE UPSERT / DELETE
    -- -------------------------------------------------------------
    ELSIF table_name = 'orders' THEN
      -- Upsert created
      IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
          -- Multi-tenant filter: Skip records belonging to another business slice during this sync
          IF (r->>'business_id') IS NOT NULL AND (r->>'business_id') != client_business_id THEN
            CONTINUE;
          END IF;

          INSERT INTO orders (id, business_id, invoice_number, total_amount, status, payment_method, bank_name, card_last_four, discount_type, discount_value, tax_rate, tax_value, created_at, updated_at)
          VALUES (
            (r->>'id'),
            COALESCE(r->>'business_id', client_business_id),
            (r->>'invoice_number'),
            (r->>'total_amount')::numeric,
            (r->>'status'),
            (r->>'payment_method'),
            (r->>'bank_name'),
            (r->>'card_last_four'),
            (r->>'discount_type'),
            (r->>'discount_value')::numeric,
            (r->>'tax_rate')::numeric,
            (r->>'tax_value')::numeric,
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            business_id = EXCLUDED.business_id,
            invoice_number = EXCLUDED.invoice_number,
            total_amount = EXCLUDED.total_amount,
            status = EXCLUDED.status,
            payment_method = EXCLUDED.payment_method,
            bank_name = EXCLUDED.bank_name,
            card_last_four = EXCLUDED.card_last_four,
            discount_type = EXCLUDED.discount_type,
            discount_value = EXCLUDED.discount_value,
            tax_rate = EXCLUDED.tax_rate,
            tax_value = EXCLUDED.tax_value,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Upsert updated
      IF updated_records IS NOT NULL AND json_array_length(updated_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(updated_records) LOOP
          -- Multi-tenant filter: Skip records belonging to another business slice during this sync
          IF (r->>'business_id') IS NOT NULL AND (r->>'business_id') != client_business_id THEN
            CONTINUE;
          END IF;

          INSERT INTO orders (id, business_id, invoice_number, total_amount, status, payment_method, bank_name, card_last_four, discount_type, discount_value, tax_rate, tax_value, created_at, updated_at)
          VALUES (
            (r->>'id'),
            COALESCE(r->>'business_id', client_business_id),
            (r->>'invoice_number'),
            (r->>'total_amount')::numeric,
            (r->>'status'),
            (r->>'payment_method'),
            (r->>'bank_name'),
            (r->>'card_last_four'),
            (r->>'discount_type'),
            (r->>'discount_value')::numeric,
            (r->>'tax_rate')::numeric,
            (r->>'tax_value')::numeric,
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            business_id = EXCLUDED.business_id,
            invoice_number = EXCLUDED.invoice_number,
            total_amount = EXCLUDED.total_amount,
            status = EXCLUDED.status,
            payment_method = EXCLUDED.payment_method,
            bank_name = EXCLUDED.bank_name,
            card_last_four = EXCLUDED.card_last_four,
            discount_type = EXCLUDED.discount_type,
            discount_value = EXCLUDED.discount_value,
            tax_rate = EXCLUDED.tax_rate,
            tax_value = EXCLUDED.tax_value,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Delete records
      IF deleted_ids IS NOT NULL AND json_array_length(deleted_ids) > 0 THEN
        DELETE FROM orders
        WHERE id IN (SELECT json_array_elements_text(deleted_ids))
          AND business_id = client_business_id;
      END IF;

    -- -------------------------------------------------------------
    -- ORDER ITEMS TABLE UPSERT / DELETE
    -- -------------------------------------------------------------
    ELSIF table_name = 'order_items' THEN
      -- Upsert created
      IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
          -- Multi-tenant filter: If order exists and belongs to another business, skip during this sync
          IF EXISTS (SELECT 1 FROM public.orders WHERE id = (r->>'order_id') AND business_id != client_business_id) THEN
            CONTINUE;
          END IF;

          -- If parent order does not exist at all (e.g. deleted), skip gracefully
          IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = (r->>'order_id')) THEN
            CONTINUE;
          END IF;

          INSERT INTO order_items (id, order_id, product_id, name, quantity, price, created_at, updated_at)
          VALUES (
            (r->>'id'),
            (r->>'order_id'),
            (r->>'product_id'),
            (r->>'name'),
            (r->>'quantity')::numeric,
            (r->>'price')::numeric,
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            order_id = EXCLUDED.order_id,
            product_id = EXCLUDED.product_id,
            name = EXCLUDED.name,
            quantity = EXCLUDED.quantity,
            price = EXCLUDED.price,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Upsert updated
      IF updated_records IS NOT NULL AND json_array_length(updated_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(updated_records) LOOP
          -- Multi-tenant filter: If order exists and belongs to another business, skip during this sync
          IF EXISTS (SELECT 1 FROM public.orders WHERE id = (r->>'order_id') AND business_id != client_business_id) THEN
            CONTINUE;
          END IF;

          -- If parent order does not exist at all (e.g. deleted), skip gracefully
          IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = (r->>'order_id')) THEN
            CONTINUE;
          END IF;

          INSERT INTO order_items (id, order_id, product_id, name, quantity, price, created_at, updated_at)
          VALUES (
            (r->>'id'),
            (r->>'order_id'),
            (r->>'product_id'),
            (r->>'name'),
            (r->>'quantity')::numeric,
            (r->>'price')::numeric,
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            order_id = EXCLUDED.order_id,
            product_id = EXCLUDED.product_id,
            name = EXCLUDED.name,
            quantity = EXCLUDED.quantity,
            price = EXCLUDED.price,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Delete records
      IF deleted_ids IS NOT NULL AND json_array_length(deleted_ids) > 0 THEN
        DELETE FROM order_items
        WHERE id IN (SELECT json_array_elements_text(deleted_ids))
          AND order_id IN (SELECT id FROM orders WHERE business_id = client_business_id);
      END IF;

    -- -------------------------------------------------------------
    -- INVENTORY LOGS TABLE UPSERT / DELETE
    -- -------------------------------------------------------------
    ELSIF table_name = 'inventory_logs' THEN
      -- Upsert created
      IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
          -- Multi-tenant filter: If product exists and belongs to another business, skip during this sync
          IF EXISTS (SELECT 1 FROM public.products WHERE id = (r->>'product_id') AND business_id != client_business_id) THEN
            CONTINUE;
          END IF;

          -- If product does not exist in database (e.g. was deleted or cascade removed), skip inserting orphaned log gracefully
          IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = (r->>'product_id')) THEN
            CONTINUE;
          END IF;

          -- Conflict check: Prevent duplicate void inventory log insertion from offline sync race condition
          IF (r->>'reason') LIKE 'Voided Invoice Sale %' THEN
            IF EXISTS (SELECT 1 FROM public.inventory_logs WHERE reason = (r->>'reason') AND product_id = (r->>'product_id')) THEN
              CONTINUE; -- Skip duplicate insertion
            END IF;
          END IF;

          INSERT INTO inventory_logs (id, product_id, type, quantity, reason, created_at, updated_at)
          VALUES (
            (r->>'id'),
            (r->>'product_id'),
            (r->>'type'),
            (r->>'quantity')::numeric,
            (r->>'reason'),
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            product_id = EXCLUDED.product_id,
            type = EXCLUDED.type,
            quantity = EXCLUDED.quantity,
            reason = EXCLUDED.reason,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Upsert updated
      IF updated_records IS NOT NULL AND json_array_length(updated_records) > 0 THEN
        FOR r IN SELECT * FROM json_array_elements(updated_records) LOOP
          -- Multi-tenant filter: If product exists and belongs to another business, skip during this sync
          IF EXISTS (SELECT 1 FROM public.products WHERE id = (r->>'product_id') AND business_id != client_business_id) THEN
            CONTINUE;
          END IF;

          -- If product does not exist in database (e.g. was deleted), skip inserting orphaned log gracefully
          IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = (r->>'product_id')) THEN
            CONTINUE;
          END IF;

          INSERT INTO inventory_logs (id, product_id, type, quantity, reason, created_at, updated_at)
          VALUES (
            (r->>'id'),
            (r->>'product_id'),
            (r->>'type'),
            (r->>'quantity')::numeric,
            (r->>'reason'),
            (r->>'created_at')::bigint,
            (r->>'updated_at')::bigint
          )
          ON CONFLICT (id) DO UPDATE SET
            product_id = EXCLUDED.product_id,
            type = EXCLUDED.type,
            quantity = EXCLUDED.quantity,
            reason = EXCLUDED.reason,
            updated_at = EXCLUDED.updated_at;
        END LOOP;
      END IF;
      
      -- Delete records
      IF deleted_ids IS NOT NULL AND json_array_length(deleted_ids) > 0 THEN
        DELETE FROM inventory_logs
        WHERE id IN (SELECT json_array_elements_text(deleted_ids))
          AND product_id IN (SELECT id FROM products WHERE business_id = client_business_id);
      END IF;

    END IF;
  END LOOP;
END;
$$;


-- -------------------------------------------------------------------------
-- 3. Account and lookup RPCs. The phone is never a parameter any more.
-- -------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fetch_user_businesses(text);
CREATE OR REPLACE FUNCTION public.fetch_user_businesses()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_input text := public.require_auth_phone();
  matched_businesses json;
  matched_employees json;
BEGIN
  SELECT coalesce(json_agg(t), '[]'::json) INTO matched_employees
  FROM (
    SELECT id, business_id, name, role, phone, email, created_at, updated_at
    FROM public.employees
    WHERE public.normalize_phone_pg(phone) = clean_input
  ) t;

  SELECT coalesce(json_agg(b), '[]'::json) INTO matched_businesses
  FROM (
    SELECT id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at
    FROM public.businesses
    WHERE public.normalize_phone_pg(phone_number) = clean_input
       OR id IN (
         SELECT business_id FROM public.employees
         WHERE public.normalize_phone_pg(phone) = clean_input)
  ) b;

  RETURN json_build_object(
    'businesses', matched_businesses,
    'employees', matched_employees);
END;
$$;

-- Own phone: full detail, used to resolve the session after OTP.
-- Any other phone: only whether it is taken, used when adding staff.
CREATE OR REPLACE FUNCTION public.check_phone_registered(
  input_phone text,
  exclude_employee_id text DEFAULT NULL,
  exclude_business_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me text := public.require_auth_phone();
  clean_input text := public.normalize_phone_pg(input_phone);
  biz_id text;
  biz_name text;
  emp_id text;
  emp_business_id text;
  emp_name text;
  emp_role text;
  emp_business_name text;
BEGIN
  IF clean_input IS NULL OR clean_input = '' THEN
    RETURN json_build_object('exists', false);
  END IF;

  SELECT id, name INTO biz_id, biz_name
  FROM public.businesses
  WHERE public.normalize_phone_pg(phone_number) = clean_input
    AND (exclude_business_id IS NULL OR id != exclude_business_id)
  LIMIT 1;

  IF biz_id IS NULL THEN
    SELECT e.id, e.business_id, e.name, e.role, b.name
    INTO emp_id, emp_business_id, emp_name, emp_role, emp_business_name
    FROM public.employees e
    LEFT JOIN public.businesses b ON b.id = e.business_id
    WHERE public.normalize_phone_pg(e.phone) = clean_input
      AND (exclude_employee_id IS NULL OR e.id != exclude_employee_id)
    LIMIT 1;
  END IF;

  IF clean_input <> me THEN
    RETURN json_build_object('exists', biz_id IS NOT NULL OR emp_id IS NOT NULL);
  END IF;

  IF biz_id IS NOT NULL THEN
    RETURN json_build_object(
      'exists', true,
      'type', 'owner',
      'role', 'admin',
      'name', 'Owner / Admin',
      'business_id', biz_id,
      'business_name', biz_name);
  END IF;

  IF emp_id IS NOT NULL THEN
    RETURN json_build_object(
      'exists', true,
      'type', 'employee',
      'role', emp_role,
      'name', emp_name,
      'employee_id', emp_id,
      'business_id', emp_business_id,
      'business_name', emp_business_name);
  END IF;

  RETURN json_build_object('exists', false);
END;
$$;

DROP FUNCTION IF EXISTS public.check_synced_account(text);

DROP FUNCTION IF EXISTS public.get_or_create_owner(text);
CREATE OR REPLACE FUNCTION public.get_or_create_owner()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean text := public.require_auth_phone();
  result_id uuid;
BEGIN
  INSERT INTO public.owners (phone) VALUES (clean)
  ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
  RETURNING id INTO result_id;
  RETURN result_id;
END;
$$;

DROP FUNCTION IF EXISTS public.get_entitlement(text, text);
DROP FUNCTION IF EXISTS public.get_entitlement(text);
CREATE OR REPLACE FUNCTION public.get_entitlement(client_business_id text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  PERFORM public.require_member(client_business_id);

  SELECT json_build_object(
      'is_pro',
        COALESCE(s.is_active AND (s.expires_at IS NULL OR s.expires_at > now()), false),
      'is_trial',
        COALESCE(
          s.period_type = 'TRIAL'
          AND s.is_active
          AND (s.expires_at IS NULL OR s.expires_at > now()),
          false),
      'is_owner',       public.is_owner_of(b.id),
      'expires_at',     s.expires_at,
      'will_renew',     COALESCE(s.will_renew, false),
      'product_id',     s.product_id,
      'store',          s.store,
      'period_type',    s.period_type,
      'management_url', s.management_url,
      'owner_id',       o.id)
  INTO result
  FROM public.businesses b
  LEFT JOIN public.owners o ON o.phone = public.normalize_phone_pg(b.phone_number)
  LEFT JOIN public.subscriptions s ON s.owner_id = o.id
  WHERE b.id = client_business_id;

  RETURN COALESCE(result,
    json_build_object('is_pro', false, 'is_trial', false, 'is_owner', false));
END;
$$;

DROP FUNCTION IF EXISTS public.delete_account(text, text);
CREATE OR REPLACE FUNCTION public.delete_account(input_business_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text := public.require_auth_phone();
  owner_id_out uuid;
  target_ids text[];
  deleted_businesses int;
BEGIN
  PERFORM public.require_owner(input_business_id);

  SELECT array_agg(b.id) INTO target_ids
  FROM public.businesses b
  WHERE public.normalize_phone_pg(b.phone_number) = normalized;

  DELETE FROM public.active_devices             WHERE business_id = ANY(target_ids);
  DELETE FROM public.device_session_revocations WHERE business_id = ANY(target_ids);

  DELETE FROM public.businesses WHERE id = ANY(target_ids);
  GET DIAGNOSTICS deleted_businesses = ROW_COUNT;

  -- Last, not first: the record_deletion() trigger writes a tombstone for
  -- every row the cascade removes, and there is no account left to sync.
  DELETE FROM public.deleted_records WHERE business_id = ANY(target_ids);

  DELETE FROM public.owners WHERE phone = normalized RETURNING id INTO owner_id_out;
  DELETE FROM auth.users WHERE id = auth.uid();

  RETURN json_build_object(
    'deleted', true,
    'businesses_deleted', deleted_businesses,
    'owner_id', owner_id_out);
END;
$$;

COMMENT ON FUNCTION public.delete_account(text) IS
  'Purges the calling owner: every business registered to the phone in their '
  'JWT, the owners row, and the auth user. Authorization is the verified '
  'session; the business id only names which shop the request came from.';

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
  PERFORM public.require_auth_phone();
  IF input_business_id IS NOT NULL THEN
    PERFORM public.require_member(input_business_id);
  END IF;

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
END;
$$;

-- -------------------------------------------------------------------------
-- 4. Presence and revocation: members only.
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
  SELECT public.require_member(input_business_id);
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
  SELECT public.require_member(input_business_id);
  DELETE FROM public.active_devices
  WHERE business_id = input_business_id
    AND device_id = input_device_id;
$$;

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
  SELECT public.require_member(input_business_id);
  SELECT d.id, d.business_id, d.employee_id, d.employee_name, d.role,
         d.device_id, d.device_model, d.battery_level, d.is_online,
         d.latitude, d.longitude, d.location_name, d.last_active_at
  FROM public.active_devices d
  WHERE d.business_id = input_business_id
    AND d.is_online = false
    AND d.last_active_at >= now() - make_interval(hours => input_hours)
  ORDER BY d.last_active_at DESC;
$$;

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
  SELECT public.require_member(input_business_id);
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
  SELECT public.require_member(input_business_id);
  SELECT EXISTS (
    SELECT 1 FROM public.device_session_revocations
    WHERE business_id = input_business_id
      AND device_id = input_device_id);
$$;

-- -------------------------------------------------------------------------
-- 5. Privileges. anon reads app_config and nothing else; authenticated
--    reaches data only through the functions above.
-- -------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON public.app_config TO anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

ALTER VIEW public.v_subscription_events SET (security_invoker = on);

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_member_of(text)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.pull_watermelondb_changes(bigint, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.push_watermelondb_changes(json, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_user_businesses()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_phone_registered(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_owner()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_entitlement(text)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account(text)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_paywall_event(text, text, text, text, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_device_presence(
  text, text, text, text, text, text, text, integer, boolean,
  numeric, numeric, text, text)                                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_device_presence(text, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_offline_devices(text, integer)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_device_session(text, text, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_device_revoked(text, text)            TO authenticated;

-- -------------------------------------------------------------------------
-- 6. Realtime. Channels are `sync:{business_id}` and `devices:{business_id}`
--    and are private: only members of that business may join or publish.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "members read business channels"  ON realtime.messages;
DROP POLICY IF EXISTS "members write business channels" ON realtime.messages;

CREATE POLICY "members read business channels" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.is_member_of(split_part(realtime.topic(), ':', 2)));

CREATE POLICY "members write business channels" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.messages.extension IN ('broadcast', 'presence')
    AND public.is_member_of(split_part(realtime.topic(), ':', 2)));

-- =========================================================================
-- VERIFY (read-only)
-- =========================================================================
SELECT
  (SELECT count(*) FROM information_schema.role_table_grants
    WHERE grantee = 'anon' AND table_schema = 'public')                     AS anon_table_grants,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND has_function_privilege('anon', p.oid, 'EXECUTE')) AS anon_callable_functions,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'realtime')          AS realtime_policies,
  (SELECT reloptions FROM pg_class WHERE relname = 'v_subscription_events') AS view_options;
