# Board-Anomaly Model Spec

This spec defines the statistical target of the NBA board-anomaly detector before any model code. The detector must implement this shape; it does not need a false-precision academic model on day one. Companion documents: [`01-product-requirements.md`](01-product-requirements.md), [`06-signal-engine-spec.md`](06-signal-engine-spec.md), [`../docs/board-state-inventory.md`](../docs/board-state-inventory.md).

## 1. Board State `B(t)`

At time `t`, for one NBA game, the board state is the set of observable per-source market rows for that game plus the current game-state context:

```text
B(t) = {
  per_source_observations: BoardObservation[],
  game_state: { status, period, clock, home_score, away_score, time_to_tip },
  coverage_flags: { sources_seen, sources_missing, mapping_status }
}
```

Each `BoardObservation` carries: `source` (bet365 / fanduel / draftkings / kalshi / polymarket), `source_kind` ("sportsbook" or "prediction-market"), `market_family`, mapped participant key when present, raw label tokens when unmapped, the source timestamp and capture timestamp, the price / implied probability / line, the sportsbook line and odds when applicable, the prediction-market bid / ask / depth / trade fields when applicable, optional volume and notional, an optional `suspension` flag, and an explicit `missing` map for every field the source did not provide.

The detector works in probability and logit space where possible:

```text
x_i(t) = logit(p_i(t)) = log(p_i(t) / (1 - p_i(t)))
```

## 2. Hypotheses

The detector scores recent board movement against two hypotheses:

- **H0 — normal market dynamics**: the change `Delta B(t)` is explainable by time-to-tip, ordinary pregame drift, period/clock/score/margin, latency and quote age, normal sportsbook line repricing, normal prediction-market bid/ask noise, ordinary close-game global repricing, and per-venue baseline volatility.
- **H1 — abnormal board shock**: the change is more likely under at least one of the following shock kinds:
  - pregame availability shock (injury, lineup, rest, or scratch news priced in late);
  - near-tip availability shock (scratch or unexpected availability after the slate has set);
  - attribution-shaped in-game shock (residual movement coherent with a single stat-event / player attribution);
  - market-structure shock (off-price prints, sudden volume share, liquidity collapse, sustained repricing);
  - cross-surface disagreement (sportsbook vs prediction-market disagreement that persists after latency, liquidity, and vig adjustment);
  - coverage / mapping / timing gap (a market that should exist or move is missing, stale, or unmapped on a game where peers are moving).

## 3. Score Shape

The headline score for a candidate board shock at time `t` is the log-likelihood ratio of the two hypotheses on the recent window:

```text
score(t) ~= log P(Delta B(t) | H1 abnormal board shock)
            - log P(Delta B(t) | H0 normal market dynamics)
```

The first implementation approximates this as a weighted sum of normalized contributions. Each contribution must remain interpretable as evidence for H1, evidence for H0, or a reliability / data-coverage adjustment. The detector must never emit a score whose components cannot be enumerated.

## 4. Residual Movement

For each observation, compute the expected move under H0 first, then take the residual:

```text
residual_i(t) = observed_move_i(t) - expected_move_i(t | H0 context)
```

`observed_move_i(t)` is `Delta x_i(t)` for probability/logit moves and the equivalent normalized move for sportsbook line moves. `expected_move_i(t | H0 context)` is the baseline movement the H0 layer predicts for that market family at that game state and quote age. Only the residual is fed to H1 scoring.

## 5. Sportsbook vs Prediction-Market Microstructure

Both surfaces are normalized onto the probability axis for residual computation, but their microstructure feature sets differ:

| Surface                                    | Microstructure features the detector scores                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| sportsbook (bet365 / fanduel / draftkings) | line move, odds move, suspension / removal / reopen behavior, cross-book line disagreement, stale-quote age, no traded-volume input expected                 |
| prediction market (kalshi / polymarket)    | off-price trade distance from the recent reference price, volume share, spread, depth score, sustained repricing vs isolated print, cross-venue disagreement |

A sportsbook line move and a prediction-market off-price fill are not added together as if they were the same event. They flow into separate components and only converge at the board-level coherence stage.

## 6. Fanout / Coherence Graph

A single residual is suggestive; a coherent fanout is evidence. The detector groups residuals into candidate board shocks using a relation graph:

- same game (always),
- mapped player (when `participant_key` resolves),
- possible paired player (when a stat is a possession-or-attribution-pair candidate, such as rebound or assist),
- team and opponent,
- stat family (points, rebounds, assists, threes, steals, blocks, RA, PRA, double-double, triple-double, team total, period, race-to-X, moneyline, spread, total),
- compound-stat relation (e.g., rebound -> RA / PRA / double-double / triple-double),
- scoring relation (e.g., assist or three -> team total / period / race-to-X),
- market family,
- source family,
- mapped / unmapped label-token similarity when no mapping exists yet.

Mapped relations contribute high coherence weight. Unmapped label-token relations contribute lower weight and must remain marked as `evidence_unmapped` so Inspect shows the trader the relation was inferred from raw text.

## 7. Shock Classification

Every emitted alert chooses exactly one of these kinds, by evidence:

| Kind                            | Necessary evidence (post-H0)                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pregame availability shock      | game state is pre-tip, residual movement is coherent across moneyline / spread / team total and at least one star-player prop family                                                          |
| near-tip availability shock     | game state is pre-tip with `time_to_tip` under threshold (default 30 minutes); shape resembles pregame availability shock but with sportsbook suspension / removal flags or sudden line moves |
| attribution-shaped board shock  | game state is in-play; residual fanout concentrated around one player or paired-player stat family (rebound / assist / made-shot) with compound-stat children moving in the same direction    |
| market-structure shock          | residual driven primarily by off-price trades, volume share, spread / depth stress, or sustained repricing without a clear player or game-event handle                                        |
| cross-surface disagreement      | residual is concentrated in cross-venue disagreement after latency, liquidity, and vig adjustment, with both surfaces present and fresh                                                       |
| coverage / mapping / timing gap | peers are moving but at least one expected source is silent, stale beyond threshold, or unmapped on a game where mapped peers fired                                                           |

Classification is conservative: when evidence does not clearly distinguish two kinds, the detector prefers the more general kind (market-structure shock or coverage gap) over the more specific kind (attribution-shaped). False-precision attribution is worse than honest market-structure.

## 8. Alerting And Suppression

- Rolling windows are short (default 60 seconds shock window, 5 minutes context window).
- Each emitted alert carries the `first_pop_at` timestamp to the second.
- Alerts are de-duplicated by `(game_id, shock_kind, primary_entity_key)`; a noisy stream of similar residuals collapses into one card.
- A new alert is allowed for the same game / kind only when the residual shape or confidence changes materially (default: confidence rises by at least 0.15 or the primary entity changes).
- Online detection must never use `event_timestamp > now` rows to decide whether an alert would have fired.

## 9. History Replay

History is the same online detector with a clock that advances through persisted rows in `event_timestamp` order, capped at `final_at + ingestion_latency_buffer`. The replay returns the same alert deck the live trader would have seen, ordered by `first_pop_at`, with `score`, one-line reason, and Inspect payload per card.

Post-game current divergence is never the primary history signal. Settlement and post-game stat corrections appear only as Inspect-time annotations unless they fall inside the operational window.

## 10. Inspect Payload

Every alert exposes, on click:

- the full component breakdown (`residual`, `microstructure`, `coherence`, `coverage`),
- the H0 adjustment applied (so the trader can see why some movement was suppressed),
- the per-observation evidence rows (game / player / stat / family / source / mapped flag),
- missing-data and coverage gaps,
- the raw source rows needed to audit the score (links into the existing `/api/v1/games/:gameId/markets/:instrumentId/raw/:sourceId` surface).

## 11. What This Spec Is Not

This is not a Bayesian model with calibrated priors. It is an interpretable approximation that preserves the likelihood-ratio shape. It is also not a settlement engine: the detector does not adjudicate disputes, it surfaces evidence the trader uses to inspect. It is not a betting-picks product, and `score` and `confidence` must never be presented as a recommendation.
