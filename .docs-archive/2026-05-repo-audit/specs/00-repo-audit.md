# Repo Audit

## Current Shape

- Monorepo with web, API, worker, and Python NBA sidecar apps
- SQLite-backed live research repository layer
- Instrument-first research APIs already implemented
- Frontend mid-migration toward live-only workflows

## Confirmed Product Direction

- This repo is for live research, not presentation scenarios
- The product should compare real source captures and real NBA state
- Historical views must be rebuilt from persisted quote and game-state history

## Risks

- Real-source capture adapters are still incomplete
- Frontend still needs additional live-only polish
- Readiness is intentionally strict and will remain red until real inputs are configured and ingest has written data
