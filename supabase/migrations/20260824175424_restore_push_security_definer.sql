-- Restore SECURITY DEFINER on push_watermelondb_changes.
-- The inventory-log orphan-handling rewrite omitted DEFINER, so the anon
-- client hit RLS on products: "new row violates row-level security policy".

ALTER FUNCTION public.push_watermelondb_changes(json, text)
  SECURITY DEFINER
  SET search_path = public;

GRANT EXECUTE ON FUNCTION public.push_watermelondb_changes(json, text) TO anon, authenticated;
