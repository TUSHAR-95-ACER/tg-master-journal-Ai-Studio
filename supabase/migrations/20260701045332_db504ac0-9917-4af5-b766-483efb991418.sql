CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION private.save_daily_plan(p_id text, p_payload jsonb, p_expected_revision integer DEFAULT NULL::integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_existing public.daily_plans%ROWTYPE;
  v_saved public.daily_plans%ROWTYPE;
  v_new_pairs jsonb;
  v_existing_pair_count int;
  v_new_pair_count int;
  v_revision int;
  v_payload_size int := octet_length(p_payload::text);
  v_payload_hash text := md5(p_payload::text);
  v_history_version int;
  v_rows int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  v_new_pairs := p_payload->'pairs';
  IF v_new_pairs IS NULL OR jsonb_typeof(v_new_pairs) <> 'array' THEN
    v_new_pairs := '[]'::jsonb;
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_new_pairs) e WHERE (e ? '__placeholder') AND (e->>'__placeholder')::boolean IS TRUE) THEN
    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, payload_hash)
      VALUES (v_user, p_id, 'daily', 'update', false, 'placeholder_pairs', v_payload_size, v_payload_hash);
    RAISE EXCEPTION 'refused_placeholder_pairs';
  END IF;

  v_new_pair_count := jsonb_array_length(v_new_pairs);

  SELECT * INTO v_existing FROM public.daily_plans WHERE id = p_id AND user_id = v_user FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.daily_plans (
      id, user_id, date, daily_bias, session_focus, max_trades, risk_limit,
      pairs, news_items, took_trades, result_narrative, result_chart_image,
      analysis_video_url, note, reviewed, day_summary, notes_journal,
      review_video, schema_version, revision, updated_at
    ) VALUES (
      p_id, v_user,
      COALESCE(p_payload->>'date', to_char(clock_timestamp(),'YYYY-MM-DD')),
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
      1,
      clock_timestamp()
    ) RETURNING * INTO v_saved;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 OR v_saved.revision <> 1 OR v_saved.updated_at IS NULL THEN
      RAISE EXCEPTION 'daily_insert_verification_failed rows=% revision=% updated_at=%', v_rows, v_saved.revision, v_saved.updated_at;
    END IF;

    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, payload_size, payload_hash, revision)
      VALUES (v_user, p_id, 'daily', 'insert', true, v_payload_size, v_payload_hash, 1);

    RETURN jsonb_build_object('revision', 1, 'previous_revision', null, 'inserted', true, 'updated_at', v_saved.updated_at, 'row_count', v_rows, 'history_created', false, 'history_version', null, 'payload_hash', v_payload_hash);
  END IF;

  IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_existing.revision THEN
    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, payload_hash, revision)
      VALUES (v_user, p_id, 'daily', 'update', false, format('concurrency: expected=%s current=%s', p_expected_revision, v_existing.revision), v_payload_size, v_payload_hash, v_existing.revision);
    RAISE EXCEPTION 'concurrency_conflict expected=% current=%', p_expected_revision, v_existing.revision;
  END IF;

  v_existing_pair_count := public._safe_jsonb_array_length(v_existing.pairs);
  IF v_existing_pair_count > 0 AND v_new_pair_count = 0 THEN
    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, payload_hash, revision)
      VALUES (v_user, p_id, 'daily', 'update', false, format('write_guard_erase pairs=%s->0', v_existing_pair_count), v_payload_size, v_payload_hash, v_existing.revision);
    RAISE EXCEPTION 'write_guard_refused_erase pairs=%->0', v_existing_pair_count;
  END IF;
  IF v_existing_pair_count >= 4 AND v_new_pair_count * 2 < v_existing_pair_count THEN
    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, payload_hash, revision)
      VALUES (v_user, p_id, 'daily', 'update', false, format('write_guard_shrink %s->%s', v_existing_pair_count, v_new_pair_count), v_payload_size, v_payload_hash, v_existing.revision);
    RAISE EXCEPTION 'write_guard_refused_shrink %->%', v_existing_pair_count, v_new_pair_count;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_history_version FROM public.daily_plan_history WHERE plan_id = v_existing.id;
  INSERT INTO public.daily_plan_history (plan_id, user_id, version, snapshot, schema_version, source_updated_at)
  VALUES (v_existing.id, v_existing.user_id, v_history_version, to_jsonb(v_existing), v_existing.schema_version, v_existing.updated_at);

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
    revision = v_revision,
    updated_at = clock_timestamp()
  WHERE id = p_id AND user_id = v_user
  RETURNING * INTO v_saved;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 OR v_saved.revision <> v_revision OR v_saved.updated_at <= v_existing.updated_at THEN
    RAISE EXCEPTION 'daily_update_verification_failed rows=% revision=% updated_at=% previous_updated_at=%', v_rows, v_saved.revision, v_saved.updated_at, v_existing.updated_at;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_plan_history WHERE plan_id = p_id AND version = v_history_version) THEN
    RAISE EXCEPTION 'daily_history_snapshot_missing version=%', v_history_version;
  END IF;

  INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, payload_size, payload_hash, revision)
    VALUES (v_user, p_id, 'daily', 'update', true, v_payload_size, v_payload_hash, v_revision);

  RETURN jsonb_build_object('revision', v_revision, 'previous_revision', v_existing.revision, 'inserted', false, 'updated_at', v_saved.updated_at, 'row_count', v_rows, 'history_created', true, 'history_version', v_history_version, 'payload_hash', v_payload_hash);
END;
$function$;

CREATE OR REPLACE FUNCTION private.save_weekly_plan(p_id text, p_payload jsonb, p_expected_revision integer DEFAULT NULL::integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_existing public.weekly_plans%ROWTYPE;
  v_saved public.weekly_plans%ROWTYPE;
  v_new_pairs jsonb;
  v_existing_pair_count int;
  v_new_pair_count int;
  v_revision int;
  v_payload_size int := octet_length(p_payload::text);
  v_payload_hash text := md5(p_payload::text);
  v_history_version int;
  v_rows int := 0;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  v_new_pairs := p_payload->'pair_analyses';
  IF v_new_pairs IS NULL OR jsonb_typeof(v_new_pairs) <> 'array' THEN
    v_new_pairs := '[]'::jsonb;
  END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_new_pairs) e WHERE (e ? '__placeholder') AND (e->>'__placeholder')::boolean IS TRUE) THEN
    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, payload_hash)
      VALUES (v_user, p_id, 'weekly', 'update', false, 'placeholder_pairs', v_payload_size, v_payload_hash);
    RAISE EXCEPTION 'refused_placeholder_pairs';
  END IF;

  v_new_pair_count := jsonb_array_length(v_new_pairs);

  SELECT * INTO v_existing FROM public.weekly_plans WHERE id = p_id AND user_id = v_user FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.weekly_plans (
      id, user_id, week_start, bias, markets, setups, levels, risk, goals,
      pair_analyses, news_items, news_result, analysis_video_url, reviewed,
      observation, calendar_result, revision, updated_at
    ) VALUES (
      p_id, v_user,
      COALESCE(p_payload->>'week_start', to_char(clock_timestamp(),'YYYY-MM-DD')),
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
      1,
      clock_timestamp()
    ) RETURNING * INTO v_saved;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 OR v_saved.revision <> 1 OR v_saved.updated_at IS NULL THEN
      RAISE EXCEPTION 'weekly_insert_verification_failed rows=% revision=% updated_at=%', v_rows, v_saved.revision, v_saved.updated_at;
    END IF;

    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, payload_size, payload_hash, revision)
      VALUES (v_user, p_id, 'weekly', 'insert', true, v_payload_size, v_payload_hash, 1);

    RETURN jsonb_build_object('revision', 1, 'previous_revision', null, 'inserted', true, 'updated_at', v_saved.updated_at, 'row_count', v_rows, 'history_created', false, 'history_version', null, 'payload_hash', v_payload_hash);
  END IF;

  IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_existing.revision THEN
    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, payload_hash, revision)
      VALUES (v_user, p_id, 'weekly', 'update', false, format('concurrency: expected=%s current=%s', p_expected_revision, v_existing.revision), v_payload_size, v_payload_hash, v_existing.revision);
    RAISE EXCEPTION 'concurrency_conflict expected=% current=%', p_expected_revision, v_existing.revision;
  END IF;

  v_existing_pair_count := public._safe_jsonb_array_length(v_existing.pair_analyses);
  IF v_existing_pair_count > 0 AND v_new_pair_count = 0 THEN
    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, payload_hash, revision)
      VALUES (v_user, p_id, 'weekly', 'update', false, format('write_guard_erase pairs=%s->0', v_existing_pair_count), v_payload_size, v_payload_hash, v_existing.revision);
    RAISE EXCEPTION 'write_guard_refused_erase pairs=%->0', v_existing_pair_count;
  END IF;
  IF v_existing_pair_count >= 4 AND v_new_pair_count * 2 < v_existing_pair_count THEN
    INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, error, payload_size, payload_hash, revision)
      VALUES (v_user, p_id, 'weekly', 'update', false, format('write_guard_shrink %s->%s', v_existing_pair_count, v_new_pair_count), v_payload_size, v_payload_hash, v_existing.revision);
    RAISE EXCEPTION 'write_guard_refused_shrink %->%', v_existing_pair_count, v_new_pair_count;
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO v_history_version FROM public.weekly_plan_history WHERE plan_id = v_existing.id;
  INSERT INTO public.weekly_plan_history (plan_id, user_id, version, snapshot, source_updated_at)
  VALUES (v_existing.id, v_existing.user_id, v_history_version, to_jsonb(v_existing), v_existing.updated_at);

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
    revision = v_revision,
    updated_at = clock_timestamp()
  WHERE id = p_id AND user_id = v_user
  RETURNING * INTO v_saved;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 OR v_saved.revision <> v_revision OR v_saved.updated_at <= v_existing.updated_at THEN
    RAISE EXCEPTION 'weekly_update_verification_failed rows=% revision=% updated_at=% previous_updated_at=%', v_rows, v_saved.revision, v_saved.updated_at, v_existing.updated_at;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.weekly_plan_history WHERE plan_id = p_id AND version = v_history_version) THEN
    RAISE EXCEPTION 'weekly_history_snapshot_missing version=%', v_history_version;
  END IF;

  INSERT INTO public.plan_audit_log(user_id, plan_id, plan_type, operation, success, payload_size, payload_hash, revision)
    VALUES (v_user, p_id, 'weekly', 'update', true, v_payload_size, v_payload_hash, v_revision);

  RETURN jsonb_build_object('revision', v_revision, 'previous_revision', v_existing.revision, 'inserted', false, 'updated_at', v_saved.updated_at, 'row_count', v_rows, 'history_created', true, 'history_version', v_history_version, 'payload_hash', v_payload_hash);
END;
$function$;