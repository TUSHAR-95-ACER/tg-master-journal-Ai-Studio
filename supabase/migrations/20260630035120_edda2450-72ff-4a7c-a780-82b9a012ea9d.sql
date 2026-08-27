
CREATE OR REPLACE FUNCTION public._safe_jsonb_array_length(v jsonb)
RETURNS integer LANGUAGE plpgsql IMMUTABLE
SET search_path = public AS $$
BEGIN
  IF v IS NULL THEN RETURN 0; END IF;
  IF jsonb_typeof(v) = 'array' THEN RETURN jsonb_array_length(v); END IF;
  RETURN 0;
END $$;

REVOKE EXECUTE ON FUNCTION public.save_daily_plan(text, jsonb, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_weekly_plan(text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_daily_plan(text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_weekly_plan(text, jsonb, integer) TO authenticated;
