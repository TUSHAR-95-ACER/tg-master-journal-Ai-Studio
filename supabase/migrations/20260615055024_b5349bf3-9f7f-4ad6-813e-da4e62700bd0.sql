CREATE TABLE public.ai_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page text NOT NULL,
  payload_hash text NOT NULL,
  insights jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_insights_cache TO authenticated;
GRANT ALL ON public.ai_insights_cache TO service_role;

ALTER TABLE public.ai_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own insights cache"
  ON public.ai_insights_cache
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_ai_insights_cache_updated_at
  BEFORE UPDATE ON public.ai_insights_cache
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();