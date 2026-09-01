-- Grant table privileges on canonical tables.
-- The schema-defining migrations enabled RLS and created policies, but never
-- explicitly GRANTed the table-level privileges to `authenticated` /
-- `service_role`. Without a GRANT the roles have no access at all (Postgres
-- denies before RLS is even evaluated), so every PostgREST read or write
-- returned "permission denied for table <name>".
-- This is a pure GRANT fix — no schema, policy, or trigger changes.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles           TO authenticated;
GRANT ALL                                            ON public.profiles           TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings      TO authenticated;
GRANT ALL                                            ON public.user_settings      TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_accounts   TO authenticated;
GRANT ALL                                            ON public.trading_accounts   TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trades             TO authenticated;
GRANT ALL                                            ON public.trades             TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions       TO authenticated;
GRANT ALL                                            ON public.transactions       TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scale_events       TO authenticated;
GRANT ALL                                            ON public.scale_events       TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_plans       TO authenticated;
GRANT ALL                                            ON public.weekly_plans       TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_plans        TO authenticated;
GRANT ALL                                            ON public.daily_plans        TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_days     TO authenticated;
GRANT ALL                                            ON public.checklist_days     TO service_role;