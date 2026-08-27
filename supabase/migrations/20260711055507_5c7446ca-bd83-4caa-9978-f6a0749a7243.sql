
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TABLE public.trading_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_checklists TO authenticated;
GRANT ALL ON public.trading_checklists TO service_role;
ALTER TABLE public.trading_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checklist select" ON public.trading_checklists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own checklist insert" ON public.trading_checklists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checklist update" ON public.trading_checklists FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own checklist delete" ON public.trading_checklists FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.trading_checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_checklist_templates TO authenticated;
GRANT ALL ON public.trading_checklist_templates TO service_role;
ALTER TABLE public.trading_checklist_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tmpl select" ON public.trading_checklist_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own tmpl insert" ON public.trading_checklist_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tmpl update" ON public.trading_checklist_templates FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own tmpl delete" ON public.trading_checklist_templates FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_trading_checklists_updated BEFORE UPDATE ON public.trading_checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_trading_checklist_tmpl_updated BEFORE UPDATE ON public.trading_checklist_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.trading_checklists REPLICA IDENTITY FULL;
ALTER TABLE public.trading_checklist_templates REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_checklists;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trading_checklist_templates;
