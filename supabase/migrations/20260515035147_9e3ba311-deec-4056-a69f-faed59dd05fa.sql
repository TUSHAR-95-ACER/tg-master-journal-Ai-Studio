
CREATE TABLE public.macro_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cycle_month text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'active',
  dominant_narrative text,
  narrative_drivers jsonb DEFAULT '[]'::jsonb,
  current_story jsonb DEFAULT '[]'::jsonb,
  forward_expectation jsonb,
  market_focus text,
  timeline jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (user_id, cycle_month)
);

ALTER TABLE public.macro_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "macro_cycles select own" ON public.macro_cycles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "macro_cycles insert own" ON public.macro_cycles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "macro_cycles update own" ON public.macro_cycles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "macro_cycles delete own" ON public.macro_cycles FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER macro_cycles_touch BEFORE UPDATE ON public.macro_cycles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.macro_events ADD COLUMN IF NOT EXISTS cycle_id uuid;
ALTER TABLE public.macro_events ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS idx_macro_events_cycle ON public.macro_events(cycle_id);

ALTER TABLE public.macro_analyses ADD COLUMN IF NOT EXISTS cycle_id uuid;
ALTER TABLE public.macro_analyses ADD COLUMN IF NOT EXISTS outcome_status text;
CREATE INDEX IF NOT EXISTS idx_macro_analyses_cycle ON public.macro_analyses(cycle_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_macro_analyses_user_cycle_date ON public.macro_analyses(user_id, cycle_id, analysis_date) WHERE cycle_id IS NOT NULL;
