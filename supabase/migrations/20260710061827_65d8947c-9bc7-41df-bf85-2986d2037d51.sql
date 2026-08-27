CREATE TABLE IF NOT EXISTS public.notebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entry_id TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  pair TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  bias TEXT NOT NULL DEFAULT '',
  journal JSONB NOT NULL DEFAULT '{"text":"","media":[]}'::jsonb,
  legacy_notes TEXT,
  legacy_key_levels TEXT,
  legacy_image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_entries TO authenticated;
GRANT ALL ON public.notebook_entries TO service_role;

ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users crud own notebook_entries" ON public.notebook_entries
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS notebook_entries_user_idx ON public.notebook_entries (user_id, updated_at DESC);

DROP TRIGGER IF EXISTS notebook_entries_touch_updated ON public.notebook_entries;
CREATE TRIGGER notebook_entries_touch_updated
  BEFORE UPDATE ON public.notebook_entries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notebook_entries'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notebook_entries';
  END IF;
END $$;

ALTER TABLE public.notebook_entries REPLICA IDENTITY FULL;