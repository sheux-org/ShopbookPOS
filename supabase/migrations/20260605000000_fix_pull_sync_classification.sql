-- Fix pull sync classification: records first pushed from another device often have
-- client created_at older than the receiving device's last_pulled_at, so they were
-- incorrectly returned as "updated". Treat unchanged records (created_at >= updated_at)
-- as "created" when they change on the server.

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
$$ LANGUAGE plpgsql;
