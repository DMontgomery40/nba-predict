---
name: 019e4286-4ff6-7ca1-bf5f-5e9bbc314398
description: "Skill for the 019e4286-4ff6-7ca1-bf5f-5e9bbc314398 area of nba-predict. 23 symbols across 1 files."
---

# 019e4286-4ff6-7ca1-bf5f-5e9bbc314398

23 symbols | 1 files | Cohesion: 81%

## When to Use

- Working with code in `outputs/`
- Understanding how isoOffset, rankedTopEntities, fetchNearestPbp work
- Modifying 019e4286-4ff6-7ca1-bf5f-5e9bbc314398-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | isoOffset, rankedTopEntities, fetchNearestPbp, buildAnchorContext, relevantReplayAlerts (+18) |

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `isoOffset` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 358 |
| `rankedTopEntities` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 377 |
| `fetchNearestPbp` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 392 |
| `buildAnchorContext` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 446 |
| `relevantReplayAlerts` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 693 |
| `selectLeadSeconds` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 717 |
| `classifyResult` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 744 |
| `evaluateIterationForAnchor` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 772 |
| `median` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 362 |
| `buildLeaderboard` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 869 |
| `shouldExpand` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 931 |
| `chooseVerdict` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 940 |
| `toCsv` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 954 |
| `buildWorkbook` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 980 |
| `run` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 1107 |
| `main` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 1148 |
| `clampScore` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 341 |
| `normalizeKey` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 370 |
| `summarizeExpectedInTop5` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 385 |
| `isBoardAlert` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 596 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `EvaluateIterationForAnchor → DatabaseFailureError` | cross_community | 5 |
| `BuildAnchorContext → GetDatabasePath` | cross_community | 5 |
| `BuildAnchorContext → DatabaseFailureError` | cross_community | 5 |
| `BuildAnchorContext → EnsureSchemaMigrationsTable` | cross_community | 5 |
| `BuildAnchorContext → GetAppliedVersion` | cross_community | 5 |
| `EvaluateIterationForAnchor → ParseTimestampMs` | cross_community | 4 |
| `EvaluateIterationForAnchor → ResolveBoardAnomalyConfig` | cross_community | 4 |
| `EvaluateIterationForAnchor → TrustedLiveStateWindow` | cross_community | 4 |
| `EvaluateIterationForAnchor → ObservationTimestampMs` | cross_community | 4 |
| `EvaluateIterationForAnchor → DedupeKey` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 4 calls |

## How to Explore

1. `gitnexus_context({name: "isoOffset"})` — see callers and callees
2. `gitnexus_query({query: "019e4286-4ff6-7ca1-bf5f-5e9bbc314398"})` — find related execution flows
3. Read key files listed above for implementation details
