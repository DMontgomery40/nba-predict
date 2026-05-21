---
name: 019e4286-4ff6-7ca1-bf5f-5e9bbc314398
description: "Skill for the 019e4286-4ff6-7ca1-bf5f-5e9bbc314398 area of nba-predict. 24 symbols across 2 files."
---

# 019e4286-4ff6-7ca1-bf5f-5e9bbc314398

24 symbols | 2 files | Cohesion: 78%

## When to Use

- Working with code in `outputs/`
- Understanding how replayBoardAnomaliesForGame work
- Modifying 019e4286-4ff6-7ca1-bf5f-5e9bbc314398-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | clampScore, isoOffset, normalizeKey, summarizeExpectedInTop5, fetchNearestPbp (+18) |
| `packages/shared/src/board-anomaly-game-runtime.ts` | replayBoardAnomaliesForGame |

## Entry Points

Start here when exploring this area:

- **`replayBoardAnomaliesForGame`** (Function) — `packages/shared/src/board-anomaly-game-runtime.ts:80`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `replayBoardAnomaliesForGame` | Function | `packages/shared/src/board-anomaly-game-runtime.ts` | 80 |
| `clampScore` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 341 |
| `isoOffset` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 358 |
| `normalizeKey` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 370 |
| `summarizeExpectedInTop5` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 385 |
| `fetchNearestPbp` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 392 |
| `buildAnchorContext` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 446 |
| `isBoardAlert` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 596 |
| `adjustAlert` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 603 |
| `boardLeadSec` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 824 |
| `entityLeadSec` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 827 |
| `median` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 362 |
| `buildLeaderboard` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 869 |
| `shouldExpand` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 931 |
| `chooseVerdict` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 940 |
| `toCsv` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 954 |
| `buildWorkbook` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 980 |
| `run` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 1107 |
| `main` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 1148 |
| `rankedTopEntities` | Function | `outputs/019e4286-4ff6-7ca1-bf5f-5e9bbc314398/math_backtest.ts` | 377 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `EvaluateIterationForAnchor → DatabaseFailureError` | cross_community | 5 |
| `EvaluateIterationForAnchor → GetDatabasePath` | cross_community | 5 |
| `BuildAnchorContext → GetDatabasePath` | cross_community | 5 |
| `BuildAnchorContext → DatabaseFailureError` | cross_community | 5 |
| `BuildAnchorContext → EnsureSchemaMigrationsTable` | cross_community | 5 |
| `BuildAnchorContext → GetAppliedVersion` | cross_community | 5 |
| `EvaluateIterationForAnchor → ParseTimestampMs` | cross_community | 4 |
| `EvaluateIterationForAnchor → ResolveBoardAnomalyConfig` | cross_community | 4 |
| `EvaluateIterationForAnchor → ObservationTimestampMs` | cross_community | 4 |
| `EvaluateIterationForAnchor → DedupeKey` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Board-anomaly | 4 calls |
| Routes | 1 calls |

## How to Explore

1. `gitnexus_context({name: "replayBoardAnomaliesForGame"})` — see callers and callees
2. `gitnexus_query({query: "019e4286-4ff6-7ca1-bf5f-5e9bbc314398"})` — find related execution flows
3. Read key files listed above for implementation details
