---
name: board-anomaly
description: "Skill for the Board-anomaly area of nba-predict. 90 symbols across 21 files."
---

# Board-anomaly

90 symbols | 21 files | Cohesion: 69%

## When to Use

- Working with code in `packages/`
- Understanding how buildHistoricalParticipantFanouts, historicalParticipantFanoutToBoardCard, listForensicFinishedGameIncidents work
- Modifying board-anomaly-related functionality

## Key Files

| File                                                          | Symbols                                                                                                                            |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/board-anomaly/alert-metrics.ts`          | firstPopAtFromScored, averageContribution, averageMicrostructure, coverageRatio, unmappedRatio (+9)                                |
| `packages/shared/src/board-anomaly/detector.ts`               | trustedLiveStateWindow, isWholeBoardTripwire, detectBoardAnomalies, measureBoardGameStateVolatility, scored (+5)                   |
| `packages/shared/src/board-anomaly/game-state-volatility.ts`  | measureGameStateVolatility, formatPhaseKind, currentObservationGameState, buildFilterObservations, trailingPersistenceSeconds (+5) |
| `packages/shared/src/board-anomaly/board-volatility-model.ts` | interpolatePercentile, runBoardStressKalmanFilter, buildBoardVolatilityBaselineLookupInput, evidenceLimit, sortFamilies (+3)       |
| `packages/shared/src/board-anomaly/classifier.ts`             | gameStatusSummary, dominantParticipantKey, hasCompoundFanout, hasCrossSurfaceDisagreement, hasMissingExpectedSource (+1)           |
| `packages/shared/src/board-anomaly-incidents.ts`              | buildIncidentReason, formatDuration, findOppositeInstrumentId, latestImpliedProbability, buildVigAdjustedComparison                |
| `packages/shared/src/board-anomaly/fanout.ts`                 | tokenize, statFamilyFromTokens, deriveRelationKeys, relationBoost, buildCoherenceClusters                                          |
| `packages/shared/src/board-anomaly-event-context.ts`          | parseHistoricalParticipantAlertId, resolveHistoricalParticipantIncident, comparePredictionMarketRows, playByPlay                   |
| `packages/shared/src/board-anomaly/replay.ts`                 | observationTimestampMs, dedupeKey, replayBoardAnomalies, inOperationalWindow                                                       |
| `packages/shared/src/board-anomaly/board-volatility-phase.ts` | parseClockSeconds, periodStartWindowSeconds, secondsSinceLastScoreChange, deriveBoardVolatilityPhase                               |

## Entry Points

Start here when exploring this area:

- **`buildHistoricalParticipantFanouts`** (Function) — `packages/shared/src/board-anomaly-historical-fanouts.ts:218`
- **`historicalParticipantFanoutToBoardCard`** (Function) — `packages/shared/src/board-anomaly-historical-fanouts.ts:290`
- **`listForensicFinishedGameIncidents`** (Function) — `packages/shared/src/board-anomaly-historical-listings.ts:96`
- **`buildIncidentReason`** (Function) — `packages/shared/src/board-anomaly-incidents.ts:52`
- **`buildVigAdjustedComparison`** (Function) — `packages/shared/src/board-anomaly-incidents.ts:150`

## Key Symbols

| Symbol                                    | Type     | File                                                          | Line |
| ----------------------------------------- | -------- | ------------------------------------------------------------- | ---- |
| `buildHistoricalParticipantFanouts`       | Function | `packages/shared/src/board-anomaly-historical-fanouts.ts`     | 218  |
| `historicalParticipantFanoutToBoardCard`  | Function | `packages/shared/src/board-anomaly-historical-fanouts.ts`     | 290  |
| `listForensicFinishedGameIncidents`       | Function | `packages/shared/src/board-anomaly-historical-listings.ts`    | 96   |
| `buildIncidentReason`                     | Function | `packages/shared/src/board-anomaly-incidents.ts`              | 52   |
| `buildVigAdjustedComparison`              | Function | `packages/shared/src/board-anomaly-incidents.ts`              | 150  |
| `fanoutToBoardCard`                       | Function | `packages/shared/src/board-anomaly-live-fanouts.ts`           | 201  |
| `scoreToSeverity`                         | Function | `packages/shared/src/board-anomaly/config.ts`                 | 48   |
| `resolveBoardAnomalyConfig`               | Function | `packages/shared/src/board-anomaly/config.ts`                 | 5    |
| `detectBoardAnomalies`                    | Function | `packages/shared/src/board-anomaly/detector.ts`               | 198  |
| `measureBoardGameStateVolatility`         | Function | `packages/shared/src/board-anomaly/detector.ts`               | 303  |
| `measureGameStateVolatility`              | Function | `packages/shared/src/board-anomaly/game-state-volatility.ts`  | 378  |
| `replayBoardAnomalies`                    | Function | `packages/shared/src/board-anomaly/replay.ts`                 | 20   |
| `inOperationalWindow`                     | Function | `packages/shared/src/board-anomaly/replay.ts`                 | 46   |
| `runBoardStressKalmanFilter`              | Function | `packages/shared/src/board-anomaly/board-volatility-model.ts` | 337  |
| `clamp01`                                 | Function | `packages/shared/src/board-anomaly/config.ts`                 | 41   |
| `scored`                                  | Function | `packages/shared/src/board-anomaly/detector.ts`               | 219  |
| `computeH0Adjustment`                     | Function | `packages/shared/src/board-anomaly/h0.ts`                     | 20   |
| `scoreObservation`                        | Function | `packages/shared/src/board-anomaly/residual.ts`               | 17   |
| `firstPopAtFromScored`                    | Function | `packages/shared/src/board-anomaly/alert-metrics.ts`          | 78   |
| `buildBoardVolatilityBaselineLookupInput` | Function | `packages/shared/src/board-anomaly/board-volatility-model.ts` | 161  |

## Execution Flows

| Flow                                                     | Type            | Steps |
| -------------------------------------------------------- | --------------- | ----- |
| `QuoteRowToObservation → StripDiacritics`                | cross_community | 6     |
| `MicrostructureRowToObservation → StripDiacritics`       | cross_community | 6     |
| `DetectBoardAnomalies → ParseTimestampMs`                | cross_community | 6     |
| `ReplayBoardAnomalies → ParseTimestampMs`                | cross_community | 6     |
| `ReplayBoardAnomalies → ParseClockSeconds`               | cross_community | 6     |
| `ReplayBoardAnomalies → SourceMarketIdsFromScored`       | cross_community | 6     |
| `ReplayBoardAnomalies → AverageContribution`             | cross_community | 6     |
| `GetBoardAnomalyIncidentsPayload → DatabaseFailureError` | cross_community | 5     |
| `GetBoardAnomalyIncidentsPayload → GetDatabasePath`      | cross_community | 5     |
| `DetectBoardAnomalies → AverageMicrostructure`           | cross_community | 5     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Services   | 4 calls     |
| Cluster_89 | 3 calls     |
| Cluster_88 | 2 calls     |
| Cluster_91 | 2 calls     |
| Cluster_90 | 2 calls     |
| Cluster_87 | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "buildHistoricalParticipantFanouts"})` — see callers and callees
2. `gitnexus_query({query: "board-anomaly"})` — find related execution flows
3. Read key files listed above for implementation details
