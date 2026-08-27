import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

type Meta = { title: string; description: string };

const ROUTE_META: Record<string, Meta> = {
  "/": {
    title: "Dashboard — TG Master Journal",
    description: "Overview of your trading performance, equity curve, recent trades, and key metrics in TG Master Journal.",
  },
  "/trades": {
    title: "Trades — TG Master Journal",
    description: "Browse, filter, and review every logged trade with grades, RR, screenshots, and execution notes.",
  },
  "/accounts": {
    title: "Accounts — TG Master Journal",
    description: "Track funded and prop accounts, phase progress, drawdown, and account-by-account performance.",
  },
  "/analytics": {
    title: "Analytics — TG Master Journal",
    description: "Performance analytics by pair, session, weekday, grade, and setup — find your edge with data.",
  },
  "/psychology": {
    title: "Psychology — TG Master Journal",
    description: "Track emotional state, discipline, and behavioral patterns alongside your trading results.",
  },
  "/mistakes": {
    title: "Mistakes — TG Master Journal",
    description: "Catalog and study recurring execution mistakes to systematically eliminate trading leaks.",
  },
  "/weekly-plan": {
    title: "Weekly Plans — TG Master Journal",
    description: "Plan your trading week — bias, key levels, scenarios, and risk allocation per pair.",
  },
  "/daily-plan": {
    title: "Daily Plans — TG Master Journal",
    description: "Daily trading plan: bias, levels, setups, and execution rules before the session opens.",
  },
  "/notebook": {
    title: "Notebook — TG Master Journal",
    description: "Research notes, charts, links, and ideas for your trading process in one searchable workspace.",
  },
  "/weekly-review": {
    title: "Weekly Review — TG Master Journal",
    description: "Review your week — performance, behavior, best and worst setups, and AI insights.",
  },
  "/setup-playbook": {
    title: "Setup Playbook — TG Master Journal",
    description: "Document and study every trading setup in your playbook with rules, examples, and stats.",
  },
  "/behavior-patterns": {
    title: "Behavior Patterns — TG Master Journal",
    description: "Identify recurring behavioral patterns — overtrading, FOMO, revenge trading — and fix them.",
  },
  "/trade-quality": {
    title: "Trade Quality — TG Master Journal",
    description: "Measure execution quality by grade, confluence, and discipline across every trade.",
  },
  "/ai-insights": {
    title: "AI Insights — TG Master Journal",
    description: "AI-powered behavioral insights, risk alerts, and trader-score analysis on your journal.",
  },
  "/trading-rules": {
    title: "Trading Rules — TG Master Journal",
    description: "Your codified trading rules, risk limits, and discipline checklist enforced across the app.",
  },
  "/bias-analytics": {
    title: "Bias Analytics — TG Master Journal",
    description: "Track how accurate your daily and weekly directional biases are against actual outcomes.",
  },
  "/control-center": {
    title: "Control Center — TG Master Journal",
    description: "Manage sessions, tags, grades, and metadata that power your journal and analytics.",
  },
  "/research-lab": {
    title: "Research Lab — TG Master Journal",
    description: "Backtest and study chart replays separate from live trades with custom grades and confluences.",
  },
  "/calendar": {
    title: "Calendar — TG Master Journal",
    description: "Calendar view of trades, plans, and sessions across months and years.",
  },
  "/settings": {
    title: "Settings — TG Master Journal",
    description: "Workspace preferences, timezone, typography, and account settings for TG Master Journal.",
  },
  "/system-analytics": {
    title: "System Analytics — TG Master Journal",
    description: "System-level analytics — RR distribution, drawdown before TP, profit before SL, and more.",
  },
  "/macro-intelligence": {
    title: "Macro Intelligence — TG Master Journal",
    description: "Institutional macro decision terminal — Fed, USD, gold bias, and prediction accuracy tracking.",
  },
  "/login": {
    title: "Sign in — TG Master Journal",
    description: "Sign in to your TG Master Journal account.",
  },
};

const DEFAULT_META: Meta = {
  title: "TG Master Journal — Professional Trading Operating System",
  description: "TG Master Journal is a professional trading journal and analytics workspace for serious traders.",
};

export function RouteSeo() {
  const { pathname } = useLocation();
  const meta = ROUTE_META[pathname] ?? DEFAULT_META;
  const canonical = pathname || "/";
  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
    </Helmet>
  );
}
