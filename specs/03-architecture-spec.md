# Architecture Spec

## System Overview

Signal Console is composed of:

- a React web app for trader-facing operator workflows
- a Fastify API for live read models, health, research, exports, and admin routes
- a worker for ingest orchestration, backfills, and watcher jobs
- a Python `nba_api` sidecar for NBA scoreboard and play-by-play normalization
- shared domain, repository, adapter, and signal packages

## Boundaries

- `apps/web`
  - renders Desk, Board Alerts, Market Anomalies, Prop Alerts, Games, History, Exports, and Settings
  - never invents a client-side detector that diverges from API or shared runtime output
- `apps/api`
  - loads repo-root env
  - exposes health, research, export, games, divergence, and admin routes
  - composes read models from persisted storage only
- `apps/worker`
  - loads repo-root env
  - orchestrates live sync, backfills, admin action work, and watcher jobs
  - isolates per-provider failures so one outage does not poison the whole cycle
- `apps/nba-sidecar`
  - normalizes NBA upstream payloads
  - does not own persistence
- `packages/shared`
  - SQLite access, repositories, env loading, signal logic, and operational helpers
- `packages/adapters`
  - venue-specific capture and backfill code
- `packages/domain`
  - schemas and typed contracts shared across apps

## Runtime Data Flow

1. The worker pulls normalized NBA game state and play-by-play through the sidecar.
2. The worker ingests sportsbook and prediction-market data through adapters into canonical storage.
3. `packages/shared` materializes divergence, anomaly, and board-volatility read models from persisted rows.
4. The API exposes those read models without a separate shadow detector in the web client.
5. The web surfaces whole-board tripwires first, then lets the operator inspect fanout, anomalies, strict prop disagreements, history, exports, and settings.

## Storage

- SQLite is the v1 system of record.
- Core persisted live entities live in canonical tables such as `games`, `game_states`, `nba_play_by_play_actions`, `market_instruments`, `source_markets`, `quote_ticks`, `raw_payloads`, `adapter_runs`, `mapping_resolutions`, and `game_outcomes`.
- Prediction-market trade and book structure lives in `market_microstructure_events`.
- Board-volatility calibration lives in `board_volatility_baselines`.
- Watcher playback frames are written as JSONL under `data/player-prop-alert-playback/` and `data/market-anomaly-playback/`.

## Boundary Rules

- Web and API consume persisted live data, not synthetic in-memory scenarios.
- Whole-board volatility is the primary trader trigger. Exact-line prop disagreement is a follow-up surface, not the main desk ordering rule.
- The sidecar owns normalization; the worker owns persistence.
- Admin routes enqueue or trigger explicit operational work. They should not fake success for work the runtime cannot perform.
- Generated build output stays downstream of the live-only source tree.
- Archived docs are not architecture inputs.
