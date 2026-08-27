ALTER TABLE public.macro_events
  ADD COLUMN IF NOT EXISTS outcome_status text;

ALTER TABLE public.macro_events
  DROP CONSTRAINT IF EXISTS macro_events_outcome_status_check;

ALTER TABLE public.macro_events
  ADD CONSTRAINT macro_events_outcome_status_check
  CHECK (outcome_status IS NULL OR outcome_status IN ('worked','not_worked'));

CREATE INDEX IF NOT EXISTS idx_macro_events_user_release
  ON public.macro_events(user_id, release_date DESC);