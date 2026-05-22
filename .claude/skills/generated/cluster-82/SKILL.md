---
name: cluster-82
description: "Skill for the Cluster_82 area of nba-predict. 20 symbols across 1 files."
---

# Cluster_82

20 symbols | 1 files | Cohesion: 95%

## When to Use

- Working with code in `packages/`
- Understanding how buildPolymarketSelectionRecords work
- Modifying cluster_82-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/adapters/src/polymarket.ts` | parseJsonArray, parseOptionalJsonArray, normalizeToken, marketTypeSupported, marketWindowPrefix (+15) |

## Entry Points

Start here when exploring this area:

- **`buildPolymarketSelectionRecords`** (Function) — `packages/adapters/src/polymarket.ts:641`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildPolymarketSelectionRecords` | Function | `packages/adapters/src/polymarket.ts` | 641 |
| `parseJsonArray` | Function | `packages/adapters/src/polymarket.ts` | 102 |
| `parseOptionalJsonArray` | Function | `packages/adapters/src/polymarket.ts` | 116 |
| `normalizeToken` | Function | `packages/adapters/src/polymarket.ts` | 129 |
| `marketTypeSupported` | Function | `packages/adapters/src/polymarket.ts` | 137 |
| `marketWindowPrefix` | Function | `packages/adapters/src/polymarket.ts` | 154 |
| `formatLine` | Function | `packages/adapters/src/polymarket.ts` | 158 |
| `buildSourceMarketId` | Function | `packages/adapters/src/polymarket.ts` | 170 |
| `buildStableId` | Function | `packages/adapters/src/polymarket.ts` | 174 |
| `buildGameKey` | Function | `packages/adapters/src/polymarket.ts` | 181 |
| `buildGameIndex` | Function | `packages/adapters/src/polymarket.ts` | 188 |
| `buildEventKeys` | Function | `packages/adapters/src/polymarket.ts` | 205 |
| `resolveParticipantKey` | Function | `packages/adapters/src/polymarket.ts` | 223 |
| `toNumber` | Function | `packages/adapters/src/polymarket.ts` | 272 |
| `describeMetric` | Function | `packages/adapters/src/polymarket.ts` | 285 |
| `buildMoneylineSelectionRecords` | Function | `packages/adapters/src/polymarket.ts` | 300 |
| `prices` | Function | `packages/adapters/src/polymarket.ts` | 311 |
| `buildSpreadSelectionRecords` | Function | `packages/adapters/src/polymarket.ts` | 378 |
| `buildTotalSelectionRecords` | Function | `packages/adapters/src/polymarket.ts` | 460 |
| `buildPlayerPropSelectionRecords` | Function | `packages/adapters/src/polymarket.ts` | 541 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SyncPolymarketNbaMarkets → NormalizeToken` | cross_community | 4 |
| `BuildPolymarketSelectionRecords → NormalizeToken` | intra_community | 4 |

## How to Explore

1. `gitnexus_context({name: "buildPolymarketSelectionRecords"})` — see callers and callees
2. `gitnexus_query({query: "cluster_82"})` — find related execution flows
3. Read key files listed above for implementation details
