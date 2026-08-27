/**
 * Page-data adapters for the shared AIInsightsPanel.
 * Each adapter ships a payload to the offline insight engine — both aggregated metrics
 * AND the raw rows the dynamic detectors need (sequence, weekday, mistakes per trade,
 * market location, RR distribution, etc.). Keep < ~50KB.
 */
import type { Trade, WeeklyPlan, DailyPlan } from '@/types/trading';
import { htmlToPlain } from '@/components/shared/RichTextEditor';

const N = (n: number | undefined, d = 2) =>
  typeof n === 'number' && isFinite(n) ? Number(n.toFixed(d)) : null;

const weekdayOf = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
};

export function adaptTrades(trades: Trade[]) {
  const all = trades.filter(t => !t.status || (t.status !== 'Draft' && t.status !== 'Incomplete' && t.status !== 'Needs Review'));
  const recent = all.slice(0, 120);

  // Aggregates (kept for backwards compatibility with old panel)
  const byPair: Record<string, { n: number; wins: number; pnl: number; rrSum: number; rrN: number }> = {};
  const bySession: Record<string, { n: number; wins: number; pnl: number; rrSum: number; rrN: number }> = {};
  const bySetup: Record<string, { n: number; wins: number; pnl: number; rrSum: number; rrN: number }> = {};
  const byWeekday: Record<string, { n: number; wins: number; pnl: number }> = {};
  const byCondition: Record<string, { n: number; wins: number; pnl: number }> = {};
  const byMarket: Record<string, { n: number; wins: number; pnl: number }> = {};
  const byGrade: Record<string, { n: number; wins: number; pnl: number; rrSum: number; rrN: number }> = {};
  const byDirection: Record<string, { n: number; wins: number; pnl: number }> = {};
  let wins = 0, losses = 0, totalPnl = 0, rrSum = 0, rrN = 0;
  const mistakeFreq: Record<string, number> = {};
  const mistakeLossFreq: Record<string, { losses: number; total: number }> = {};
  const rows: Array<{
    id: string; date: string; pair: string; session: string; setup?: string; result: string;
    pnl: number; rr: number | null; weekday: string | null; condition?: string; market?: string;
    direction?: string; grade?: string; mistakes: string[]; emotion?: string;
  }> = [];

  for (const t of recent) {
    if (t.result === 'Win') wins++;
    else if (t.result === 'Loss') losses++;
    totalPnl += t.profitLoss || 0;
    if (typeof t.actualRR === 'number') { rrSum += t.actualRR; rrN++; }
    const bump = (bucket: typeof byPair, key: string) => {
      const b = bucket[key] ||= { n: 0, wins: 0, pnl: 0, rrSum: 0, rrN: 0 };
      b.n++; if (t.result === 'Win') b.wins++; b.pnl += t.profitLoss || 0;
      if (typeof t.actualRR === 'number') { b.rrSum += t.actualRR; b.rrN++; }
    };
    bump(byPair, t.asset);
    bump(bySession, String(t.session));
    if (t.setup) bump(bySetup, t.setup);
    if (t.grade) bump(byGrade, t.grade);
    const wd = weekdayOf(t.date);
    if (wd) {
      const b = byWeekday[wd] ||= { n: 0, wins: 0, pnl: 0 };
      b.n++; if (t.result === 'Win') b.wins++; b.pnl += t.profitLoss || 0;
    }
    if (t.marketCondition) {
      const b = byCondition[t.marketCondition] ||= { n: 0, wins: 0, pnl: 0 };
      b.n++; if (t.result === 'Win') b.wins++; b.pnl += t.profitLoss || 0;
    }
    if (t.market) {
      const b = byMarket[String(t.market)] ||= { n: 0, wins: 0, pnl: 0 };
      b.n++; if (t.result === 'Win') b.wins++; b.pnl += t.profitLoss || 0;
    }
    if (t.direction) {
      const b = byDirection[t.direction] ||= { n: 0, wins: 0, pnl: 0 };
      b.n++; if (t.result === 'Win') b.wins++; b.pnl += t.profitLoss || 0;
    }
    if (Array.isArray(t.mistakes)) {
      for (const m of t.mistakes) {
        mistakeFreq[m] = (mistakeFreq[m] || 0) + 1;
        const r = mistakeLossFreq[m] ||= { losses: 0, total: 0 };
        r.total++; if (t.result === 'Loss') r.losses++;
      }
    }
    rows.push({
      id: t.id, date: t.date, pair: t.asset, session: String(t.session),
      setup: t.setup, result: String(t.result), pnl: t.profitLoss || 0,
      rr: typeof t.actualRR === 'number' ? t.actualRR : null,
      weekday: wd, condition: t.marketCondition, market: t.market as any,
      direction: t.direction, grade: t.grade,
      mistakes: Array.isArray(t.mistakes) ? t.mistakes : [],
      emotion: (t as any).psychology?.emotion,
    });
  }

  const toArr = (b: typeof byPair, label: string) =>
    Object.entries(b).map(([k, v]) => ({
      [label]: k, trades: v.n, wins: v.wins,
      win_rate: v.n ? N((v.wins / v.n) * 100, 1) : null,
      pnl: N(v.pnl), avg_rr: v.rrN ? N(v.rrSum / v.rrN) : null,
    }));

  return {
    total_trades: recent.length,
    wins, losses,
    win_rate_pct: wins + losses ? N((wins / (wins + losses)) * 100, 1) : null,
    total_pnl: N(totalPnl),
    avg_rr: rrN ? N(rrSum / rrN) : null,
    by_pair: toArr(byPair, 'pair'),
    by_session: toArr(bySession, 'session'),
    top_setups: toArr(bySetup, 'setup').sort((a, b) => (b.trades || 0) - (a.trades || 0)).slice(0, 12),
    by_weekday: Object.entries(byWeekday).map(([k, v]) => ({ weekday: k, trades: v.n, win_rate: N((v.wins / v.n) * 100, 1), pnl: N(v.pnl) })),
    by_condition: Object.entries(byCondition).map(([k, v]) => ({ condition: k, trades: v.n, win_rate: N((v.wins / v.n) * 100, 1), pnl: N(v.pnl) })),
    by_market: Object.entries(byMarket).map(([k, v]) => ({ market: k, trades: v.n, win_rate: N((v.wins / v.n) * 100, 1), pnl: N(v.pnl) })),
    by_grade: toArr(byGrade, 'grade'),
    by_direction: Object.entries(byDirection).map(([k, v]) => ({ direction: k, trades: v.n, win_rate: N((v.wins / v.n) * 100, 1), pnl: N(v.pnl) })),
    mistake_freq: Object.entries(mistakeFreq).map(([mistake, count]) => ({ mistake, count })),
    mistake_loss_rate: Object.entries(mistakeLossFreq).map(([mistake, v]) => ({ mistake, total: v.total, losses: v.losses, loss_rate: N((v.losses / v.total) * 100, 0) })),
    recent_mistakes: recent.slice(0, 20).flatMap(t => Array.isArray(t.mistakes) ? t.mistakes : []).slice(0, 20),
    // Raw rows for sequence-aware detectors (revenge trading, streaks, clustering)
    rows,
  };
}

export function adaptWeeklyPlan(plan: WeeklyPlan | null) {
  if (!plan) return { empty: true };
  return {
    week_start: plan.weekStart,
    bias: plan.bias,
    goals: (plan.goals || '').slice(0, 400),
    risk: (plan.risk || '').slice(0, 200),
    levels: (plan.levels || '').slice(0, 400),
    pairs: (plan.pairAnalyses || []).map(p => ({
      pair: p.pair, predicted: p.bias, actual: p.actualBias || null,
      narrative: htmlToPlain(p.narrative || '').slice(0, 200),
    })),
    observation_text: htmlToPlain(plan.observation?.text || '').slice(0, 600),
    calendar_result_text: htmlToPlain(plan.calendarResult?.text || '').slice(0, 600),
  };
}

export function adaptDailyPlan(plan: DailyPlan | null, dayTrades: Trade[]) {
  if (!plan) return { empty: true };
  return {
    date: plan.date,
    daily_bias: plan.dailyBias,
    session_focus: plan.sessionFocus,
    max_trades: plan.maxTrades,
    risk_limit: plan.riskLimit,
    took_trades: plan.tookTrades ?? null,
    pairs: (plan.pairs || []).map(p => ({
      pair: p.pair, predicted: p.bias, actual: p.actualBias || null,
      narrative: htmlToPlain(p.narrative || '').slice(0, 200),
      condition: p.marketCondition,
      location_daily: p.marketLocationDaily,
      location_4h: p.marketLocation4H,
      location_1h: p.marketLocation1H,
      has_daily_chart: !!p.dailyViewImage,
      has_4h_chart: !!p.fourHViewImage,
    })),
    day_summary: htmlToPlain(plan.daySummary?.text || plan.resultNarrative || '').slice(0, 500),
    notes: htmlToPlain(plan.notesJournal?.text || plan.note || '').slice(0, 500),
    actual_trades: dayTrades.slice(0, 20).map(t => ({
      pair: t.asset, dir: t.direction, result: t.result, pnl: N(t.profitLoss), rr: N(t.actualRR),
      session: String(t.session), condition: t.marketCondition,
    })),
  };
}

export function adaptNotebook(entries: Array<{ category?: string; pair?: string; date?: string; title?: string; content?: string }>) {
  return {
    total_entries: entries.length,
    categories: Object.entries(
      entries.reduce<Record<string, number>>((a, e) => { const k = e.category || 'Uncategorized'; a[k] = (a[k] || 0) + 1; return a; }, {})
    ).map(([category, count]) => ({ category, count })),
    pairs: Object.entries(
      entries.reduce<Record<string, number>>((a, e) => { if (!e.pair) return a; a[e.pair] = (a[e.pair] || 0) + 1; return a; }, {})
    ).map(([pair, count]) => ({ pair, count })),
    recent: entries.slice(0, 30).map(e => ({
      title: (e.title || '').slice(0, 80),
      category: e.category, pair: e.pair, date: e.date,
      excerpt: (e.content || '').slice(0, 200),
    })),
    // Raw entries (lightweight) so the detector can look for stale topics, repeats, gaps
    entries: entries.slice(0, 200).map(e => ({
      category: e.category, pair: e.pair, date: e.date,
      title: (e.title || '').slice(0, 80),
    })),
  };
}

export function adaptPsychology(trades: Trade[]) {
  const valid = trades.filter(t => !t.status || (t.status !== 'Draft' && t.status !== 'Incomplete' && t.status !== 'Needs Review'));
  const emotions: Record<string, number> = {};
  const mistakes: Record<string, number> = {};
  const rows: Array<{ date: string; result: string; pnl: number; emotion?: string; mistakes: string[]; session: string; condition?: string; rr: number | null }> = [];
  for (const t of valid.slice(0, 120)) {
    const psy: any = (t as any).psychology;
    if (psy?.emotion) emotions[psy.emotion] = (emotions[psy.emotion] || 0) + 1;
    if (Array.isArray(t.mistakes)) for (const m of t.mistakes) mistakes[m] = (mistakes[m] || 0) + 1;
    rows.push({
      date: t.date, result: String(t.result), pnl: t.profitLoss || 0,
      emotion: psy?.emotion, mistakes: Array.isArray(t.mistakes) ? t.mistakes : [],
      session: String(t.session), condition: t.marketCondition,
      rr: typeof t.actualRR === 'number' ? t.actualRR : null,
    });
  }
  return {
    sample_size: Math.min(valid.length, 120),
    emotion_distribution: Object.entries(emotions).map(([k, v]) => ({ emotion: k, count: v })),
    mistake_distribution: Object.entries(mistakes).map(([k, v]) => ({ mistake: k, count: v })),
    rows,
  };
}
