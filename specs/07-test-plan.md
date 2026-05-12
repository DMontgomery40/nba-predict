# Test Plan

## Objectives

- `TEST-001` Prove that live repositories preserve append-only history and honest dedupe behavior.
- `TEST-002` Prove that live APIs are backed by persisted research data.
- `TEST-003` Prove that readiness fails honestly when required live inputs are missing.
- `TEST-004` Prove that the web shell can render tracked games, divergence, instrument detail, and operations views from live routes.

## Core Coverage

- `TEST-005` Quote observation dedupe and heartbeat writes
- `TEST-006` Game-state append semantics
- `TEST-007` Line mismatch versus comparable classification
- `TEST-008` Raw payload and source-market provenance exposure
- `TEST-009` Manual mapping resolution flow
- `TEST-010` NBA sidecar normalization helpers
- `TEST-011` Worker-side NBA sidecar ingest and adapter-run logging
- `TEST-011A` NBA sidecar window syncs continue through isolated date failures but fail honestly when every requested date fails.
- `TEST-012` Readiness red state when sidecar/session/auth/live-data inputs are missing
- `TEST-013` Trader desk root route renders the ranked queue, capture tape, historical backfill feasibility, and pending user-behavior metric from persisted APIs without requiring a non-empty live slate.
- `TEST-014` Historical backfill workers must prove source observations append idempotently into canonical quote/raw-payload tables and record historical adapter runs.
- `TEST-015` Signal-quality research must prove closed-game cutoffs exclude post-settlement ticks where appropriate and compute Brier/log-loss/winner-accuracy metrics from persisted data.
