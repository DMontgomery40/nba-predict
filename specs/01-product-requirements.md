# Product Requirements

## Product Summary

Signal Console is an internal NBA market-intelligence and trader decision-support product for bet365 stakeholders. It compares bet365 book state against external signal sources such as Kalshi, Polymarket, and NBA context data, then surfaces divergence, confidence, freshness, provenance, and recommended next actions.

## Personas

- Trader
  - needs the fastest honest view of where bet365 may be stale or overexposed
- Product / leadership reviewer
  - needs a polished demo that clearly communicates why the product matters
- Research / quant analyst
  - needs transparent scoring logic, replay, and backtest-friendly artifacts
- Platform / data engineer
  - needs clear adapter boundaries, diagnostics, and portable contracts

## Primary Use Cases

- Scan the slate for the highest-priority divergence opportunities.
- Open a single matchup and understand what changed, why it matters, and what to inspect next.
- Compare how disagreement evolved over time across sources.
- Review source health and freshness before trusting a signal.
- Maintain an internal watchlist for the markets worth active trader review.
- Run demo and replay scenarios without depending on live external APIs.

## Functional Requirements

- `FR-001` The product shall support `demo`, `replay`, and `live` operating modes.
- `FR-002` The product shall provide an overview dashboard that ranks events by watchlist priority and divergence severity.
- `FR-003` The product shall provide an event workspace showing source probabilities, signal score, confidence, narrative reasons, and audit context for a selected NBA event.
- `FR-004` The product shall provide a divergence explorer with sortable and filterable cross-event scanning.
- `FR-005` The product shall provide a timeline view showing how divergence changed over time.
- `FR-006` The product shall provide a watchlist surface with priority, alert reasons, and last-change metadata.
- `FR-007` The product shall provide a diagnostics/settings surface showing mode, adapter health, last sync times, and fixture selection.
- `FR-008` The product shall expose deterministic reason codes and readable narrative summaries for each surfaced signal.
- `FR-009` The product shall label freshness, provenance, and source availability for all surfaced market data.
- `FR-010` The product shall degrade gracefully when any live source is stale, missing, or unhealthy.
- `FR-011` The product shall support a command palette and keyboard-first navigation for major operator flows.
- `FR-012` The product shall persist normalized snapshots, replay frames, watchlist state, and audit events in portable storage.
- `FR-013` The product shall preserve audit context for important signal events and suggested trader actions.

## Non-Functional Requirements

- `NFR-001` Core scoring logic shall be deterministic and implemented without LLM dependency.
- `NFR-002` All runtime TypeScript projects shall use strict type checking.
- `NFR-003` API boundaries shall validate inputs and outputs with Zod.
- `NFR-004` Demo mode shall run with zero external network dependency.
- `NFR-005` The product shall remain legible and usable on laptop-sized viewports.
- `NFR-006` The UI shall emphasize dense readability over decorative excess.
- `NFR-007` The system shall expose source freshness and health within one API hop of the UI.
- `NFR-008` Storage choices shall be portable enough to migrate from SQLite to Postgres later.
- `NFR-009` Logs and server failures shall be structured and operator-readable.
- `NFR-010` The changed surface shall be covered by automated unit, integration, and end-to-end tests.

## Constraints

- No public sportsbook betting flow.
- No wallet or execution flow.
- No pretending stale data is live.
- No hidden weighting or black-box numeric output.
- No LLM-driven probability math.

## Success Criteria

- Traders can identify the most important market on the slate within 3 seconds of loading the overview.
- Event detail answers three questions immediately: what changed, why it matters, and what to do next.
- Demo mode remains visually compelling and operational even if all live adapters are disabled.
- Signal scoring, narrative reasons, and freshness states are traceable in tests and inspectable in the UI.
