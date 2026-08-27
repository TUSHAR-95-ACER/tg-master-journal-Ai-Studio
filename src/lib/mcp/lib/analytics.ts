import { isBreakeven, isExecuted, isLoss, isWin, num, round } from "./client";

export interface TradeRow {
  date?: string;
  asset?: string;
  session?: string;
  setup?: string;
  grade?: string;
  result?: string;
  status?: string;
  profit_loss?: number | string | null;
  actual_rr?: number | string | null;
  planned_rr?: number | string | null;
}

export function computeMetrics(rows: TradeRow[]) {
  const executed = rows.filter(isExecuted);
  const wins = executed.filter((r) => isWin(r.result));
  const losses = executed.filter((r) => isLoss(r.result));
  const breakevens = executed.filter((r) => isBreakeven(r.result));

  const grossProfit = wins.reduce((s, r) => s + Math.max(num(r.profit_loss), 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, r) => s + Math.min(num(r.profit_loss), 0), 0));
  const netPnl = executed.reduce((s, r) => s + num(r.profit_loss), 0);

  const winRate = executed.length ? (wins.length / executed.length) * 100 : 0;
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const rValues = executed
    .map((r) => Number(r.actual_rr))
    .filter((v) => Number.isFinite(v));
  const avgR = rValues.length ? rValues.reduce((a, b) => a + b, 0) / rValues.length : 0;
  const plannedR = executed
    .map((r) => Number(r.planned_rr))
    .filter((v) => Number.isFinite(v));

  return {
    total_trades: rows.length,
    executed_trades: executed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    win_rate_pct: round(winRate),
    net_profit_loss: round(netPnl),
    gross_profit: round(grossProfit),
    gross_loss: round(grossLoss),
    profit_factor: grossLoss > 0 ? round(grossProfit / grossLoss, 3) : grossProfit > 0 ? null : 0,
    expectancy_per_trade: executed.length ? round(netPnl / executed.length) : 0,
    expectancy_r: round((winRate / 100) * (avgLoss ? avgWin / avgLoss : 0) - (1 - winRate / 100), 3),
    average_win: round(avgWin),
    average_loss: round(avgLoss),
    average_actual_r: round(avgR, 3),
    average_planned_r: plannedR.length
      ? round(plannedR.reduce((a, b) => a + b, 0) / plannedR.length, 3)
      : 0,
    best_trade: executed.length ? round(Math.max(...executed.map((r) => num(r.profit_loss)))) : 0,
    worst_trade: executed.length ? round(Math.min(...executed.map((r) => num(r.profit_loss)))) : 0,
  };
}

export function groupPerformance(rows: TradeRow[], key: keyof TradeRow) {
  const buckets = new Map<string, TradeRow[]>();
  for (const row of rows.filter(isExecuted)) {
    const k = String(row[key] ?? "Unspecified");
    buckets.set(k, [...(buckets.get(k) ?? []), row]);
  }
  return [...buckets.entries()]
    .map(([label, group]) => {
      const m = computeMetrics(group);
      return {
        label,
        trades: m.executed_trades,
        win_rate_pct: m.win_rate_pct,
        net_profit_loss: m.net_profit_loss,
        profit_factor: m.profit_factor,
        average_actual_r: m.average_actual_r,
      };
    })
    .sort((a, b) => b.net_profit_loss - a.net_profit_loss);
}

export function monthKey(date?: string) {
  return (date ?? "").slice(0, 7);
}

/** ISO-ish week start (Monday) for a YYYY-MM-DD string. */
export function weekStart(date?: string) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function equityCurve(rows: TradeRow[], startingBalance = 0) {
  let running = startingBalance;
  let peak = startingBalance;
  let maxDrawdown = 0;
  const points = rows
    .filter(isExecuted)
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((r) => {
      running += num(r.profit_loss);
      peak = Math.max(peak, running);
      maxDrawdown = Math.max(maxDrawdown, peak - running);
      return { date: r.date, pnl: round(num(r.profit_loss)), equity: round(running) };
    });
  return { points, ending_equity: round(running), peak_equity: round(peak), max_drawdown: round(maxDrawdown) };
}
