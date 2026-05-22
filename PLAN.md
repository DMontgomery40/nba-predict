# Signal Console Plan

## Goal

Keep `nba-predict` truthful as a live NBA trader-incident console:

- whole-board money-weighted volatility is the primary live trigger
- broad prediction-market weirdness is the secondary discovery lane
- exact-line player-prop disagreement is a specialist follow-up lane
- historical replay answers what the trader would have seen and how much earlier a warning could have arrived

## What Is True Now

- The live board trigger is the shared `board-vw` runtime exposed by `/api/v1/research/board-volatility` and reused in `/api/v1/research/board-alerts`.
- The current live runtime uses 60-second whole-board quote buckets, `Σ |Δ implied probability| * log1p(volume)`, a trailing `median + 3*MAD` threshold over the prior 20 non-empty buckets, and an 8-bucket warmup.
- `outputs/innovation-team-suspend-signal-report/report.html` is the active research rationale for the board-first and off-price detector family, but current code and current API payloads define the exact live trigger behavior.
- Player-prop alerts still matter, but they are not the root desk headline.
- The repo now has one active doc layer. Stale prompts, proposals, and exploratory notes were moved into `.docs-archive/2026-05-repo-audit/`.

## Stable Capabilities

- Live-only SQLite storage with append-only quote, game-state, raw-payload, adapter-run, mapping, play-by-play, and microstructure tables.
- Fastify read models for games, divergence, history, exports, trader incidents, board volatility, market anomalies, player-prop alerts, and admin controls.
- Worker capture loops for NBA sidecar sync plus direct Kalshi, Polymarket, Odds-API-backed Bet365, and historical backfills.
- Watcher and playback workflows for market anomalies and player-prop alerts.
- Desk, Board Alerts, Market Anomalies, Prop Alerts, History, Exports, and Settings routes in the web app.
- Honest readiness behavior when the sidecar, env, or persisted live data are missing.

## Next Slices

1. Keep `/api/v1/research/board-alerts/incidents` and related historical reads fast enough that operator surfaces stay truthful without multi-second stalls.
2. Keep tightening event-context and replay honesty around real NBA play-by-play anchors and stale-state edge cases.
3. Expand direct microstructure capture where it improves trader usefulness: Polymarket book or spread depth and richer Kalshi trade or orderbook surfaces.
4. Improve the follow-up layer after a board trigger: clearer culprit ranking, better fanout evidence, and better uncertainty labeling.
5. Attach exposure or liability context once the feed exists so follow-up ranking can move beyond pure price or volume signals.
6. Keep widening end-to-end validation around env -> worker -> DB -> API -> UI for the live-only operator path.

## Non-Negotiables

- No synthetic runtime modes.
- No authored scenario packs.
- No pretending coverage gaps are healthy states.
- No turning line mismatch into fake like-for-like divergence.
- No presenting isolated prop disagreement as the primary trader trigger.
- No historical replay that looks past the replay clock.
- No archived prompt, proposal, or note should outrank current code, `AGENTS.md`, `README.md`, or the active specs.
