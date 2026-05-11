# Product Requirements

## Product Thesis

Signal Console is a research system for live in-game market comparison. It should help an operator understand where book structure, prediction-market prices, and actual game context disagree, with full provenance and no synthetic fallback path.

## Functional Requirements

- `FR-001` The product shall serve live-only research workflows.
- `FR-002` The product shall expose tracked games with current game state, coverage, and top divergence summaries.
- `FR-003` The product shall expose instrument-level views with per-source quotes, raw line terms, implied probabilities, and provenance.
- `FR-004` The product shall expose append-only quote and game-state timelines for one canonical instrument.
- `FR-005` The product shall separate line mismatch from like-for-like probability divergence.
- `FR-006` The product shall expose unmapped markets and allow manual resolution.
- `FR-007` The product shall expose operator-facing source health and readiness state.
- `FR-008` The product shall ingest NBA game-state and outcomes through a Python `nba_api` sidecar.
- `FR-009` The product shall persist enough raw and normalized history to answer what each source showed over time for a completed or live game.
- `FR-010` The product shall expose a game-level workspace with market-family switching, grouped instruments, and direct navigation into one instrument timeline.
- `FR-011` The product shall export instrument timeline research artifacts with provenance and timestamps.
- `FR-012` The product shall ingest live Polymarket NBA game markets through official APIs into canonical instruments, source markets, quote ticks, raw payloads, and adapter runs.
- `FR-013` The product shall expose first-class player-prop attribution risk alerts when mapped Bet365 props and mapped prediction-market props materially disagree inside a fresh quote window. These alerts are manual-review signals, not automatic source correction or settlement decisions.
- `FR-014` The product shall support live player-prop alert monitoring with desktop notification emission and a persisted replay tape so trading can inspect what the alert surface looked like at the time it fired.

## Non-Functional Requirements

- `NFR-001` Runtime errors shall use stable typed envelopes.
- `NFR-002` Health/readiness shall fail honestly when required live dependencies or persisted live data are missing.
- `NFR-003` Storage shall remain portable through SQLite for v1 while preserving append-only history.
- `NFR-004` The system shall never silently substitute synthetic data for missing live data.
- `NFR-005` Node runtime entrypoints shall load repo-local env files without overriding explicit shell exports.
