# Signal Engine Spec

## Goals

- `SIG-001` Produce deterministic, inspectable divergence and confidence outputs for each event.
- `SIG-002` Make it obvious whether a signal is likely actionable, noisy, stale, or under-supported.

## Inputs

- normalized source probabilities
- order-book and depth proxies where available
- source freshness
- source reliability configuration
- NBA context support metrics
- internal exposure urgency

## Core Derived Outputs

- `SIG-003` `consensusProbability`
- `SIG-004` `divergenceScore`
- `SIG-005` `confidenceScore`
- `SIG-006` `watchlistPriority`
- `SIG-007` `severityBand`
- `SIG-008` `reasonCodes`
- `SIG-009` `riskFlags`

## Weighting Model

The initial engine uses readable weighted sub-scores:

```text
sourceAdjustedProbability = probability * freshnessWeight * reliabilityWeight

consensusProbability =
  weighted_average(sourceAdjustedProbability by sourceWeight)

divergenceScore =
  0.40 * abs(bookProbability - consensusProbability)
  + 0.20 * externalDispersion
  + 0.15 * priceVelocitySignal
  + 0.15 * exposureUrgency
  + 0.10 * nbaContextSupport

confidenceScore =
  0.30 * freshnessQuality
  + 0.25 * liquidityQuality
  + 0.20 * sourceAgreement
  + 0.15 * reliabilityQuality
  + 0.10 * dataCompleteness
  - penalty(noiseOrReversalRisk)
```

## Weight Definitions

- `SIG-010` `freshnessWeight` shall degrade continuously from fresh to stale according to source-specific thresholds.
- `SIG-011` `liquidityWeight` shall reward deeper, tighter, more persistent sources and down-weight thin books.
- `SIG-012` `sourceReliabilityWeight` shall be centrally configured by source and market type.
- `SIG-013` `volatilityWeight` shall distinguish meaningful persistent movement from isolated spikes.
- `SIG-014` `exposureUrgency` shall raise priority when liability or concentration is elevated.

## Consensus Logic

- `SIG-015` Consensus shall be based on weighted external and internal support, but the book remains separately visible.
- `SIG-016` Consensus shall not overwrite or hide the bet365 value; it is a comparison anchor, not a replacement.

## Severity and Bands

- `SIG-017` Severity bands shall map from score ranges to `low`, `medium`, `high`, and `critical`.
- `SIG-018` Confidence bands shall map from score ranges to `low`, `moderate`, and `high`.

## Narrative / Explainability Boundaries

- `SIG-019` Narrative cards shall be generated from deterministic reason codes and evidence fields.
- `SIG-020` Reason codes shall include at least:
  - `CONSENSUS_DRIFT`
  - `KALSHI_LEADS`
  - `POLYMARKET_LEADS`
  - `STALE_BOOK`
  - `EXPOSURE_HEAT`
  - `THIN_MARKET`
  - `FUNDAMENTAL_SUPPORT`
  - `REVERSAL_RISK`
  - `DATA_GAP`

## Noise Suppression Rules

- `SIG-021` Suppress high-severity alerts when only one low-liquidity source moved and the move reverted quickly.
- `SIG-022` Suppress confidence when required sources are stale or offline.
- `SIG-023` Surface a low-confidence explanation instead of inventing certainty when inputs conflict.

## Replay Compatibility

- `SIG-024` The same scoring engine shall process replay frames and live snapshots.
- `SIG-025` Score calculations shall be stable enough for timeline playback and test snapshots.
