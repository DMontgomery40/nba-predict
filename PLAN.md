# Signal Console Live Research Plan

## Goal

Build a live NBA trader-incident detector for Bet365 trader inspection. The primary job is to warn fast enough that a trader can suspend the affected player props and related derivative markets when a stat may be misattributed or otherwise unstable. Broad whole-board volatility and prediction-market weirdness are still valuable, but as the earliest tripwire, not the final answer. The product should fan out from the first tripwire into the implicated players, stat families, and suspension targets, while historical replay answers what the trader would have seen and how many seconds earlier the warning could have arrived. All inputs are real persisted live data with no synthetic runtime modes.

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
- API readiness now probes the NBA sidecar's `/health/ready` endpoint instead of treating a configured base URL as ready.
- Bet365 live capture is idempotent on duplicate provider timestamps and uses a provider-specific 429 cooldown so Odds-API rate limits do not keep poisoning worker cycles or block Kalshi/Polymarket refresh.
- The live market-anomaly queue now applies the score config's `maxQuoteAgeMinutes`; stale active-game prints remain available through historical reads without appearing as current desk alerts. The trader desk uses `skipQuoteAnomalies=true` for its supporting weirdness feed so persisted trade/orderbook/candlestick events can refresh quickly without blocking the primary desk on quote-tick scans.
- Trader-incident detection now includes a single first-class game-state volatility path inside the existing detector: broad Kalshi/Polymarket movement across multiple core game-state families can headline the card while individual props stay in the evidence list.
- Player-prop divergence visibility now enforces the operator invariant: Bet365 plus at least one comparable Kalshi or Polymarket source, with line-mismatch remaining distinct from comparable probability divergence
- Divergence truth model now separates game lifecycle, market coverage, quote freshness, and comparison state. Final games use persisted peak/latest comparison summaries, live rows use same-time latest comparisons, and player-prop surfaces fail closed on missing Bet365-plus-exchange coverage, selection mismatch, or prop-line mismatch.
- Slate and desk game cards no longer manufacture `0.0%` top signals for coverage-only rows; market feeds and NBA state are displayed as separate facts, and source-record inspection no longer exposes raw payload JSON in the trader workspace.
- Route audit pass now applies the shared lifecycle/comparison model across Desk, Slate, Divergence, Prop Alerts, Saved Checks, Event Workspace, Settings, History, Exports, and Ctrl+K. Trader-facing rows show peak/latest divergence, threshold duration, local timestamps, and same-time source evidence instead of unrelated latest quote trivia.
- Same-time divergence summary reads now use an indexed source-market path instead of scanning the full quote history, and final-game score lines are rendered from the lifecycle/outcome contract so old NBA `in-play` state cannot contradict a final game row.
- Settings now exposes runtime-settable environment/config keys, readiness, source health, admin actions, coverage, captures, storage, queued results, and mapping state in dense non-card controls
- Readiness, worker heartbeat, storage coverage, and research coverage avoid full-DB blocking scans so the full local quote/raw-payload store no longer freezes operator UI surfaces
- Temporary authenticated local/static hosting is available through `pnpm host:temporary`, suitable for a short-lived Cloudflare tunnel in front of the built web app
- Generalized prediction-market weirdness detection is now modeled separately from exact-line player-prop attribution alerts, with persisted microstructure event storage, tunable score config, `/api/v1/research/market-anomalies`, `/market-anomalies`, a watcher/playback path, and a desk-first anomaly queue
- The root trader desk now leads with per-game live game-state volatility from `/api/v1/research/board-volatility`, matched by `gameId` to NBA score/period/clock from `/api/v1/games`; primary desk surfaces poll every five seconds so "now/current" is backed by fresh live data instead of a static first paint
- Polymarket Data API trade ingestion now hydrates Gamma `conditionId` metadata into `market_microstructure_events`, including size, notional, trade price, live-to-date/final volume basis, and sane `volume_share` values for board-level anomaly scoring.
- NBA play-by-play actions are persisted through the sidecar, with an official NBA CDN fallback when `nba_api` rejects the live endpoint; board-alert inspect views can now compare nearby market reactions against nearby real game actions.
- Trader-incident desk and inspect surfaces are being split into smaller dedicated modules, and the board-alert API payload builders are moving into their own service so trader-first behavior and NBA context rules are easier to maintain without drifting.
- Shared trader-incident storage/replay code is being split along explicit boundaries: observation materialization, historical incident/fanout assembly, NBA play-by-play context, and incident event-context now live in smaller modules instead of one catch-all repository/context file.
- Trader-incident API orchestration is also being split by responsibility: historical incident hydration/dedupe, query normalization, and live/event-context payloads now live in smaller service modules instead of one mixed service file.
- Board-alert inspect/event-context now uses one canonical `predictionMarketContext` structure with nested by-source summaries plus canonical quote/trade rows, so the historical/live trader read no longer mixes a unified observation model with a separate trade-only side channel.
- The historical inspect path now resolves exact `historic-participant` incidents from persisted canonical observations via `alertId`, including legacy `dean+wade` style participant segments, so the trader page no longer waits on the broad whole-day incidents list just to know which incident it is showing.
- Last-50 real-game coverage is now repaired on the data side: Bet365 settled-game historical snapshots are backfilled through Odds API historical endpoints, and the current audit shows `0` real games missing Bet365, Kalshi, Polymarket, or persisted NBA PBP across the latest 50 NBA rows.
- The current historical read model no longer hides past scheduled games that already have persisted market coverage; date-scoped game APIs now keep those rows visible instead of treating them like ghost placeholders.
- NBA sidecar window backfill now repairs a final game state/outcome from official `Game End` play-by-play rows when scoreboard history missed the finished-game write, closing the stale-`scheduled` contradiction for recent playoff games with persisted PBP.
- Scheduled NBA rows now stay neutral until a five-minute post-tip grace expires, so the desk/slate do not raise a false `Score update missing` critical state during the normal pre-tip window.
- Board-alert inspect now switches to a context-only fallback state when no alert reconstructs at the exact anchor but persisted prediction-market evidence exists, avoiding the contradictory hard empty-state above populated review targets.
- Whole-board `game-state-volatility` scoring now uses representative core market families instead of whichever prop rows saturate hottest, dropping routine live board scores out of the permanent `90+ critical` band and keeping the evidence list anchored on core spread/total/team-state markets first.
- Whole-board volatility now runs through one shared calibrated state model across live alerts, replay, inspect, and desk surfaces: phase-aware baselines in `board_volatility_baselines`, Iter02 state gating for untrusted player/entity fanout, a linear Kalman persistence layer, and a desk/API contract that exposes phase, percentile/range, filter state, gates, and drivers instead of an inline threshold legend.
- Repo-local Codex bug-fix enforcement now uses first-class `.codex/hooks.json` lifecycle hooks backed by a tested shared guard module, so concrete defect-fix turns are reminded to add behavior-level regression coverage and cannot stop cleanly without touched tests, a changed-surface test run, and a `pnpm verify` attempt.

## In Progress
- Live math note, 2026-05-19 20:06 MDT: during `nba-0042500301` at `P3 1:21` remaining (`81-66`, snapshot captured `2026-05-20T02:02:43.314267+00:00`), switched the live board detector to the stricter `#2` board-first gate. When a whole-game `game-state-volatility` tripwire and player-specific fanout first pop inside the same shock window, the live deck keeps the whole-game card and leaves the player rows in board-alert evidence until a later follow-up separates itself.
- Running the May 17 playoff trader-incident / board-tripwire monitor for the live slate, with player-prop checks preserved as the exact-line compatibility route
- Re-validating the rebuilt shared board-volatility model on live localhost data so the new phase/baseline/filter contract, board-first fold, and desk presentation all match the actual API output
- Wiring remaining direct venue orderbook, midpoint, spread, depth, and WebSocket ingestion into the market microstructure event table so liquidity shocks are captured directly rather than inferred from quote ticks alone
- Turning player-prop alerts from a polling read model into a full exposure-aware workflow once bet-intent/liability feeds exist
- Tightening the direct public Bet365 capture seam so the repo is not permanently dependent on a backup provider
- Restoring fresh Bet365 capture; the current local Odds-API path is configured and now target-bounded, but the account is still rate-limited with HTTP 429 until the upstream window resets
- Broad app/API reliability audit is still open: the main remaining work is making sure no other read path quietly depends on stale scheduled state, and keeping historical trader APIs fast enough that truthy payloads arrive without long waits.

## Next

1. Keep shrinking the remaining historical API latency, especially `/api/v1/research/board-alerts/incidents`, so trader/backtest reads stay truthful without multi-second stalls.
2. Add direct Polymarket CLOB book/mid/spread snapshots into `market_microstructure_events`.
3. Add direct Kalshi trade, candlestick, orderbook, and WebSocket-derived microstructure ingestion into `market_microstructure_events`.
4. Land direct public-site Bet365 capture so the primary source path no longer depends on Odds-API.io as a backup provider.
5. Attach exposure/liability inputs to player-prop attribution alerts so the popup can rank by money at risk rather than price delta alone.
6. Add an indexed, date/game-scoped export path for the handoff slices so data engineering does not have to pull full-table CSVs for current-game joins.
7. Add broader live validation around direct Kalshi, Polymarket, and Bet365 backup ingestion with real local provider credentials.
8. Expand the chart surface with clearer game-state overlays, anomaly annotations, divergence-duration sparklines, and depth-oriented views where the source supports them.
9. Turn more admin placeholders into executable workflows rather than queue-only records.
10. Keep widening browser and integration coverage around env -> worker -> DB -> API -> UI for the live-only operator path.

## Non-Negotiables

- No synthetic runtime modes.
- No authored scenario packs.
- No synthetic fallback for live routes.
- No hiding line mismatch under generic divergence.
- No claiming success because rows, clusters, source posts, chips, links, or tables are visible. Success is a board-level alert that a Bet365 trader can act on or dismiss in seconds.
- Generic whole-game volatility is useful only if it quickly resolves into the player and market follow-up the trader can act on.
- History replay exists to answer "what warning would we have had, and how much earlier?" It is not a license to lead with post-game noise.
- Sportsbook line/odds movement and prediction-market orderbook/trade movement are scored separately; a sportsbook line move and a prediction-market off-price fill are not the same signal.
- Prediction-market game-state implied volatility is a valid whole-board tripwire across core game families. Once it fires, the user-facing workflow must pivot into the implicated players, props, and related derivatives instead of stopping at the broad volatility label.
- History replay must use only data captured at or before the replay clock. Post-game current divergence is not the primary history signal.
- FanDuel and DraftKings paths must be backed by current (2026) evidence — either an implemented adapter or a concrete blocker scorecard. No imaginary providers.
