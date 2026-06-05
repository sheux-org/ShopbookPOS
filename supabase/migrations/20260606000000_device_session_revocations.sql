-- Device session revocations for persistent remote logout (minimal DB writes)
CREATE TABLE IF NOT EXISTS public.device_session_revocations (
  business_id text NOT NULL,
  device_id text NOT NULL,
  revoked_at timestamptz NOT NULL DEFAULT now(),
  revoked_by_device_id text,
  PRIMARY KEY (business_id, device_id)
);

ALTER TABLE public.device_session_revocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select" ON public.device_session_revocations;
CREATE POLICY "Allow public select" ON public.device_session_revocations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert" ON public.device_session_revocations;
CREATE POLICY "Allow public insert" ON public.device_session_revocations FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update" ON public.device_session_revocations;
CREATE POLICY "Allow public update" ON public.device_session_revocations FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete" ON public.device_session_revocations;
CREATE POLICY "Allow public delete" ON public.device_session_revocations FOR DELETE USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_session_revocations TO anon, authenticated, service_role;

-- One-time cleanup: stale online rows from the old 30s ping system
UPDATE public.active_devices SET is_online = false WHERE is_online = true;
