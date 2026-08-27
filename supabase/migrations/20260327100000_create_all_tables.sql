-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, broker TEXT NOT NULL DEFAULT '', type TEXT NOT NULL DEFAULT 'Personal',
  starting_balance NUMERIC DEFAULT 0, current_size NUMERIC DEFAULT 0, initial_size NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD', stage TEXT, target_balance NUMERIC, status TEXT,
  phase1_target NUMERIC, phase2_target NUMERIC, phase3_target NUMERIC,
  phase1_target_percent NUMERIC, phase2_target_percent NUMERIC, phase3_target_percent NUMERIC,
  max_drawdown_limit NUMERIC, daily_drawdown_limit NUMERIC, target_percent NUMERIC,
  daily_drawdown_percent NUMERIC, max_drawdown_percent NUMERIC, steps INTEGER,
  payouts JSONB DEFAULT '[]', created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own accounts" ON public.trading_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL, entry_time TEXT, exit_time TEXT, market TEXT NOT NULL, asset TEXT NOT NULL,
  direction TEXT NOT NULL, session TEXT NOT NULL, market_condition TEXT NOT NULL, setup TEXT NOT NULL,
  quantity NUMERIC DEFAULT 0, entry_price NUMERIC DEFAULT 0, stop_loss NUMERIC DEFAULT 0,
  take_profit NUMERIC DEFAULT 0, exit_price NUMERIC, result TEXT NOT NULL, planned_rr NUMERIC DEFAULT 0,
  actual_rr NUMERIC, pips NUMERIC, profit_loss NUMERIC DEFAULT 0, fees NUMERIC, notes TEXT DEFAULT '',
  accounts JSONB DEFAULT '[]', management JSONB DEFAULT '[]', confluences JSONB DEFAULT '[]',
  entry_confluences JSONB, target_confluences JSONB, chart_link TEXT,
  prediction_image TEXT, execution_image TEXT, psychology JSONB, mistakes JSONB DEFAULT '[]',
  grade TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own trades" ON public.trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL, account_id TEXT NOT NULL, type TEXT NOT NULL, amount NUMERIC DEFAULT 0,
  note TEXT DEFAULT '', created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.scale_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  account_id TEXT NOT NULL, date TEXT NOT NULL, old_size NUMERIC DEFAULT 0,
  new_size NUMERIC DEFAULT 0, note TEXT, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.scale_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own scale_events" ON public.scale_events FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start TEXT NOT NULL, bias TEXT DEFAULT '', markets JSONB DEFAULT '[]', setups JSONB DEFAULT '[]',
  levels TEXT DEFAULT '', risk TEXT DEFAULT '', goals TEXT DEFAULT '', pair_analyses JSONB DEFAULT '[]',
  news_items JSONB, news_result TEXT, analysis_video_url TEXT, reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.weekly_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own weekly_plans" ON public.weekly_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL, daily_bias TEXT DEFAULT 'Neutral', session_focus TEXT DEFAULT 'London',
  max_trades INTEGER DEFAULT 3, risk_limit TEXT DEFAULT '', pairs JSONB DEFAULT '[]',
  news_items JSONB, took_trades BOOLEAN, result_narrative TEXT, result_chart_image TEXT,
  analysis_video_url TEXT, note TEXT, reviewed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own daily_plans" ON public.daily_plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notebook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL, pair TEXT DEFAULT '', category TEXT DEFAULT '', bias TEXT DEFAULT '',
  key_levels TEXT DEFAULT '', notes TEXT DEFAULT '', image TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.notebook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own notebook_entries" ON public.notebook_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.checklist_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL, items JSONB DEFAULT '{}', score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(), UNIQUE(user_id, date)
);
ALTER TABLE public.checklist_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own checklist_days" ON public.checklist_days FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id TEXT NOT NULL, label TEXT NOT NULL, sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own checklist_items" ON public.checklist_items FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.tool_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL, category TEXT DEFAULT '', description TEXT DEFAULT '', status TEXT DEFAULT '',
  daily_checks JSONB DEFAULT '[]', best_session TEXT DEFAULT '', best_condition TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.tool_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own tool_entries" ON public.tool_entries FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.backtesting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pair TEXT NOT NULL, month TEXT NOT NULL, entries JSONB DEFAULT '[]',
  started_at BIGINT NOT NULL, ended_at BIGINT, created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.backtesting_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own backtesting_sessions" ON public.backtesting_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  custom_setups JSONB DEFAULT '[]', custom_assets JSONB DEFAULT '[]',
  custom_confluences JSONB DEFAULT '[]', markets JSONB DEFAULT '[]',
  sessions JSONB DEFAULT '[]', conditions JSONB DEFAULT '[]', grades_list JSONB DEFAULT '[]',
  management_options JSONB DEFAULT '[]', psych_tags JSONB DEFAULT '[]',
  violations JSONB DEFAULT '[]', notebook_categories JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users crud own user_settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
