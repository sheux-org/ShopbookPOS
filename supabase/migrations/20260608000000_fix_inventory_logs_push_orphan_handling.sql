-- Migration: 20260608000000_fix_inventory_logs_push_orphan_handling.sql
-- Description: Fix push_watermelondb_changes to handle multi-tenant batch sync, deleted/orphaned inventory_logs and order_items gracefully.

CREATE OR REPLACE FUNCTION public.push_watermelondb_changes(
  changes json,
  client_business_id text
)
RETURNS void AS $$
DECLARE
  table_name text;
  table_changes json;
  created_records json;
  updated_records json;
  deleted_ids json;
  r json;
BEGIN
  -- Multi-tenant Security Check:
  -- Ensure that client_business_id is provided.
  IF client_business_id IS NULL OR client_business_id = '' THEN
    RAISE EXCEPTION 'client_business_id is required for push';
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
        DELETE FROM businesses WHERE id IN (SELECT json_array_elements_text(deleted_ids));
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
        DELETE FROM employees WHERE id IN (SELECT json_array_elements_text(deleted_ids));
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
        DELETE FROM products WHERE id IN (SELECT json_array_elements_text(deleted_ids));
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
        DELETE FROM orders WHERE id IN (SELECT json_array_elements_text(deleted_ids));
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
        WHERE id IN (SELECT json_array_elements_text(deleted_ids));
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
        WHERE id IN (SELECT json_array_elements_text(deleted_ids));
      END IF;

    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.push_watermelondb_changes(json, text) TO anon, authenticated;
