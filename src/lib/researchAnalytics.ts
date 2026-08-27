import { ResearchTest, Strategy, ResearchMarketCondition } from '@/types/research';

export interface ConditionStat { key: ResearchMarketCondition; wins: number; losses: number; total: number; winRate: number }

export function conditionStats(tests: ResearchTest[]): ConditionStat[] {
  const keys: ResearchMarketCondition[] = ['Trending', 'Volatile', 'Sideways'];
  return keys.map((key) => {
    const subset = tests.filter((t) => t.marketCondition === key && (t.result === 'Win' || t.result === 'Loss'));
    const wins = subset.filter((t) => t.result === 'Win').length;
    const losses = subset.filter((t) => t.result === 'Loss').length;
    const total = wins + losses;
    return { key, wins, losses, total, winRate: total ? (wins / total) * 100 : 0 };
  });
}


export interface StrategyKPIs {
  totalTests: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;        // 0-100
  avgRR: number;
  biasAccuracy: number;   // 0-100
  bestSession: string;
  bestPair: string;
  aGradePct: number;
  validationScore: number; // 0-100 composite
}

function pct(n: number, d: number) { return d > 0 ? (n / d) * 100 : 0; }

export function computeKPIs(tests: ResearchTest[]): StrategyKPIs {
  const decisive = tests.filter((t) => t.result === 'Win' || t.result === 'Loss');
  const wins = tests.filter((t) => t.result === 'Win').length;
  const losses = tests.filter((t) => t.result === 'Loss').length;
  const scratches = tests.filter((t) => t.result === 'Scratch').length;
  const winRate = pct(wins, decisive.length);

  const rrVals = tests.map((t) => parseFloat(t.rAchieved)).filter((v) => !Number.isNaN(v));
  const avgRR = rrVals.length ? rrVals.reduce((a, b) => a + b, 0) / rrVals.length : 0;

  const biasJudged = tests.filter((t) => t.predictedBias && t.actualBias);
  const biasHits = biasJudged.filter((t) => t.predictedBias === t.actualBias).length;
  const biasAccuracy = pct(biasHits, biasJudged.length);

  const bySession = winRateByKey(tests, (t) => t.session || '');
  const byPair = winRateByKey(tests, (t) => t.pair || '');
  const bestSession = topKey(bySession);
  const bestPair = topKey(byPair);

  const graded = tests.filter((t) => t.grade);
  const aGradePct = pct(graded.filter((t) => t.grade === 'A').length, graded.length);

  // Composite: 40% winrate + 30% bias accuracy + 20% A-grade + 10% sample size scaling
  const sampleFactor = Math.min(1, tests.length / 30) * 100;
  const validationScore = Math.round(
    winRate * 0.4 + biasAccuracy * 0.3 + aGradePct * 0.2 + sampleFactor * 0.1,
  );

  return {
    totalTests: tests.length,
    wins,
    losses,
    scratches,
    winRate,
    avgRR,
    biasAccuracy,
    bestSession,
    bestPair,
    aGradePct,
    validationScore,
  };
}

export interface BucketStat { key: string; wins: number; losses: number; total: number; winRate: number }

export function winRateByKey(tests: ResearchTest[], keyFn: (t: ResearchTest) => string): BucketStat[] {
  const map = new Map<string, { wins: number; losses: number; total: number }>();
  tests.forEach((t) => {
    const k = keyFn(t);
    if (!k) return;
    const cur = map.get(k) || { wins: 0, losses: 0, total: 0 };
    if (t.result === 'Win') cur.wins += 1;
    if (t.result === 'Loss') cur.losses += 1;
    if (t.result === 'Win' || t.result === 'Loss') cur.total += 1;
    map.set(k, cur);
  });
  return Array.from(map.entries()).map(([key, v]) => ({
    key, ...v, winRate: v.total ? (v.wins / v.total) * 100 : 0,
  }));
}

function topKey(stats: BucketStat[]): string {
  const sig = stats.filter((s) => s.total >= 2);
  if (!sig.length) return '—';
  return sig.sort((a, b) => b.winRate - a.winRate)[0].key;
}

export function gradeDistribution(tests: ResearchTest[]) {
  const g = { A: 0, B: 0, C: 0 };
  tests.forEach((t) => { if (t.grade) g[t.grade] += 1; });
  return [
    { key: 'A', count: g.A },
    { key: 'B', count: g.B },
    { key: 'C', count: g.C },
  ];
}

export function emotionDistribution(tests: ResearchTest[]) {
  const map = new Map<string, number>();
  tests.forEach((t) => { if (t.emotionalState) map.set(t.emotionalState, (map.get(t.emotionalState) || 0) + 1); });
  return Array.from(map.entries()).map(([key, count]) => ({ key, count }));
}

export function biasAccuracySplit(tests: ResearchTest[]) {
  const judged = tests.filter((t) => t.predictedBias && t.actualBias);
  const hits = judged.filter((t) => t.predictedBias === t.actualBias).length;
  return [
    { key: 'Correct', count: hits },
    { key: 'Wrong', count: judged.length - hits },
  ];
}

export function summarizeStrategy(s: Strategy): StrategyKPIs {
  return computeKPIs(s.tests);
}
