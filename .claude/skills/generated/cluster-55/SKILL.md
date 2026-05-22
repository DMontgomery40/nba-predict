---
name: cluster-55
description: "Skill for the Cluster_55 area of nba-predict. 16 symbols across 1 files."
---

# Cluster_55

16 symbols | 1 files | Cohesion: 86%

## When to Use

- Working with code in `apps/`
- Understanding how calculateBackoffDelay, runWorkerCycle, startWorker work
- Modifying cluster_55-related functionality

## Key Files

| File                       | Symbols                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/worker/src/index.ts` | getDefaultIntervalMs, getDefaultMaxBackoffMs, getBet365RateLimitCooldownMs, getSidecarLookbackDays, getSidecarLookaheadDays (+11) |

## Entry Points

Start here when exploring this area:

- **`calculateBackoffDelay`** (Function) — `apps/worker/src/index.ts:317`
- **`runWorkerCycle`** (Function) — `apps/worker/src/index.ts:359`
- **`startWorker`** (Function) — `apps/worker/src/index.ts:616`
- **`stop`** (Function) — `apps/worker/src/index.ts:631`
- **`scheduleNext`** (Function) — `apps/worker/src/index.ts:645`

## Key Symbols

| Symbol                               | Type     | File                       | Line |
| ------------------------------------ | -------- | -------------------------- | ---- |
| `calculateBackoffDelay`              | Function | `apps/worker/src/index.ts` | 317  |
| `runWorkerCycle`                     | Function | `apps/worker/src/index.ts` | 359  |
| `startWorker`                        | Function | `apps/worker/src/index.ts` | 616  |
| `stop`                               | Function | `apps/worker/src/index.ts` | 631  |
| `scheduleNext`                       | Function | `apps/worker/src/index.ts` | 645  |
| `getDefaultIntervalMs`               | Function | `apps/worker/src/index.ts` | 32   |
| `getDefaultMaxBackoffMs`             | Function | `apps/worker/src/index.ts` | 36   |
| `getBet365RateLimitCooldownMs`       | Function | `apps/worker/src/index.ts` | 40   |
| `getSidecarLookbackDays`             | Function | `apps/worker/src/index.ts` | 44   |
| `getSidecarLookaheadDays`            | Function | `apps/worker/src/index.ts` | 48   |
| `getKalshiLiveMaxEvents`             | Function | `apps/worker/src/index.ts` | 52   |
| `getKalshiLiveLookbackDays`          | Function | `apps/worker/src/index.ts` | 56   |
| `getKalshiLiveMinimumStartDate`      | Function | `apps/worker/src/index.ts` | 60   |
| `getPolymarketTradesLookbackMinutes` | Function | `apps/worker/src/index.ts` | 66   |
| `getPolymarketTradesMaxMarkets`      | Function | `apps/worker/src/index.ts` | 70   |
| `isRateLimitFailure`                 | Function | `apps/worker/src/index.ts` | 140  |

## Execution Flows

| Flow                                    | Type            | Steps |
| --------------------------------------- | --------------- | ----- |
| `RunWorkerCycle → GetDefaultIntervalMs` | intra_community | 3     |

## Connected Areas

| Area       | Connections |
| ---------- | ----------- |
| Services   | 4 calls     |
| Cluster_1  | 1 calls     |
| Cluster_60 | 1 calls     |

## How to Explore

1. `gitnexus_context({name: "calculateBackoffDelay"})` — see callers and callees
2. `gitnexus_query({query: "cluster_55"})` — find related execution flows
3. Read key files listed above for implementation details
