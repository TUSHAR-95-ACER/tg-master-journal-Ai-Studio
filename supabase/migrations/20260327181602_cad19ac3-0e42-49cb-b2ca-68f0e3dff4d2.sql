
-- 1. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'avatar_url');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. User Settings table
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_setups jsonb DEFAULT '[]'::jsonb,
  custom_assets jsonb DEFAULT '[]'::jsonb,
  custom_confluences jsonb DEFAULT '[]'::jsonb,
  markets jsonb DEFAULT '[]'::jsonb,
  sessions jsonb DEFAULT '[]'::jsonb,
  conditions jsonb DEFAULT '[]'::jsonb,
  grades_list jsonb DEFAULT '[]'::jsonb,
  management_options jsonb DEFAULT '[]'::jsonb,
  psych_tags jsonb DEFAULT '[]'::jsonb,
  violations jsonb DEFAULT '[]'::jsonb,
  notebook_categories jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own settings" ON public.user_settings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. Trading Accounts table
CREATE TABLE public.trading_accounts (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  broker text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'Personal',
  starting_balance numeric NOT NULL DEFAULT 0,
  current_size numeric NOT NULL DEFAULT 0,
  initial_size numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  stage text,
  target_balance numeric,
  status text,
  phase1_target numeric,
  phase2_target numeric,
  phase3_target numeric,
  phase1_target_percent numeric,
  phase2_target_percent numeric,
  phase3_target_percent numeric,
  max_drawdown_limit numeric,
  daily_drawdown_limit numeric,
  target_percent numeric,
  daily_drawdown_percent numeric,
  max_drawdown_percent numeric,
  steps integer,
  payouts jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own accounts" ON public.trading_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own accounts" ON public.trading_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts" ON public.trading_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts" ON public.trading_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Trades table
CREATE TABLE public.trades (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  entry_time text,
  exit_time text,
  market text NOT NULL,
  asset text NOT NULL,
  direction text NOT NULL,
  session text NOT NULL,
  market_condition text NOT NULL,
  setup text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  entry_price numeric NOT NULL DEFAULT 0,
  stop_loss numeric NOT NULL DEFAULT 0,
  take_profit numeric NOT NULL DEFAULT 0,
  exit_price numeric,
  result text NOT NULL,
  planned_rr numeric NOT NULL DEFAULT 0,
  actual_rr numeric,
  pips numeric,
  profit_loss numeric NOT NULL DEFAULT 0,
  fees numeric,
  notes text DEFAULT '',
  accounts jsonb DEFAULT '[]'::jsonb,
  management jsonb DEFAULT '[]'::jsonb,
  confluences jsonb DEFAULT '[]'::jsonb,
  entry_confluences jsonb,
  target_confluences jsonb,
  chart_link text,
  prediction_image text,
  execution_image text,
  psychology jsonb,
  mistakes jsonb DEFAULT '[]'::jsonb,
  grade text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. Transactions table
CREATE TABLE public.transactions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  account_id text NOT NULL,
  type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Scale Events table
CREATE TABLE public.scale_events (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  date text NOT NULL,
  old_size numeric NOT NULL DEFAULT 0,
  new_size numeric NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.scale_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scale_events" ON public.scale_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scale_events" ON public.scale_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scale_events" ON public.scale_events FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own scale_events" ON public.scale_events FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. Weekly Plans table
CREATE TABLE public.weekly_plans (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start text NOT NULL,
  bias text NOT NULL DEFAULT '',
  markets jsonb DEFAULT '[]'::jsonb,
  setups jsonb DEFAULT '[]'::jsonb,
  levels text DEFAULT '',
  risk text DEFAULT '',
  goals text DEFAULT '',
  pair_analyses jsonb DEFAULT '[]'::jsonb,
  news_items jsonb,
  news_result text,
  analysis_video_url text,
  reviewed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own weekly_plans" ON public.weekly_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly_plans" ON public.weekly_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly_plans" ON public.weekly_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own weekly_plans" ON public.weekly_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 8. Daily Plans table
CREATE TABLE public.daily_plans (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  daily_bias text NOT NULL DEFAULT 'Neutral',
  session_focus text NOT NULL DEFAULT 'London',
  max_trades integer NOT NULL DEFAULT 3,
  risk_limit text DEFAULT '',
  pairs jsonb DEFAULT '[]'::jsonb,
  news_items jsonb,
  took_trades boolean,
  result_narrative text,
  result_chart_image text,
  analysis_video_url text,
  note text,
  reviewed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own daily_plans" ON public.daily_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily_plans" ON public.daily_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily_plans" ON public.daily_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily_plans" ON public.daily_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);
