import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CONFLUENCE_OPTIONS, SETUPS, Trade, TradingAccount, Transaction, ScaleEvent, WeeklyPlan, DailyPlan } from '@/types/trading';
import { supabase } from '@/integrations/supabase/client';

// Cast supabase client to bypass empty generated types (tables created via migration)
const db = supabase as any;
import { useAuth } from '@/contexts/AuthContext';
import {
  tradeToDb, dbToTrade, accountToDb, dbToAccount,
  txToDb, dbToTx, scaleToDb, dbToScale,
  weeklyPlanToDb, dbToWeeklyPlan, dailyPlanToDb, dbToDailyPlan,
  saveDailyPlanRpc, saveWeeklyPlanRpc, SavePlanResult,
} from '@/lib/dbMappers';

interface TradingContextType {
  trades: Trade[];
  accounts: TradingAccount[];
  transactions: Transaction[];
  scaleEvents: ScaleEvent[];
  weeklyPlans: WeeklyPlan[];
  dailyPlans: DailyPlan[];
  customSetups: string[];
  customAssets: string[];
  customConfluences: string[];
  markets: string[];
  sessions: string[];
  conditions: string[];
  gradesList: string[];
  managementOptions: string[];
  psychTags: string[];
  violations: string[];
  notebookCategories: string[];
  loading: boolean;
  // Per-resource loading flags so pages can render their own data without waiting on others.
  loadingTrades: boolean;
  loadingDailyPlans: boolean;
  loadingWeeklyPlans: boolean;
  loadingAccounts: boolean;
  loadingSettings: boolean;
  /** Fetches a single trade (incl. heavy media columns) on demand. */
  hydrateTradeMedia: (id: string) => Promise<Trade | null>;
  /** Fetches a single daily plan with full media on demand. */
  hydrateDailyPlanMedia: (id: string) => Promise<DailyPlan | null>;
  /** Fetches a single weekly plan with full pair_analyses/observation/calendarResult on demand. */
  hydrateWeeklyPlanMedia: (id: string) => Promise<WeeklyPlan | null>;
  addTrade: (trade: Trade) => void;
  updateTrade: (trade: Trade) => void;
  deleteTrade: (id: string) => void;
  addAccount: (account: TradingAccount) => void;
  updateAccount: (account: TradingAccount) => void;
  deleteAccount: (id: string) => void;
  addTransaction: (tx: Transaction) => void;
  addScaleEvent: (event: ScaleEvent) => void;
  addWeeklyPlan: (plan: WeeklyPlan) => Promise<SavePlanResult | void>;
  updateWeeklyPlan: (plan: WeeklyPlan) => Promise<SavePlanResult | void>;
  deleteWeeklyPlan: (id: string) => void;
  addDailyPlan: (plan: DailyPlan) => Promise<SavePlanResult | void>;
  updateDailyPlan: (plan: DailyPlan) => Promise<SavePlanResult | void>;
  deleteDailyPlan: (id: string) => void;
  addCustomSetup: (setup: string) => void;
  updateCustomSetup: (previous: string, next: string) => void;
  deleteCustomSetup: (setup: string) => void;
  addCustomAsset: (asset: string) => void;
  deleteCustomAsset: (asset: string) => void;
  addCustomConfluence: (c: string) => void;
  updateCustomConfluence: (previous: string, next: string) => void;
  deleteCustomConfluence: (c: string) => void;
  addMarket: (v: string) => void; updateMarket: (p: string, n: string) => void; deleteMarket: (v: string) => void;
  addSession: (v: string) => void; updateSession: (p: string, n: string) => void; deleteSession: (v: string) => void;
  addCondition: (v: string) => void; updateCondition: (p: string, n: string) => void; deleteCondition: (v: string) => void;
  addGrade: (v: string) => void; updateGrade: (p: string, n: string) => void; deleteGrade: (v: string) => void;
  addManagement: (v: string) => void; updateManagement: (p: string, n: string) => void; deleteManagement: (v: string) => void;
  addPsychTag: (v: string) => void; updatePsychTag: (p: string, n: string) => void; deletePsychTag: (v: string) => void;
  addViolation: (v: string) => void; updateViolation: (p: string, n: string) => void; deleteViolation: (v: string) => void;
  addNotebookCategory: (v: string) => void; updateNotebookCategory: (p: string, n: string) => void; deleteNotebookCategory: (v: string) => void;
}

const TradingContext = createContext<TradingContextType | null>(null);

const DEFAULT_MARKETS = ['Forex', 'Crypto', 'Commodities', 'Indices', 'Stocks', 'Futures'];
const DEFAULT_SESSIONS = ['Asia', 'London', 'New York', 'New York Kill Zone', 'London Close'];
const DEFAULT_CONDITIONS = ['Trending', 'Ranging', 'Volatile'];
const DEFAULT_GRADES = ['A+', 'A', 'B', 'C'];
const DEFAULT_MANAGEMENT = ['Moved SL to Breakeven', 'Partial TP', 'Trailing Stop', 'Closed Early', 'Held Full Position', 'Scaled In', 'Scaled Out'];
const DEFAULT_PSYCH = ['Confident', 'Fearful', 'Greedy', 'Neutral', 'Anxious', 'Calm'];
const DEFAULT_VIOLATIONS = ['FOMO', 'Early Entry', 'Overtrading', 'Emotional', 'Ignored SL'];
const DEFAULT_NOTEBOOK_CATS = ['Pattern', 'Missed Trade', 'Opportunity Not Taken', 'Observation', 'News Reaction'];

// PERFORMANCE: Initial trade fetch excludes heavy base64 image columns
// (prediction_image, execution_image). They're hydrated on demand via
// hydrateTradeMedia(id) when the user opens the gallery card or detail sheet.
const TRADE_LITE_COLUMNS = [
  'id','user_id','date','entry_time','exit_time','market','asset','direction','session',
  'market_condition','setup','quantity','entry_price','stop_loss','take_profit','exit_price','order_type',
  'result','planned_rr','actual_rr','max_rr_reached','max_adverse_move','pips','profit_loss',
  'fees','notes','accounts','management','confluences','entry_confluences','target_confluences',
  'chart_link','psychology','mistakes','grade','timeframe','trend','trade_journey','day_tags',
  'curve','trade_analysis','market_sentiment','status','created_at',
].join(',');

// Daily-plan LIST fetch. After the base64→Storage migration, `pairs` only
// holds URLs + light text, so it's safe to include for cross-page analytics
// (Bias Analytics, Weekly Review aggregations, etc.). Truly heavy legacy rows
// can still be re-hydrated via hydrateDailyPlanMedia() if needed.
const DAILY_PLAN_LIST_COLUMNS = [
  'id','user_id','date','daily_bias','session_focus','max_trades','risk_limit',
  'took_trades','reviewed','analysis_video_url','review_video','pair_count',
  'pairs','schema_version','created_at','updated_at','revision',
].join(',');


// Weekly-plan LIST fetch: include `pair_analyses` for bias analytics — they
// are URL-only after migration. Heavy rich-text fields stay lazy.
const WEEKLY_PLAN_LIST_COLUMNS = [
  'id','user_id','week_start','bias','markets','setups','levels','risk','goals',
  'analysis_video_url','reviewed','pair_count','pair_analyses','created_at','updated_at','revision',
].join(',');

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scaleEvents, setScaleEvents] = useState<ScaleEvent[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([]);
  const [customSetups, setCustomSetups] = useState<string[]>([...SETUPS]);
  const [customAssets, setCustomAssets] = useState<string[]>([]);
  const [customConfluences, setCustomConfluences] = useState<string[]>([...CONFLUENCE_OPTIONS]);
  const [markets, setMarkets] = useState<string[]>(DEFAULT_MARKETS);
  const [sessions, setSessions] = useState<string[]>(DEFAULT_SESSIONS);
  const [conditions, setConditions] = useState<string[]>(DEFAULT_CONDITIONS);
  const [gradesList, setGradesList] = useState<string[]>(DEFAULT_GRADES);
  const [managementOptions, setManagementOptions] = useState<string[]>(DEFAULT_MANAGEMENT);
  const [psychTags, setPsychTags] = useState<string[]>(DEFAULT_PSYCH);
  const [violations, setViolations] = useState<string[]>(DEFAULT_VIOLATIONS);
  const [notebookCategories, setNotebookCategories] = useState<string[]>(DEFAULT_NOTEBOOK_CATS);

  const [loadingTrades, setLoadingTrades] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingDailyPlans, setLoadingDailyPlans] = useState(true);
  const [loadingWeeklyPlans, setLoadingWeeklyPlans] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Aggregate loading: any resource still loading.
  const loading =
    loadingTrades || loadingAccounts || loadingDailyPlans || loadingWeeklyPlans || loadingSettings;

  const resetState = useCallback(() => {
    setTrades([]);
    setAccounts([]);
    setTransactions([]);
    setScaleEvents([]);
    setWeeklyPlans([]);
    setDailyPlans([]);
    setCustomSetups([...SETUPS]);
    setCustomAssets([]);
    setCustomConfluences([...CONFLUENCE_OPTIONS]);
    setMarkets(DEFAULT_MARKETS);
    setSessions(DEFAULT_SESSIONS);
    setConditions(DEFAULT_CONDITIONS);
    setGradesList(DEFAULT_GRADES);
    setManagementOptions(DEFAULT_MANAGEMENT);
    setPsychTags(DEFAULT_PSYCH);
    setViolations(DEFAULT_VIOLATIONS);
    setNotebookCategories(DEFAULT_NOTEBOOK_CATS);
  }, []);

  // Track current load to ignore stale responses on rapid user switches.
  const loadIdRef = useRef(0);

  // Stream-load: each query fires independently and updates its own slice the moment it returns.
  // No Promise.all → a slow trade fetch never blocks Daily Plan rendering.
  useEffect(() => {
    resetState();

    if (!user) {
      setLoadingTrades(false);
      setLoadingAccounts(false);
      setLoadingDailyPlans(false);
      setLoadingWeeklyPlans(false);
      setLoadingSettings(false);
      return;
    }

    loadIdRef.current += 1;
    const myLoadId = loadIdRef.current;
    const uid = user.id;

    setLoadingTrades(true);
    setLoadingAccounts(true);
    setLoadingDailyPlans(true);
    setLoadingWeeklyPlans(true);
    setLoadingSettings(true);

    const isStale = () => loadIdRef.current !== myLoadId;

    // Trades — lite (no base64 images).
    db.from('trades').select(TRADE_LITE_COLUMNS).eq('user_id', uid)
      .order('created_at', { ascending: false })
      .then(({ data }: any) => {
        if (isStale()) return;
        if (data) setTrades(data.map(dbToTrade));
        setLoadingTrades(false);
      });

    // Daily plans — lite. THIS is what was getting blocked behind the giant trade fetch.
    db.from('daily_plans').select(DAILY_PLAN_LIST_COLUMNS).eq('user_id', uid)
      .order('date', { ascending: false })
      .then(({ data }: any) => {
        if (isStale()) return;
        if (data) {
          const plans = data.map(dbToDailyPlan);
          plans.forEach((p: DailyPlan) => {
            if (typeof p.revision === 'number') latestDailyRevision.current.set(p.id, p.revision);
          });
          setDailyPlans(plans);
        }
        setLoadingDailyPlans(false);
      });

    db.from('weekly_plans').select(WEEKLY_PLAN_LIST_COLUMNS).eq('user_id', uid)
      .order('week_start', { ascending: false })
      .then(({ data }: any) => {
        if (isStale()) return;
        if (data) {
          const plans = data.map(dbToWeeklyPlan);
          plans.forEach((p: WeeklyPlan) => {
            if (typeof p.revision === 'number') latestWeeklyRevision.current.set(p.id, p.revision);
          });
          setWeeklyPlans(plans);
        }
        setLoadingWeeklyPlans(false);
      });

    db.from('trading_accounts').select('*').eq('user_id', uid)
      .then(({ data }: any) => {
        if (isStale()) return;
        if (data) setAccounts(data.map(dbToAccount));
        setLoadingAccounts(false);
      });

    db.from('transactions').select('*').eq('user_id', uid)
      .then(({ data }: any) => { if (!isStale() && data) setTransactions(data.map(dbToTx)); });

    db.from('scale_events').select('*').eq('user_id', uid)
      .then(({ data }: any) => { if (!isStale() && data) setScaleEvents(data.map(dbToScale)); });

    db.from('user_settings').select('*').eq('user_id', uid).maybeSingle()
      .then(({ data }: any) => {
        if (isStale()) return;
        if (data) {
          const s = data;
          const parse = (v: any, def: string[]) => {
            if (!v) return def;
            const arr = typeof v === 'string' ? JSON.parse(v) : v;
            return Array.isArray(arr) && arr.length > 0 ? arr : def;
          };
          setCustomSetups(parse(s.custom_setups, [...SETUPS]));
          setCustomAssets(parse(s.custom_assets, []));
          setCustomConfluences(parse(s.custom_confluences, [...CONFLUENCE_OPTIONS]));
          setMarkets(parse(s.markets, DEFAULT_MARKETS));
          setSessions(parse(s.sessions, DEFAULT_SESSIONS));
          setConditions(parse(s.conditions, DEFAULT_CONDITIONS));
          setGradesList(parse(s.grades_list, DEFAULT_GRADES));
          setManagementOptions(parse(s.management_options, DEFAULT_MANAGEMENT));
          setPsychTags(parse(s.psych_tags, DEFAULT_PSYCH));
          setViolations(parse(s.violations, DEFAULT_VIOLATIONS));
          setNotebookCategories(parse(s.notebook_categories, DEFAULT_NOTEBOOK_CATS));
        } else {
          db.from('user_settings').insert({
            user_id: uid,
            custom_setups: [...SETUPS], custom_assets: [], custom_confluences: [...CONFLUENCE_OPTIONS],
            markets: DEFAULT_MARKETS, sessions: DEFAULT_SESSIONS, conditions: DEFAULT_CONDITIONS,
            grades_list: DEFAULT_GRADES, management_options: DEFAULT_MANAGEMENT,
            psych_tags: DEFAULT_PSYCH, violations: DEFAULT_VIOLATIONS,
            notebook_categories: DEFAULT_NOTEBOOK_CATS,
          }).then(() => {});
        }
        setLoadingSettings(false);
      });
  }, [user, resetState]);

  // ── On-demand media hydration ──
  // Cache so opening the same trade detail twice doesn't refetch.
  const tradeMediaCache = useRef<Map<string, Trade>>(new Map());
  const dailyPlanMediaCache = useRef<Map<string, DailyPlan>>(new Map());
  const dailyPlanSaveQueue = useRef<Map<string, Promise<SavePlanResult | void>>>(new Map());
  const weeklyPlanSaveQueue = useRef<Map<string, Promise<SavePlanResult | void>>>(new Map());
  const latestDailyRevision = useRef<Map<string, number>>(new Map());
  const latestWeeklyRevision = useRef<Map<string, number>>(new Map());

  // Cross-client sync (web ↔ desktop): when RealtimeSyncProvider emits an
  // `mj:realtime` event for our plan tables, seed the latest revision so the
  // next local save doesn't hit a stale-revision conflict. We intentionally do
  // NOT overwrite unsaved local edits — only the revision pointer is updated.
  useEffect(() => {
    if (!user) return;
    const onRealtime = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      if (!detail || detail.event === 'DELETE') return;
      const row = detail.new;
      if (!row || row.user_id !== user.id) return;
      const rev = typeof row.revision === 'number' ? row.revision : null;
      if (rev == null) return;
      if (detail.table === 'daily_plans') {
        latestDailyRevision.current.set(row.id, rev);
      } else if (detail.table === 'weekly_plans') {
        latestWeeklyRevision.current.set(row.id, rev);
      }
    };
    window.addEventListener('mj:realtime', onRealtime as EventListener);
    return () => window.removeEventListener('mj:realtime', onRealtime as EventListener);
  }, [user]);

  const enqueuePlanSave = useCallback((
    queue: React.MutableRefObject<Map<string, Promise<SavePlanResult | void>>>,
    id: string,
    task: () => Promise<SavePlanResult | void>,
  ): Promise<SavePlanResult | void> => {
    const previous = queue.current.get(id) || Promise.resolve();
    const next = previous.catch(() => undefined).then(task);
    queue.current.set(id, next);
    next.then(() => {
      if (queue.current.get(id) === next) queue.current.delete(id);
    }).catch(() => {
      if (queue.current.get(id) === next) queue.current.delete(id);
    });
    return next;
  }, []);

  const hydrateTradeMedia = useCallback(async (id: string): Promise<Trade | null> => {
    if (!user) return null;
    const cached = tradeMediaCache.current.get(id);
    if (cached) return cached;
    const { data } = await db.from('trades')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) return null;
    const full = dbToTrade(data);
    tradeMediaCache.current.set(id, full);
    // Also patch the in-memory list so the row picks up images without a re-fetch.
    setTrades(s => s.map(t => t.id === id ? { ...t, ...full } : t));
    return full;
  }, [user]);

  const hydrateDailyPlanMedia = useCallback(async (id: string): Promise<DailyPlan | null> => {
    if (!user) return null;
    const cached = dailyPlanMediaCache.current.get(id);
    if (cached) return cached;
    const { data } = await db.from('daily_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) return null;
    const full = dbToDailyPlan(data);
    dailyPlanMediaCache.current.set(id, full);
    if (typeof full.revision === 'number') latestDailyRevision.current.set(id, full.revision);
    setDailyPlans(s => s.map(p => p.id === id ? { ...p, ...full } : p));
    return full;
  }, [user]);

  const weeklyPlanMediaCache = useRef<Map<string, WeeklyPlan>>(new Map());
  const hydrateWeeklyPlanMedia = useCallback(async (id: string): Promise<WeeklyPlan | null> => {
    if (!user) return null;
    const cached = weeklyPlanMediaCache.current.get(id);
    if (cached) return cached;
    const { data } = await db.from('weekly_plans')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!data) return null;
    const full = dbToWeeklyPlan(data);
    weeklyPlanMediaCache.current.set(id, full);
    if (typeof full.revision === 'number') latestWeeklyRevision.current.set(id, full.revision);
    setWeeklyPlans(s => s.map(p => p.id === id ? { ...p, ...full } : p));
    return full;
  }, [user]);
  const saveSettings = useCallback((updates: Record<string, any>) => {
    if (!user) return;
    db.from('user_settings').update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', user.id).then(() => {});
  }, [user]);

  // ── Trades CRUD ──
  const addTrade = useCallback((trade: Trade) => {
    setTrades(s => [trade, ...s]);
    tradeMediaCache.current.set(trade.id, trade);
    if (user) db.from('trades').insert(tradeToDb(trade, user.id) as any).then(() => {});
  }, [user]);

  const updateTrade = useCallback((trade: Trade) => {
    setTrades(s => s.map(t => t.id === trade.id ? trade : t));
    tradeMediaCache.current.set(trade.id, trade);
    if (user) {
      const { id, ...rest } = tradeToDb(trade, user.id);
      db.from('trades').update(rest as any).eq('id', id).eq('user_id', user.id).then(() => {});
    }
  }, [user]);

  const deleteTrade = useCallback((id: string) => {
    setTrades(s => s.filter(t => t.id !== id));
    tradeMediaCache.current.delete(id);
    if (user) db.from('trades').delete().eq('id', id).eq('user_id', user.id).then(() => {});
  }, [user]);

  // ── Accounts CRUD ──
  const addAccount = useCallback((account: TradingAccount) => {
    setAccounts(s => [account, ...s]);
    if (user) db.from('trading_accounts').insert(accountToDb(account, user.id) as any).then(() => {});
  }, [user]);

  const updateAccount = useCallback((account: TradingAccount) => {
    setAccounts(s => s.map(a => a.id === account.id ? account : a));
    if (user) {
      const { id, ...rest } = accountToDb(account, user.id);
      db.from('trading_accounts').update(rest as any).eq('id', id).eq('user_id', user.id).then(() => {});
    }
  }, [user]);

  const deleteAccount = useCallback((id: string) => {
    setAccounts(s => s.filter(a => a.id !== id));
    if (user) db.from('trading_accounts').delete().eq('id', id).eq('user_id', user.id).then(() => {});
  }, [user]);

  // ── Transactions ──
  const addTransaction = useCallback((tx: Transaction) => {
    setTransactions(s => [...s, tx]);
    if (user) db.from('transactions').insert(txToDb(tx, user.id) as any).then(() => {});
  }, [user]);

  // ── Scale Events ──
  const addScaleEvent = useCallback((event: ScaleEvent) => {
    setScaleEvents(s => [...s, event]);
    if (user) db.from('scale_events').insert(scaleToDb(event, user.id) as any).then(() => {});
  }, [user]);

  // ── Weekly Plans ──
  // All writes go through `save_weekly_plan` RPC which: snapshots history,
  // validates payload, enforces optimistic concurrency, and runs inside a
  // single DB transaction. Revision is round-tripped on the plan object.
  const addWeeklyPlan = useCallback((plan: WeeklyPlan) => {
    const seeded: WeeklyPlan = { ...plan, revision: undefined };
    setWeeklyPlans(s => [...s, seeded]);
    if (!user) return Promise.resolve();
    return enqueuePlanSave(weeklyPlanSaveQueue, plan.id, async () => {
      const res = await saveWeeklyPlanRpc(seeded);
      latestWeeklyRevision.current.set(plan.id, res.revision);
      setWeeklyPlans(s => s.map(p => p.id === plan.id ? { ...p, revision: res.revision, updatedAt: res.updated_at } : p));
      return res;
    }).catch(err => {
      console.error('[addWeeklyPlan] save failed:', err);
      throw err;
    });
  }, [enqueuePlanSave, user]);

  // Concurrency-conflict retry: when another client (web ↔ desktop) has bumped
  // the server revision between our reads and our RPC call, refetch the current
  // revision from the DB, seed our local ref, and retry the save ONCE. This
  // makes cross-device editing feel seamless — the user never sees "Save failed"
  // just because the other window updated the record a moment earlier.
  const isConcurrencyError = (err: any): boolean => {
    const msg = String(err?.message || err?.error_description || err || '');
    return /concurrency_conflict/i.test(msg);
  };

  const refetchWeeklyRevision = useCallback(async (id: string): Promise<number | null> => {
    if (!user) return null;
    const { data } = await db.from('weekly_plans')
      .select('revision,updated_at')
      .eq('id', id).eq('user_id', user.id).maybeSingle();
    const rev = typeof data?.revision === 'number' ? data.revision : null;
    if (rev != null) latestWeeklyRevision.current.set(id, rev);
    return rev;
  }, [user]);

  const refetchDailyRevision = useCallback(async (id: string): Promise<number | null> => {
    if (!user) return null;
    const { data } = await db.from('daily_plans')
      .select('revision,updated_at')
      .eq('id', id).eq('user_id', user.id).maybeSingle();
    const rev = typeof data?.revision === 'number' ? data.revision : null;
    if (rev != null) latestDailyRevision.current.set(id, rev);
    return rev;
  }, [user]);

  const updateWeeklyPlan = useCallback((plan: WeeklyPlan) => {
    // Optimistic UI; revision is bumped only after the server confirms.
    setWeeklyPlans(s => s.map(p => p.id === plan.id ? plan : p));
    if (!user) return Promise.resolve();
    return enqueuePlanSave(weeklyPlanSaveQueue, plan.id, async () => {
      const attempt = async (rev: number | null | undefined) => {
        const planForSave = rev != null ? { ...plan, revision: rev } : plan;
        return await saveWeeklyPlanRpc(planForSave);
      };
      let res: SavePlanResult;
      try {
        res = await attempt(latestWeeklyRevision.current.get(plan.id));
      } catch (err) {
        if (!isConcurrencyError(err)) throw err;
        // Another client wrote first — refresh revision and retry once.
        console.warn('[updateWeeklyPlan] concurrency conflict — refreshing revision and retrying', err);
        const fresh = await refetchWeeklyRevision(plan.id);
        res = await attempt(fresh);
      }
      latestWeeklyRevision.current.set(plan.id, res.revision);
      setWeeklyPlans(s => s.map(p => p.id === plan.id ? { ...p, revision: res.revision, updatedAt: res.updated_at } : p));
      return res;
    }).catch(err => {
      console.error('[updateWeeklyPlan] save rejected:', err);
      throw err;
    });
  }, [enqueuePlanSave, user, refetchWeeklyRevision]);

  const deleteWeeklyPlan = useCallback((id: string) => {
    setWeeklyPlans(s => s.filter(p => p.id !== id));
    if (user) db.from('weekly_plans').delete().eq('id', id).eq('user_id', user.id).then(() => {});
  }, [user]);

  // ── Daily Plans ──
  const addDailyPlan = useCallback((plan: DailyPlan) => {
    const seeded: DailyPlan = { ...plan, revision: undefined };
    setDailyPlans(s => [...s, seeded]);
    dailyPlanMediaCache.current.set(plan.id, seeded);
    if (!user) return Promise.resolve();
    return enqueuePlanSave(dailyPlanSaveQueue, plan.id, async () => {
      const res = await saveDailyPlanRpc(seeded);
      latestDailyRevision.current.set(plan.id, res.revision);
      setDailyPlans(s => s.map(p => p.id === plan.id ? { ...p, revision: res.revision, updatedAt: res.updated_at } : p));
      const cached = dailyPlanMediaCache.current.get(plan.id);
      if (cached) dailyPlanMediaCache.current.set(plan.id, { ...cached, revision: res.revision, updatedAt: res.updated_at });
      return res;
    }).catch(err => {
      console.error('[addDailyPlan] save failed:', err);
      throw err;
    });
  }, [enqueuePlanSave, user]);

  const updateDailyPlan = useCallback((plan: DailyPlan) => {
    setDailyPlans(s => s.map(p => p.id === plan.id ? plan : p));
    dailyPlanMediaCache.current.set(plan.id, plan);
    if (!user) return Promise.resolve();
    return enqueuePlanSave(dailyPlanSaveQueue, plan.id, async () => {
      const attempt = async (rev: number | null | undefined) => {
        const planForSave = rev != null ? { ...plan, revision: rev } : plan;
        return await saveDailyPlanRpc(planForSave);
      };
      let res: SavePlanResult;
      try {
        res = await attempt(latestDailyRevision.current.get(plan.id));
      } catch (err) {
        if (!isConcurrencyError(err)) throw err;
        console.warn('[updateDailyPlan] concurrency conflict — refreshing revision and retrying', err);
        const fresh = await refetchDailyRevision(plan.id);
        res = await attempt(fresh);
      }
      latestDailyRevision.current.set(plan.id, res.revision);
      setDailyPlans(s => s.map(p => p.id === plan.id ? { ...p, revision: res.revision, updatedAt: res.updated_at } : p));
      const cached = dailyPlanMediaCache.current.get(plan.id);
      if (cached) dailyPlanMediaCache.current.set(plan.id, { ...cached, revision: res.revision, updatedAt: res.updated_at });
      return res;
    }).catch(err => {
      console.error('[updateDailyPlan] save rejected:', err);
      throw err;
    });
  }, [enqueuePlanSave, user, refetchDailyRevision]);

  const deleteDailyPlan = useCallback((id: string) => {
    setDailyPlans(s => s.filter(p => p.id !== id));
    dailyPlanMediaCache.current.delete(id);
    if (user) db.from('daily_plans').delete().eq('id', id).eq('user_id', user.id).then(() => {});
  }, [user]);


  // ── Settings list CRUD factory ──
  function makeSettingsCRUD(
    stateKey: string,
    dbKey: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    const add = (v: string) => {
      const val = v.trim();
      if (!val) return;
      setter(prev => {
        const next = [...new Set([...prev, val])];
        saveSettings({ [dbKey]: next });
        return next;
      });
    };
    const update = (prev: string, next: string) => {
      const val = next.trim();
      if (!val || prev === val) return;
      setter(items => {
        const updated = [...new Set(items.filter(i => i !== prev).concat(val))];
        saveSettings({ [dbKey]: updated });
        return updated;
      });
    };
    const remove = (v: string) => {
      setter(items => {
        const updated = items.filter(i => i !== v);
        saveSettings({ [dbKey]: updated });
        return updated;
      });
    };
    return { add, update, remove };
  }

  const setupsCRUD = makeSettingsCRUD('customSetups', 'custom_setups', setCustomSetups);
  const assetsCRUD = makeSettingsCRUD('customAssets', 'custom_assets', setCustomAssets);
  const confluencesCRUD = makeSettingsCRUD('customConfluences', 'custom_confluences', setCustomConfluences);
  const marketsCRUD = makeSettingsCRUD('markets', 'markets', setMarkets);
  const sessionsCRUD = makeSettingsCRUD('sessions', 'sessions', setSessions);
  const conditionsCRUD = makeSettingsCRUD('conditions', 'conditions', setConditions);
  const gradesCRUD = makeSettingsCRUD('gradesList', 'grades_list', setGradesList);
  const mgmtCRUD = makeSettingsCRUD('managementOptions', 'management_options', setManagementOptions);
  const psychCRUD = makeSettingsCRUD('psychTags', 'psych_tags', setPsychTags);
  const violCRUD = makeSettingsCRUD('violations', 'violations', setViolations);
  const notebookCRUD = makeSettingsCRUD('notebookCategories', 'notebook_categories', setNotebookCategories);

  return (
    <TradingContext.Provider value={{
      trades, accounts, transactions, scaleEvents, weeklyPlans, dailyPlans,
      customSetups, customAssets, customConfluences, markets, sessions, conditions,
      gradesList, managementOptions, psychTags, violations, notebookCategories, loading,
      loadingTrades, loadingDailyPlans, loadingWeeklyPlans, loadingAccounts, loadingSettings,
      hydrateTradeMedia, hydrateDailyPlanMedia, hydrateWeeklyPlanMedia,
      addTrade, updateTrade, deleteTrade,
      addAccount, updateAccount, deleteAccount,
      addTransaction, addScaleEvent,
      addWeeklyPlan, updateWeeklyPlan, deleteWeeklyPlan,
      addDailyPlan, updateDailyPlan, deleteDailyPlan,
      addCustomSetup: setupsCRUD.add, updateCustomSetup: setupsCRUD.update, deleteCustomSetup: setupsCRUD.remove,
      addCustomAsset: assetsCRUD.add, deleteCustomAsset: assetsCRUD.remove,
      addCustomConfluence: confluencesCRUD.add, updateCustomConfluence: confluencesCRUD.update, deleteCustomConfluence: confluencesCRUD.remove,
      addMarket: marketsCRUD.add, updateMarket: marketsCRUD.update, deleteMarket: marketsCRUD.remove,
      addSession: sessionsCRUD.add, updateSession: sessionsCRUD.update, deleteSession: sessionsCRUD.remove,
      addCondition: conditionsCRUD.add, updateCondition: conditionsCRUD.update, deleteCondition: conditionsCRUD.remove,
      addGrade: gradesCRUD.add, updateGrade: gradesCRUD.update, deleteGrade: gradesCRUD.remove,
      addManagement: mgmtCRUD.add, updateManagement: mgmtCRUD.update, deleteManagement: mgmtCRUD.remove,
      addPsychTag: psychCRUD.add, updatePsychTag: psychCRUD.update, deletePsychTag: psychCRUD.remove,
      addViolation: violCRUD.add, updateViolation: violCRUD.update, deleteViolation: violCRUD.remove,
      addNotebookCategory: notebookCRUD.add, updateNotebookCategory: notebookCRUD.update, deleteNotebookCategory: notebookCRUD.remove,
    }}>
      {children}
    </TradingContext.Provider>
  );
}

export function useTrading() {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error('useTrading must be used within TradingProvider');
  return ctx;
}
