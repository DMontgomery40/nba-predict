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
- NBA sidecar window syncs now preserve isolated date failures while failing honestly on full-window outages
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
- Trader desk UI now demotes external-only and old Bet365 rows into diagnostics, reserves live-trading language for current Bet365-vs-exchange signals, and collapses placeholder/scoreboard-only slate noise.
- Player-prop ingestion for Bet365 Odds-API snapshots and Polymarket historical CLOB backfill, with May 2 export files under `data/exports/`
- Direct Kalshi NBA market-data capture via `KALSHI_API_KEY`, covering milestone-related game, spread, total, team-prop, player-prop, period, overtime, and related event families in canonical storage
- API-backed export catalog and server-streamed CSV/JSONL/SQLite downloads surfaced from `/exports`, including provider/family quote slices for data engineering
- NBA sidecar future-schedule fallback to the official NBA CDN season schedule, covering playoff games that `scoreboardv2` omits or times out on
- Worker market-provider isolation: bet365 rate limits are reported without blocking Kalshi/Polymarket refresh, and live Kalshi scans are bounded to recent events
- First-class player-prop attribution risk alerts: `/api/v1/research/player-prop-alerts` compares fresh mapped Bet365 props against Kalshi/Polymarket, with `/prop-alerts` preserving the exact-line monitor as a compatibility/specialized view
- Player-prop alert watcher and saved-check path: `pnpm prop-alert-watch` records every poll frame to JSONL, sends desktop notifications for newly observed alert ids, `/api/v1/research/player-prop-alert-playback` serves persisted checks, and `/prop-alerts` reviews the selected date without synthetic frames
- Market anomaly watcher and saved-check path: `pnpm market-anomaly-watch` records every generalized weirdness poll frame to JSONL, sends desktop notifications for newly observed anomaly ids, and `/api/v1/research/market-anomaly-playback` serves persisted checks
- Odds-API Bet365 backup discovery is bounded to pending/live NBA events around the active target slate before requesting odds for matched event ids
- Current-slate game ordering keeps live and near-term NBA games ahead of old persisted history, with missing score updates and missing final confirmation called out in Games and Trader Desk
- NBA sidecar live-scoreboard and schedule CDN fallbacks use browser-compatible NBA headers, keeping active playoff games visible when the default `nba_api` live endpoint is rejected
- Player-prop divergence visibility now enforces the operator invariant: Bet365 plus at least one comparable Kalshi or Polymarket source, with line-mismatch remaining distinct from comparable probability divergence
- Divergence truth model now separates game lifecycle, market coverage, quote freshness, and comparison state. Final games use persisted peak/latest comparison summaries, live rows use same-time latest comparisons, and player-prop surfaces fail closed on missing Bet365-plus-exchange coverage, selection mismatch, or prop-line mismatch.
- Slate and desk game cards no longer manufacture `0.0%` top signals for coverage-only rows; market feeds and NBA state are displayed as separate facts, and source-record inspection no longer exposes raw payload JSON in the trader workspace.
- Route audit pass now applies the shared lifecycle/comparison model across Desk, Slate, Divergence, Prop Alerts, Saved Checks, Event Workspace, Settings, History, Exports, and Ctrl+K. Trader-facing rows show peak/latest divergence, threshold duration, local timestamps, and same-time source evidence instead of unrelated latest quote trivia.
- Same-time divergence summary reads now use an indexed source-market path instead of scanning the full quote history, and final-game score lines are rendered from the lifecycle/outcome contract so old NBA `in-play` state cannot contradict a final game row.
- Settings now exposes runtime-settable environment/config keys, readiness, source health, admin actions, coverage, captures, storage, queued results, and mapping state in dense non-card controls
- Readiness, worker heartbeat, storage coverage, and research coverage avoid full-DB blocking scans so the full local quote/raw-payload store no longer freezes operator UI surfaces
- Temporary authenticated local/static hosting is available through `pnpm host:temporary`, suitable for a short-lived Cloudflare tunnel in front of the built web app
- Generalized prediction-market weirdness detection is now modeled separately from exact-line player-prop attribution alerts, with persisted microstructure event storage, tunable score config, `/api/v1/research/market-anomalies`, `/market-anomalies`, a watcher/playback path, and a desk-first anomaly queue

## In Progress
- Running the Mother's Day playoff player-prop alert monitor for the live slate
- Wiring direct venue trade/orderbook ingestion into the new market microstructure event table so off-price prints and liquidity shocks are captured directly rather than inferred from quote ticks alone
- Turning player-prop alerts from a polling read model into a full exposure-aware workflow once bet-intent/liability feeds exist
- Tightening the direct public Bet365 capture seam so the repo is not permanently dependent on a backup provider
- Restoring fresh Bet365 capture; the current local Odds-API path is configured and now target-bounded, but the account is still rate-limited with HTTP 429 until the upstream window resets

## Next

1. Add direct Polymarket Data API trade ingestion and CLOB book/mid/spread snapshots into `market_microstructure_events`.
2. Add direct Kalshi trade, candlestick, orderbook, and WebSocket-derived microstructure ingestion into `market_microstructure_events`.
3. Land direct public-site Bet365 capture so the primary source path no longer depends on Odds-API.io as a backup provider.
4. Attach exposure/liability inputs to player-prop attribution alerts so the popup can rank by money at risk rather than price delta alone.
5. Add an indexed, date/game-scoped export path for the handoff slices so data engineering does not have to pull full-table CSVs for current-game joins.
6. Add broader live validation around direct Kalshi, Polymarket, and Bet365 backup ingestion with real local provider credentials.
7. Expand the chart surface with clearer game-state overlays, anomaly annotations, divergence-duration sparklines, and depth-oriented views where the source supports them.
8. Turn more admin placeholders into executable workflows rather than queue-only records.
9. Keep widening browser and integration coverage around env -> worker -> DB -> API -> UI for the live-only operator path.

## Non-Negotiables

- No synthetic runtime modes.
- No authored scenario packs.
- No synthetic fallback for live routes.
- No hiding line mismatch under generic divergence.
