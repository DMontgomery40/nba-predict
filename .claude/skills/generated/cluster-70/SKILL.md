---
name: cluster-70
description: "Skill for the Cluster_70 area of nba-predict. 15 symbols across 1 files."
---

# Cluster_70

15 symbols | 1 files | Cohesion: 82%

## When to Use

- Working with code in `packages/`
- Understanding how syncKalshiNbaDirect work
- Modifying cluster_70-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/adapters/src/kalshi-direct.ts` | normalizeToken, toNumber, buildStableId, buildRawPayloadHash, buildGameKey (+10) |

## Entry Points

Start here when exploring this area:

- **`syncKalshiNbaDirect`** (Function) — `packages/adapters/src/kalshi-direct.ts:514`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `syncKalshiNbaDirect` | Function | `packages/adapters/src/kalshi-direct.ts` | 514 |
| `normalizeToken` | Function | `packages/adapters/src/kalshi-direct.ts` | 161 |
| `toNumber` | Function | `packages/adapters/src/kalshi-direct.ts` | 171 |
| `buildStableId` | Function | `packages/adapters/src/kalshi-direct.ts` | 177 |
| `buildRawPayloadHash` | Function | `packages/adapters/src/kalshi-direct.ts` | 184 |
| `buildGameKey` | Function | `packages/adapters/src/kalshi-direct.ts` | 188 |
| `shiftIsoDate` | Function | `packages/adapters/src/kalshi-direct.ts` | 195 |
| `buildGameIndex` | Function | `packages/adapters/src/kalshi-direct.ts` | 201 |
| `parseKalshiEventParts` | Function | `packages/adapters/src/kalshi-direct.ts` | 223 |
| `resolveGameByTicker` | Function | `packages/adapters/src/kalshi-direct.ts` | 242 |
| `resolveTeamKeyFromMarket` | Function | `packages/adapters/src/kalshi-direct.ts` | 253 |
| `parsePlayerName` | Function | `packages/adapters/src/kalshi-direct.ts` | 298 |
| `inferLine` | Function | `packages/adapters/src/kalshi-direct.ts` | 310 |
| `inferMarketShape` | Function | `packages/adapters/src/kalshi-direct.ts` | 319 |
| `snapshotProbability` | Function | `packages/adapters/src/kalshi-direct.ts` | 439 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SyncKalshiNbaDirect → DatabaseFailureError` | cross_community | 4 |
| `SyncKalshiNbaDirect → GetDatabasePath` | cross_community | 4 |
| `SyncKalshiNbaDirect → RowToOutcome` | cross_community | 4 |
| `SyncKalshiNbaDirect → DeriveResearchGameStatus` | cross_community | 4 |
| `SyncKalshiNbaDirect → ComputeCoverageSummary` | cross_community | 4 |
| `SyncKalshiNbaDirect → NormalizeToken` | intra_community | 4 |
| `SyncKalshiNbaDirect → Sleep` | cross_community | 4 |
| `SyncKalshiNbaDirect → ShiftIsoDate` | intra_community | 3 |
| `SyncKalshiNbaDirect → BuildKalshiHeaders` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 6 calls |
| Cluster_69 | 2 calls |

## How to Explore

1. `gitnexus_context({name: "syncKalshiNbaDirect"})` — see callers and callees
2. `gitnexus_query({query: "cluster_70"})` — find related execution flows
3. Read key files listed above for implementation details
