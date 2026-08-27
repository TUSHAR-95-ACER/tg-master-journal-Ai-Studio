export type Market = 'Forex' | 'Crypto' | 'Commodities' | 'Indices' | 'Stocks' | 'Futures';

export type Session = 'Asia' | 'London' | 'New York' | 'New York Kill Zone' | 'London Close';

export type MarketCondition = 'Trending' | 'Ranging' | 'Volatile';

export type TradeDirection = 'Long' | 'Short';

export type TradeResult = 'Win' | 'Loss' | 'Breakeven' | 'Untriggered Setup' | 'Cancelled';

export type OrderType = 'Market Order' | 'Limit Order';
export const ORDER_TYPES: OrderType[] = ['Market Order', 'Limit Order'];

export type AccountType = 'Personal' | 'Prop Firm' | 'Funded' | 'Demo';

export type PropFirmStage = 'Phase 1' | 'Phase 2' | 'Phase 3' | 'Funded' | 'Scale Up';

export type AccountStatus = 'Evaluation' | 'Funded' | 'Active' | 'Disabled';

export type TradeGrade = 'A+' | 'A' | 'B' | 'C';

export type TradeStatus = 'Complete' | 'Draft' | 'Incomplete' | 'Needs Review';
export const TRADE_STATUSES: TradeStatus[] = ['Complete', 'Draft', 'Incomplete', 'Needs Review'];

export type TradeManagement =
  | 'Moved SL to Breakeven'
  | 'Partial TP'
  | 'Trailing Stop'
  | 'Closed Early'
  | 'Held Full Position'
  | 'Scaled In'
  | 'Scaled Out';

export type Confluence =
  | 'Order Block'
  | 'BOS'
  | 'CHoCH'
  | 'FVG'
  | 'Liquidity Sweep'
  | 'SMT'
  | 'Support/Resistance'
  | 'EQH'
  | 'EQL';

export type Emotion = 'Confident' | 'Fearful' | 'Greedy' | 'Neutral' | 'Anxious' | 'Calm';

export type Mistake = 'FOMO' | 'Early Entry' | 'Overtrading' | 'Emotional' | 'Ignored SL';

export type PairReason = 'Liquidity Sweep' | 'Order Block' | 'Fair Value Gap' | 'SMT Divergence' | 'Trend Continuation' | 'Volume Candle';

export const PAIR_REASONS: PairReason[] = ['Liquidity Sweep', 'Order Block', 'Fair Value Gap', 'SMT Divergence', 'Trend Continuation', 'Volume Candle'];

export interface TradingAccount {
  id: string;
  name: string;
  broker: string;
  type: AccountType;
  startingBalance: number;
  currentSize: number; // tracks current account size (updated on scale-ups)
  initialSize: number; // original starting size, never changes
  currency: string;
  stage?: PropFirmStage;
  targetBalance?: number;
  createdAt: string;
  status?: AccountStatus;
  phase1Target?: number;
  phase2Target?: number;
  phase3Target?: number;
  phase1TargetPercent?: number;  // e.g. 8 means 8%
  phase2TargetPercent?: number;
  phase3TargetPercent?: number;
  maxDrawdownLimit?: number;
  dailyDrawdownLimit?: number;
  targetPercent?: number;       // e.g. 10 means 10%
  dailyDrawdownPercent?: number; // e.g. 5 means 5%
  maxDrawdownPercent?: number;   // e.g. 10 means 10%
  steps?: 1 | 2 | 3;           // number of evaluation steps
  payouts?: Payout[];
}

export interface Payout {
  id: string;
  date: string;
  amount: number;
  note?: string;
}

export interface AccountAllocation {
  accountId: string;
  riskPercent: number;
}

export interface Trade {
  id: string;
  date: string;
  entryTime?: string;
  exitTime?: string;
  market: Market;
  asset: string;
  direction: TradeDirection;
  orderType?: OrderType;
  session: Session;
  marketCondition: MarketCondition;
  setup: string;
  quantity: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice?: number;
  result: TradeResult;
  plannedRR: number;
  actualRR?: number;
  maxRRReached?: number;
  maxAdverseMove?: number;
  pips?: number;
  profitLoss: number;
  fees?: number;
  notes: string;
  accounts: AccountAllocation[];
  management: TradeManagement[];
  confluences: string[];
  entryConfluences?: string[];
  targetConfluences?: string[];
  chartLink?: string;
  predictionImage?: string;
  executionImage?: string;
  psychology?: TradePsychology;
  mistakes: Mistake[];
  grade?: TradeGrade;
  timeframe?: string;
  trend?: string;
  /** @deprecated Trade Journey feature removed. Field retained only for legacy data hydration. */
  tradeJourney?: TradeJourneyStep[];
  dayTags?: string[];
  curve?: 'Right' | 'Left' | 'Centre';
  /** Notion-style trade thesis block (text + media). Replaces Technical Points UI. */
  tradeAnalysis?: { text: string; media: Array<{ id: string; type: 'image' | 'video'; url: string; path?: string; name?: string; legacy?: boolean }> };
  /** Crowd sentiment for the trade's pair: long % 0-100 (short % = 100 - this). */
  marketSentiment?: number;
  /** Lifecycle status. Drafts/incomplete trades are excluded from analytics. */
  status?: TradeStatus;
}

export interface TradeJourneyStep {
  id: string;
  type: string;
  time: string;
  note?: string;
  image?: string;
}

export const JOURNEY_EVENT_TYPES = [
  'SL moved to BE',
  'Partial Close',
  'Trailing SL',
  'TP Hit',
  'SL Hit',
  'Manual Exit',
  'Custom Event',
] as const;

export type TradeReviewAnswer = 'yes' | 'no' | 'partial';

export interface TradePsychology {
  emotion: Emotion;
  focus: number;
  discipline: number;
  checklist: {
    followPlan: boolean;
    noFomo: boolean;
    noRevenge: boolean;
    waitedConfirmation: boolean;
    riskRespected: boolean;
  };
  /**
   * Post-trade reflection answers keyed by question id. Optional — used for
   * AI coaching + journal review. Does not participate in analytics/grading.
   */
  reviewAnswers?: Record<string, TradeReviewAnswer>;
}

export interface Transaction {
  id: string;
  date: string;
  accountId: string;
  type: 'Deposit' | 'Withdrawal';
  amount: number;
  note: string;
}

export interface ScaleEvent {
  id: string;
  accountId: string;
  date: string;
  oldSize: number;
  newSize: number;
  note?: string;
}

// News item for plans
export interface NewsItem {
  id: string;
  date: string;
  event: string;
  currency: string;
  impact: 'High' | 'Medium' | 'Low';
  notes?: string;
  image?: string;
}

// Rich journal value (for Notion-style blocks)
export interface RichJournalDoc {
  text: string;
  media: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    path?: string;
    name?: string;
    legacy?: boolean;
  }>;
}

// Weekly Plan with multi-pair analysis
export interface PairAnalysis {
  id: string;
  pair: string;
  bias: 'Bullish' | 'Bearish' | 'Sideways' | 'Neutral';
  actualBias?: 'Bullish' | 'Bearish' | 'Sideways' | 'Neutral' | '';
  setupFocus: string;
  reasons: PairReason[];
  keyLevels: string;
  chartImage?: string;
  narrative?: string;
  /** Notion-style chart analysis block (text + media uploads) */
  analysisJournal?: RichJournalDoc;
  expectedDirection: 'Buy' | 'Sell';
  resultChartImage?: string;
  resultNarrative?: string;
  actualDirection?: 'Bullish' | 'Bearish' | 'Sideways' | 'Neutral' | '';
  actualResult?: 'Win' | 'Loss' | 'Untriggered Setup' | '';
  note?: string;
}

export interface WeeklyPlan {
  id: string;
  weekStart: string;
  bias: string;
  markets: string[];
  setups: string[];
  levels: string;
  risk: string;
  goals: string;
  pairAnalyses: PairAnalysis[];
  newsItems?: NewsItem[];
  newsResult?: string;
  analysisVideoUrl?: string;
  reviewed?: boolean;
  /** Notion-style observation block */
  observation?: RichJournalDoc;
  /** Notion-style calendar/news result block */
  calendarResult?: RichJournalDoc;
  /** Persisted Storage path for analysis video (in addition to URL) */
  analysisVideoPath?: string;
  /** Server-tracked optimistic concurrency revision. Echoed back unchanged on save. */
  revision?: number;
  /** Server-tracked last update timestamp. Display-only. */
  updatedAt?: string;
}

// Daily Plan
export type DailyPairMarketCondition = 'Trending' | 'Volatile' | 'Sideways';

export interface DailyPairPlan {
  id: string;
  pair: string;
  bias: 'Bullish' | 'Bearish' | 'Sideways' | 'Neutral';
  actualBias?: 'Bullish' | 'Bearish' | 'Sideways' | 'Neutral' | '';
  setup: string;
  reasons: PairReason[];
  keyLevels: string;
  chartImage?: string;
  /** Additional Daily timeframe chart shown under Prediction Notes. */
  dailyViewImage?: string;
  narrative?: string;
  /** Notion-style prediction analysis block */
  analysisJournal?: RichJournalDoc;
  resultChartImage?: string;
  /** Additional 4H timeframe chart shown under Result Notes. */
  fourHViewImage?: string;
  resultNarrative?: string;
  note?: string;
  /** Crowd sentiment slider: long % 0-100 (short % = 100 - this). */
  marketSentiment?: number;
  /** Predicted market condition for the day (used by analytics). */
  marketCondition?: DailyPairMarketCondition;
  /** Market location (Premium / Discount / EQ) per timeframe — schemaVersion >= 2 only. */
  marketLocationDaily?: MarketLocation;
  marketLocation4H?: MarketLocation;
  marketLocation1H?: MarketLocation;
}

export type MarketLocation = 'Premium' | 'Discount' | 'EQ';
export const MARKET_LOCATIONS: MarketLocation[] = ['Premium', 'Discount', 'EQ'];

export interface DailyPlan {
  id: string;
  date: string;
  dailyBias: 'Bullish' | 'Bearish' | 'Sideways' | 'Neutral';
  sessionFocus: string;
  maxTrades: number;
  riskLimit: string;
  pairs: DailyPairPlan[];
  newsItems?: NewsItem[];
  tookTrades?: boolean;
  resultNarrative?: string;
  resultChartImage?: string;
  analysisVideoUrl?: string;
  note?: string;
  reviewed?: boolean;
  daySummary?: RichJournalDoc;
  notesJournal?: RichJournalDoc;
  analysisVideoPath?: string;
  reviewVideo?: DailyReviewVideo | null;
  /** Schema version. >=2 enables Daily/4H reference charts and Market Location selector. Absent/1 = legacy plan. */
  schemaVersion?: number;
  /** Server-tracked optimistic concurrency revision. Echoed back unchanged on save. */
  revision?: number;
  /** Server-tracked last update timestamp. Display-only. */
  updatedAt?: string;
}

export interface DailyReviewVideo {
  video_url: string;
  video_title?: string;
  provider: 'google_drive';
  added_at: string;
  file_id?: string;
}


export const TRADE_GRADES: TradeGrade[] = ['A+', 'A', 'B', 'C'];

export const FOREX_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDCAD',
];

export const METALS = ['XAUUSD', 'XAGUSD'];

export const CRYPTO_PAIRS = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'BNBUSD'];

export const INDICES = ['US30', 'NAS100', 'SPX500', 'UK100', 'GER40'];

export const ANALYSIS_ONLY_ASSETS = ['DXY'];

export const ALL_ASSETS = [...FOREX_PAIRS, ...METALS, ...CRYPTO_PAIRS, ...INDICES, ...ANALYSIS_ONLY_ASSETS];

export const DEFAULT_PLAN_PAIRS = ['EURUSD', 'GBPUSD', 'XAUUSD'];

export const MARKET_ASSETS: Record<Market, string[]> = {
  Forex: FOREX_PAIRS,
  Crypto: CRYPTO_PAIRS,
  Commodities: METALS,
  Indices: INDICES,
  Stocks: [],
  Futures: [],
};

export const SETUPS = [
  'Breakout', 'Pullback', 'No Bos', 'Volume Candle',
];

export const CONFLUENCE_OPTIONS = [
  'Order Block',
  'BOS',
  'CHoCH',
  'FVG',
  'Liquidity Sweep',
  'SMT',
  'Support/Resistance',
  'EQH',
  'EQL',
] as const;
