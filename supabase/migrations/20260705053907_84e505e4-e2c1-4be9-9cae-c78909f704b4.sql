DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'trades','trading_accounts','transactions','scale_events',
    'weekly_plans','daily_plans','user_settings','profiles',
    'macro_events','macro_analyses','macro_predictions','macro_cycles'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Make sure UPDATE payloads include the previous row so clients can merge.
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    -- Add to the realtime publication only if not already a member.
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;