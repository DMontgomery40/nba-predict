# Architecture Spec

## System Overview

Signal Console is composed of:

- a React web app for live research workflows
- a Fastify API for live read models and admin routes
- a worker for ingest orchestration
- a Python `nba_api` sidecar for NBA game-state normalization
- shared domain and repository packages

## Backend Responsibilities

- persist append-only live game and quote history
- compose research read models from persisted history
- stream data-engineering exports from the persisted SQLite store without requiring browser-side staging
- expose operator/admin routes for health, coverage, unmapped markets, and source state
- emit structured errors and logs

## Worker Responsibilities

- ingest normalized NBA sidecar payloads across a recent-plus-lookahead date window
- ingest Polymarket NBA game markets through the official Gamma API
- ingest Bet365 NBA markets through the backend-only Odds-API.io backup provider when `ODDS_API_KEY` is present
- ingest direct Kalshi NBA market data through `KALSHI_API_KEY`, including milestone-related game, spread, total, team-prop, player-prop, period, overtime, and related event families
- log adapter runs and ingest outcomes
- keep direct public Bet365 capture behind the same storage model as it matures
- back off cleanly on failure

## Storage

- SQLite for v1 portability
- append-only tables for `game_states`, `quote_ticks`, and `raw_payloads`
- relational links between canonical instruments and per-source markets

## Boundary Rules

- Web and API should consume persisted live data, not synthetic in-memory scenarios.
- The NBA sidecar normalizes raw upstream payloads; the worker owns persistence.
- Admin actions should enqueue explicit operational work rather than mutating state implicitly inside request handlers.
- Generated build output must remain downstream of the live-only source tree; stale artifacts should be rebuilt or removed rather than treated as a separate runtime surface.
