# Architecture Spec

## System Overview

Signal Console is a monorepo-based internal product composed of:

- a React web application for operator workflows
- a Fastify API for serving normalized, scored event views
- a worker process for polling adapters, generating snapshots, and preparing replay timelines
- shared packages for contracts, adapters, scoring, persistence, and UI

## Frontend Architecture

- React + TypeScript + Vite
- React Router for routed surfaces and URL-driven filters
- TanStack Query for server-state fetching and caching
- Zustand for lightweight shell state such as active mode, drawers, and command palette status
- `packages/ui` for shared operator-console components

Frontend responsibilities:

- shell layout and keyboard flows
- data visualization and comparison surfaces
- optimistic watchlist interactions where appropriate
- clear labeling of freshness, staleness, and mode provenance

## Backend Architecture

- Fastify + TypeScript
- Zod validation at route boundaries
- service layer for assembling read models
- repository layer over SQLite
- adapter layer separated from HTTP concerns

Backend responsibilities:

- serve overview, event detail, timeline, watchlist, and diagnostics read models
- normalize demo, replay, and live inputs into the same domain contracts
- run deterministic signal scoring
- emit structured health and freshness metadata
- emit structured logs with request correlation and typed runtime errors
- expose split liveness/readiness probes backed by real storage and mode-resolution checks

## Worker Architecture

The worker owns:

- live adapter polling
- snapshot persistence
- replay-frame generation and indexing
- fixture hydration
- adapter health sampling
- structured cycle logging
- graceful shutdown and exception-isolated polling loops
- retry/backoff behavior when a cycle fails

## Data Flow

1. Adapters fetch raw source payloads.
2. Normalizers map raw payloads into canonical domain records.
3. Records are persisted as normalized snapshots and health samples.
4. The signal engine derives divergence, confidence, priority, and reason codes.
5. API services compose UI-oriented read models.
6. The web app fetches those read models and renders operator workflows.

## Adapter Boundaries

- bet365 internal source adapter
- Kalshi source adapter
- Polymarket source adapter
- NBA context adapter
- fixture adapter for demo mode
- replay adapter for indexed snapshot sequences

All adapters must return canonical records plus provenance metadata.

## Storage Decisions

- SQLite for local portability and demo friendliness
- Drizzle schema definitions sized for future Postgres migration
- snapshot-oriented tables for events, quotes, health, timelines, watchlist entries, and audit events

Reference:

- `ADR-001` package boundaries
- `ADR-002` mode strategy
- `ADR-003` scoring boundary

## Cache Strategy

- short-lived in-memory API cache for read-model composition
- query-keyed frontend cache through TanStack Query
- source freshness derived from persisted timestamps rather than cache age alone

## Polling and Refresh Strategy

- Demo mode: no polling, fixture-based.
- Replay mode: frame stepping plus optional timed playback.
- Live mode: worker polling at source-specific intervals with health and stale thresholds.
- Failed worker cycles should not crash the process; they should log structured errors, back off, and retry.

Suggested defaults:

- Kalshi: 15s
- Polymarket: 15s
- NBA context: 60s
- Internal book/demo shadow: 15s

## Replay Mode Strategy

Replay mode uses a selected storyline of ordered frames. Each frame contains:

- canonical event state
- source quotes and health
- scoring outputs
- annotations for major signal changes

The UI can step or autoplay through frames without calling external APIs.
