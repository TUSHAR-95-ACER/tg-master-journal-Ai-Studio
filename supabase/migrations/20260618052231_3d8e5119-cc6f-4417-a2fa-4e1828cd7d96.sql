
-- Maintained pair-count columns so list queries don't need to pull heavy JSON
ALTER TABLE public.daily_plans  ADD COLUMN IF NOT EXISTS pair_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.weekly_plans ADD COLUMN IF NOT EXISTS pair_count integer NOT NULL DEFAULT 0;

-- Parse the JSON-string `pairs` and set count safely
CREATE OR REPLACE FUNCTION public.set_daily_plan_pair_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parsed jsonb;
BEGIN
  IF NEW.pairs IS NULL THEN
    NEW.pair_count := 0;
  ELSIF jsonb_typeof(NEW.pairs) = 'array' THEN
    NEW.pair_count := jsonb_array_length(NEW.pairs);
  ELSE
    BEGIN
      parsed := (NEW.pairs #>> '{}')::jsonb;
      IF jsonb_typeof(parsed) = 'array' THEN
        NEW.pair_count := jsonb_array_length(parsed);
      ELSE
        NEW.pair_count := 0;
      END IF;
    EXCEPTION WHEN others THEN
      NEW.pair_count := 0;
    END;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_weekly_plan_pair_count()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parsed jsonb;
BEGIN
  IF NEW.pair_analyses IS NULL THEN
    NEW.pair_count := 0;
  ELSIF jsonb_typeof(NEW.pair_analyses) = 'array' THEN
    NEW.pair_count := jsonb_array_length(NEW.pair_analyses);
  ELSE
    BEGIN
      parsed := (NEW.pair_analyses #>> '{}')::jsonb;
      IF jsonb_typeof(parsed) = 'array' THEN
        NEW.pair_count := jsonb_array_length(parsed);
      ELSE
        NEW.pair_count := 0;
      END IF;
    EXCEPTION WHEN others THEN
      NEW.pair_count := 0;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_plans_pair_count_trg  ON public.daily_plans;
DROP TRIGGER IF EXISTS weekly_plans_pair_count_trg ON public.weekly_plans;

CREATE TRIGGER daily_plans_pair_count_trg
  BEFORE INSERT OR UPDATE OF pairs ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_daily_plan_pair_count();

CREATE TRIGGER weekly_plans_pair_count_trg
  BEFORE INSERT OR UPDATE OF pair_analyses ON public.weekly_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_weekly_plan_pair_count();

-- One-time backfill
UPDATE public.daily_plans
SET pair_count = CASE
  WHEN pairs IS NULL THEN 0
  WHEN jsonb_typeof(pairs) = 'array' THEN jsonb_array_length(pairs)
  ELSE COALESCE(
    (SELECT jsonb_array_length(((pairs #>> '{}')::jsonb))
     WHERE jsonb_typeof((pairs #>> '{}')::jsonb) = 'array'),
    0)
END;

UPDATE public.weekly_plans
SET pair_count = CASE
  WHEN pair_analyses IS NULL THEN 0
  WHEN jsonb_typeof(pair_analyses) = 'array' THEN jsonb_array_length(pair_analyses)
  ELSE COALESCE(
    (SELECT jsonb_array_length(((pair_analyses #>> '{}')::jsonb))
     WHERE jsonb_typeof((pair_analyses #>> '{}')::jsonb) = 'array'),
    0)
END;

-- Indexes for the always-filtered (user_id, date/week_start desc) access pattern
CREATE INDEX IF NOT EXISTS daily_plans_user_date_idx  ON public.daily_plans  (user_id, date DESC);
CREATE INDEX IF NOT EXISTS weekly_plans_user_week_idx ON public.weekly_plans (user_id, week_start DESC);
