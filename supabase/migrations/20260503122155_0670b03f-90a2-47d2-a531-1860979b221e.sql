ALTER TABLE public.weekly_plans ADD COLUMN IF NOT EXISTS observation jsonb;
ALTER TABLE public.weekly_plans ADD COLUMN IF NOT EXISTS calendar_result jsonb;
ALTER TABLE public.daily_plans ADD COLUMN IF NOT EXISTS day_summary jsonb;
ALTER TABLE public.daily_plans ADD COLUMN IF NOT EXISTS notes_journal jsonb;