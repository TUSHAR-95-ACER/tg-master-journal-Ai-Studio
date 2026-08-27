export type StrategyStatus = 'Testing' | 'Promising' | 'Validated' | 'Failed' | 'Archived';
export type StrategyType = 'Session Model' | 'Liquidity Model' | 'SMT Model' | 'PO3 Model' | 'Custom';

export type Bias = 'Bullish' | 'Neutral' | 'Bearish' | 'Sideways';
export type DealingRange = 'Premium' | 'Discount' | 'EQ';
export type LiquidityTarget = 'BSL Above' | 'SSL Below' | 'Both' | 'None';
export type BreakoutQuality = 'Strong Displacement' | 'Weak / No Displacement';
export type FVGLocation = 'High' | '50%' | 'Low';
export type EntryType = 'DR High' | 'DR Low' | 'Midpoint' | 'FVG' | 'S/D Zone' | 'Supply/Demand';
export type LTFConfirmation = 'Bullish MSS' | 'Bearish MSS' | 'Wick Rejection' | 'Displacement Off Zone';
export type DRLevel = 'High' | 'EQ' | 'Low';
export type TestResult = 'Win' | 'Loss' | 'Scratch';
export type ProcessGrade = 'A' | 'B' | 'C';
export type EmotionalState = 'Process' | 'Flow' | 'Foggy' | 'Revenge';
export type ResearchMarketCondition = 'Trending' | 'Volatile' | 'Sideways';
export const RESEARCH_MARKET_CONDITIONS: ResearchMarketCondition[] = ['Trending', 'Volatile', 'Sideways'];

export const SESSIONS = [
  'Asia',
  'London',
  'New York',
  'London Killzone',
  'New York Killzone',
  'London Lunch',
  'London Close',
] as const;
export type ResearchSession = typeof SESSIONS[number];

/** Template identifies which field layout the test editor renders.
 *  Each strategy stores its OWN template — DR cannot share with ADC, etc. */
export type StrategyTemplate = 'blank' | 'dr' | 'adc' | 'ebp' | 'smt' | 'custom';

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'rich';
  placeholder?: string;
}
export interface CustomSection {
  id: string;
  title: string;
  subtitle?: string;
  fields: CustomField[];
}

export interface ResearchTest {
  id: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  pair: string;
  session: ResearchSession | '';
  predictedBias: Bias | '';
  actualBias: Bias | '';
  /** Market condition this test was executed in — used by Research Analytics. */
  marketCondition?: ResearchMarketCondition | '';
  // DR-specific (only rendered when strategy.template === 'dr')
  dealingRange: DealingRange | '';
  liquidityTarget: LiquidityTarget | '';
  liquidityNote: string;
  narrative: string;
  drHigh: string;
  drEq: string;
  drLow: string;
  breakoutQuality: BreakoutQuality | '';
  fvgLocation: FVGLocation | '';
  entryType: EntryType | '';
  ltfConfirmation: LTFConfirmation[];
  drLevel: DRLevel | '';
  entryPrice: string;
  stopLoss: string;
  tp1: string;
  tp1Target: string; // legacy field name kept for storage compat — labelled "TP1 Liquidity Pool"
  tp2: string;
  tp2Target: string; // legacy field name kept for storage compat — labelled "TP2 Liquidity Pool"
  result: TestResult | '';
  rAchieved: string; // labelled "RR Achieved"
  grade: ProcessGrade | '';
  emotionalState: EmotionalState | '';
  predictedScreenshot?: string;
  actualScreenshot?: string;
  reflectionWentWell: string;
  reflectionToImprove: string;
  reflectionNotes: string;
  reviewFollowedModel: string;
  reviewNarrative: string;
  reviewDifferently: string;
  /** Per-template field values keyed by field id. Each strategy isolates here — editing one strategy never touches another. */
  customValues?: Record<string, string>;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  type: StrategyType;
  icon: string;
  color: string;
  status: StrategyStatus;
  pairs: string[];
  tests: ResearchTest[];
  /** Drives which test form is shown. Defaults to 'blank' for new strategies. */
  template: StrategyTemplate;
  /** For template === 'custom': user-defined sections & fields. */
  customSections?: CustomSection[];
  templateName?: string;
  createdAt: string;
  updatedAt: string;
}

export const STRATEGY_TYPES: StrategyType[] = [
  'Session Model', 'Liquidity Model', 'SMT Model', 'PO3 Model', 'Custom',
];

export const STRATEGY_COLORS = [
  'blue', 'emerald', 'amber', 'purple', 'rose', 'cyan', 'orange', 'slate',
] as const;

export const STRATEGY_ICONS = ['🧪', '🎯', '📊', '⚡', '🌊', '🔭', '🧠', '🪙', '📈', '🛰️'];

export interface TemplatePreset {
  id: StrategyTemplate;
  name: string;
  description: string;
  /** Custom sections seeded when this template is selected (for non-built-in ones). */
  defaultSections?: CustomSection[];
}

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  { id: 'blank', name: 'Blank Strategy', description: 'Minimal form — basic info, result, reflection. Add structure later.' },
  { id: 'dr',    name: 'DR Strategy',     description: 'Dealing Range model — DR levels, breakout, FVG, LTF confirmation.' },
  { id: 'adc',   name: 'ADC Strategy',    description: 'Accumulation → Manipulation → Distribution (PO3) cycle workspace.' },
  { id: 'ebp',   name: 'EBP Candle',      description: 'Engulfing Body Pattern reversal validation.' },
  { id: 'smt',   name: 'SMT Strategy',    description: 'Smart Money Technique divergence between correlated pairs.' },
  { id: 'custom',name: 'Custom Template', description: 'Define your own sections and fields. Each strategy stays isolated.' },
];

/** Field structure for the non-DR built-in templates. Rendered on top of the
 *  shared "Basic Info / HTF Bias / Result / Reflection" frame, but every strategy
 *  reads/writes its own customValues map — they never touch each other. */
export const TEMPLATE_SECTIONS: Partial<Record<StrategyTemplate, CustomSection[]>> = {
  adc: [
    {
      id: 'adc-cycle',
      title: 'PO3 Cycle Read',
      subtitle: 'Accumulation → Manipulation → Distribution',
      fields: [
        { id: 'accumulationZone', label: 'Accumulation Zone (range)', type: 'text', placeholder: 'e.g. Asia 1.0850–1.0880' },
        { id: 'manipulationSide', label: 'Manipulation Side', type: 'text', placeholder: 'BSL above Asia High / SSL below Asia Low' },
        { id: 'distributionTarget', label: 'Distribution Target', type: 'text', placeholder: 'e.g. Previous Day Low' },
        { id: 'cycleNarrative', label: 'Cycle Narrative', type: 'textarea', placeholder: 'How you expect AMD to unfold today.' },
      ],
    },
  ],
  ebp: [
    {
      id: 'ebp-candle',
      title: 'EBP Candle',
      subtitle: 'Engulfing Body Pattern context',
      fields: [
        { id: 'ebpLocation', label: 'EBP Location', type: 'text', placeholder: 'PD High / Weekly Low / OB...' },
        { id: 'ebpTimeframe', label: 'Timeframe', type: 'text', placeholder: '15m / 1H / 4H' },
        { id: 'ebpBody', label: 'Body Size vs ATR', type: 'text', placeholder: 'e.g. 1.8× ATR' },
        { id: 'ebpConfluence', label: 'Confluence', type: 'textarea', placeholder: 'Liquidity sweep, session, FVG alignment...' },
      ],
    },
  ],
  smt: [
    {
      id: 'smt-div',
      title: 'SMT Divergence',
      subtitle: 'Correlated pair behaviour',
      fields: [
        { id: 'smtPairA', label: 'Pair A', type: 'text', placeholder: 'e.g. EURUSD' },
        { id: 'smtPairB', label: 'Pair B (correlated)', type: 'text', placeholder: 'e.g. GBPUSD / DXY' },
        { id: 'smtType', label: 'Divergence Type', type: 'text', placeholder: 'Bullish / Bearish SMT' },
        { id: 'smtLevel', label: 'Level Where SMT Formed', type: 'text', placeholder: 'PD High / Asia Low...' },
        { id: 'smtNarrative', label: 'Narrative', type: 'textarea', placeholder: 'Why this divergence matters today.' },
      ],
    },
  ],
};

export function createEmptyTest(pair = ''): ResearchTest {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    date: new Date().toISOString().slice(0, 10),
    pair,
    session: '',
    predictedBias: '',
    actualBias: '',
    marketCondition: '',
    dealingRange: '',
    liquidityTarget: '',
    liquidityNote: '',
    narrative: '',
    drHigh: '',
    drEq: '',
    drLow: '',
    breakoutQuality: '',
    fvgLocation: '',
    entryType: '',
    ltfConfirmation: [],
    drLevel: '',
    entryPrice: '',
    stopLoss: '',
    tp1: '',
    tp1Target: '',
    tp2: '',
    tp2Target: '',
    result: '',
    rAchieved: '',
    grade: '',
    emotionalState: '',
    reflectionWentWell: '',
    reflectionToImprove: '',
    reflectionNotes: '',
    reviewFollowedModel: '',
    reviewNarrative: '',
    reviewDifferently: '',
    customValues: {},
  };
}

export function createStrategy(partial: Partial<Strategy> = {}): Strategy {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: partial.name || 'Untitled Strategy',
    description: partial.description || '',
    type: partial.type || 'Custom',
    icon: partial.icon || '🧪',
    color: partial.color || 'blue',
    status: partial.status || 'Testing',
    pairs: partial.pairs || ['EURUSD', 'GBPUSD', 'XAUUSD'],
    tests: partial.tests || [],
    template: partial.template || 'blank',
    customSections: partial.customSections || [],
    templateName: partial.templateName,
    createdAt: now,
    updatedAt: now,
  };
}
