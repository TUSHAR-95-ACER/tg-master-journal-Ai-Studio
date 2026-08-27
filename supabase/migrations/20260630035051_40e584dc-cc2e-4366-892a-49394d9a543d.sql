
-- 1. updated_at + revision on plan tables
ALTER TABLE public.daily_plans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

ALTER TABLE public.weekly_plans
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;

-- Generic updated_at trigger (reuse public.touch_updated_at if present)
DROP TRIGGER IF EXISTS trg_daily_plans_updated_at ON public.daily_plans;
CREATE TRIGGER trg_daily_plans_updated_at
  BEFORE UPDATE ON public.daily_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_weekly_plans_updated_at ON public.weekly_plans;
CREATE TRIGGER trg_weekly_plans_updated_at
  BEFORE UPDATE ON public.weekly_plans
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. History tables
CREATE TABLE IF NOT EXISTS public.daily_plan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL,
  user_id uuid NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  schema_version smallint,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_plan_history_plan_idx
  ON public.daily_plan_history (plan_id, version DESC);
CREATE INDEX IF NOT EXISTS daily_plan_history_user_idx
  ON public.daily_plan_history (user_id, created_at DESC);

GRANT SELECT ON public.daily_plan_history TO authenticated;
GRANT ALL ON public.daily_plan_history TO service_role;
ALTER TABLE public.daily_plan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own daily history" ON public.daily_plan_history;
CREATE POLICY "Users read own daily history"
  ON public.daily_plan_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.weekly_plan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL,
  user_id uuid NOT NULL,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  schema_version smallint,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS weekly_plan_history_plan_idx
  ON public.weekly_plan_history (plan_id, version DESC);
CREATE INDEX IF NOT EXISTS weekly_plan_history_user_idx
  ON public.weekly_plan_history (user_id, created_at DESC);

GRANT SELECT ON public.weekly_plan_history TO authenticated;
GRANT ALL ON public.weekly_plan_history TO service_role;
ALTER TABLE public.weekly_plan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own weekly history" ON public.weekly_plan_history;
CREATE POLICY "Users read own weekly history"
  ON public.weekly_plan_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- 3. Audit log
CREATE TABLE IF NOT EXISTS public.plan_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  plan_id text,
  plan_type text NOT NULL,
  operation text NOT NULL,
  success boolean NOT NULL,
  error text,
  payload_size integer,
  revision integer,
  payload_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_audit_log_user_idx
  ON public.plan_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS plan_audit_log_plan_idx
  ON public.plan_audit_log (plan_id, created_at DESC);

GRANT SELECT ON public.plan_audit_log TO authenticated;
GRANT ALL ON public.plan_audit_log TO service_role;
ALTER TABLE public.plan_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own audit" ON public.plan_audit_log;
CREATE POLICY "Users read own audit"
  ON public.plan_audit_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- 4. Helper: jsonb array length safely
CREATE OR REPLACE FUNCTION public._safe_jsonb_array_length(v jsonb)
RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF v IS NULL THEN RETURN 0; END IF;
  IF jsonb_typeof(v) = 'array' THEN RETURN jsonb_array_length(v); END IF;
  RETURN 0;
END $$;

-- 5. save_daily_plan RPC
CREATE OR REPLACE FUNCTION public.save_daily_plan(
  p_id text,
  p_payload jsonb,
  p_expected_revision integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing public.daily_plans%ROWTYPE;
  v_new_pairs jsonb;
  v_existing_pair_count int;
  v_new_pair_count int;
  v_revision int;
  v_payload_size int := octet_length(p_payload::text);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  v_new_pairs := p_payload->'pairs';
  IF v_new_pairs IS NULL OR jsonb_typeof(v_new_pairs) <> 'array' THEN
    v_new_pairs := '[]'::jsonb;
  END IF;

  -- Reject hydration placeholders
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_new_pairs) e
    WHERE (e ? '__placeholder') AND (e->>'__placeholder')::boolean IS TRUE
  ) THEN
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size)
      VALUES (v_user, p_id, 'daily', 'update', false, 'placeholder_pairs', v_payload_size);
    RAISE EXCEPTION 'refused_placeholder_pairs';
  END IF;

  v_new_pair_count := jsonb_array_length(v_new_pairs);

  SELECT * INTO v_existing FROM public.daily_plans
   WHERE id = p_id AND user_id = v_user FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.daily_plans (
      id, user_id, date, daily_bias, session_focus, max_trades, risk_limit,
      pairs, news_items, took_trades, result_narrative, result_chart_image,
      analysis_video_url, note, reviewed, day_summary, notes_journal,
      review_video, schema_version, revision
    ) VALUES (
      p_id, v_user,
      COALESCE(p_payload->>'date', to_char(now(),'YYYY-MM-DD')),
      COALESCE(p_payload->>'daily_bias', 'Neutral'),
      COALESCE(p_payload->>'session_focus', 'London'),
      COALESCE((p_payload->>'max_trades')::int, 2),
      COALESCE(p_payload->>'risk_limit', ''),
      v_new_pairs,
      p_payload->'news_items',
      NULLIF(p_payload->>'took_trades','')::boolean,
      p_payload->>'result_narrative',
      p_payload->>'result_chart_image',
      p_payload->>'analysis_video_url',
      p_payload->>'note',
      COALESCE(NULLIF(p_payload->>'reviewed','')::boolean, false),
      p_payload->'day_summary',
      p_payload->'notes_journal',
      p_payload->'review_video',
      NULLIF(p_payload->>'schema_version','')::smallint,
      1
    );
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, payload_size, revision)
      VALUES (v_user, p_id, 'daily', 'insert', true, v_payload_size, 1);
    RETURN jsonb_build_object('revision', 1, 'inserted', true, 'updated_at', now());
  END IF;

  -- Optimistic concurrency
  IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_existing.revision THEN
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, revision)
      VALUES (v_user, p_id, 'daily', 'update', false,
        format('concurrency: expected=%s current=%s', p_expected_revision, v_existing.revision),
        v_payload_size, v_existing.revision);
    RAISE EXCEPTION 'concurrency_conflict expected=% current=%', p_expected_revision, v_existing.revision;
  END IF;

  -- Write guard
  v_existing_pair_count := public._safe_jsonb_array_length(v_existing.pairs);
  IF v_existing_pair_count > 0 AND v_new_pair_count = 0 THEN
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, revision)
      VALUES (v_user, p_id, 'daily', 'update', false,
        format('write_guard_erase pairs=%s->0', v_existing_pair_count),
        v_payload_size, v_existing.revision);
    RAISE EXCEPTION 'write_guard_refused_erase pairs=%->0', v_existing_pair_count;
  END IF;
  IF v_existing_pair_count >= 4 AND v_new_pair_count * 2 < v_existing_pair_count THEN
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, revision)
      VALUES (v_user, p_id, 'daily', 'update', false,
        format('write_guard_shrink %s->%s', v_existing_pair_count, v_new_pair_count),
        v_payload_size, v_existing.revision);
    RAISE EXCEPTION 'write_guard_refused_shrink %->%', v_existing_pair_count, v_new_pair_count;
  END IF;

  -- Snapshot to history BEFORE updating
  INSERT INTO public.daily_plan_history (plan_id, user_id, version, snapshot, schema_version, source_updated_at)
  VALUES (
    v_existing.id, v_existing.user_id,
    COALESCE((SELECT MAX(version)+1 FROM public.daily_plan_history WHERE plan_id = v_existing.id), 1),
    to_jsonb(v_existing),
    v_existing.schema_version,
    v_existing.updated_at
  );

  v_revision := v_existing.revision + 1;

  UPDATE public.daily_plans SET
    date = COALESCE(p_payload->>'date', date),
    daily_bias = COALESCE(p_payload->>'daily_bias', daily_bias),
    session_focus = COALESCE(p_payload->>'session_focus', session_focus),
    max_trades = COALESCE((p_payload->>'max_trades')::int, max_trades),
    risk_limit = COALESCE(p_payload->>'risk_limit', risk_limit),
    pairs = v_new_pairs,
    news_items = COALESCE(p_payload->'news_items', news_items),
    took_trades = COALESCE(NULLIF(p_payload->>'took_trades','')::boolean, took_trades),
    result_narrative = COALESCE(p_payload->>'result_narrative', result_narrative),
    result_chart_image = COALESCE(p_payload->>'result_chart_image', result_chart_image),
    analysis_video_url = COALESCE(p_payload->>'analysis_video_url', analysis_video_url),
    note = COALESCE(p_payload->>'note', note),
    reviewed = COALESCE(NULLIF(p_payload->>'reviewed','')::boolean, reviewed),
    day_summary = COALESCE(p_payload->'day_summary', day_summary),
    notes_journal = COALESCE(p_payload->'notes_journal', notes_journal),
    review_video = COALESCE(p_payload->'review_video', review_video),
    schema_version = COALESCE(NULLIF(p_payload->>'schema_version','')::smallint, schema_version),
    revision = v_revision
  WHERE id = p_id AND user_id = v_user;

  INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, payload_size, revision)
    VALUES (v_user, p_id, 'daily', 'update', true, v_payload_size, v_revision);

  RETURN jsonb_build_object('revision', v_revision, 'inserted', false, 'updated_at', now());
END $$;

-- 6. save_weekly_plan RPC
CREATE OR REPLACE FUNCTION public.save_weekly_plan(
  p_id text,
  p_payload jsonb,
  p_expected_revision integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing public.weekly_plans%ROWTYPE;
  v_new_pairs jsonb;
  v_existing_pair_count int;
  v_new_pair_count int;
  v_revision int;
  v_payload_size int := octet_length(p_payload::text);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  v_new_pairs := p_payload->'pair_analyses';
  IF v_new_pairs IS NULL OR jsonb_typeof(v_new_pairs) <> 'array' THEN
    v_new_pairs := '[]'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_new_pairs) e
    WHERE (e ? '__placeholder') AND (e->>'__placeholder')::boolean IS TRUE
  ) THEN
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size)
      VALUES (v_user, p_id, 'weekly', 'update', false, 'placeholder_pairs', v_payload_size);
    RAISE EXCEPTION 'refused_placeholder_pairs';
  END IF;

  v_new_pair_count := jsonb_array_length(v_new_pairs);

  SELECT * INTO v_existing FROM public.weekly_plans
   WHERE id = p_id AND user_id = v_user FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.weekly_plans (
      id, user_id, week_start, bias, markets, setups, levels, risk, goals,
      pair_analyses, news_items, news_result, analysis_video_url, reviewed,
      observation, calendar_result, revision
    ) VALUES (
      p_id, v_user,
      COALESCE(p_payload->>'week_start', to_char(now(),'YYYY-MM-DD')),
      COALESCE(p_payload->>'bias',''),
      COALESCE(p_payload->'markets','[]'::jsonb),
      COALESCE(p_payload->'setups','[]'::jsonb),
      COALESCE(p_payload->>'levels',''),
      COALESCE(p_payload->>'risk',''),
      COALESCE(p_payload->>'goals',''),
      v_new_pairs,
      p_payload->'news_items',
      p_payload->>'news_result',
      p_payload->>'analysis_video_url',
      COALESCE(NULLIF(p_payload->>'reviewed','')::boolean, false),
      p_payload->'observation',
      p_payload->'calendar_result',
      1
    );
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, payload_size, revision)
      VALUES (v_user, p_id, 'weekly', 'insert', true, v_payload_size, 1);
    RETURN jsonb_build_object('revision', 1, 'inserted', true, 'updated_at', now());
  END IF;

  IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_existing.revision THEN
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, revision)
      VALUES (v_user, p_id, 'weekly', 'update', false,
        format('concurrency: expected=%s current=%s', p_expected_revision, v_existing.revision),
        v_payload_size, v_existing.revision);
    RAISE EXCEPTION 'concurrency_conflict expected=% current=%', p_expected_revision, v_existing.revision;
  END IF;

  v_existing_pair_count := public._safe_jsonb_array_length(v_existing.pair_analyses);
  IF v_existing_pair_count > 0 AND v_new_pair_count = 0 THEN
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, revision)
      VALUES (v_user, p_id, 'weekly', 'update', false,
        format('write_guard_erase pairs=%s->0', v_existing_pair_count),
        v_payload_size, v_existing.revision);
    RAISE EXCEPTION 'write_guard_refused_erase pairs=%->0', v_existing_pair_count;
  END IF;
  IF v_existing_pair_count >= 4 AND v_new_pair_count * 2 < v_existing_pair_count THEN
    INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, revision)
      VALUES (v_user, p_id, 'weekly', 'update', false,
        format('write_guard_shrink %s->%s', v_existing_pair_count, v_new_pair_count),
        v_payload_size, v_existing.revision);
    RAISE EXCEPTION 'write_guard_refused_shrink %->%', v_existing_pair_count, v_new_pair_count;
  END IF;

  INSERT INTO public.weekly_plan_history (plan_id, user_id, version, snapshot, source_updated_at)
  VALUES (
    v_existing.id, v_existing.user_id,
    COALESCE((SELECT MAX(version)+1 FROM public.weekly_plan_history WHERE plan_id = v_existing.id), 1),
    to_jsonb(v_existing),
    v_existing.updated_at
  );

  v_revision := v_existing.revision + 1;

  UPDATE public.weekly_plans SET
    week_start = COALESCE(p_payload->>'week_start', week_start),
    bias = COALESCE(p_payload->>'bias', bias),
    markets = COALESCE(p_payload->'markets', markets),
    setups = COALESCE(p_payload->'setups', setups),
    levels = COALESCE(p_payload->>'levels', levels),
    risk = COALESCE(p_payload->>'risk', risk),
    goals = COALESCE(p_payload->>'goals', goals),
    pair_analyses = v_new_pairs,
    news_items = COALESCE(p_payload->'news_items', news_items),
    news_result = COALESCE(p_payload->>'news_result', news_result),
    analysis_video_url = COALESCE(p_payload->>'analysis_video_url', analysis_video_url),
    reviewed = COALESCE(NULLIF(p_payload->>'reviewed','')::boolean, reviewed),
    observation = COALESCE(p_payload->'observation', observation),
    calendar_result = COALESCE(p_payload->'calendar_result', calendar_result),
    revision = v_revision
  WHERE id = p_id AND user_id = v_user;

  INSERT INTO plan_audit_log(user_id, plan_id, plan_type, operation, success, payload_size, revision)
    VALUES (v_user, p_id, 'weekly', 'update', true, v_payload_size, v_revision);

  RETURN jsonb_build_object('revision', v_revision, 'inserted', false, 'updated_at', now());
END $$;

GRANT EXECUTE ON FUNCTION public.save_daily_plan(text, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_weekly_plan(text, jsonb, integer) TO authenticated;
