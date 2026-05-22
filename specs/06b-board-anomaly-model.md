# Trader-Incident Board-State Model Spec

This spec defines the live whole-board tripwire that powers the desk and board-alert workflows. The operator-facing purpose is trader action under time pressure: warn quickly enough to review or suspend the right markets, then explain the likely fanout without inventing precision.

Companion documents: [`01-product-requirements.md`](01-product-requirements.md), [`06-signal-engine-spec.md`](06-signal-engine-spec.md), and [`../docs/board-state-inventory.md`](../docs/board-state-inventory.md).

## 1. Current Runtime

The current live runtime is the shared `board-vw` detector used by:

- `/api/v1/research/board-volatility`
- `/api/v1/research/board-alerts`
- Desk whole-board cards
- replay and incident inspect flows

It must not be reimplemented differently per consumer.

The runtime flow is:

```text
materialized quote observations
-> drop heartbeats and exact 0.500 anchor rows
-> keep in-play quote history only
-> per-source-market implied-probability deltas
-> ignore gaps above the fresh-cap window
-> 60-second whole-board buckets of Σ |Δ implied probability| * log1p(volume)
-> trailing median + 3*MAD over the prior 20 non-empty buckets
-> require 8 prior buckets before a fire is allowed
-> causal bucket-end confirmation
-> board-first deck fold
```

The live runtime currently lives in `packages/shared/src/board-anomaly/game-state-volatility.ts`.

## 2. Runtime Rules

- Whole-board volatility is the primary live trigger.
- The board trigger is all-families and quote-history-based. It is not a single-prop detector.
- The desk preserves the board-first fold: if likely player fanout first appears inside the same shock window, the whole-game card stays the headline until the follow-up separates in time.
- The runtime keeps a long enough context window to support the warmup and trailing baseline. The default live context is 30 minutes.
- Consumers must read the shared runtime output instead of reconstructing thresholds client-side.

## 3. Inputs And Weighting

- Inputs are persisted quote observations for one game.
- Heartbeats and exact `0.500` opening-anchor placeholder rows are ignored.
- The detector works off consecutive implied-probability deltas within the freshness cap.
- Weighting is volume-aware. Quote volume is preferred when present; fallback paths exist when volume is absent so the detector still behaves deterministically on sparse sources.
- Prediction-market microstructure evidence such as off-price prints or volume share does not replace the board trigger; it supports attribution and follow-up.

## 4. Output Expectations

The shared runtime output must expose:

- current bucket state
- trailing-window baseline summary
- threshold and recent-fire state
- evidence rows and supporting evidence
- phase context
- inspect payload
- score and confidence bands derived from the board state, not from a separate hidden model

## 5. Relationship To Other Signal Lanes

- `game-state-volatility` is the earliest whole-board tripwire.
- `/api/v1/research/market-anomalies` is the broad market-structure lane and can provide supporting evidence before attribution is known.
- `/api/v1/research/player-prop-alerts` is the strict exact-line compatibility lane for follow-up.
- Historical replay must use the same shared board runtime with no future leakage.

## 6. Research vs Live Runtime

The report in `outputs/innovation-team-suspend-signal-report/` is the active research rationale for the board-first and off-price detector family. If a research artifact and the live runtime disagree on exact threshold constants or experiment settings, current code and current API payloads define live behavior until a deliberate math change is merged and documented here.
