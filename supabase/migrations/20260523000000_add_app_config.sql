-- Create app_config table to store global configuration settings
CREATE TABLE IF NOT EXISTS public.app_config (
  id integer PRIMARY KEY DEFAULT 1,
  force_update boolean NOT NULL DEFAULT false,
  min_version text NOT NULL DEFAULT '1.0.0',
  android_url text NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.pasanpahasara.shopbookpos',
  ios_url text NOT NULL DEFAULT 'https://apps.apple.com/app/id6470000000',
  updated_at timestamp with time zone NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT singleton_id CHECK (id = 1)
);

-- Seed initial row
INSERT INTO public.app_config (id, force_update, min_version, android_url, ios_url)
VALUES (1, false, '1.0.0', 'https://play.google.com/store/apps/details?id=com.pasanpahasara.shopbookpos', 'https://apps.apple.com/app/id6470000000')
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for both anonymous and authenticated sessions)
DROP POLICY IF EXISTS "Allow public select" ON public.app_config;
CREATE POLICY "Allow public select" ON public.app_config FOR SELECT USING (true);
