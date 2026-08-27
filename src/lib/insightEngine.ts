/**
 * Offline Insight Engine — dynamic, ranked, page-aware.
 *
 * Replaces the fixed-template panel. Each detector:
 *   - inspects the payload it cares about
 *   - returns 0..N Insight objects with an importance score
 * The engine runs ALL detectors for the page, ranks by importance, and returns the
 * top 5–10. Quality over quantity: detectors only fire when their evidence threshold is met.
 *
 * Pure functions, no AI, no network, no caching.
 */

export interface Insight {
  /** Display string. Lead with an icon emoji where it adds clarity. Keep to 1–2 lines. */
  text: string;
  /** 0–100. Higher = surfaced first. Detectors should score by absolute deviation from baseline. */
  importance: number;
  /** Optional category tag, used only for downstream sorting tie-breakers. */
  tag?: string;
}

type AnyRec = Record<string, any>;
type Detector = (p: AnyRec) => Insight[] | null;

const isArr = (x: any): x is any[] => Array.isArray(x);
const pct = (n: any, d = 0) => (typeof n === 'number' && isFinite(n) ? `${n.toFixed(d)}%` : '—');
const num = (n: any, d = 2) => (typeof n === 'number' && isFinite(n) ? n.toFixed(d) : '—');

// ──────────────────────────────────────────────────────────────────────────────
// Generic helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Return the bucket whose `key` deviates most from the population baseline. */
function deviationTop(
  arr: AnyRec[] | undefined,
  key: string,
  countKey = 'trades',
  minCount = 4,
): { item: AnyRec; baseline: number; delta: number } | null {
  if (!isArr(arr) || arr.length < 2) return null;
  const eligible = arr.filter(x => (x?.[countKey] ?? 0) >= minCount && typeof x?.[key] === 'number');
  if (!eligible.length) return null;
  const total = eligible.reduce((a, x) => a + x[countKey], 0);
  if (!total) return null;
  const baseline = eligible.reduce((a, x) => a + x[key] * x[countKey], 0) / total;
  let best: { item: AnyRec; baseline: number; delta: number } | null = null;
  for (const it of eligible) {
    const d = it[key] - baseline;
    if (!best || Math.abs(d) > Math.abs(best.delta)) best = { item: it, baseline, delta: d };
  }
  return best;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ──────────────────────────────────────────────────────────────────────────────
// TRADE-shaped detectors (Dashboard, Trades, Analytics, TradeQuality, Behavior)
// ──────────────────────────────────────────────────────────────────────────────

const tradeDetectors: Detector[] = [
  // Sample-size guard / headline
  (p) => {
    if (typeof p.total_trades !== 'number' || p.total_trades < 3) return null;
    const wr = p.win_rate_pct;
    if (typeof wr !== 'number') return null;
    if (wr >= 60) return [{ text: `✅ Strong overall edge — ${pct(wr, 0)} win rate across ${p.total_trades} graded trades.`, importance: 60 }];
    if (wr >= 50) return [{ text: `📈 Net-positive win rate at ${pct(wr, 0)} over ${p.total_trades} trades.`, importance: 45 }];
    if (wr < 40 && p.total_trades >= 8) return [{ text: `⚠️ Win rate sits at ${pct(wr, 0)} (${p.total_trades} trades) — quality of entries needs review before scaling size.`, importance: 75 }];
    return null;
  },

  // Expectancy: RR + win-rate combined
  (p) => {
    const wr = p.win_rate_pct, rr = p.avg_rr;
    if (typeof wr !== 'number' || typeof rr !== 'number' || (p.total_trades ?? 0) < 8) return null;
    const exp = (wr / 100) * rr - (1 - wr / 100);
    if (exp >= 0.4) return [{ text: `🔥 Positive expectancy of ${num(exp)}R per trade — RR ${num(rr)} pairs well with your ${pct(wr, 0)} hit rate.`, importance: 70 }];
    if (exp < -0.1) return [{ text: `📉 Expectancy is ${num(exp)}R/trade — either your RR (${num(rr)}) or your hit-rate (${pct(wr, 0)}) needs to move before this is profitable.`, importance: 80 }];
    if (wr >= 55 && rr < 1) return [{ text: `🎯 High ${pct(wr, 0)} hit rate is wasted — average RR is only ${num(rr)}. Winners are being cut early.`, importance: 75 }];
    if (wr < 45 && rr >= 2.5) return [{ text: `🎯 RR ${num(rr)} compensates for a ${pct(wr, 0)} hit rate — protect this asymmetry, don't tighten targets.`, importance: 60 }];
    return null;
  },

  // Pair edge
  (p) => {
    const out: Insight[] = [];
    const best = deviationTop(p.by_pair, 'win_rate');
    if (best && best.delta >= 12) {
      out.push({ text: `📈 ${best.item.pair} is your best pair — ${pct(best.item.win_rate, 0)} vs ${pct(best.baseline, 0)} overall (${best.item.trades} trades).`, importance: 55 + clamp(best.delta, 0, 25) });
    }
    if (best && best.delta <= -15 && best.item.trades >= 5) {
      // also surface a true under-performer
      const arr: AnyRec[] = isArr(p.by_pair) ? p.by_pair : [];
      const worst = arr.filter(x => x.trades >= 5).sort((a, b) => (a.win_rate ?? 100) - (b.win_rate ?? 100))[0];
      if (worst && worst.win_rate <= (best.baseline) - 12) {
        out.push({ text: `⚠️ ${worst.pair} is dragging — ${pct(worst.win_rate, 0)} win rate over ${worst.trades} trades. Consider sizing down or skipping.`, importance: 70 });
      }
    }
    return out.length ? out : null;
  },

  // Session edge
  (p) => {
    const best = deviationTop(p.by_session, 'win_rate');
    if (best && best.delta >= 10 && best.item.trades >= 5) {
      return [{ text: `🕒 Edge concentrates in the ${best.item.session} session (${pct(best.item.win_rate, 0)}, ${best.item.trades} trades) — defend this slot in your schedule.`, importance: 60 + clamp(best.delta, 0, 20) }];
    }
    return null;
  },

  // Setup edge
  (p) => {
    const best = deviationTop(p.top_setups, 'win_rate', 'trades', 4);
    if (best && best.delta >= 12) {
      return [{ text: `🎯 Highest-conviction setup: "${best.item.setup}" — ${pct(best.item.win_rate, 0)} over ${best.item.trades} trades.`, importance: 55 + clamp(best.delta, 0, 20) }];
    }
    return null;
  },

  // Market condition (trending vs volatile vs sideways)
  (p) => {
    const best = deviationTop(p.by_condition, 'win_rate', 'trades', 4);
    if (best && Math.abs(best.delta) >= 12) {
      const verb = best.delta > 0 ? 'thrive' : 'struggle';
      return [{ text: `🌊 You ${verb} in ${best.item.condition} markets — ${pct(best.item.win_rate, 0)} vs ${pct(best.baseline, 0)} elsewhere.`, importance: 55 + clamp(Math.abs(best.delta), 0, 20) }];
    }
    return null;
  },

  // Direction skew
  (p) => {
    const arr: AnyRec[] = isArr(p.by_direction) ? p.by_direction : [];
    if (arr.length < 2) return null;
    const longs = arr.find(x => /long|buy/i.test(x.direction));
    const shorts = arr.find(x => /short|sell/i.test(x.direction));
    if (longs && shorts && longs.trades >= 5 && shorts.trades >= 5) {
      const delta = (longs.win_rate ?? 0) - (shorts.win_rate ?? 0);
      if (Math.abs(delta) >= 18) {
        const side = delta > 0 ? 'long' : 'short';
        const other = delta > 0 ? 'short' : 'long';
        return [{ text: `↔️ Directional bias detected — your ${side}s win ${pct(delta > 0 ? longs.win_rate : shorts.win_rate, 0)} vs ${pct(delta > 0 ? shorts.win_rate : longs.win_rate, 0)} for ${other}s. Audit counter-trend execution.`, importance: 60 }];
      }
    }
    return null;
  },

  // Weekday clustering of losses
  (p) => {
    const arr: AnyRec[] = isArr(p.by_weekday) ? p.by_weekday : [];
    const eligible = arr.filter(x => x.trades >= 3);
    if (!eligible.length) return null;
    const worst = [...eligible].sort((a, b) => (a.win_rate ?? 100) - (b.win_rate ?? 100))[0];
    const best = [...eligible].sort((a, b) => (b.win_rate ?? 0) - (a.win_rate ?? 0))[0];
    if (worst && best && worst.weekday !== best.weekday && (best.win_rate - worst.win_rate) >= 25) {
      return [{
        text: `📅 ${worst.weekday}s are your weakest day (${pct(worst.win_rate, 0)}, ${worst.trades} trades) while ${best.weekday}s deliver ${pct(best.win_rate, 0)} — consider a ${worst.weekday} stand-aside rule.`,
        importance: 65,
      }];
    }
    return null;
  },

  // Market type — Gold vs Forex etc.
  (p) => {
    const best = deviationTop(p.by_market, 'win_rate', 'trades', 4);
    if (best && Math.abs(best.delta) >= 15) {
      const verb = best.delta > 0 ? 'outperforms' : 'underperforms';
      return [{ text: `💰 ${best.item.market} ${verb} significantly — ${pct(best.item.win_rate, 0)} (${best.item.trades} trades) vs ${pct(best.baseline, 0)} portfolio baseline.`, importance: 55 + clamp(Math.abs(best.delta), 0, 20) }];
    }
    return null;
  },

  // Grade reliability
  (p) => {
    const arr: AnyRec[] = isArr(p.by_grade) ? p.by_grade : [];
    const aGrade = arr.find(x => /^A/i.test(x.grade));
    const cGrade = arr.find(x => /^C/i.test(x.grade) || /^D/i.test(x.grade));
    if (aGrade && cGrade && aGrade.trades >= 4 && cGrade.trades >= 4) {
      const delta = (aGrade.win_rate ?? 0) - (cGrade.win_rate ?? 0);
      if (delta >= 15) {
        return [{ text: `🏆 Self-grading is calibrated — A-grade trades win ${pct(aGrade.win_rate, 0)} vs ${pct(cGrade.win_rate, 0)} for low-grade. Trust the filter, skip C/D setups.`, importance: 65 }];
      }
      if (delta <= -10) {
        return [{ text: `⚠️ Self-grading is inverted — your "A" trades win ${pct(aGrade.win_rate, 0)} vs ${pct(cGrade.win_rate, 0)} for C/D. Re-examine what "A" actually means in your checklist.`, importance: 80 }];
      }
    }
    return null;
  },

  // Repeat mistake → loss correlation
  (p) => {
    const arr: AnyRec[] = isArr(p.mistake_loss_rate) ? p.mistake_loss_rate : [];
    const eligible = arr.filter(x => x.total >= 3);
    if (!eligible.length) return null;
    const worst = [...eligible].sort((a, b) => (b.loss_rate ?? 0) - (a.loss_rate ?? 0))[0];
    if (worst && worst.loss_rate >= 70) {
      return [{ text: `💡 "${worst.mistake}" precedes a loss ${pct(worst.loss_rate, 0)} of the time (${worst.losses}/${worst.total}) — make it a hard checklist item.`, importance: 75 }];
    }
    const topRepeat = [...arr].sort((a, b) => b.total - a.total)[0];
    if (topRepeat && topRepeat.total >= 4) {
      return [{ text: `🧠 Most-repeated leak: "${topRepeat.mistake}" (${topRepeat.total}×) — recurring patterns are where compounding wins hide.`, importance: 55 }];
    }
    return null;
  },

  // Streak / cold streak detection from rows
  (p) => {
    const rows: AnyRec[] = isArr(p.rows) ? p.rows : [];
    if (rows.length < 4) return null;
    // rows are newest-first
    let streak = 0; let streakType: 'Win' | 'Loss' | null = null;
    for (const r of rows) {
      if (r.result !== 'Win' && r.result !== 'Loss') break;
      if (streakType === null) { streakType = r.result; streak = 1; continue; }
      if (r.result === streakType) streak++; else break;
    }
    if (streakType === 'Loss' && streak >= 3) {
      return [{ text: `🔻 ${streak}-trade losing streak in progress — historical edge suggests reducing size or stepping back for 24h.`, importance: 90 }];
    }
    if (streakType === 'Win' && streak >= 4) {
      return [{ text: `🚀 ${streak}-trade winning streak — guard against over-confidence sizing. Stick to plan, don't double risk.`, importance: 70 }];
    }
    return null;
  },

  // Revenge trading: loss immediately followed by a same-day trade with higher size / mistake
  (p) => {
    const rows: AnyRec[] = isArr(p.rows) ? p.rows : [];
    if (rows.length < 6) return null;
    let revengeCount = 0;
    // rows newest-first, scan pairs in chronological order
    const chrono = [...rows].reverse();
    for (let i = 1; i < chrono.length; i++) {
      const prev = chrono[i - 1], cur = chrono[i];
      if (prev.result === 'Loss' && cur.date === prev.date) {
        if (cur.result === 'Loss' || (cur.mistakes || []).length > 0) revengeCount++;
      }
    }
    if (revengeCount >= 3) {
      return [{ text: `🛑 ${revengeCount} same-day trades follow a loss with another loss or logged mistake — classic revenge pattern. Force a 30-min cooldown after any loss.`, importance: 85 }];
    }
    return null;
  },

  // PnL flag
  (p) => {
    if (typeof p.total_pnl !== 'number' || (p.total_trades ?? 0) < 5) return null;
    if (p.total_pnl < 0) return [{ text: `📉 Net PnL is negative (${num(p.total_pnl)}) over the last ${p.total_trades} trades — focus on capital preservation before pushing for new highs.`, importance: 60 }];
    if (p.total_pnl > 0) return [{ text: `💵 Net PnL positive at ${num(p.total_pnl)} over the sample — equity curve trending up.`, importance: 35 }];
    return null;
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// PSYCHOLOGY / BEHAVIOR detectors
// ──────────────────────────────────────────────────────────────────────────────

const psychologyDetectors: Detector[] = [
  // Emotion → outcome correlation
  (p) => {
    const rows: AnyRec[] = isArr(p.rows) ? p.rows : [];
    const tagged = rows.filter(r => r.emotion);
    if (tagged.length < 6) return null;
    const byEmo: Record<string, { n: number; wins: number; pnl: number }> = {};
    for (const r of tagged) {
      const b = byEmo[r.emotion] ||= { n: 0, wins: 0, pnl: 0 };
      b.n++; if (r.result === 'Win') b.wins++; b.pnl += r.pnl || 0;
    }
    const eligible = Object.entries(byEmo).filter(([, v]) => v.n >= 3);
    if (eligible.length < 2) return null;
    eligible.sort((a, b) => (b[1].wins / b[1].n) - (a[1].wins / a[1].n));
    const [topEmo, topV] = eligible[0];
    const [worstEmo, worstV] = eligible[eligible.length - 1];
    const out: Insight[] = [];
    if ((topV.wins / topV.n) - (worstV.wins / worstV.n) >= 0.25) {
      out.push({ text: `🧠 "${topEmo}" trades win ${pct((topV.wins / topV.n) * 100, 0)} vs "${worstEmo}" at ${pct((worstV.wins / worstV.n) * 100, 0)} — emotional state is a measurable filter.`, importance: 75 });
    }
    if (worstV.pnl < 0 && /revenge|fear|anger|fomo|tilt/i.test(worstEmo)) {
      out.push({ text: `⚠️ Trades logged under "${worstEmo}" are net-negative (${num(worstV.pnl)}) — treat that emotion as a hard stand-aside trigger.`, importance: 85 });
    }
    return out.length ? out : null;
  },

  // Revenge trading after losses (sequence within session)
  (p) => {
    const rows: AnyRec[] = isArr(p.rows) ? p.rows : [];
    if (rows.length < 6) return null;
    const chrono = [...rows].reverse();
    let revenge = 0;
    for (let i = 1; i < chrono.length; i++) {
      if (chrono[i - 1].result === 'Loss' && chrono[i].date === chrono[i - 1].date && chrono[i].result === 'Loss') revenge++;
    }
    if (revenge >= 3) return [{ text: `🛑 ${revenge} back-to-back same-day losses detected — revenge-trading pattern. A 30-min lockout after any loss would have saved capital.`, importance: 90 }];
    return null;
  },

  // Recurring leaks
  (p) => {
    const dist: AnyRec[] = isArr(p.mistake_distribution) ? p.mistake_distribution : [];
    if (!dist.length) return null;
    const top = [...dist].sort((a, b) => (b.count || 0) - (a.count || 0))[0];
    if (top && top.count >= 3) {
      return [{ text: `🔁 Recurring leak: "${top.mistake}" logged ${top.count}× — repeat patterns are the highest-leverage fix.`, importance: 70 }];
    }
    return null;
  },

  // Patience → RR
  (p) => {
    const rows: AnyRec[] = isArr(p.rows) ? p.rows : [];
    const withRR = rows.filter(r => typeof r.rr === 'number');
    if (withRR.length < 8) return null;
    const calm = withRR.filter(r => /calm|patient|focus|disciplined/i.test(r.emotion || ''));
    const rushed = withRR.filter(r => /fomo|rush|anxi|impuls/i.test(r.emotion || ''));
    if (calm.length >= 3 && rushed.length >= 3) {
      const calmRR = calm.reduce((a, r) => a + (r.rr || 0), 0) / calm.length;
      const rushedRR = rushed.reduce((a, r) => a + (r.rr || 0), 0) / rushed.length;
      if (calmRR - rushedRR >= 0.6) {
        return [{ text: `🎯 Patient trades realize ${num(calmRR)}R on average vs ${num(rushedRR)}R when rushed — patience is the highest-EV input.`, importance: 70 }];
      }
    }
    return null;
  },

  // Session × emotion clustering
  (p) => {
    const rows: AnyRec[] = isArr(p.rows) ? p.rows : [];
    const tagged = rows.filter(r => r.emotion && r.session);
    if (tagged.length < 8) return null;
    const bySession: Record<string, { n: number; bad: number }> = {};
    for (const r of tagged) {
      const b = bySession[r.session] ||= { n: 0, bad: 0 };
      b.n++; if (/fomo|fear|tilt|revenge|anger/i.test(r.emotion || '')) b.bad++;
    }
    const eligible = Object.entries(bySession).filter(([, v]) => v.n >= 4);
    if (!eligible.length) return null;
    const worst = eligible.sort((a, b) => (b[1].bad / b[1].n) - (a[1].bad / a[1].n))[0];
    if (worst && (worst[1].bad / worst[1].n) >= 0.5) {
      return [{ text: `⏰ ${pct((worst[1].bad / worst[1].n) * 100, 0)} of your ${worst[0]} trades are logged under stress emotions — environmental factor worth investigating.`, importance: 65 }];
    }
    return null;
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// NOTEBOOK detectors
// ──────────────────────────────────────────────────────────────────────────────

const notebookDetectors: Detector[] = [
  // Category imbalance
  (p) => {
    const cats: AnyRec[] = isArr(p.categories) ? p.categories : [];
    if (cats.length < 2 || (p.total_entries ?? 0) < 6) return null;
    const total = cats.reduce((a, c) => a + c.count, 0);
    const top = [...cats].sort((a, b) => b.count - a.count)[0];
    if (top && top.count / total >= 0.5) {
      return [{ text: `📚 Your study heavily favors "${top.category}" (${pct((top.count / total) * 100, 0)} of all entries) — the imbalance suggests an unresolved knowledge gap here.`, importance: 65 }];
    }
    return null;
  },

  // Pair focus
  (p) => {
    const pairs: AnyRec[] = isArr(p.pairs) ? p.pairs : [];
    if (pairs.length < 2) return null;
    const total = pairs.reduce((a, c) => a + c.count, 0);
    const top = [...pairs].sort((a, b) => b.count - a.count)[0];
    if (top && total >= 5 && (top.count / total) >= 0.45) {
      return [{ text: `🎯 ${top.count} of ${total} notebook entries focus on ${top.pair} — your research center of gravity.`, importance: 55 }];
    }
    return null;
  },

  // Stale categories — present early, absent recently
  (p) => {
    const entries: AnyRec[] = isArr(p.entries) ? p.entries : [];
    if (entries.length < 10) return null;
    const now = Date.now();
    const stale: Record<string, number> = {};
    for (const e of entries) {
      if (!e.category || !e.date) continue;
      const t = new Date(e.date).getTime();
      if (isNaN(t)) continue;
      const days = (now - t) / (1000 * 60 * 60 * 24);
      stale[e.category] = Math.min(stale[e.category] ?? 9999, days);
    }
    const candidate = Object.entries(stale).filter(([, d]) => d >= 60).sort((a, b) => b[1] - a[1])[0];
    if (candidate) {
      return [{ text: `🕸️ "${candidate[0]}" hasn't been revisited in ${candidate[1].toFixed(0)} days — concepts decay without review.`, importance: 60 }];
    }
    return null;
  },

  // Repeated title/topic (knowledge gap signal)
  (p) => {
    const entries: AnyRec[] = isArr(p.entries) ? p.entries : [];
    if (entries.length < 8) return null;
    const titleCount: Record<string, number> = {};
    for (const e of entries) {
      const key = (e.title || '').toLowerCase().split(/\s+/).slice(0, 3).join(' ');
      if (key.length < 6) continue;
      titleCount[key] = (titleCount[key] || 0) + 1;
    }
    const repeat = Object.entries(titleCount).sort((a, b) => b[1] - a[1])[0];
    if (repeat && repeat[1] >= 3) {
      return [{ text: `💡 You've written about "${repeat[0]}…" ${repeat[1]}× — frequently revisited topics often signal an unresolved concept.`, importance: 55 }];
    }
    return null;
  },

  // Total entries baseline (low-importance)
  (p) => {
    if (typeof p.total_entries !== 'number' || p.total_entries < 1) return null;
    return [{ text: `📖 Notebook holds ${p.total_entries} entries — weekly review keeps lessons compounding.`, importance: 15 }];
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// DAILY PLAN detectors
// ──────────────────────────────────────────────────────────────────────────────

const dailyPlanDetectors: Detector[] = [
  (p) => {
    const pairs: AnyRec[] = isArr(p.pairs) ? p.pairs : [];
    if (!pairs.length) return null;
    const directional = pairs.filter(x => x.predicted === 'Bullish' || x.predicted === 'Bearish');
    const resolved = directional.filter(x => x.actual === 'Bullish' || x.actual === 'Bearish');
    if (!resolved.length) {
      if (directional.length) return [{ text: `📝 Log the actual direction on each pair to grade today's bias.`, importance: 40 }];
      return null;
    }
    const hits = resolved.filter(x => x.actual === x.predicted).length;
    const acc = (hits / resolved.length) * 100;
    if (acc >= 75) return [{ text: `✅ Directional read was on point — ${hits}/${resolved.length} pairs (${pct(acc, 0)}).`, importance: 65 }];
    if (acc <= 40) return [{ text: `⚠️ Directional accuracy was only ${pct(acc, 0)} (${hits}/${resolved.length}) — review what shifted intraday vs your pre-market thesis.`, importance: 70 }];
    return [{ text: `🎯 Mixed bias day — ${hits}/${resolved.length} pairs aligned (${pct(acc, 0)}).`, importance: 45 }];
  },

  // HTF alignment vs accuracy
  (p) => {
    const pairs: AnyRec[] = isArr(p.pairs) ? p.pairs : [];
    const withLoc = pairs.filter(x => x.location_daily && x.location_4h);
    if (withLoc.length < 2) return null;
    const aligned = withLoc.filter(x => x.location_daily === x.location_4h);
    const ratio = aligned.length / withLoc.length;
    if (ratio >= 0.7) {
      return [{ text: `🧭 ${aligned.length}/${withLoc.length} pairs show Daily/4H location alignment — top-down structure is in sync.`, importance: 55 }];
    }
    if (ratio <= 0.3) {
      return [{ text: `⚠️ Only ${aligned.length}/${withLoc.length} pairs align across Daily and 4H location — expect choppy intraday behavior.`, importance: 60 }];
    }
    return null;
  },

  // Reference chart usage
  (p) => {
    const pairs: AnyRec[] = isArr(p.pairs) ? p.pairs : [];
    if (pairs.length < 2) return null;
    const withCharts = pairs.filter(x => x.has_daily_chart || x.has_4h_chart).length;
    if (withCharts === 0 && pairs.length >= 2) {
      return [{ text: `📷 No reference charts attached — Daily/4H snapshots accelerate post-trade pattern recognition.`, importance: 35 }];
    }
    if (withCharts === pairs.length) {
      return [{ text: `📐 Every pair has a reference chart attached — strong prep hygiene.`, importance: 35 }];
    }
    return null;
  },

  // Discipline: trades vs plan
  (p) => {
    const max = p.max_trades, actual = isArr(p.actual_trades) ? p.actual_trades.length : 0;
    if (typeof max !== 'number') return null;
    if (actual > max) return [{ text: `🛑 Took ${actual} trades vs plan of ${max} — over-trading is the most common discipline leak.`, importance: 85 }];
    if (actual <= max && actual > 0) return [{ text: `✅ Stayed within trade cap (${actual}/${max}) — discipline locked in.`, importance: 45 }];
    return null;
  },

  // Today's PnL summary
  (p) => {
    const trades: AnyRec[] = isArr(p.actual_trades) ? p.actual_trades : [];
    if (!trades.length) return null;
    const wins = trades.filter(t => t.result === 'Win').length;
    const pnl = trades.reduce((a, t) => a + (t.pnl ?? 0), 0);
    return [{ text: `${pnl >= 0 ? '💵' : '📉'} Today: ${wins}/${trades.length} wins, net PnL ${num(pnl)}.`, importance: 50 }];
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// WEEKLY PLAN detectors
// ──────────────────────────────────────────────────────────────────────────────

const weeklyPlanDetectors: Detector[] = [
  (p) => {
    const pairs: AnyRec[] = isArr(p.pairs) ? p.pairs : [];
    if (!pairs.length) return null;
    const directional = pairs.filter(x => x.predicted === 'Bullish' || x.predicted === 'Bearish');
    const resolved = directional.filter(x => x.actual === 'Bullish' || x.actual === 'Bearish');
    if (!resolved.length) {
      if (directional.length) return [{ text: `📝 Fill in the actual weekly direction for each pair to score this week's bias.`, importance: 40 }];
      return null;
    }
    const hits = resolved.filter(x => x.actual === x.predicted).length;
    const acc = (hits / resolved.length) * 100;
    if (acc >= 70) return [{ text: `✅ Weekly bias read well — ${hits}/${resolved.length} pairs aligned (${pct(acc, 0)}).`, importance: 65 }];
    if (acc <= 40) return [{ text: `⚠️ Weekly bias was off — ${hits}/${resolved.length} pairs aligned (${pct(acc, 0)}). What macro signal was missed?`, importance: 75 }];
    return [{ text: `🎯 Weekly bias accuracy: ${pct(acc, 0)} (${hits}/${resolved.length}).`, importance: 45 }];
  },

  (p) => {
    const goals = (p.goals || '').trim();
    if (!goals && p.bias) return [{ text: `📝 No weekly goals captured — even one measurable objective sharpens execution.`, importance: 40 }];
    return null;
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// MACRO detectors
// ──────────────────────────────────────────────────────────────────────────────

const macroDetectors: Detector[] = [
  (p) => {
    const out: Insight[] = [];
    if (p.usd_bias) out.push({ text: `💵 Current USD lean: ${p.usd_bias}.`, importance: 50 });
    if (p.gold_bias) out.push({ text: `🥇 Current Gold lean: ${p.gold_bias}.`, importance: 50 });
    if (p.fed_bias) out.push({ text: `🏦 Current Fed lean: ${p.fed_bias}.`, importance: 50 });
    return out.length ? out : null;
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Engine
// ──────────────────────────────────────────────────────────────────────────────

function selectDetectors(page: string, payload: AnyRec): Detector[] {
  const list: Detector[] = [];
  const key = page.toLowerCase();

  if (key.includes('psychology') || key.includes('behavior')) list.push(...psychologyDetectors);
  if (key.includes('notebook')) list.push(...notebookDetectors);
  if (key.includes('daily plan')) list.push(...dailyPlanDetectors);
  if (key.includes('weekly plan') || key.includes('weekly review')) list.push(...weeklyPlanDetectors);
  if (key.includes('macro')) list.push(...macroDetectors);

  // Trade detectors run whenever the payload looks trade-shaped (covers Dashboard, Trades,
  // Analytics, Trade Quality, Behavior overlay).
  if (typeof payload.total_trades === 'number') list.push(...tradeDetectors);

  return list;
}

export function generateInsights(page: string, payload: AnyRec): string[] {
  if (!payload || payload.empty) return ['Add data on this page to surface insights.'];

  const detectors = selectDetectors(page, payload);
  const all: Insight[] = [];
  for (const d of detectors) {
    try {
      const out = d(payload);
      if (out) all.push(...out);
    } catch {
      // detectors are best-effort; never block the panel on a single failure
    }
  }

  if (!all.length) return ['Not enough data yet — log more trades, plans, or notes to surface patterns.'];

  // Rank by importance, dedupe near-duplicates, cap 5–10.
  all.sort((a, b) => b.importance - a.importance);
  const seen = new Set<string>();
  const unique: Insight[] = [];
  for (const i of all) {
    const fp = i.text.replace(/[\d.%]/g, '').slice(0, 40).toLowerCase();
    if (seen.has(fp)) continue;
    seen.add(fp);
    unique.push(i);
    if (unique.length >= 10) break;
  }
  // Aim for 5–10 but never pad — if only 3 strong observations, return 3.
  const cutoff = Math.max(5, Math.min(10, unique.length));
  return unique.slice(0, cutoff).map(i => i.text);
}
