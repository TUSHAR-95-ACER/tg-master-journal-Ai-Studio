
CREATE TABLE public.macro_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  release_date date NOT NULL DEFAULT CURRENT_DATE,
  event text NOT NULL,
  previous numeric,
  forecast numeric,
  actual numeric,
  unit text,
  surprise text,
  trend text,
  impact text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.macro_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "macro_events select own" ON public.macro_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "macro_events insert own" ON public.macro_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "macro_events update own" ON public.macro_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "macro_events delete own" ON public.macro_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_macro_events_user_date ON public.macro_events(user_id, release_date DESC);

CREATE TABLE public.macro_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  analysis_date date NOT NULL DEFAULT CURRENT_DATE,
  macro_theme text,
  fed_cycle text,
  environment text,
  narrative text,
  fed_bias text,
  usd_bias text,
  gold_bias text,
  fed_confidence numeric,
  usd_confidence numeric,
  gold_confidence numeric,
  hawkish_probability numeric,
  dovish_probability numeric,
  rate_cut_probability numeric,
  rate_hike_probability numeric,
  recession_risk numeric,
  inflation_pressure text,
  market_focus text,
  smart_money_view text,
  expectation_pricing text,
  conflict_signals jsonb DEFAULT '[]'::jsonb,
  positioning_risk text,
  future_probabilities jsonb DEFAULT '[]'::jsonb,
  trade_filter text,
  interpretation text,
  narrative_shift text,
  predicted_outcome text,
  actual_outcome text,
  outcome_accurate boolean,
  confidence_level text,
  source_event_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.macro_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "macro_analyses select own" ON public.macro_analyses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "macro_analyses insert own" ON public.macro_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "macro_analyses update own" ON public.macro_analyses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "macro_analyses delete own" ON public.macro_analyses FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_macro_analyses_user_date ON public.macro_analyses(user_id, analysis_date DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_macro_events_updated BEFORE UPDATE ON public.macro_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_macro_analyses_updated BEFORE UPDATE ON public.macro_analyses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
