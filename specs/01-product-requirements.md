# Product Requirements

## Product Thesis

Signal Console is a live NBA trader-incident detector for Bet365-style operator review. The system exists to warn quickly enough that a trader can review or suspend the right markets when a stat may be misattributed, corrected, or otherwise unstable. The main live trigger is broad whole-board money-weighted volatility. After that trigger fires, the product must fan out into likely players, props, and related markets with honest uncertainty.

Sportsbooks and prediction markets are different signal surfaces. They may be normalized onto a common probability axis for comparison, but they must not be treated as identical microstructure. The system is live-only, persisted-data-only, and does not produce gambling recommendations.

## Functional Requirements

- `FR-001` The product shall serve live-only research workflows.
- `FR-002` The root desk shall lead with whole-board `game-state-volatility` by game, not isolated prop rows.
- `FR-003` When a broad trigger fires, the system shall fan out into likely players, stat families, related markets, and important uncertainty.
- `FR-004` The product shall expose a broad prediction-market weirdness lane for off-price prints, volume share, spread/depth stress, sustained repricing, and cross-venue disagreement.
- `FR-005` The product shall keep the exact-line player-prop alert route as a specialist compatibility and follow-up workflow, not the primary desk headline.
- `FR-006` The product shall expose tracked games with current game state, coverage, and direct navigation into market detail.
- `FR-007` The product shall expose instrument-level views with per-source quotes, raw line terms, implied probabilities, timelines, and provenance.
- `FR-008` The product shall separate line mismatch from like-for-like probability divergence.
- `FR-009` The product shall expose unmapped markets and allow manual resolution.
- `FR-010` The product shall expose operator-facing source health, readiness, coverage, admin actions, and exports.
- `FR-011` The product shall ingest NBA game-state, outcomes, and play-by-play through a Python `nba_api` sidecar with honest fallback behavior.
- `FR-012` The product shall persist enough raw and normalized history to answer what each source showed over time for a completed or live game.
- `FR-013` Historical replay shall use no future leakage and answer what the trader would have seen and how much earlier a warning could have appeared.
- `FR-014` If the system cannot name a precise culprit market yet, it shall still surface the game-level tripwire honestly and then present best-effort follow-up rather than fabricating precision.
- `FR-015` If the system cannot support a workflow with persisted live data yet, it shall describe that workflow as pending rather than inventing fallback data.

## Non-Functional Requirements

- `NFR-001` Runtime errors shall use stable typed envelopes.
- `NFR-002` Health and readiness shall fail honestly when required live dependencies or persisted live data are missing.
- `NFR-003` Storage shall remain portable through SQLite for v1 while preserving append-only history.
- `NFR-004` The system shall never silently substitute synthetic data for missing live data.
- `NFR-005` Node runtime entrypoints shall load repo-local env files without overriding explicit shell exports.
