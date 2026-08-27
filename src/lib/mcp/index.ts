import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRecentTrades from "./tools/list-recent-trades";
import listTrades from "./tools/list-trades";
import getTrade from "./tools/get-trade";
import searchTrades from "./tools/search-trades";
import getTradeStats from "./tools/get-trade-stats";
import getPerformanceMetrics from "./tools/get-performance-metrics";
import getDashboardSummary from "./tools/get-dashboard-summary";
import getEquityCurve from "./tools/get-equity-curve";
import getPeriodStats from "./tools/get-period-stats";
import getDailyPlan from "./tools/get-daily-plan";
import listDailyPlans from "./tools/list-daily-plans";
import getWeeklyPlan from "./tools/get-weekly-plan";
import getChecklist from "./tools/get-checklist";
import searchNotebook from "./tools/search-notebook";
// Phase 2 — search & analysis
import searchJournal from "./tools/search-journal";
import analyzeMistakes from "./tools/analyze-mistakes";
import analyzeSetups from "./tools/analyze-setups";
import analyzePsychology from "./tools/analyze-psychology";
import getConsistencyReport from "./tools/get-consistency-report";
import getMonthlySummary from "./tools/get-monthly-summary";
import getWeeklyReport from "./tools/get-weekly-report";
// Phase 3 — write tools
import createTrade from "./tools/create-trade";
import updateTrade from "./tools/update-trade";
import deleteTrade from "./tools/delete-trade";
import upsertDailyPlan from "./tools/upsert-daily-plan";
import upsertWeeklyPlan from "./tools/upsert-weekly-plan";
import createNotebookEntry from "./tools/create-notebook-entry";
import updateChecklist from "./tools/update-checklist";
// Phase 4 — media
import getMediaUrl from "./tools/get-media-url";
import listMedia from "./tools/list-media";

// Build the OAuth issuer from the project ref (Vite inlines this literal at
// build time, so it stays import-safe — no runtime env reads at module top
// level). Must be the direct supabase.co host, not the .lovable.cloud proxy.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tg-master-journal-mcp",
  title: "TG Master Journal",
  version: "0.4.0",
  instructions:
    "Tools for TG Master Journal, a professional trading operating system. " +
    "Dashboard & analytics: `get_dashboard_summary`, `get_performance_metrics` (win rate, profit factor, " +
    "expectancy, optional breakdown by session/asset/setup/grade), `get_equity_curve`, `get_period_stats`, " +
    "`get_trade_stats`. " +
    "Trades: `list_trades` (filter by pair, session, setup, grade, result, direction, date range, min RR; " +
    "sorted and paginated), `search_trades`, `get_trade`, `list_recent_trades`. " +
    "Planning: `get_daily_plan`, `list_daily_plans`, `get_weekly_plan`. " +
    "Routine & journal: `get_checklist`, `search_notebook`. " +
    "Search & analysis: `search_journal` (ranked full-journal text search with snippets), `analyze_mistakes` " +
    "(recurring violations and their cost), `analyze_setups` (strongest/weakest setups, assets, sessions), " +
    "`analyze_psychology` (emotions, discipline, sentiment vs outcomes), `get_consistency_report`, " +
    "`get_monthly_summary`, `get_weekly_report`. " +
    "Writes (always confirm with the user first): `create_trade`, `update_trade`, `delete_trade` (needs " +
    "confirm: true), `upsert_daily_plan`, `upsert_weekly_plan`, `create_notebook_entry`, `update_checklist`. " +
    "Media: `list_media` and `get_media_url` return short-lived signed URLs for chart screenshots. " +
    "All tools are scoped to the signed-in user and enforce row-level security; no tool can read or write " +
    "another user's data or execute SQL. Prefer filtered, paginated calls over fetching everything.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getDashboardSummary,
    getPerformanceMetrics,
    getEquityCurve,
    getPeriodStats,
    getTradeStats,
    listTrades,
    searchTrades,
    getTrade,
    listRecentTrades,
    getDailyPlan,
    listDailyPlans,
    getWeeklyPlan,
    getChecklist,
    searchNotebook,
    searchJournal,
    analyzeMistakes,
    analyzeSetups,
    analyzePsychology,
    getConsistencyReport,
    getMonthlySummary,
    getWeeklyReport,
    createTrade,
    updateTrade,
    deleteTrade,
    upsertDailyPlan,
    upsertWeeklyPlan,
    createNotebookEntry,
    updateChecklist,
    getMediaUrl,
    listMedia,
  ],
});
