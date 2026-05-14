# Research Prioritization Spec

## Objective

Signal Console should rank instruments for operator review using live comparison state rather than a synthetic scenario engine.

## Rules

- `SIG-001` Moneyline-like markets rank primarily by implied-probability divergence.
- `SIG-002` Spread, total, and prop markets must downgrade or separately classify line mismatch.
- `SIG-003` Freshness and source coverage should influence priority.
- `SIG-004` The operator must still be able to inspect raw per-source state even when priority is low.
- `SIG-005` A probability divergence is valid only when Bet365 and at least one non-Bet365 market source have quotes inside the configured same-time window for the same canonical instrument.
- `SIG-006` Player-prop live alerts require Bet365 plus Kalshi or Polymarket, matching canonical player/outcome, matching line, quote timestamps no later than the poll time, and quote age inside the configured live window unless old-quote inclusion is explicitly requested.
- `SIG-007` Historical review rows should rank by the peak same-time divergence for a finished game, while live rows should rank by the latest same-time divergence and also expose how long the alert threshold was exceeded.
- `SIG-008` Prediction-market anomaly alerts rank broad market weirdness across Kalshi and Polymarket before exact attribution is known. Scoring combines off-price prints, volume share, volatility, liquidity/spread/depth, and cross-venue disagreement, with lower confidence for sampled/candle-only evidence.
- `SIG-009` Bet365 exposure is optional context for market anomaly detection. Exact-line Bet365 requirements remain scoped to the player-prop alert compatibility route.
