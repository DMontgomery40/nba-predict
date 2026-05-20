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
- `SIG-010` Trader-incident alerts are scored as a likelihood ratio of H1 (abnormal incident) against H0 (normal market dynamics). Each scored observation must expose its raw value, normalized contribution, missing-data status, and a short explanation string suitable for Inspect.
- `SIG-011` H0 baseline features must include time-to-tip when known, live period/clock/score/margin when known, market family, source kind (sportsbook vs prediction market), quote age, and liquidity/spread/depth where available. H0 must suppress ordinary pregame drift, ordinary close-game global repricing, thin bid/ask noise alone, and stale-quote-only fires.
- `SIG-012` Sportsbook line/odds movement and prediction-market orderbook/trade microstructure are scored on the same probability axis but with distinct microstructure feature sets (line move, suspension/removal/reopen behavior for sportsbooks; off-price distance, volume share, spread/depth stress for prediction markets).
- `SIG-013` Observations are grouped into coherent incident clusters using a fanout/coherence graph keyed by game, mapped player, possible paired player, team and opponent, stat family, compound-stat relations (such as rebounds → RA/PRA/double-double/triple-double), scoring relations, market family, and source. Mapped relations contribute high evidence; unmapped label-token similarity contributes lower evidence and is marked as such.
- `SIG-014` Alert classification chooses exactly one of: pregame availability tripwire, near-tip availability tripwire, game-state implied-volatility tripwire, attribution-shaped player follow-up, market-structure tripwire, cross-surface follow-up, or coverage/mapping/timing gap. Whole-game implied volatility is the earliest board-level prediction-market tripwire across multiple core game-state families; individual props remain supporting evidence unless the shape is truly attribution-specific. Selection is evidence-driven, conservative, and explainable from the scored observations.
- `SIG-015` Live alerts use short rolling windows with first-clear-pop-time captured to the second. Repeated similar shocks are suppressed; a materially new shock (different shape or substantially higher confidence) may create a new alert. History replay must use only data with `event_timestamp` (or `captured_at` where event time is absent) at or before the replay clock; post-game current divergence shall not be used as the primary signal for completed games.
