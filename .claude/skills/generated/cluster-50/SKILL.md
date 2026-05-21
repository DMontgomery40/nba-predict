---
name: cluster-50
description: "Skill for the Cluster_50 area of nba-predict. 16 symbols across 1 files."
---

# Cluster_50

16 symbols | 1 files | Cohesion: 86%

## When to Use

- Working with code in `apps/`
- Understanding how calculateBackoffDelay, runWorkerCycle, startWorker work
- Modifying cluster_50-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/worker/src/index.ts` | getDefaultIntervalMs, getDefaultMaxBackoffMs, getBet365RateLimitCooldownMs, getSidecarLookbackDays, getSidecarLookaheadDays (+11) |

## Entry Points

Start here when exploring this area:

- **`calculateBackoffDelay`** (Function) — `apps/worker/src/index.ts:314`
- **`runWorkerCycle`** (Function) — `apps/worker/src/index.ts:356`
- **`startWorker`** (Function) — `apps/worker/src/index.ts:613`
- **`stop`** (Function) — `apps/worker/src/index.ts:628`
- **`scheduleNext`** (Function) — `apps/worker/src/index.ts:642`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `calculateBackoffDelay` | Function | `apps/worker/src/index.ts` | 314 |
| `runWorkerCycle` | Function | `apps/worker/src/index.ts` | 356 |
| `startWorker` | Function | `apps/worker/src/index.ts` | 613 |
| `stop` | Function | `apps/worker/src/index.ts` | 628 |
| `scheduleNext` | Function | `apps/worker/src/index.ts` | 642 |
| `getDefaultIntervalMs` | Function | `apps/worker/src/index.ts` | 31 |
| `getDefaultMaxBackoffMs` | Function | `apps/worker/src/index.ts` | 35 |
| `getBet365RateLimitCooldownMs` | Function | `apps/worker/src/index.ts` | 39 |
| `getSidecarLookbackDays` | Function | `apps/worker/src/index.ts` | 43 |
| `getSidecarLookaheadDays` | Function | `apps/worker/src/index.ts` | 47 |
| `getKalshiLiveMaxEvents` | Function | `apps/worker/src/index.ts` | 51 |
| `getKalshiLiveLookbackDays` | Function | `apps/worker/src/index.ts` | 55 |
| `getKalshiLiveMinimumStartDate` | Function | `apps/worker/src/index.ts` | 59 |
| `getPolymarketTradesLookbackMinutes` | Function | `apps/worker/src/index.ts` | 65 |
| `getPolymarketTradesMaxMarkets` | Function | `apps/worker/src/index.ts` | 69 |
| `isRateLimitFailure` | Function | `apps/worker/src/index.ts` | 139 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RunWorkerCycle → GetDefaultIntervalMs` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Services | 3 calls |
| Cluster_53 | 1 calls |
| Routes | 1 calls |
| Cluster_55 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "calculateBackoffDelay"})` — see callers and callees
2. `gitnexus_query({query: "cluster_50"})` — find related execution flows
3. Read key files listed above for implementation details
