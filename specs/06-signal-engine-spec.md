# Research Prioritization Spec

## Objective

Signal Console should rank instruments for operator review using live comparison state rather than a synthetic scenario engine.

## Rules

- `SIG-001` Moneyline-like markets rank primarily by implied-probability gap.
- `SIG-002` Spread, total, and prop markets must downgrade or separately classify line mismatch.
- `SIG-003` Freshness and source coverage should influence priority.
- `SIG-004` The operator must still be able to inspect raw per-source state even when priority is low.
