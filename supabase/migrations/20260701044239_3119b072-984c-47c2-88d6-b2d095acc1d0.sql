
-- Lock down SECURITY DEFINER helper functions so signed-in users can't execute
-- ones that are only meant for internal/trigger use.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, supabase_auth_admin;

-- save_daily_plan / save_weekly_plan must remain callable by authenticated users
-- (they enforce auth.uid() internally), but revoke the broad PUBLIC/anon grants
-- created by default so only signed-in roles can execute them.
REVOKE ALL ON FUNCTION public.save_daily_plan(text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_daily_plan(text, jsonb, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.save_weekly_plan(text, jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_weekly_plan(text, jsonb, integer) TO authenticated, service_role;
