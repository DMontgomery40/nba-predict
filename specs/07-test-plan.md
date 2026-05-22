# Test Plan

## Objectives

- `TEST-001` Prove that live repositories preserve append-only history and honest dedupe behavior.
- `TEST-002` Prove that live APIs are backed by persisted research data.
- `TEST-003` Prove that readiness fails honestly when required live inputs are missing.
- `TEST-004` Prove that the web shell can render desk, board-alert, anomaly, prop-alert, game, history, export, and settings views from live routes.

## Core Coverage

- `TEST-005` Quote observation dedupe and heartbeat writes.
- `TEST-006` Game-state append semantics.
- `TEST-007` NBA play-by-play persistence and event-context honesty.
- `TEST-008` Line mismatch versus comparable classification.
- `TEST-009` Raw payload and source-market provenance exposure.
- `TEST-010` Manual mapping resolution flow.
- `TEST-011` Env loading for API and worker from repo-root `.env.local` then `.env`.
- `TEST-012` Worker-side sidecar ingest and adapter-run logging.
- `TEST-013` Worker provider isolation and honest partial-failure reporting.
- `TEST-014` Whole-board volatility route and board-alert route stay aligned on the shared runtime.
- `TEST-015` Market anomaly scoring, filters, and playback reads stay backed by persisted quote or microstructure data.
- `TEST-016` Player-prop alerts require the strict same-line, same-canonical-instrument comparison path.
- `TEST-017` History and replay stay no-future-leakage.
- `TEST-018` Export routes stream real persisted data packages and slices.
- `TEST-019` Readiness uses bounded probes and fails honestly on missing sidecar, missing env, or missing live data.

## Standard Validation Commands

```bash
pnpm verify
cd apps/nba-sidecar && uv run pytest
```
