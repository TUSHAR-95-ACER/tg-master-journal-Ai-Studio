ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Complete';

CREATE INDEX IF NOT EXISTS idx_trades_status ON public.trades(user_id, status);