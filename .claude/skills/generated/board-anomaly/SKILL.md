---
name: board-anomaly
description: "Skill for the Board-anomaly area of nba-predict. 83 symbols across 22 files."
---

# Board-anomaly

83 symbols | 22 files | Cohesion: 72%

## When to Use

- Working with code in `packages/`
- Understanding how getBoardAlertEventContext, playByPlay, detectBoardAnomaliesForGame work
- Modifying board-anomaly-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/shared/src/board-anomaly/alert-metrics.ts` | unmappedRatio, evidenceFromScored, h0DriversFromScored, sourceMarketIdsFromScored, instrumentIdsFromScored (+9) |
| `packages/shared/src/board-anomaly/detector.ts` | measureBoardGameStateVolatility, detectBoardAnomalies, scored, clusterToAlert, inWindow (+3) |
| `packages/shared/src/board-anomaly/game-state-volatility.ts` | measureGameStateVolatility, familySet, sortFamilies, bandForScore, calculateGameStateVolatility (+2) |
| `packages/shared/src/board-anomaly-event-context.ts` | comparePredictionMarketRows, loadGameLabel, getBoardAlertEventContext, playByPlay, parseHistoricalParticipantAlertId (+1) |
| `packages/shared/src/board-anomaly-observation-context.ts` | tokenize, statFamilyHintFromTokens, loadGameContext, gameStateRows, gameStateAt (+1) |
| `packages/shared/src/board-anomaly/classifier.ts` | gameStatusSummary, dominantParticipantKey, hasCompoundFanout, hasCrossSurfaceDisagreement, hasMissingExpectedSource (+1) |
| `packages/shared/src/board-anomaly-incidents.ts` | buildIncidentReason, formatDuration, findOppositeInstrumentId, latestImpliedProbability, buildVigAdjustedComparison |
| `packages/shared/src/board-anomaly/fanout.ts` | tokenize, statFamilyFromTokens, deriveRelationKeys, relationBoost, buildCoherenceClusters |
| `packages/shared/src/board-anomaly/replay.ts` | observationTimestampMs, dedupeKey, replayBoardAnomalies, inOperationalWindow |
| `packages/shared/src/board-anomaly/config.ts` | scoreToSeverity, resolveBoardAnomalyConfig, clamp01 |

## Entry Points

Start here when exploring this area:

- **`getBoardAlertEventContext`** (Function) — `packages/shared/src/board-anomaly-event-context.ts:327`
- **`playByPlay`** (Function) — `packages/shared/src/board-anomaly-event-context.ts:395`
- **`detectBoardAnomaliesForGame`** (Function) — `packages/shared/src/board-anomaly-game-runtime.ts:27`
- **`measureGameStateVolatilityForGame`** (Function) — `packages/shared/src/board-anomaly-game-runtime.ts:49`
- **`listBoardAnomaliesAcrossGames`** (Function) — `packages/shared/src/board-anomaly-live-listings.ts:23`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getBoardAlertEventContext` | Function | `packages/shared/src/board-anomaly-event-context.ts` | 327 |
| `playByPlay` | Function | `packages/shared/src/board-anomaly-event-context.ts` | 395 |
| `detectBoardAnomaliesForGame` | Function | `packages/shared/src/board-anomaly-game-runtime.ts` | 27 |
| `measureGameStateVolatilityForGame` | Function | `packages/shared/src/board-anomaly-game-runtime.ts` | 49 |
| `listBoardAnomaliesAcrossGames` | Function | `packages/shared/src/board-anomaly-live-listings.ts` | 23 |
| `listGameStateVolatilityAcrossGames` | Function | `packages/shared/src/board-anomaly-live-listings.ts` | 87 |
| `loadGameContext` | Function | `packages/shared/src/board-anomaly-observation-context.ts` | 65 |
| `gameStateRows` | Function | `packages/shared/src/board-anomaly-observation-context.ts` | 98 |
| `gameStateAt` | Function | `packages/shared/src/board-anomaly-observation-context.ts` | 134 |
| `buildObservationLabels` | Function | `packages/shared/src/board-anomaly-observation-context.ts` | 190 |
| `quoteRowToObservation` | Function | `packages/shared/src/board-anomaly-observation-converters.ts` | 71 |
| `microstructureRowToObservation` | Function | `packages/shared/src/board-anomaly-observation-converters.ts` | 159 |
| `materializeBoardObservations` | Function | `packages/shared/src/board-anomaly-observations.ts` | 20 |
| `parseTimestampMs` | Function | `packages/shared/src/board-anomaly-support.ts` | 2 |
| `measureBoardGameStateVolatility` | Function | `packages/shared/src/board-anomaly/detector.ts` | 265 |
| `measureGameStateVolatility` | Function | `packages/shared/src/board-anomaly/game-state-volatility.ts` | 240 |
| `buildHistoricalParticipantFanouts` | Function | `packages/shared/src/board-anomaly-historical-fanouts.ts` | 218 |
| `historicalParticipantFanoutToBoardCard` | Function | `packages/shared/src/board-anomaly-historical-fanouts.ts` | 290 |
| `listForensicFinishedGameIncidents` | Function | `packages/shared/src/board-anomaly-historical-listings.ts` | 96 |
| `buildIncidentReason` | Function | `packages/shared/src/board-anomaly-incidents.ts` | 52 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `GetBoardAnomalyIncidentsPayload → DatabaseFailureError` | cross_community | 5 |
| `GetBoardAnomalyIncidentsPayload → GetDatabasePath` | cross_community | 5 |
| `EvaluateIterationForAnchor → DatabaseFailureError` | cross_community | 5 |
| `EvaluateIterationForAnchor → GetDatabasePath` | cross_community | 5 |
| `BuildAnchorContext → GetDatabasePath` | cross_community | 5 |
| `BuildAnchorContext → DatabaseFailureError` | cross_community | 5 |
| `BuildAnchorContext → EnsureSchemaMigrationsTable` | cross_community | 5 |
| `BuildAnchorContext → GetAppliedVersion` | cross_community | 5 |
| `ListBoardAnomaliesAcrossGames → InternalAppError` | cross_community | 5 |
| `ListGameStateVolatilityAcrossGames → InternalAppError` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Routes | 13 calls |
| Cluster_80 | 4 calls |
| Cluster_81 | 3 calls |
| Cluster_83 | 2 calls |
| Cluster_82 | 2 calls |
| Cluster_93 | 1 calls |
| Cluster_77 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getBoardAlertEventContext"})` — see callers and callees
2. `gitnexus_query({query: "board-anomaly"})` — find related execution flows
3. Read key files listed above for implementation details
