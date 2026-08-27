# TG Master Journal — MCP Server

Version **0.4.0** · Phases 1–4 complete (auth + read-only, analysis, writes, media)

The server exposes TG Master Journal as standard MCP tools so ChatGPT, Claude
Desktop, VS Code / Copilot and any other MCP-compatible client can read the
signed-in user's journal.

## Endpoint

```
https://<project-ref>.supabase.co/functions/v1/mcp
```

Transport: MCP Streamable HTTP. The exact URL is shown in the app under
**Settings → AI**.

## Authentication

- OAuth 2.1 against the app's own auth server (`/auth/v1`), audience
  `authenticated`. Dynamic client registration is enabled, so compatible
  clients self-register.
- The user signs in and approves the client on the in-app consent page
  (`/.lovable/oauth/consent`).
- Every tool call verifies the bearer token, derives the user from the token's
  `sub` claim (never from tool input), and forwards the raw token to the
  database so row-level security runs as that user.
- Unauthenticated calls return an MCP error result, never data.

## Tools

### Dashboard & analytics

| Tool | Input | Returns |
| --- | --- | --- |
| `get_dashboard_summary` | — | All-time and last-30-day metrics, top sessions/pairs, accounts, 10 most recent trades |
| `get_performance_metrics` | `from?`, `to?`, `days?`, `group_by?` (`session`\|`asset`\|`setup`\|`grade`) | Win rate, net P/L, gross profit/loss, profit factor, expectancy, avg win/loss, avg R, best/worst trade, optional breakdown |
| `get_equity_curve` | `from?`, `to?`, `starting_balance?` | Cumulative equity points, ending/peak equity, max drawdown |
| `get_period_stats` | `period?` (`month`\|`week`), `from?`, `to?`, `limit?` | Per-period metric buckets, most recent first |
| `get_trade_stats` | `days?` | Compact count / win rate / P/L / average R |

### Trades

| Tool | Input | Returns |
| --- | --- | --- |
| `list_trades` | `asset?`, `session?`, `setup?`, `grade?`, `result?`, `direction?`, `market?`, `from?`, `to?`, `min_rr?`, `sort?`, `order?`, `limit?`, `offset?` | Filtered, sorted, paginated trades + pagination block |
| `search_trades` | `query`, `limit?`, `offset?` | Trades matching notes / setup / asset / session / grade |
| `get_trade` | `id` | One full trade record |
| `list_recent_trades` | `limit?` | Most recent trades, core fields |

### Planning

| Tool | Input | Returns |
| --- | --- | --- |
| `get_daily_plan` | `date?` | Full daily plan for a date (defaults to today) |
| `list_daily_plans` | `from?`, `to?`, `reviewed?`, `limit?`, `offset?` | Daily plan index with bias, focus, risk, review status |
| `get_weekly_plan` | `week_start?` | Weekly plan, pair analyses, news, goals and review notes |

### Routine & journal

| Tool | Input | Returns |
| --- | --- | --- |
| `get_checklist` | `date?`, `history_days?` | Checklist for the day, per-section progress, history, current/longest streak |
| `search_notebook` | `query?`, `pair?`, `category?`, `from?`, `to?`, `limit?`, `offset?` | Notebook/journal entries matching filters and text |

### Search & analysis (Phase 2)

| Tool | Input | Returns |
| --- | --- | --- |
| `search_journal` | `query`, `sources?`, `from?`, `to?`, `limit?` | Ranked matches across trades, notebook, daily plans and weekly plans with snippets |
| `analyze_mistakes` | `from?`, `to?`, `days?`, `limit?` | Recurring mistakes with occurrences, win rate, net P/L and estimated cost |
| `analyze_setups` | `dimension?`, `from?`, `to?`, `days?`, `min_trades?` | Ranking plus strongest/weakest buckets by P/L, win rate, profit factor |
| `analyze_psychology` | `from?`, `to?`, `days?` | Emotions, day tags, grades, sentiment and discipline vs outcomes |
| `get_consistency_report` | `days?` | Plan coverage, checklist completion, overtrading, risk consistency, score |
| `get_monthly_summary` | `month?` | Full month synthesis: metrics, equity, best/worst days, breakdowns, routine |
| `get_weekly_report` | `week_start?` | Week synthesis with day-by-day P/L, breakdowns, weekly plan and notable trades |

### Writes (Phase 3)

| Tool | Input | Effect |
| --- | --- | --- |
| `create_trade` | `date`, `asset`, + optional trade fields | Inserts a trade and returns it |
| `update_trade` | `id` + fields to change | Partial update; omitted fields untouched |
| `delete_trade` | `id`, `confirm: true` | Permanently deletes a trade (destructive) |
| `upsert_daily_plan` | `date` + plan fields | Creates or patches the daily plan |
| `upsert_weekly_plan` | `week_start?` + plan fields | Creates or patches the weekly plan |
| `create_notebook_entry` | `text`, `date?`, `pair?`, `category?`, `bias?`, `entry_id?` | Creates or updates a notebook entry |
| `update_checklist` | `date?`, `items[]` (`match`, `done`, `section?`) | Ticks/unticks checklist items, returns progress |

All writes run under the caller's token, so RLS scopes them to that user. Write
tools never accept a `user_id` from input.

### Media (Phase 4)

| Tool | Input | Returns |
| --- | --- | --- |
| `list_media` | `trade_id?`, `from?`, `to?`, `sources?`, `sign?`, `expires_in?`, `limit?` | Media referenced by trades, notebook and daily plans |
| `get_media_url` | `paths[]`, `expires_in?` | Short-lived signed URLs (60s–24h) for journal-media paths or stale URLs |

## Conventions

- **Dates** are `YYYY-MM-DD` strings.
- **Pagination**: `limit` + `offset`; responses include
  `pagination: { limit, offset, returned, total, has_more }`.
- **Sorting**: `list_trades` accepts `sort` (`date`, `profit_loss`,
  `actual_rr`, `planned_rr`) and `order` (`asc` \| `desc`).
- **Executed trades** for metrics = results `Win` / `Loss` / `Breakeven`,
  excluding drafts, untriggered setups and cancellations.
- Every response also carries `structuredContent` alongside the text block.

## Error handling

Errors come back as normal MCP results with `isError: true` and a short text
message:

| Situation | Message |
| --- | --- |
| Missing/invalid token | `Not authenticated. Sign in to TG Master Journal first.` |
| Database or RLS denial | The database error message (no credentials, no SQL) |
| Unknown id | `No trade found with id "…".` |
| Empty search term | `Query must not be empty.` |

## Security

- No SQL execution, no arbitrary filesystem access, no service-role key.
- All queries are typed client calls scoped to `user_id = token.sub` and
  additionally protected by row-level security.
- Tokens are never logged or returned; secrets are never exposed to the model.
- Read tools are marked `readOnlyHint: true`; write tools are explicitly annotated, and `delete_trade` is `destructiveHint: true` and requires `confirm: true`.

## Versioning

Semantic version on the MCP server (`defineMcp.version`). Tool inputs are
additive within a major version; removals or renames bump the major.

## Roadmap

- **Phase 1 (done)** — auth + read-only dashboard, trades, planning, checklist,
  notebook, analytics.
- **Phase 2 (done)** — semantic journal search and analysis tools.
- **Phase 3 (done)** — write tools for trades, plans, notebook and checklist.
- **Phase 4 (done)** — media access via short-lived signed URLs.
  caching.

## Adding a tool

1. Create `src/lib/mcp/tools/<name>.ts` with `defineTool` (use the helpers in
   `src/lib/mcp/lib/client.ts`).
2. Register it in `src/lib/mcp/index.ts`.
3. Regenerate the manifest and deploy the `mcp` function.
