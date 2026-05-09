# Signal Console Live Research Plan

## Goal

Build a real research backend and operator console for live market comparison across bet365, Kalshi, Polymarket, and NBA game-state truth. The system should answer, from persisted history, what each source showed over time and how the game changed while those prices moved.

## Completed

- Sport-aware live storage and repositories in SQLite
- Append-only `game_states` and `quote_ticks`
- Raw payload persistence, adapter run logging, manual mapping resolution, and storage coverage views
- Instrument-first live API routes under `/api/v1/games`, `/api/v1/divergence`, `/api/v1/research/*`, and `/api/v1/admin/*`
- Fail-honest readiness checks for missing sidecar/auth/session/live-data inputs
- Python `nba_api` sidecar scaffold with normalized scoreboard, box score, and play-by-play endpoints
- Worker-side NBA sidecar ingest seam and tests
- Repo-wide removal of presentation-only runtime paths from source, docs, specs, and regenerated build output
- Shared repo-root env loading for Node runtime entrypoints
- SQLite cleanup migration that removes legacy storyline tables and stale replay/demo `app_state` keys
- NBA schedule-window sync in the worker so future scheduled games land in canonical storage
- Real Polymarket NBA game-market ingestion into canonical instruments, source markets, quote ticks, raw payloads, and adapter runs
- Real Bet365 and Kalshi NBA backup ingestion through backend-only `ODDS_API_KEY` wiring, with those rows persisted under the existing live source model
- Game-level market workspace, CSV instrument export route, richer instrument capture-health visuals, and expanded operations visibility in the web app
- First-class History and Exports routes in the web app, plus a non-dead-end empty-slate Games state so persisted research remains reachable when no live games are visible
- Frontend visibility for previously API-only backend surfaces, including instrument source diagnostics, research signal mismatches, and queued admin control actions
- Frontend correctness fixes for timeline bucketing, nullable live-data display, editable-field shortcut guarding, unmapped-market fallbacks, dark-mode chart theming, and deeper browser coverage against seeded live history
- Frontend coverage wording now separates market feeds from NBA game-state truth so `polymarket + nba` no longer reads like two market books
- Odds-API backup ingest URL fix so `/v3` routes are preserved for live Bet365 capture
- Trader desk UI now demotes external-only and stale Bet365 rows into diagnostics, keeping "read first" reserved for fresh Bet365-backed signals and collapsing placeholder/state-only slate noise.
- Player-prop ingestion for Bet365 Odds-API snapshots and Polymarket historical CLOB backfill, with May 2 export files under `data/exports/`
- Direct Kalshi NBA market-data capture via `KALSHI_API_KEY`, covering milestone-related game, spread, total, team-prop, player-prop, period, overtime, and related event families in canonical storage
- API-backed export catalog and server-streamed CSV/JSONL/SQLite downloads surfaced from `/exports`, including provider/family quote slices for data engineering

## In Progress

- Cutting the pathological `research/signal-mismatches` cost that currently leaves History, Settings, and Exports stuck in loading states for real users
- Refocusing the historical UI on weekly comparative highlights with score/context readouts instead of operator-oriented storage/admin trivia above the fold
- Tightening the direct public Bet365 capture seam so the repo is not permanently dependent on a backup provider
- Restoring fresh Bet365 capture so the desk can show an actual live trading signal instead of stale diagnostic rows.

## Next

1. Land direct public-site Bet365 capture so the primary source path no longer depends on Odds-API.io as a backup provider.
2. Add broader live validation around direct Kalshi and Bet365 backup ingestion with real local provider credentials.
3. Expand the chart surface with clearer game-state overlays, mismatch annotations, and depth-oriented views where the source supports them.
4. Turn more admin placeholders into executable workflows rather than queue-only records.
5. Keep widening browser and integration coverage around env -> worker -> DB -> API -> UI for the live-only operator path.

## Non-Negotiables

- No synthetic runtime modes.
- No authored scenario packs.
- No synthetic fallback for live routes.
- No hiding line mismatch under generic divergence.
