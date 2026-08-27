ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS max_rr_reached numeric DEFAULT NULL;
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS max_adverse_move numeric DEFAULT NULL;