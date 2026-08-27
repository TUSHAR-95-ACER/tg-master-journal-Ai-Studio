/**
 * Phase 2 Context Split — facade.
 *
 * The legacy `useTrading()` hook is preserved verbatim for backward
 * compatibility. New code can import the narrower facade hooks here so that a
 * future internal refactor (splitting state into independent providers) is a
 * pure mechanical change with no public-API churn.
 *
 * Each hook returns a SUBSET of the trading context. Components that consume
 * them will re-render whenever the parent context updates — that matches
 * current behavior. When the underlying providers are split for real, only
 * this file needs to point at the new sources.
 */
import { useTrading } from '@/contexts/TradingContext';

export function usePlans() {
  const t = useTrading();
  return {
    dailyPlans: t.dailyPlans,
    weeklyPlans: t.weeklyPlans,
    loadingDailyPlans: t.loadingDailyPlans,
    loadingWeeklyPlans: t.loadingWeeklyPlans,
    addDailyPlan: t.addDailyPlan,
    updateDailyPlan: t.updateDailyPlan,
    deleteDailyPlan: t.deleteDailyPlan,
    addWeeklyPlan: t.addWeeklyPlan,
    updateWeeklyPlan: t.updateWeeklyPlan,
    deleteWeeklyPlan: t.deleteWeeklyPlan,
    hydrateDailyPlanMedia: t.hydrateDailyPlanMedia,
    hydrateWeeklyPlanMedia: t.hydrateWeeklyPlanMedia,
  };
}

export function useTradesSlice() {
  const t = useTrading();
  return {
    trades: t.trades,
    loadingTrades: t.loadingTrades,
    addTrade: t.addTrade,
    updateTrade: t.updateTrade,
    deleteTrade: t.deleteTrade,
    hydrateTradeMedia: t.hydrateTradeMedia,
  };
}

export function useAccountsSlice() {
  const t = useTrading();
  return {
    accounts: t.accounts,
    transactions: t.transactions,
    scaleEvents: t.scaleEvents,
    loadingAccounts: t.loadingAccounts,
    addAccount: t.addAccount,
    updateAccount: t.updateAccount,
    deleteAccount: t.deleteAccount,
    addTransaction: t.addTransaction,
    addScaleEvent: t.addScaleEvent,
  };
}

/**
 * Metadata slice — read-only lists used across pickers (setups, sessions,
 * markets, grades, etc.). Kept separate from the CRUD mutators so components
 * that only need the enum values don't accidentally re-render when a mutator
 * identity would change.
 */
export function useSettingsMeta() {
  const t = useTrading();
  return {
    customSetups: t.customSetups,
    customAssets: t.customAssets,
    customConfluences: t.customConfluences,
    markets: t.markets,
    sessions: t.sessions,
    conditions: t.conditions,
    gradesList: t.gradesList,
    managementOptions: t.managementOptions,
    psychTags: t.psychTags,
    violations: t.violations,
    notebookCategories: t.notebookCategories,
    loadingSettings: t.loadingSettings,
  };
}

