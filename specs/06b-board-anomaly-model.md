# Trader-Incident Board-State Model Spec

This spec defines the statistical target of the NBA trader-incident board-state detector before any model code. The detector must implement this shape; it does not need a false-precision academic model on day one. The operator-facing purpose is trader action under time pressure: warn quickly enough to suspend the right player props and related derivative markets, then explain the likely fanout. Companion documents: [`01-product-requirements.md`](01-product-requirements.md), [`06-signal-engine-spec.md`](06-signal-engine-spec.md), [`../docs/board-state-inventory.md`](../docs/board-state-inventory.md).

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
- **H1 — abnormal incident**: the change is more likely under at least one of the following incident shapes:
  - pregame availability shock (injury, lineup, rest, or scratch news priced in late);
  - near-tip availability shock (scratch or unexpected availability after the slate has set);
  - game-state implied-volatility shock (prediction markets reprice the whole game across moneyline / spread / total / team prop buckets, with player props treated as supporting evidence when present);
  - attribution-shaped in-game shock (residual movement coherent with a single stat-event / player attribution);
  - market-structure shock (off-price prints, sudden volume share, liquidity collapse, sustained repricing);
  - cross-surface disagreement (sportsbook vs prediction-market disagreement that persists after latency, liquidity, and vig adjustment);
  - coverage / mapping / timing gap (a market that should exist or move is missing, stale, or unmapped on a game where peers are moving).

## 3. Score Shape

The headline score for a candidate incident at time `t` is the log-likelihood ratio of the two hypotheses on the recent window:

```text
score(t) ~= log P(Delta B(t) | H1 abnormal incident)
            - log P(Delta B(t) | H0 normal market dynamics)
```

The first implementation approximates this as a weighted sum of normalized contributions. Each contribution must remain interpretable as evidence for H1, evidence for H0, or a reliability / data-coverage adjustment. The detector must never emit a score whose components cannot be enumerated.

## 3A. Shared Whole-Board Runtime

Whole-board volatility is one shared runtime model consumed by live alerts, replay, inspect, and desk surfaces. It must not be recomputed differently per consumer. The runtime flow is:

```text
materialized quote observations
-> drop heartbeats and exact 0.500 anchor rows
-> per-source-market implied-probability deltas
-> 60-second whole-board buckets of Σ |Δ implied probability| * log1p(volume)
-> trailing median + 3*MAD over the prior 20 non-empty buckets
-> require 8 prior buckets before a fire is allowed
-> causal bucket-end confirmation
-> board-first deck fold
```

Implementation constraints:

- Iter02 / `StateGate` is a hard runtime rule: when a live window is not trusted, entity/player-specific alerts are suppressed, while whole-board tripwires may still emit.
- The live deck preserves board-first ordering: simultaneous player fanout that first pops inside the same shock window stays folded under the whole-board card until a later follow-up separates itself in time.
- The whole-board tripwire is all-families and quote-history-based, not core-families-only: sportsbook and prediction-market quote rows may both contribute whenever they carry persisted implied-probability history and volume.
- The live runtime needs a long enough context window to hold the warmup and trailing baseline. The default detector context is therefore 30 minutes rather than the old 5-minute trim.
- `/api/v1/research/board-volatility` and `shockKind === "game-state-volatility"` alerts must derive from this same runtime output.

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

FanDuel and DraftKings remain preserved as equal sportsbook families beside Bet365. They share the sportsbook residual model, but they must retain their own source identity, suspension behavior, and cross-book disagreement evidence so future adapter additions widen the signal surface instead of collapsing distinct sportsbook behavior into a single generic book.

## 6. Fanout / Coherence Graph

A single residual is suggestive; a coherent fanout is evidence. The detector groups residuals into candidate incident clusters using a relation graph:

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

These classes are detector internals. Operator surfaces may show them, but they must not stop at the class label when a trader-facing suspension read can be derived.

## 7. Shock Classification

Every emitted alert chooses exactly one of these kinds, by evidence:

| Kind                            | Necessary evidence (post-H0)                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| pregame availability shock      | game state is pre-tip, residual movement is coherent across moneyline / spread / team total and at least one star-player prop family                                                          |
| near-tip availability shock     | game state is pre-tip with `time_to_tip` under threshold (default 30 minutes); shape resembles pregame availability shock but with sportsbook suspension / removal flags or sudden line moves |
| game-state volatility shock     | the whole-board volume-weighted quote bucket `Σ                                                                                                                                               | Δ implied probability | * log1p(volume)`exceeds the trailing`median + 3*MAD` over the prior 20 non-empty 60-second buckets after an 8-bucket warmup; player/entity follow-up remains separate from the whole-board headline |
| attribution-shaped incident     | game state is in-play; residual fanout concentrated around one player or paired-player stat family (rebound / assist / made-shot) with compound-stat children moving in the same direction    |
| market-structure shock          | residual driven primarily by off-price trades, volume share, spread / depth stress, or sustained repricing without a clear player or game-event handle                                        |
| cross-surface disagreement      | residual is concentrated in cross-venue disagreement after latency, liquidity, and vig adjustment, with both surfaces present and fresh                                                       |
| coverage / mapping / timing gap | peers are moving but at least one expected source is silent, stale beyond threshold, or unmapped on a game where mapped peers fired                                                           |

Classification is conservative: when evidence does not clearly distinguish two kinds, the detector prefers the more general kind (market-structure shock or coverage gap) over the more specific kind (attribution-shaped). False-precision attribution is worse than honest market-structure. However, if a broad tripwire fires first and player-specific follow-up appears moments later, the operator-facing flow should preserve that sequence: fastest warning first, actionable fanout immediately after. In the live deck, simultaneous player fanout that first pops inside the same shock window stays folded under the whole-game card; it should re-emerge as its own card only once the follow-up separates itself in time.

## 8. Alerting And Suppression

- Rolling windows are short in alert semantics (default 60-second shock window) but the board-vw detector keeps a 30-minute default context so the 8-bucket warmup and 20-bucket trailing baseline have room to exist.
- Each emitted alert carries the `first_pop_at` timestamp to the second.
- Alerts are de-duplicated by `(game_id, shock_kind, primary_entity_key)`; a noisy stream of similar residuals collapses into one card.
- A new alert is allowed for the same game / kind only when the residual shape or confidence changes materially (default: confidence rises by at least 0.15 or the primary entity changes).
- Online detection must never use `event_timestamp > now` rows to decide whether an alert would have fired.

For `game-state-volatility`, score bands are derived from the board-vw bucket state rather than a separate hidden model:

- `insufficient-data`: fewer than 8 prior non-empty buckets are available for the current completed bucket.
- `normal`: enough history exists and the latest evaluated bucket stays below the fire threshold.
- `elevated`: enough history exists and the latest evaluated bucket is warm, but it does not cross the fire threshold.
- `alert`: a completed 60-second bucket crosses the trailing `median + 3*MAD` threshold and is still inside the live shock window.

The runtime must expose the phase, trailing-window summary, latest evaluated bucket, recent-fire state, and supporting evidence so operator surfaces can explain why the board is hot without inventing a different threshold legend client-side.

## 9. History Replay

History is the same online detector with a clock that advances through persisted rows in `event_timestamp` order, capped at `final_at + ingestion_latency_buffer`. The replay returns the same alert deck the live trader would have seen, ordered by `first_pop_at`, with `score`, one-line reason, and Inspect payload per card. The product question for history is not "what generic noise existed later?" but "what would have warned the trader, and how much earlier?"

Post-game current divergence is never the primary history signal. Settlement and post-game stat corrections appear only as Inspect-time annotations unless they fall inside the operational window.

## 10. Inspect Payload

Every alert exposes, on click:

- actual wall-clock time first, and game period/clock if known,
- the likely player/prop suspension targets plus related derivative markets,
- whether the selected alert is itself actionable or only an early tripwire,
- nearby player-specific follow-up when the first signal was broad,
- the full component breakdown (`residual`, `microstructure`, `coherence`, `coverage`),
- the H0 adjustment applied (so the trader can see why some movement was suppressed),
- the per-observation evidence rows (game / player / stat / family / source / mapped flag),
- missing-data and coverage gaps,
- the raw source rows needed to audit the score (links into the existing `/api/v1/games/:gameId/markets/:instrumentId/raw/:sourceId` surface).

## 11. What This Spec Is Not

This is not a Bayesian model with calibrated priors. It is an interpretable approximation that preserves the likelihood-ratio shape. It is also not a settlement engine: the detector does not adjudicate disputes, it surfaces evidence the trader uses to inspect. It is not a betting-picks product, and `score` and `confidence` must never be presented as a recommendation.
