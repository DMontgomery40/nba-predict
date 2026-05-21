---
name: cluster-66
description: "Skill for the Cluster_66 area of nba-predict. 20 symbols across 1 files."
---

# Cluster_66

20 symbols | 1 files | Cohesion: 84%

## When to Use

- Working with code in `packages/`
- Understanding how fetchKalshiSettledNbaEvents, fetchKalshiCandlesticks, syncKalshiNbaHistorical work
- Modifying cluster_66-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/adapters/src/kalshi-historical.ts` | sleep, fetchWithRateLimit, normalizeToken, buildGameKey, parseKalshiEventDate (+15) |

## Entry Points

Start here when exploring this area:

- **`fetchKalshiSettledNbaEvents`** (Function) — `packages/adapters/src/kalshi-historical.ts:436`
- **`fetchKalshiCandlesticks`** (Function) — `packages/adapters/src/kalshi-historical.ts:480`
- **`syncKalshiNbaHistorical`** (Function) — `packages/adapters/src/kalshi-historical.ts:629`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `fetchKalshiSettledNbaEvents` | Function | `packages/adapters/src/kalshi-historical.ts` | 436 |
| `fetchKalshiCandlesticks` | Function | `packages/adapters/src/kalshi-historical.ts` | 480 |
| `syncKalshiNbaHistorical` | Function | `packages/adapters/src/kalshi-historical.ts` | 629 |
| `sleep` | Function | `packages/adapters/src/kalshi-historical.ts` | 28 |
| `fetchWithRateLimit` | Function | `packages/adapters/src/kalshi-historical.ts` | 34 |
| `normalizeToken` | Function | `packages/adapters/src/kalshi-historical.ts` | 163 |
| `buildGameKey` | Function | `packages/adapters/src/kalshi-historical.ts` | 171 |
| `parseKalshiEventDate` | Function | `packages/adapters/src/kalshi-historical.ts` | 178 |
| `parseKalshiTeamAbbreviations` | Function | `packages/adapters/src/kalshi-historical.ts` | 198 |
| `toNumberFromDollars` | Function | `packages/adapters/src/kalshi-historical.ts` | 211 |
| `shiftIsoDate` | Function | `packages/adapters/src/kalshi-historical.ts` | 220 |
| `buildGameIndex` | Function | `packages/adapters/src/kalshi-historical.ts` | 226 |
| `resolveKalshiGame` | Function | `packages/adapters/src/kalshi-historical.ts` | 248 |
| `resolveParticipantKey` | Function | `packages/adapters/src/kalshi-historical.ts` | 262 |
| `buildStableId` | Function | `packages/adapters/src/kalshi-historical.ts` | 301 |
| `buildRawPayloadHash` | Function | `packages/adapters/src/kalshi-historical.ts` | 308 |
| `parseJsonObject` | Function | `packages/adapters/src/kalshi-historical.ts` | 312 |
| `chooseHistoricalWindow` | Function | `packages/adapters/src/kalshi-historical.ts` | 324 |
| `selectExistingKalshiHistoricalTargets` | Function | `packages/adapters/src/kalshi-historical.ts` | 360 |
| `backfillExistingKalshiHistoricalTarget` | Function | `packages/adapters/src/kalshi-historical.ts` | 535 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SyncKalshiNbaHistorical → DatabaseFailureError` | cross_community | 4 |
| `SyncKalshiNbaHistorical → GetDatabasePath` | cross_community | 4 |
| `SyncKalshiNbaHistorical → RowToOutcome` | cross_community | 4 |
| `SyncKalshiNbaHistorical → DeriveResearchGameStatus` | cross_community | 4 |
| `SyncKalshiNbaHistorical → ComputeCoverageSummary` | cross_community | 4 |
| `SyncKalshiNbaHistorical → NormalizeToken` | intra_community | 4 |
| `SyncKalshiNbaHistorical → Sleep` | intra_community | 4 |
| `SyncKalshiNbaHistorical → ShiftIsoDate` | intra_community | 3 |
| `SyncKalshiNbaHistorical → ParseKalshiTeamAbbreviations` | intra_community | 3 |
| `SyncKalshiNbaHistorical → ParseKalshiEventDate` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Routes | 9 calls |

## How to Explore

1. `gitnexus_context({name: "fetchKalshiSettledNbaEvents"})` — see callers and callees
2. `gitnexus_query({query: "cluster_66"})` — find related execution flows
3. Read key files listed above for implementation details
