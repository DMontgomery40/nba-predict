# Test Plan

## Objectives

- `TEST-001` Prove that the deterministic scoring engine behaves predictably across normal and edge-case inputs.
- `TEST-002` Prove that demo and replay modes stay usable without live adapters.
- `TEST-003` Prove that API and UI contracts remain aligned.

## Unit Tests

- `TEST-004` Domain schema validation for canonical contracts
- `TEST-005` Probability normalization helpers
- `TEST-006` Freshness-band calculation across threshold edges
- `TEST-007` Liquidity weighting and suppression logic
- `TEST-008` Divergence score and severity band mapping
- `TEST-009` Narrative reason generation from reason codes

## Contract Tests

- `TEST-010` Adapter normalizers map raw fixture payloads into canonical domain records.
- `TEST-011` API response schemas validate overview, event detail, timeline, watchlist, and diagnostics payloads.
- `TEST-012` Replay frames maintain required provenance and timestamp fields.

## Integration Tests

- `TEST-013` Demo fixture ingestion populates snapshots, events, and watchlist read models.
- `TEST-014` Replay selection changes event timeline responses deterministically.
- `TEST-015` Diagnostics reflect stale or offline sources honestly.
- `TEST-016` Watchlist mutations persist and round-trip through API reads.
- `TEST-030` API health/readiness routes shall fail honestly when persisted replay selection or storage integrity is invalid.
- `TEST-031` Database handle reuse shall not leak state across changed SQLite paths.

## End-to-End Tests

- `TEST-017` Overview loads in demo mode and opens a high-severity event into the workspace.
- `TEST-018` Divergence explorer filters and sorting update the visible rows and URL state.
- `TEST-019` Replay mode steps frames and updates timeline and narrative cards.
- `TEST-020` Settings mode switch updates the shell and diagnostics surfaces.
- `TEST-032` Settings shall surface readiness/liveness status and fixture mutation feedback without leaving the shell.

## Frontend Reliability Tests

- `TEST-033` Overview route renders operator cards from the query layer.
- `TEST-034` Event workspace failure state shall expose retry affordance and operator-facing error detail.

## Demo-Mode Validation

- `TEST-021` Demo mode shall run without any external network access.
- `TEST-022` Demo fixtures shall include several NBA events with at least one clear storyline and one stale-source case.

## Replay Validation

- `TEST-023` Replay storylines shall include annotations for lead/confirm/reversal moments.
- `TEST-024` Frame stepping shall be deterministic and reversible within bounds.

## Acceptance Criteria by Feature

- `TEST-025` `FR-002`, `FR-003`, `FR-008`, and `FR-009` are satisfied when an event can be opened from overview and the workspace shows probabilities, signal score, confidence, reasons, and provenance.
- `TEST-026` `FR-001`, `FR-007`, and `FR-010` are satisfied when mode changes and unhealthy sources remain visible without breaking the shell.
- `TEST-027` `FR-004` and `FR-011` are satisfied when the explorer supports filters, sorting, and command-palette entry points.
- `TEST-028` `FR-005` is satisfied when timeline overlays change with replay frames and expose annotations.
- `TEST-029` `FR-006` and `FR-013` are satisfied when watchlist actions and audit events round-trip through the API and UI.
