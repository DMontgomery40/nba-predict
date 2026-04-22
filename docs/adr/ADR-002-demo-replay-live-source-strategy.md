# ADR-002: Support Demo, Replay, and Live Modes Through a Shared Normalization Pipeline

## Status

Accepted

## Context

The product must remain impressive even when external APIs are unavailable or unstable. The plan explicitly requires demo mode, replay mode, and live mode, with honest freshness labeling and graceful degradation.

## Decision

All modes will flow through the same normalization and scoring pipeline:

- Demo mode reads curated fixture packs with deterministic snapshots.
- Replay mode reads ordered timeline frames from stored fixtures and snapshot history.
- Live mode reads from adapters that normalize external responses into canonical domain records.

The API will expose mode metadata explicitly, and every record will include provenance and freshness state so the UI can label degraded or stale inputs without pretending they are live.

## Consequences

Positive:

- demo and replay surfaces exercise the same code paths as live mode
- live-source outages do not break the operator workflow
- acceptance tests can prove mode parity instead of maintaining three disconnected implementations

Negative:

- adapters must normalize into richer internal shapes up front
- replay fixture quality becomes a product concern rather than a throwaway test concern

## Follow-Up

- Persist normalized snapshots in a portable SQLite schema.
- Treat replay frames as first-class domain objects.
- Expose source health in overview and diagnostics routes.
