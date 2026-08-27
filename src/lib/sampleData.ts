import { Trade, TradeGrade, WeeklyPlan, DailyPlan, PairAnalysis, DailyPairPlan } from '@/types/trading';
import { calcProfitLoss, calcResult } from './calculations';

const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'AUDUSD', 'GBPJPY', 'BTCUSD', 'NAS100', 'US30', 'ETHUSD'];
const sessions = ['Asia', 'London', 'New York', 'New York Kill Zone', 'London Close'] as const;
const conditions = ['Trending', 'Ranging', 'Volatile'] as const;
const setups = ['Breakout', 'Pullback', 'No Bos', 'Volume Candle'] as const;
const allConfluences = ['Order Block', 'BOS', 'CHoCH', 'FVG', 'Liquidity Sweep', 'SMT', 'Support/Resistance'] as const;
const mgmt = ['Moved SL to Breakeven', 'Partial TP', 'Trailing Stop', 'Closed Early', 'Held Full Position', 'Scaled In', 'Scaled Out'] as const;
const emotionsList = ['Confident', 'Fearful', 'Greedy', 'Neutral', 'Anxious', 'Calm'] as const;
const mistakesList = ['FOMO', 'Early Entry', 'Overtrading', 'Emotional', 'Ignored SL'] as const;
const grades: TradeGrade[] = ['A+', 'A', 'B', 'C'];

const marketForPair: Record<string, Trade['market']> = {
  EURUSD: 'Forex', GBPUSD: 'Forex', USDJPY: 'Forex', AUDUSD: 'Forex', GBPJPY: 'Forex',
  XAUUSD: 'Commodities', BTCUSD: 'Crypto', ETHUSD: 'Crypto', NAS100: 'Indices', US30: 'Indices',
};

const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
const pickN = <T,>(arr: readonly T[], max: number): T[] => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.floor(Math.random() * max) + 1);
};

const notes = [
  'Clean setup, good execution', 'Followed the plan perfectly', 'Market was choppy today',
  'Entered on confirmation candle', 'Waited for liquidity sweep before entry',
  'Price reacted from OB as expected', 'Took profit too early', 'Held through pullback nicely',
  'Should have waited for NY session', 'Good patience on this one',
];

type TradeKind = 'normal' | 'missed' | 'cancelled';

function genTrade(dateStr: string, index: number, kind: TradeKind): Trade {
  const asset = pairs[index % pairs.length];
  const market = marketForPair[asset] || 'Forex';
  const direction = Math.random() > 0.45 ? 'Long' as const : 'Short' as const;

  const isJpy = ['USDJPY', 'GBPJPY'].includes(asset);
  const isGold = asset === 'XAUUSD';
  const isCrypto = ['BTCUSD', 'ETHUSD'].includes(asset);
  const isIndex = ['NAS100', 'US30'].includes(asset);

  let entry: number, sl: number, tp: number, exitPrice: number, quantity: number;

  if (isGold) {
    entry = 2300 + Math.random() * 100;
    const risk = 2 + Math.random() * 5;
    sl = direction === 'Long' ? entry - risk : entry + risk;
    tp = direction === 'Long' ? entry + risk * 2.5 : entry - risk * 2.5;
    quantity = +(0.01 + Math.random() * 0.49).toFixed(2);
    const win = Math.random() < 0.55;
    exitPrice = win
      ? (direction === 'Long' ? entry + risk * (1 + Math.random() * 2) : entry - risk * (1 + Math.random() * 2))
      : (direction === 'Long' ? entry - risk * (0.4 + Math.random() * 0.7) : entry + risk * (0.4 + Math.random() * 0.7));
  } else if (isJpy) {
    entry = 148 + Math.random() * 5;
    const risk = 0.15 + Math.random() * 0.3;
    sl = direction === 'Long' ? entry - risk : entry + risk;
    tp = direction === 'Long' ? entry + risk * 2 : entry - risk * 2;
    quantity = +(0.01 + Math.random() * 0.99).toFixed(2);
    const win = Math.random() < 0.5;
    exitPrice = win
      ? (direction === 'Long' ? entry + risk * (0.5 + Math.random() * 2) : entry - risk * (0.5 + Math.random() * 2))
      : (direction === 'Long' ? entry - risk * (0.3 + Math.random()) : entry + risk * (0.3 + Math.random()));
  } else if (isCrypto) {
    entry = asset === 'BTCUSD' ? 60000 + Math.random() * 10000 : 3000 + Math.random() * 500;
    const risk = asset === 'BTCUSD' ? 200 + Math.random() * 500 : 30 + Math.random() * 80;
    sl = direction === 'Long' ? entry - risk : entry + risk;
    tp = direction === 'Long' ? entry + risk * 2 : entry - risk * 2;
    quantity = asset === 'BTCUSD' ? +(0.001 + Math.random() * 0.05).toFixed(4) : +(0.01 + Math.random() * 1).toFixed(3);
    const win = Math.random() < 0.48;
    exitPrice = win
      ? (direction === 'Long' ? entry + risk * (0.5 + Math.random() * 2) : entry - risk * (0.5 + Math.random() * 2))
      : (direction === 'Long' ? entry - risk * (0.5 + Math.random()) : entry + risk * (0.5 + Math.random()));
  } else if (isIndex) {
    entry = asset === 'NAS100' ? 18000 + Math.random() * 1000 : 38000 + Math.random() * 2000;
    const risk = asset === 'NAS100' ? 30 + Math.random() * 50 : 50 + Math.random() * 100;
    sl = direction === 'Long' ? entry - risk : entry + risk;
    tp = direction === 'Long' ? entry + risk * 2 : entry - risk * 2;
    quantity = +(0.1 + Math.random() * 2).toFixed(2);
    const win = Math.random() < 0.5;
    exitPrice = win
      ? (direction === 'Long' ? entry + risk * (0.5 + Math.random() * 2) : entry - risk * (0.5 + Math.random() * 2))
      : (direction === 'Long' ? entry - risk * (0.3 + Math.random()) : entry + risk * (0.3 + Math.random()));
  } else {
    entry = asset === 'EURUSD' ? 1.08 + Math.random() * 0.02 : 1.25 + Math.random() * 0.03;
    const risk = 0.0010 + Math.random() * 0.0020;
    sl = direction === 'Long' ? entry - risk : entry + risk;
    tp = direction === 'Long' ? entry + risk * (1.5 + Math.random() * 2) : entry - risk * (1.5 + Math.random() * 2);
    quantity = +(0.01 + Math.random() * 0.99).toFixed(2);
    const outcome = Math.random();
    if (outcome < 0.52) exitPrice = direction === 'Long' ? entry + risk * (0.5 + Math.random() * 2.5) : entry - risk * (0.5 + Math.random() * 2.5);
    else if (outcome < 0.88) exitPrice = direction === 'Long' ? entry - risk * (0.3 + Math.random() * 0.8) : entry + risk * (0.3 + Math.random() * 0.8);
    else exitPrice = entry + (Math.random() - 0.5) * risk * 0.3;
  }

  if (kind === 'missed' || kind === 'cancelled') {
    const riskAmt = Math.abs(entry - sl);
    const plannedRR = Math.round((Math.abs(tp - entry) / riskAmt) * 100) / 100;
    return {
      id: crypto.randomUUID(),
      date: dateStr,
      entryTime: `${String(8 + Math.floor(Math.random() * 10)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
      market, asset, direction,
      session: pick(sessions),
      marketCondition: pick(conditions),
      setup: pick(setups),
      quantity,
      entryPrice: Math.round(entry * 100000) / 100000,
      stopLoss: Math.round(sl * 100000) / 100000,
      takeProfit: Math.round(tp * 100000) / 100000,
      result: kind === 'missed' ? 'Untriggered Setup' : 'Cancelled',
      plannedRR,
      profitLoss: 0,
      notes: kind === 'missed' ? 'Missed this setup - was away from desk' : 'Cancelled - conditions changed before entry',
      accounts: [],
      management: [],
      confluences: pickN(allConfluences, 3) as Trade['confluences'],
      psychology: {
        emotion: pick(emotionsList),
        focus: 3,
        discipline: 3,
        checklist: { followPlan: true, noFomo: true, noRevenge: true, waitedConfirmation: true, riskRespected: true },
      },
      mistakes: [],
      grade: pick(grades),
    };
  }

  const riskAmt = Math.abs(entry - sl);
  const plannedRR = Math.round((Math.abs(tp - entry) / riskAmt) * 100) / 100;
  const actualRR = Math.round(((direction === 'Long' ? exitPrice - entry : entry - exitPrice) / riskAmt) * 100) / 100;

  const rawPL = calcProfitLoss(entry, exitPrice, direction, quantity, asset, market);
  const fees = +(Math.random() * 5).toFixed(2);
  const profitLoss = Math.round((rawPL - fees) * 100) / 100;
  const result: Trade['result'] = calcResult(profitLoss);

  const hasMistakes = result === 'Loss' && Math.random() > 0.4;
  const disc = result === 'Win' ? 3 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 4);
  const focus = Math.max(1, Math.min(5, disc + Math.floor(Math.random() * 2) - 1));

  let grade: TradeGrade;
  if (result === 'Win' && actualRR > 2) grade = Math.random() > 0.5 ? 'A+' : 'A';
  else if (result === 'Win') grade = Math.random() > 0.3 ? 'A' : 'B';
  else if (result === 'Breakeven') grade = Math.random() > 0.5 ? 'B' : 'C';
  else grade = Math.random() > 0.6 ? 'B' : 'C';

  return {
    id: crypto.randomUUID(),
    date: dateStr,
    entryTime: `${String(8 + Math.floor(Math.random() * 10)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    exitTime: `${String(10 + Math.floor(Math.random() * 12)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    market, asset, direction,
    session: pick(sessions),
    marketCondition: pick(conditions),
    setup: pick(setups),
    quantity,
    entryPrice: Math.round(entry * 100000) / 100000,
    stopLoss: Math.round(sl * 100000) / 100000,
    takeProfit: Math.round(tp * 100000) / 100000,
    exitPrice: Math.round(exitPrice * 100000) / 100000,
    result, plannedRR, actualRR,
    pips: undefined,
    profitLoss,
    fees,
    notes: pick(notes),
    accounts: [],
    management: pickN(mgmt, 2) as Trade['management'],
    confluences: pickN(allConfluences, 3) as Trade['confluences'],
    psychology: {
      emotion: pick(emotionsList),
      focus: Math.min(5, focus),
      discipline: Math.min(5, disc),
      checklist: {
        followPlan: Math.random() > 0.3,
        noFomo: Math.random() > 0.25,
        noRevenge: Math.random() > 0.2,
        waitedConfirmation: Math.random() > 0.35,
        riskRespected: Math.random() > 0.15,
      },
    },
    mistakes: hasMistakes ? pickN(mistakesList, 2) as Trade['mistakes'] : [],
    grade,
  };
}

function getRandomDate(daysAgo: number): string {
  const now = new Date();
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  if (date.getDay() === 0) date.setDate(date.getDate() - 2);
  if (date.getDay() === 6) date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

export function generateSampleTrades(): Trade[] {
  const trades: Trade[] = [];

  for (let i = 0; i < 30; i++) {
    const daysAgo = Math.floor(Math.random() * 55) + 1;
    trades.push(genTrade(getRandomDate(daysAgo), i, 'normal'));
  }

  for (let i = 0; i < 5; i++) {
    const daysAgo = Math.floor(Math.random() * 40) + 1;
    trades.push(genTrade(getRandomDate(daysAgo), 30 + i, 'missed'));
  }

  for (let i = 0; i < 5; i++) {
    const daysAgo = Math.floor(Math.random() * 40) + 1;
    trades.push(genTrade(getRandomDate(daysAgo), 35 + i, 'cancelled'));
  }

  return trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const biases = ['Bullish', 'Bearish', 'Neutral'] as const;
const samplePairs = ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', 'NAS100'];
const reasonOptions = ['Liquidity Sweep', 'Order Block', 'Fair Value Gap', 'SMT Divergence', 'Volume Candle', 'Trend Continuation'] as const;

function makePairAnalysis(pair: string, withResult: boolean): PairAnalysis {
  const bias = pick(biases);
  const actualBias = withResult ? pick(biases) : '';
  return {
    id: crypto.randomUUID(),
    pair,
    bias,
    setupFocus: '',
    reasons: pickN(reasonOptions, 3) as any,
    keyLevels: `${(1.08 + Math.random() * 0.02).toFixed(5)} - support\n${(1.09 + Math.random() * 0.02).toFixed(5)} - resistance`,
    narrative: `Expecting ${bias.toLowerCase()} move based on structure. Key area of interest near current price.`,
    expectedDirection: bias === 'Bullish' ? 'Buy' : 'Sell',
    actualDirection: actualBias as any,
    actualResult: '',
    note: withResult ? 'Market followed analysis well this week.' : '',
    chartImage: undefined,
    resultChartImage: undefined,
  };
}

export function generateSampleWeeklyPlans(): WeeklyPlan[] {
  const plans: WeeklyPlan[] = [];
  const now = new Date();

  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (w * 7) - weekStart.getDay() + 1);
    const isReviewed = w > 0;

    const pairAnalyses = samplePairs.slice(0, 3 + Math.floor(Math.random() * 2)).map(p => makePairAnalysis(p, isReviewed));

    plans.push({
      id: crypto.randomUUID(),
      weekStart: weekStart.toISOString().split('T')[0],
      bias: '',
      markets: ['EURUSD', 'XAUUSD', 'NAS100'],
      setups: [],
      levels: '',
      risk: 'Max 2% per trade, 5% daily drawdown',
      goals: '',
      pairAnalyses,
      newsItems: [{ id: crypto.randomUUID(), date: weekStart.toISOString().split('T')[0], event: 'FOMC', currency: 'USD', impact: 'High', notes: 'Key rate decision this week. Expect volatility around Wednesday.' }],
      newsResult: isReviewed ? 'FOMC caused expected USD volatility. Market reacted as anticipated.' : '',
      analysisVideoUrl: '',
      reviewed: isReviewed,
    });
  }

  return plans.sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

function makeDailyPairPlan(pair: string): DailyPairPlan {
  return {
    id: crypto.randomUUID(),
    pair,
    bias: pick(biases),
    setup: pick(setups),
    reasons: pickN(reasonOptions, 2) as any,
    keyLevels: `${(1.08 + Math.random() * 0.02).toFixed(5)} - key level`,
    narrative: 'Looking for entry on pullback to OB.',
  };
}

export function generateSampleDailyPlans(): DailyPlan[] {
  const plans: DailyPlan[] = [];
  const now = new Date();

  for (let d = 0; d < 5; d++) {
    const date = new Date(now);
    date.setDate(date.getDate() - d);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    plans.push({
      id: crypto.randomUUID(),
      date: date.toISOString().split('T')[0],
      dailyBias: pick(biases) as any,
      sessionFocus: pick(['London', 'New York', 'New York Kill Zone'] as const),
      maxTrades: 3,
      riskLimit: '2% per trade',
      pairs: samplePairs.slice(0, 2 + Math.floor(Math.random() * 2)).map(p => makeDailyPairPlan(p)),
      newsItems: [],
      tookTrades: d > 0 ? true : undefined,
      resultNarrative: d > 0 ? 'Market followed daily analysis. Good execution day.' : '',
      analysisVideoUrl: '',
      note: '',
    });
  }

  return plans.sort((a, b) => b.date.localeCompare(a.date));
}
