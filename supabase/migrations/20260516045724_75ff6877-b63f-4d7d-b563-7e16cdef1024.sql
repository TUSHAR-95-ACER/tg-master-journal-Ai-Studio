DROP INDEX IF EXISTS public.uq_macro_analyses_user_cycle_date;

ALTER TABLE public.macro_analyses
  ADD CONSTRAINT macro_analyses_user_cycle_date_key
  UNIQUE (user_id, cycle_id, analysis_date);