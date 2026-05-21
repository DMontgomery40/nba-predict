---
name: cluster-47
description: "Skill for the Cluster_47 area of nba-predict. 11 symbols across 1 files."
---

# Cluster_47

11 symbols | 1 files | Cohesion: 61%

## When to Use

- Working with code in `apps/`
- Understanding how runBackfill work
- Modifying cluster_47-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/worker/src/backfill.ts` | parseArgs, asNumber, printUsage, runNba, runKalshi (+6) |

## Entry Points

Start here when exploring this area:

- **`runBackfill`** (Function) — `apps/worker/src/backfill.ts:249`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `runBackfill` | Function | `apps/worker/src/backfill.ts` | 249 |
| `parseArgs` | Function | `apps/worker/src/backfill.ts` | 47 |
| `asNumber` | Function | `apps/worker/src/backfill.ts` | 80 |
| `printUsage` | Function | `apps/worker/src/backfill.ts` | 103 |
| `runNba` | Function | `apps/worker/src/backfill.ts` | 127 |
| `runKalshi` | Function | `apps/worker/src/backfill.ts` | 146 |
| `runKalshiHistorical` | Function | `apps/worker/src/backfill.ts` | 159 |
| `runPolymarketTrades` | Function | `apps/worker/src/backfill.ts` | 204 |
| `runBet365Internal` | Function | `apps/worker/src/backfill.ts` | 224 |
| `runBet365Historical` | Function | `apps/worker/src/backfill.ts` | 230 |
| `runBet365Direct` | Function | `apps/worker/src/backfill.ts` | 243 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RunBackfill → AsNumber` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Routes | 4 calls |
| Services | 2 calls |
| Cluster_65 | 1 calls |
| Cluster_66 | 1 calls |
| Cluster_74 | 1 calls |
| Cluster_48 | 1 calls |
| Cluster_49 | 1 calls |
| Cluster_53 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "runBackfill"})` — see callers and callees
2. `gitnexus_query({query: "cluster_47"})` — find related execution flows
3. Read key files listed above for implementation details
