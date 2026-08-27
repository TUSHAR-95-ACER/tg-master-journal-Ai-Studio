import { Trade, Market } from '@/types/trading';

export const calcPips = (entry: number, exit: number, asset: string): number => {
  const diff = Math.abs(exit - entry);
  if (asset === 'XAUUSD') return Math.round(diff / 0.10 * 10) / 10;
  if (asset === 'XAGUSD') return Math.round(diff / 0.01 * 10) / 10;
  if (asset.includes('JPY')) return Math.round(diff * 100 * 10) / 10;
  if (['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD'].includes(asset)) return Math.round(diff * 100) / 100;
  if (['US30', 'NAS100', 'SPX500', 'UK100', 'GER40'].includes(asset)) return Math.round(diff * 10) / 10;
  return Math.round(diff * 10000 * 10) / 10;
};

export const calcPlannedRR = (entry: number, sl: number, tp: number): number => {
  const risk = Math.abs(entry - sl);
  if (risk === 0) return 0;
  return Math.round((Math.abs(tp - entry) / risk) * 100) / 100;
};

export const calcActualRR = (entry: number, sl: number, exit: number, direction: 'Long' | 'Short'): number => {
  const risk = Math.abs(entry - sl);
  if (risk === 0) return 0;
  const reward = direction === 'Long' ? exit - entry : entry - exit;
  return Math.round((reward / risk) * 100) / 100;
};

export const calcResult = (pl: number): 'Win' | 'Loss' | 'Breakeven' => {
  if (pl > 20) return 'Win';
  if (pl < -20) return 'Loss';
  return 'Breakeven';
};

/**
 * Get the contract multiplier for an asset based on its market type.
 * Forex: 1 lot = 100,000 units
 * Crypto: direct (multiplier = 1)
 * Indices: contract multiplier (1 for most)
 * Commodities (Gold/Silver): 100 per lot for XAUUSD, 5000 for XAGUSD
 */
export const getContractMultiplier = (asset: string, market: Market): number => {
  // Forex pairs: 1 lot = 100,000 units
  if (market === 'Forex') return 100000;
  
  // Gold: 1 lot = 100 oz
  if (asset === 'XAUUSD') return 100;
  // Silver: 1 lot = 5000 oz
  if (asset === 'XAGUSD') return 5000;
  
  // Crypto: direct price × quantity
  if (market === 'Crypto') return 1;
  
  // Indices: contract multiplier
  if (['US30', 'NAS100', 'SPX500'].includes(asset)) return 1;
  if (['UK100', 'GER40'].includes(asset)) return 1;
  if (market === 'Indices') return 1;
  
  // Futures
  if (market === 'Futures') return 1;
  
  // Stocks
  if (market === 'Stocks') return 1;
  
  // Default commodities
  if (market === 'Commodities') return 100;
  
  return 1;
};

/**
 * Calculate PnL based on price movement, quantity, and contract multiplier.
 * BUY/Long:  PnL = (Exit - Entry) × Quantity × Multiplier
 * SELL/Short: PnL = (Entry - Exit) × Quantity × Multiplier
 */
export const calcProfitLoss = (entry: number, exit: number, direction: 'Long' | 'Short', quantity: number, asset: string = '', market: Market = 'Forex'): number => {
  const multiplier = getContractMultiplier(asset, market);
  if (direction === 'Long') {
    return Math.round((exit - entry) * quantity * multiplier * 100) / 100;
  }
  return Math.round((entry - exit) * quantity * multiplier * 100) / 100;
};

/** @deprecated Use calcProfitLoss instead */
export const calcPL = (entry: number, exit: number, direction: 'Long' | 'Short', pips: number): number => {
  if (direction === 'Long') return exit > entry ? Math.abs(pips) : -Math.abs(pips);
  return entry > exit ? Math.abs(pips) : -Math.abs(pips);
};

/**
 * Drafts / incomplete / needs-review trades are excluded from every analytics
 * calculation — they don't represent finished decisions yet. Trades with no
 * status (legacy data) are treated as Complete.
 */
const isLive = (t: Trade) => !t.status || t.status === 'Complete';

export const calcWinRate = (trades: Trade[]): number => {
  const valid = trades.filter(t => isLive(t) && t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
  if (valid.length === 0) return 0;
  const wins = valid.filter(t => t.result === 'Win').length;
  return Math.round((wins / valid.length) * 100 * 10) / 10;
};

export const calcProfitFactor = (trades: Trade[]): number => {
  const valid = trades.filter(t => isLive(t) && t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
  const grossProfit = valid.filter(t => t.profitLoss > 0).reduce((s, t) => s + t.profitLoss, 0);
  const grossLoss = Math.abs(valid.filter(t => t.profitLoss < 0).reduce((s, t) => s + t.profitLoss, 0));
  if (grossLoss === 0) return grossProfit > 0 ? Infinity : 0;
  return Math.round((grossProfit / grossLoss) * 100) / 100;
};

export const calcExpectancy = (trades: Trade[]): number => {
  const valid = trades.filter(t => isLive(t) && t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
  if (valid.length === 0) return 0;
  return Math.round((valid.reduce((s, t) => s + t.profitLoss, 0) / valid.length) * 100) / 100;
};

export const calcMaxDrawdown = (trades: Trade[]): number => {
  let peak = 0;
  let maxDD = 0;
  let cumulative = 0;
  const sorted = [...trades].filter(isLive).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (const t of sorted) {
    cumulative += t.profitLoss;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
  }
  return Math.round(maxDD * 100) / 100;
};

export const calcEdgeScore = (winRate: number, avgRR: number, tradeCount: number, maxDD: number): number => {
  // Legacy edge score — kept for backwards compatibility. Falls back to setup score when no drawdown.
  if (maxDD <= 0) return calcSetupScore({ winRate, avgRR, profitFactor: avgRR > 0 ? avgRR : 0, maxDD: 0, tradeCount });
  return Math.round(((winRate / 100) * avgRR * tradeCount) / maxDD * 100) / 100;
};

/**
 * Institutional Setup Score — 0–100 composite.
 *  40% Win Rate · 30% Avg RR (normalized to 3) · 20% Profit Factor (normalized to 3) · 10% Drawdown control.
 * Always returns a meaningful number when at least 1 trade exists — never silently 0.
 */
export const calcSetupScore = ({
  winRate, avgRR, profitFactor, maxDD, tradeCount,
}: { winRate: number; avgRR: number; profitFactor: number; maxDD: number; tradeCount: number }): number => {
  if (tradeCount === 0) return 0;
  const wr = Math.max(0, Math.min(100, winRate)) / 100;                       // 0..1
  const rr = Math.max(0, Math.min(1, (avgRR || 0) / 3));                       // 0..1, cap at RR 3
  const pf = !isFinite(profitFactor) ? 1 : Math.max(0, Math.min(1, profitFactor / 3));
  // Drawdown control: 0 DD = 1.0, scales down as DD grows relative to trade count.
  const ddCtrl = maxDD <= 0 ? 1 : Math.max(0, 1 - Math.min(1, maxDD / (Math.max(1, tradeCount) * 100)));
  const score = (wr * 0.4) + (rr * 0.3) + (pf * 0.2) + (ddCtrl * 0.1);
  return Math.round(score * 100);
};

export const getSetupGrade = (score: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' => {
  if (score >= 88) return 'A+';
  if (score >= 78) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C+';
  if (score >= 40) return 'C';
  return 'D';
};

export const calcAvgRR = (trades: Trade[]): number => {
  const valid = trades.filter(t => isLive(t) && t.actualRR !== undefined && t.result !== 'Untriggered Setup' && t.result !== 'Cancelled');
  if (valid.length === 0) return 0;
  return Math.round((valid.reduce((s, t) => s + (t.actualRR || 0), 0) / valid.length) * 100) / 100;
};

export const formatCurrency = (value: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

export const getDayOfWeek = (dateStr: string): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[new Date(dateStr).getDay()];
};
