# Architecture Spec

## System Overview

Signal Console is composed of:

- a React web app for live research workflows
- a Fastify API for live read models and admin routes
- a worker for ingest orchestration
- a Python `nba_api` sidecar for NBA game-state normalization, with official NBA CDN schedule fallback for future games omitted by `scoreboardv2`
- shared domain and repository packages

## Backend Responsibilities

- persist append-only live game and quote history
- compose research read models from persisted history
- compute urgent player-prop attribution alerts from fresh mapped Bet365 and Kalshi/Polymarket quote overlap
- serve player-prop alert playback frames written by the watcher
- stream data-engineering exports from the persisted SQLite store without requiring browser-side staging
- expose operator/admin routes for health, coverage, unmapped markets, and source state
- emit structured errors and logs

## Worker Responsibilities

- ingest normalized NBA sidecar payloads across a recent-plus-lookahead date window and preserve partial-date failures without hiding full-window outages
- ingest Polymarket NBA game markets through the official Gamma API
- ingest Bet365 NBA markets through the backend-only Odds-API.io backup provider when `ODDS_API_KEY` is present, bounded to pending/live NBA events around the active target slate before requesting odds for matched event ids
- ingest direct Kalshi NBA market data through `KALSHI_API_KEY`, including milestone-related game, spread, total, team-prop, player-prop, period, overtime, and related event families
- log adapter runs and ingest outcomes
- keep direct public Bet365 capture behind the same storage model as it matures
- isolate market-provider failures inside a worker cycle so one source outage does not block later source refreshes
- run an optional player-prop alert watcher that records every poll frame and sends desktop notifications for newly observed alert ids
- back off cleanly on unrecoverable cycle failure

## Storage

- SQLite for v1 portability
- append-only tables for `game_states`, `quote_ticks`, and `raw_payloads`
- relational links between canonical instruments and per-source markets
- JSONL operational playback frames under `data/player-prop-alert-playback/`

## Boundary Rules

- Web and API should consume persisted live data, not synthetic in-memory scenarios.
- The NBA sidecar normalizes raw upstream payloads; the worker owns persistence.
- Admin actions should enqueue explicit operational work rather than mutating state implicitly inside request handlers.
- Generated build output must remain downstream of the live-only source tree; stale artifacts should be rebuilt or removed rather than treated as a separate runtime surface.
- User-behavior anomaly metrics must stay pending until user event data is persisted and queryable.
