-- Deduplicate macro_analyses before adding unique index (keep newest per cycle+date)
DELETE FROM public.macro_analyses a
USING public.macro_analyses b
WHERE a.user_id = b.user_id
  AND COALESCE(a.cycle_id::text,'') = COALESCE(b.cycle_id::text,'')
  AND a.analysis_date = b.analysis_date
  AND a.created_at < b.created_at;

-- Unique constraint that treats NULL cycle_id as a single bucket
CREATE UNIQUE INDEX IF NOT EXISTS uq_macro_analyses_user_cycle_date
  ON public.macro_analyses (user_id, COALESCE(cycle_id, '00000000-0000-0000-0000-000000000000'::uuid), analysis_date);

-- Deduplicate macro_cycles before adding unique constraint
DELETE FROM public.macro_cycles a
USING public.macro_cycles b
WHERE a.user_id = b.user_id
  AND a.cycle_month = b.cycle_month
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_macro_cycles_user_month
  ON public.macro_cycles (user_id, cycle_month);