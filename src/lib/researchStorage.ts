import { loadUserStorage, saveUserStorage } from '@/lib/userStorage';
import { Strategy, createStrategy } from '@/types/research';

export const RESEARCH_STRATEGIES_KEY = 'ef_research_strategies';

const SEED_STRATEGIES: Array<Partial<Strategy>> = [
  { name: 'ICT Session Narrative Model', type: 'Session Model', icon: '🌐', color: 'blue', description: 'Predict session narrative: which pool runs, which reverses.' },
  { name: 'EBP Candle Strategy', type: 'Custom', icon: '🕯️', color: 'amber', description: 'Engulfing Body Pattern reversals at key levels.' },
  { name: 'SMT Divergence Model', type: 'SMT Model', icon: '🔀', color: 'purple', description: 'Smart Money Technique divergence between correlated pairs.' },
  { name: 'AMD Model', type: 'PO3 Model', icon: '⚡', color: 'cyan', description: 'Accumulation → Manipulation → Distribution daily cycle.' },
  { name: 'London Reversal Model', type: 'Session Model', icon: '🌅', color: 'emerald', description: 'London session sweep + reversal toward NY range.' },
];

export function loadStrategies(userId: string): Strategy[] {
  return loadUserStorage<Strategy[]>(RESEARCH_STRATEGIES_KEY, userId, []);
}

export function saveStrategies(userId: string, strategies: Strategy[]) {
  saveUserStorage(RESEARCH_STRATEGIES_KEY, userId, strategies);
}

export function getSeedStrategies(): Strategy[] {
  return SEED_STRATEGIES.map((s) => createStrategy(s));
}
