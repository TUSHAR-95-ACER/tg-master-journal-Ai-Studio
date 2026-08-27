import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface UserPreferences {
  // Trading
  defaultRiskPercent?: number;
  defaultRR?: number;
  maxDailyTrades?: number;
  maxDailyLoss?: number;
  defaultSession?: string;
  preferredPairs?: string;
  defaultMarket?: string;
  // Journal
  defaultTradeSize?: number;
  autoSavePlans?: boolean;
  requireGrade?: boolean;
  requirePsychology?: boolean;
  showEntryGate?: boolean;
  defaultMaxTrades?: number;
  defaultRiskLimit?: string;
  // Risk
  maxConcurrentTrades?: number;
  maxLotSize?: number;
  enforceDailyLossLimit?: boolean;
  enforceTradeCountLimit?: boolean;
  // AI
  aiCoachEnabled?: boolean;
  analysisDepth?: string;
  responseStyle?: string;
  autoGenerateInsights?: boolean;
  // Market
  defaultTimezone?: string;
  showTicker?: boolean;
  tickerSymbols?: string;
  // UI
  layoutDensity?: string;
  chartTheme?: string;
  sidebarCollapsed?: boolean;
  journalFont?: 'notion' | 'jetbrains' | 'ibm' | 'space' | 'fira' | 'roboto' | 'source' | 'geist';
  // Notifications
  dailyPlanReminder?: boolean;
  weeklyReviewReminder?: boolean;
  tradeLimitWarning?: boolean;
  // Profile
  displayName?: string;
  tradingStyle?: string;
  experienceLevel?: string;
}

const DEFAULT_PREFS: UserPreferences = {
  defaultRiskPercent: 1,
  defaultRR: 2,
  maxDailyTrades: 3,
  maxDailyLoss: 3,
  defaultSession: 'New York Kill Zone',
  preferredPairs: 'EURUSD, GBPUSD, XAUUSD',
  defaultMarket: 'Forex',
  defaultTradeSize: 0.1,
  autoSavePlans: true,
  requireGrade: true,
  requirePsychology: true,
  showEntryGate: true,
  defaultMaxTrades: 3,
  defaultRiskLimit: '1% per trade',
  maxConcurrentTrades: 2,
  maxLotSize: 1.0,
  enforceDailyLossLimit: false,
  enforceTradeCountLimit: true,
  aiCoachEnabled: true,
  analysisDepth: 'advanced',
  responseStyle: 'direct',
  autoGenerateInsights: false,
  defaultTimezone: 'America/New_York',
  showTicker: true,
  tickerSymbols: 'EURUSD, GBPUSD, XAUUSD, BTCUSD, USDCAD',
  layoutDensity: 'comfortable',
  chartTheme: 'default',
  sidebarCollapsed: false,
  journalFont: 'notion',
  dailyPlanReminder: false,
  weeklyReviewReminder: false,
  tradeLimitWarning: true,
  displayName: '',
  tradingStyle: 'scalper',
  experienceLevel: 'intermediate',
};

export function useUserPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  // Load from DB
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.preferences && typeof data.preferences === 'object') {
        setPrefs(prev => ({ ...prev, ...(data.preferences as UserPreferences) }));
      }
      setLoaded(true);
    })();
  }, [user]);

  // Apply journal font globally whenever it changes; persist to localStorage for instant boot.
  useEffect(() => {
    const font = prefs.journalFont || 'notion';
    document.documentElement.setAttribute('data-journal-font', font);
    try { localStorage.setItem('ef_journal_font', font); } catch { /* ignore */ }
  }, [prefs.journalFont]);

  // Debounced save
  const saveToDb = useCallback(async (newPrefs: UserPreferences) => {
    if (!user) return;
    const { data: existing } = await supabase
      .from('user_settings')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('user_settings')
        .update({ preferences: newPrefs as any, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('user_settings')
        .insert({ user_id: user.id, preferences: newPrefs as any });
    }
  }, [user]);

  const updatePref = useCallback(<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    setPrefs(prev => {
      const next = { ...prev, [key]: value };
      // Debounce save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveToDb(next);
        toast.success('Settings saved', { duration: 1500 });
      }, 800);
      return next;
    });
  }, [saveToDb]);

  return { prefs, updatePref, loaded };
}
