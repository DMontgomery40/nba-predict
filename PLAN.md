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
- NBA sidecar future-schedule fallback to the official NBA CDN season schedule, covering playoff games that `scoreboardv2` omits or times out on
- Worker market-provider isolation: bet365 rate limits are reported without blocking Kalshi/Polymarket refresh, and live Kalshi scans are bounded to recent events
- First-class player-prop attribution risk alerts: `/api/v1/research/player-prop-alerts` compares fresh mapped Bet365 props against Kalshi/Polymarket, and the trader desk polls it every five seconds for a popup plus top-of-dashboard review queue
- Player-prop alert watcher and replay path: `pnpm prop-alert-watch` records every poll frame to JSONL, sends desktop notifications for newly observed alert ids, `/api/v1/research/player-prop-alert-playback` serves the tape, and `/prop-alerts` replays what the watcher saw
- Odds-API Bet365 backup discovery is bounded to pending/live NBA events around the active target slate before requesting odds for matched event ids

## In Progress

- Running the Mother's Day playoff player-prop alert monitor for the live slate
- Turning player-prop alerts from a polling read model into a full exposure-aware workflow once bet-intent/liability feeds exist
- Cutting the pathological `research/signal-mismatches` and coverage/export cost that can still leave heavy research routes slow on the full 4.5M+ quote local DB
- Tightening the direct public Bet365 capture seam so the repo is not permanently dependent on a backup provider
- Restoring fresh Bet365 capture; the current local Odds-API path is configured and now target-bounded, but the account is still rate-limited with HTTP 429 until the upstream window resets

## Next

1. Land direct public-site Bet365 capture so the primary source path no longer depends on Odds-API.io as a backup provider.
2. Attach exposure/liability inputs to player-prop attribution alerts so the popup can rank by money at risk rather than price delta alone.
3. Add an indexed, date/game-scoped export path for the handoff slices so data engineering does not have to pull full-table CSVs for current-game joins.
4. Add broader live validation around direct Kalshi and Bet365 backup ingestion with real local provider credentials.
5. Expand the chart surface with clearer game-state overlays, mismatch annotations, and depth-oriented views where the source supports them.
6. Turn more admin placeholders into executable workflows rather than queue-only records.
7. Keep widening browser and integration coverage around env -> worker -> DB -> API -> UI for the live-only operator path.

## Non-Negotiables

- No synthetic runtime modes.
- No authored scenario packs.
- No synthetic fallback for live routes.
- No hiding line mismatch under generic divergence.
