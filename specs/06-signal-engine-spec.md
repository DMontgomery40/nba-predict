# Alerting And Prioritization Spec

## Objective

Signal Console should rank operator attention using live persisted comparison state and live persisted microstructure, not a synthetic scenario engine.

## Rules

- `SIG-001` Whole-board money-weighted volatility is the primary live trader trigger.
- `SIG-002` The root desk and board-alert flows shall stay board-first: if a whole-game tripwire and a likely player fanout appear in the same shock window, the whole-game card stays the headline and the player follow-up lives underneath it.
- `SIG-003` Prediction-market anomalies are the broad weirdness lane. Scoring combines off-price prints, volume share, spread/depth stress, sustained repricing, and cross-venue disagreement.
- `SIG-004` Exact-line player-prop alerts require Bet365 plus Kalshi or Polymarket on the same canonical instrument and same line inside the configured quote windows.
- `SIG-005` Spread, total, and prop markets must separate line mismatch from like-for-like probability divergence.
- `SIG-006` Freshness, source coverage, mapping status, and source kind should influence ranking and confidence.
- `SIG-007` The operator must still be able to inspect raw per-source state even when a row or card ranks low.
- `SIG-008` Sportsbook line or odds movement and prediction-market trade or orderbook microstructure are scored on the same probability axis but with different feature families.
- `SIG-009` Broad tripwires may fire before the system can honestly pinpoint a culprit prop. The product should then present best-effort fanout rather than fabricate precision.
- `SIG-010` Historical replay must use only rows at or before the replay clock. Post-game current divergence is not the primary signal for completed games.
