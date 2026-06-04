-- =========================================================================
-- SUPABASE MIGRATION FOR WATERMELONDB SYNC (SHOPBOOK POS)
-- Paste this script into your Supabase SQL Editor (Dashboard -> SQL Editor)
-- and click Run.
-- =========================================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------------------
-- 1. CREATE TABLES (matching WatermelonDB schema)
-- -------------------------------------------------------------------------

-- A. Businesses Table
CREATE TABLE IF NOT EXISTS businesses (
  id text PRIMARY KEY,
  name text NOT NULL,
  business_type text NOT NULL,
  address text,
  phone_number text NOT NULL,
  tax_id text,
  operating_hours text,
  logo_uri text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  server_updated_at bigint NOT NULL
);

-- B. Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL,
  phone text NOT NULL,
  email text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  server_updated_at bigint NOT NULL
);

-- C. Products Table
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  sku text,
  quick_code text,
  barcode text,
  category text,
  unit_type text,
  cost_price numeric,
  price numeric NOT NULL,
  stock_count integer NOT NULL,
  low_stock_alert integer,
  icon text,
  is_favorite boolean DEFAULT false,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  server_updated_at bigint NOT NULL
);

-- D. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  total_amount numeric NOT NULL,
  status text NOT NULL,
  payment_method text,
  bank_name text,
  card_last_four text,
  discount_type text,
  discount_value numeric,
  tax_rate numeric,
  tax_value numeric,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  server_updated_at bigint NOT NULL
);

-- E. Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id text PRIMARY KEY,
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text REFERENCES products(id) ON DELETE SET NULL,
  name text NOT NULL,
  quantity numeric NOT NULL,
  price numeric NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  server_updated_at bigint NOT NULL
);

-- F. Inventory Logs Table
CREATE TABLE IF NOT EXISTS inventory_logs (
  id text PRIMARY KEY,
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type text NOT NULL,
  quantity numeric NOT NULL,
  reason text,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  server_updated_at bigint NOT NULL
);

-- Index for search performance
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);

-- Enable RLS
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 2. CREATE DELETED RECORDS TRACKER (Tombstones for Client Synchronization)
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deleted_records (
  table_name text NOT NULL,
  record_id text NOT NULL,
  deleted_at bigint NOT NULL,
  business_id text,
  PRIMARY KEY (table_name, record_id)
);

-- Index for fast deletion queries during pull
CREATE INDEX IF NOT EXISTS idx_deleted_records_search ON deleted_records(table_name, deleted_at);

-- -------------------------------------------------------------------------
-- 3. TRIGGERS: AUTOMATICALLY UPDATE `server_updated_at` ON INSERT/UPDATE
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_server_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.server_updated_at := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp trigger to all tables
DROP TRIGGER IF EXISTS tr_timestamp_businesses ON businesses;
CREATE TRIGGER tr_timestamp_businesses
  BEFORE INSERT OR UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

DROP TRIGGER IF EXISTS tr_timestamp_employees ON employees;
CREATE TRIGGER tr_timestamp_employees
  BEFORE INSERT OR UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

DROP TRIGGER IF EXISTS tr_timestamp_products ON products;
CREATE TRIGGER tr_timestamp_products
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

DROP TRIGGER IF EXISTS tr_timestamp_orders ON orders;
CREATE TRIGGER tr_timestamp_orders
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

DROP TRIGGER IF EXISTS tr_timestamp_order_items ON order_items;
CREATE TRIGGER tr_timestamp_order_items
  BEFORE INSERT OR UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

DROP TRIGGER IF EXISTS tr_timestamp_inventory_logs ON inventory_logs;
CREATE TRIGGER tr_timestamp_inventory_logs
  BEFORE INSERT OR UPDATE ON inventory_logs
  FOR EACH ROW EXECUTE FUNCTION set_server_updated_at();

-- -------------------------------------------------------------------------
-- 4. TRIGGERS: AUTOMATICALLY LOG DELETIONS TO `deleted_records`
-- -------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_deletion()
RETURNS TRIGGER AS $$
DECLARE
  v_business_id text;
BEGIN
  IF TG_TABLE_NAME = 'businesses' THEN
    v_business_id := OLD.id;
  ELSIF TG_TABLE_NAME IN ('employees', 'products', 'orders') THEN
    v_business_id := OLD.business_id;
  ELSIF TG_TABLE_NAME = 'order_items' THEN
    SELECT business_id INTO v_business_id FROM public.orders WHERE id = OLD.order_id;
  ELSIF TG_TABLE_NAME = 'inventory_logs' THEN
    SELECT business_id INTO v_business_id FROM public.products WHERE id = OLD.product_id;
  END IF;

  INSERT INTO deleted_records (table_name, record_id, deleted_at, business_id)
  VALUES (TG_TABLE_NAME, OLD.id, floor(extract(epoch from clock_timestamp()) * 1000)::bigint, v_business_id)
  ON CONFLICT (table_name, record_id)
  DO UPDATE SET deleted_at = EXCLUDED.deleted_at, business_id = EXCLUDED.business_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Apply deletion trigger to all tables
DROP TRIGGER IF EXISTS tr_delete_businesses ON businesses;
CREATE TRIGGER tr_delete_businesses
  AFTER DELETE ON businesses
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

DROP TRIGGER IF EXISTS tr_delete_employees ON employees;
CREATE TRIGGER tr_delete_employees
  AFTER DELETE ON employees
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

DROP TRIGGER IF EXISTS tr_delete_products ON products;
CREATE TRIGGER tr_delete_products
  AFTER DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

DROP TRIGGER IF EXISTS tr_delete_orders ON orders;
CREATE TRIGGER tr_delete_orders
  AFTER DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

DROP TRIGGER IF EXISTS tr_delete_order_items ON order_items;
CREATE TRIGGER tr_delete_order_items
  AFTER DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

DROP TRIGGER IF EXISTS tr_delete_inventory_logs ON inventory_logs;
CREATE TRIGGER tr_delete_inventory_logs
  AFTER DELETE ON inventory_logs
  FOR EACH ROW EXECUTE FUNCTION record_deletion();

-- -- -------------------------------------------------------------------------
-- 5. FUNCTION: `pull_watermelondb_changes` RPC (Enforce Tenant Isolation)
-- -------------------------------------------------------------------------
DROP FUNCTION IF EXISTS pull_watermelondb_changes(bigint);

CREATE OR REPLACE FUNCTION pull_watermelondb_changes(last_pulled_at bigint, client_business_id text)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  current_time_ms bigint;
  result json;
BEGIN
  IF client_business_id IS NULL OR client_business_id = '' THEN
    RAISE EXCEPTION 'Unauthorized: client_business_id must be provided.';
  END IF;

  -- Get current server time in epoch milliseconds
  current_time_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;

  -- Build the JSON response structure with tenant filtered items
  SELECT json_build_object(
    'changes', json_build_object(
      'businesses', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at FROM businesses WHERE server_updated_at > last_pulled_at AND created_at > last_pulled_at AND id = client_business_id) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, name, business_type, address, phone_number, tax_id, operating_hours, logo_uri, created_at, updated_at FROM businesses WHERE server_updated_at > last_pulled_at AND created_at <= last_pulled_at AND id = client_business_id) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'businesses' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'employees', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, name, role, phone, email, created_at, updated_at FROM employees WHERE server_updated_at > last_pulled_at AND created_at > last_pulled_at AND business_id = client_business_id) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, name, role, phone, email, created_at, updated_at FROM employees WHERE server_updated_at > last_pulled_at AND created_at <= last_pulled_at AND business_id = client_business_id) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'employees' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'products', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, name, sku, quick_code, barcode, category, unit_type, cost_price, price, stock_count, low_stock_alert, icon, is_favorite, created_at, updated_at FROM products WHERE server_updated_at > last_pulled_at AND created_at > last_pulled_at AND business_id = client_business_id) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, name, sku, quick_code, barcode, category, unit_type, cost_price, price, stock_count, low_stock_alert, icon, is_favorite, created_at, updated_at FROM products WHERE server_updated_at > last_pulled_at AND created_at <= last_pulled_at AND business_id = client_business_id) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'products' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'orders', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, invoice_number, total_amount, status, payment_method, bank_name, card_last_four, discount_type, discount_value, tax_rate, tax_value, created_at, updated_at FROM orders WHERE server_updated_at > last_pulled_at AND created_at > last_pulled_at AND business_id = client_business_id) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, business_id, invoice_number, total_amount, status, payment_method, bank_name, card_last_four, discount_type, discount_value, tax_rate, tax_value, created_at, updated_at FROM orders WHERE server_updated_at > last_pulled_at AND created_at <= last_pulled_at AND business_id = client_business_id) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'orders' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'order_items', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, order_id, product_id, name, quantity, price, created_at, updated_at FROM order_items WHERE server_updated_at > last_pulled_at AND created_at > last_pulled_at AND order_id IN (SELECT id FROM orders WHERE business_id = client_business_id)) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, order_id, product_id, name, quantity, price, created_at, updated_at FROM order_items WHERE server_updated_at > last_pulled_at AND created_at <= last_pulled_at AND order_id IN (SELECT id FROM orders WHERE business_id = client_business_id)) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'order_items' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      ),
      'inventory_logs', json_build_object(
        'created', coalesce((SELECT json_agg(t) FROM (SELECT id, product_id, type, quantity, reason, created_at, updated_at FROM inventory_logs WHERE server_updated_at > last_pulled_at AND created_at > last_pulled_at AND product_id IN (SELECT id FROM products WHERE business_id = client_business_id)) t), '[]'::json),
        'updated', coalesce((SELECT json_agg(t) FROM (SELECT id, product_id, type, quantity, reason, created_at, updated_at FROM inventory_logs WHERE server_updated_at > last_pulled_at AND created_at <= last_pulled_at AND product_id IN (SELECT id FROM products WHERE business_id = client_business_id)) t), '[]'::json),
        'deleted', coalesce((SELECT json_agg(record_id) FROM deleted_records WHERE table_name = 'inventory_logs' AND deleted_at > last_pulled_at AND business_id = client_business_id), '[]'::json)
      )
    ),
    'timestamp', current_time_ms
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------------------------------------
-- 6. FUNCTION: `push_watermelondb_changes` RPC (Enforce Tenant Isolation)
-- -------------------------------------------------------------------------
DROP FUNCTION IF EXISTS push_watermelondb_changes(json);

CREATE OR REPLACE FUNCTION push_watermelondb_changes(changes json, client_business_id text)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
  table_name text;
  created_records json;
  updated_records json;
  deleted_ids json;
  r json;
BEGIN
  IF client_business_id IS NULL OR client_business_id = '' THEN
    RAISE EXCEPTION 'Unauthorized: client_business_id must be provided.';
  END IF;

  -- Identify which table changes are being pushed
  SELECT key INTO table_name FROM json_each(changes) LIMIT 1;
  
  IF table_name IS NULL THEN
    RETURN;
  END IF;

  created_records := changes->table_name->'created';
  updated_records := changes->table_name->'updated';
  deleted_ids := changes->table_name->'deleted';

  -- -------------------------------------------------------------
  -- BUSINESSES TABLE UPSERT / DELETE
  -- -------------------------------------------------------------
  IF table_name = 'businesses' THEN
    -- Upsert created
    IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
      FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
        -- Security assert
        IF (r->>'id') != client_business_id THEN
          RAISE EXCEPTION 'Unauthorized access to business ID';
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
          phone_number = EXCLUDED.phone_number,
          tax_id = EXCLUDED.tax_id,
          operating_hours = EXCLUDED.operating_hours,
          logo_uri = EXCLUDED.logo_uri,
          updated_at = EXCLUDED.updated_at;
      END LOOP;
    END IF;
    
    -- Upsert updated
    IF updated_records IS NOT NULL AND json_array_length(updated_records) > 0 THEN
      FOR r IN SELECT * FROM json_array_elements(updated_records) LOOP
        -- Security assert
        IF (r->>'id') != client_business_id THEN
          RAISE EXCEPTION 'Unauthorized access to business ID';
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
          phone_number = EXCLUDED.phone_number,
          tax_id = EXCLUDED.tax_id,
          operating_hours = EXCLUDED.operating_hours,
          logo_uri = EXCLUDED.logo_uri,
          updated_at = EXCLUDED.updated_at;
      END LOOP;
    END IF;
    
    -- Delete records
    IF deleted_ids IS NOT NULL AND json_array_length(deleted_ids) > 0 THEN
      DELETE FROM businesses WHERE id IN (SELECT json_array_elements_text(deleted_ids)) AND id = client_business_id;
    END IF;

  -- -------------------------------------------------------------
  -- EMPLOYEES TABLE UPSERT / DELETE
  -- -------------------------------------------------------------
  ELSIF table_name = 'employees' THEN
    -- Upsert created
    IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
      FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
        -- Security assert
        IF (r->>'business_id') != client_business_id THEN
          RAISE EXCEPTION 'Unauthorized employee push';
        END IF;

        INSERT INTO employees (id, business_id, name, role, phone, email, created_at, updated_at)
        VALUES (
          (r->>'id'),
          (r->>'business_id'),
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
        -- Security assert
        IF (r->>'business_id') != client_business_id THEN
          RAISE EXCEPTION 'Unauthorized employee push';
        END IF;

        INSERT INTO employees (id, business_id, name, role, phone, email, created_at, updated_at)
        VALUES (
          (r->>'id'),
          (r->>'business_id'),
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
      DELETE FROM employees WHERE id IN (SELECT json_array_elements_text(deleted_ids)) AND business_id = client_business_id;
    END IF;

  -- -------------------------------------------------------------
  -- PRODUCTS TABLE UPSERT / DELETE
  -- -------------------------------------------------------------
  ELSIF table_name = 'products' THEN
    -- Upsert created
    IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
      FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
        -- Security assert
        IF (r->>'business_id') != client_business_id THEN
          RAISE EXCEPTION 'Unauthorized product push';
        END IF;

        INSERT INTO products (id, business_id, name, sku, quick_code, barcode, category, unit_type, cost_price, price, stock_count, low_stock_alert, icon, is_favorite, created_at, updated_at)
        VALUES (
          (r->>'id'),
          (r->>'business_id'),
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
        -- Security assert
        IF (r->>'business_id') != client_business_id THEN
          RAISE EXCEPTION 'Unauthorized product push';
        END IF;

        INSERT INTO products (id, business_id, name, sku, quick_code, barcode, category, unit_type, cost_price, price, stock_count, low_stock_alert, icon, is_favorite, created_at, updated_at)
        VALUES (
          (r->>'id'),
          (r->>'business_id'),
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
      DELETE FROM products WHERE id IN (SELECT json_array_elements_text(deleted_ids)) AND business_id = client_business_id;
    END IF;

  -- -------------------------------------------------------------
  -- ORDERS TABLE UPSERT / DELETE
  -- -------------------------------------------------------------
  ELSIF table_name = 'orders' THEN
    -- Upsert created
    IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
      FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
        -- Security assert
        IF (r->>'business_id') != client_business_id THEN
          RAISE EXCEPTION 'Unauthorized order push';
        END IF;

        INSERT INTO orders (id, business_id, invoice_number, total_amount, status, payment_method, bank_name, card_last_four, discount_type, discount_value, tax_rate, tax_value, created_at, updated_at)
        VALUES (
          (r->>'id'),
          (r->>'business_id'),
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
        -- Security assert
        IF (r->>'business_id') != client_business_id THEN
          RAISE EXCEPTION 'Unauthorized order push';
        END IF;

        INSERT INTO orders (id, business_id, invoice_number, total_amount, status, payment_method, bank_name, card_last_four, discount_type, discount_value, tax_rate, tax_value, created_at, updated_at)
        VALUES (
          (r->>'id'),
          (r->>'business_id'),
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
      DELETE FROM orders WHERE id IN (SELECT json_array_elements_text(deleted_ids)) AND business_id = client_business_id;
    END IF;

  -- -------------------------------------------------------------
  -- ORDER ITEMS TABLE UPSERT / DELETE
  -- -------------------------------------------------------------
  ELSIF table_name = 'order_items' THEN
    -- Upsert created
    IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
      FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
        -- Security assert: order_id must belong to business
        IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = (r->>'order_id') AND business_id = client_business_id) THEN
          RAISE EXCEPTION 'Unauthorized order_items push';
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
        -- Security assert: order_id must belong to business
        IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = (r->>'order_id') AND business_id = client_business_id) THEN
          RAISE EXCEPTION 'Unauthorized order_items push';
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
        AND order_id IN (SELECT id FROM public.orders WHERE business_id = client_business_id);
    END IF;

  -- -------------------------------------------------------------
  -- INVENTORY LOGS TABLE UPSERT / DELETE
  -- -------------------------------------------------------------
  ELSIF table_name = 'inventory_logs' THEN
    -- Upsert created
    IF created_records IS NOT NULL AND json_array_length(created_records) > 0 THEN
      FOR r IN SELECT * FROM json_array_elements(created_records) LOOP
        -- Security assert: product_id must belong to business
        IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = (r->>'product_id') AND business_id = client_business_id) THEN
          RAISE EXCEPTION 'Unauthorized inventory_logs push';
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
        -- Security assert: product_id must belong to business
        IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = (r->>'product_id') AND business_id = client_business_id) THEN
          RAISE EXCEPTION 'Unauthorized inventory_logs push';
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
        AND product_id IN (SELECT id FROM public.products WHERE business_id = client_business_id);
    END IF;

  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. GRANT PERMISSIONS ON RPC FUNCTIONS TO ANON & AUTHENTICATED
GRANT EXECUTE ON FUNCTION public.pull_watermelondb_changes(bigint, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_watermelondb_changes(json, text) TO anon, authenticated;

-- 6. ENABLE RLS AND SET NO POLICIES (DENIES DIRECT REST ACCESS BY DEFAULT)
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deleted_records ENABLE ROW LEVEL SECURITY;

-- Remove core table RLS policies so no direct REST requests can read or write
DROP POLICY IF EXISTS "Allow business owner select" ON public.businesses;
DROP POLICY IF EXISTS "Allow business owner update" ON public.businesses;
DROP POLICY IF EXISTS "Allow business employees select" ON public.employees;
DROP POLICY IF EXISTS "Allow business employees all" ON public.employees;
DROP POLICY IF EXISTS "Allow business products select" ON public.products;
DROP POLICY IF EXISTS "Allow business products all" ON public.products;
DROP POLICY IF EXISTS "Allow business orders select" ON public.orders;
DROP POLICY IF EXISTS "Allow business orders all" ON public.orders;
DROP POLICY IF EXISTS "Allow business order_items select" ON public.order_items;
DROP POLICY IF EXISTS "Allow business order_items all" ON public.order_items;
DROP POLICY IF EXISTS "Allow business inventory_logs select" ON public.inventory_logs;
DROP POLICY IF EXISTS "Allow business inventory_logs all" ON public.inventory_logs;
DROP POLICY IF EXISTS "Allow business deleted_records select" ON public.deleted_records;

-- 7. Redefine RLS policies for active_devices to allow anon session upserts/deletes
ALTER TABLE public.active_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow business active_devices select" ON public.active_devices;
DROP POLICY IF EXISTS "Allow public select" ON public.active_devices;
CREATE POLICY "Allow public select" ON public.active_devices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow business active_devices insert" ON public.active_devices;
DROP POLICY IF EXISTS "Allow public insert" ON public.active_devices;
CREATE POLICY "Allow public insert" ON public.active_devices FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow business active_devices update" ON public.active_devices;
DROP POLICY IF EXISTS "Allow public update" ON public.active_devices;
CREATE POLICY "Allow public update" ON public.active_devices FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete" ON public.active_devices;
CREATE POLICY "Allow public delete" ON public.active_devices FOR DELETE USING (true);


-- 8. FUNCTION: `fetch_user_businesses` RPC (Retrieve all businesses matching user phone)
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


