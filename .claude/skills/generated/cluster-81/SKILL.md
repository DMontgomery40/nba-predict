---
name: cluster-81
description: "Skill for the Cluster_81 area of nba-predict. 16 symbols across 1 files."
---

# Cluster_81

16 symbols | 1 files | Cohesion: 87%

## When to Use

- Working with code in `packages/`
- Understanding how syncPolymarketNbaTrades work
- Modifying cluster_81-related functionality

## Key Files

| File                                         | Symbols                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `packages/adapters/src/polymarket-trades.ts` | sleep, normalizeToken, toNumber, toUnixSeconds, parseStringArray (+11) |

## Entry Points

Start here when exploring this area:

- **`syncPolymarketNbaTrades`** (Function) — `packages/adapters/src/polymarket-trades.ts:378`

## Key Symbols

| Symbol                                  | Type     | File                                         | Line |
| --------------------------------------- | -------- | -------------------------------------------- | ---- |
| `syncPolymarketNbaTrades`               | Function | `packages/adapters/src/polymarket-trades.ts` | 378  |
| `sleep`                                 | Function | `packages/adapters/src/polymarket-trades.ts` | 87   |
| `normalizeToken`                        | Function | `packages/adapters/src/polymarket-trades.ts` | 91   |
| `toNumber`                              | Function | `packages/adapters/src/polymarket-trades.ts` | 99   |
| `toUnixSeconds`                         | Function | `packages/adapters/src/polymarket-trades.ts` | 105  |
| `parseStringArray`                      | Function | `packages/adapters/src/polymarket-trades.ts` | 109  |
| `parseObjectJson`                       | Function | `packages/adapters/src/polymarket-trades.ts` | 120  |
| `hashPayload`                           | Function | `packages/adapters/src/polymarket-trades.ts` | 132  |
| `hydrateSourceMarketsWithGammaMetadata` | Function | `packages/adapters/src/polymarket-trades.ts` | 136  |
| `selectTargets`                         | Function | `packages/adapters/src/polymarket-trades.ts` | 182  |
| `fetchGammaEvent`                       | Function | `packages/adapters/src/polymarket-trades.ts` | 273  |
| `fetchTradesPage`                       | Function | `packages/adapters/src/polymarket-trades.ts` | 293  |
| `buildTeamOutcomeMap`                   | Function | `packages/adapters/src/polymarket-trades.ts` | 319  |
| `selectionForOutcome`                   | Function | `packages/adapters/src/polymarket-trades.ts` | 335  |
| `tradeTimestampIso`                     | Function | `packages/adapters/src/polymarket-trades.ts` | 360  |
| `tradeIdentity`                         | Function | `packages/adapters/src/polymarket-trades.ts` | 366  |

## Execution Flows

| Flow                                                    | Type            | Steps |
| ------------------------------------------------------- | --------------- | ----- |
| `SyncPolymarketNbaTrades → DatabaseFailureError`        | cross_community | 5     |
| `SyncPolymarketNbaTrades → GetDatabasePath`             | cross_community | 5     |
| `SyncPolymarketNbaTrades → EnsureSchemaMigrationsTable` | cross_community | 5     |
| `SyncPolymarketNbaTrades → GetAppliedVersion`           | cross_community | 5     |
| `SyncPolymarketNbaTrades → ParseStringArray`            | intra_community | 3     |
| `SyncPolymarketNbaTrades → ParseObjectJson`             | intra_community | 3     |
| `SyncPolymarketNbaTrades → ToNumber`                    | intra_community | 3     |

## Connected Areas

| Area     | Connections |
| -------- | ----------- |
| Services | 5 calls     |

## How to Explore

1. `gitnexus_context({name: "syncPolymarketNbaTrades"})` — see callers and callees
2. `gitnexus_query({query: "cluster_81"})` — find related execution flows
3. Read key files listed above for implementation details
