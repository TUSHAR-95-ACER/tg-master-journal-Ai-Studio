CREATE TABLE public.macro_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cycle_id uuid,
  source_event_id uuid,
  source_event text NOT NULL,
  target_event text NOT NULL,
  prediction_date date NOT NULL DEFAULT CURRENT_DATE,
  usd_outlook text,
  gold_outlook text,
  fed_outlook text,
  narrative text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT macro_predictions_status_check CHECK (status IN ('pending','worked','failed'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.macro_predictions TO authenticated;
GRANT ALL ON public.macro_predictions TO service_role;

ALTER TABLE public.macro_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "macro_predictions select own" ON public.macro_predictions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "macro_predictions insert own" ON public.macro_predictions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "macro_predictions update own" ON public.macro_predictions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "macro_predictions delete own" ON public.macro_predictions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_macro_predictions_user_date
  ON public.macro_predictions (user_id, prediction_date DESC);
CREATE INDEX idx_macro_predictions_user_status
  ON public.macro_predictions (user_id, status);

CREATE TRIGGER trg_macro_predictions_updated
  BEFORE UPDATE ON public.macro_predictions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();