---
name: cluster-106
description: "Skill for the Cluster_106 area of nba-predict. 20 symbols across 1 files."
---

# Cluster_106

20 symbols | 1 files | Cohesion: 97%

## When to Use

- Working with code in `packages/`
- Understanding how applyMigrations work
- Modifying cluster_106-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/shared/src/migrations.ts` | nowIso, ensureSchemaMigrationsTable, getAppliedVersion, insertMigration, tableExists (+15) |

## Entry Points

Start here when exploring this area:

- **`applyMigrations`** (Function) — `packages/shared/src/migrations.ts:286`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `applyMigrations` | Function | `packages/shared/src/migrations.ts` | 286 |
| `nowIso` | Function | `packages/shared/src/migrations.ts` | 6 |
| `ensureSchemaMigrationsTable` | Function | `packages/shared/src/migrations.ts` | 10 |
| `getAppliedVersion` | Function | `packages/shared/src/migrations.ts` | 20 |
| `insertMigration` | Function | `packages/shared/src/migrations.ts` | 30 |
| `tableExists` | Function | `packages/shared/src/migrations.ts` | 36 |
| `buildMigrationStableId` | Function | `packages/shared/src/migrations.ts` | 51 |
| `applyInitialRuntimeSchema` | Function | `packages/shared/src/migrations.ts` | 57 |
| `applyLiveResearchSchema` | Function | `packages/shared/src/migrations.ts` | 78 |
| `applyLegacyRuntimeCleanup` | Function | `packages/shared/src/migrations.ts` | 228 |
| `applyHistoricalIngestionSupport` | Function | `packages/shared/src/migrations.ts` | 250 |
| `applyCanonicalInstrumentConsolidation` | Function | `packages/shared/src/migrations.ts` | 358 |
| `applyPolymarketPlayerPropCanonicalIds` | Function | `packages/shared/src/migrations.ts` | 396 |
| `applyLatestLookupIndexes` | Function | `packages/shared/src/migrations.ts` | 496 |
| `applyDivergenceLookupIndexes` | Function | `packages/shared/src/migrations.ts` | 523 |
| `applyMarketAnomalySupport` | Function | `packages/shared/src/migrations.ts` | 536 |
| `applyMarketAnomalyLookupIndexes` | Function | `packages/shared/src/migrations.ts` | 598 |
| `applyNbaPlayByPlayActionStorage` | Function | `packages/shared/src/migrations.ts` | 619 |
| `applySourceCoverageLookupIndexes` | Function | `packages/shared/src/migrations.ts` | 654 |
| `applyMarketMicrostructureTradeIdentityIndex` | Function | `packages/shared/src/migrations.ts` | 671 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SendSqliteSnapshot → NowIso` | cross_community | 8 |
| `SyncKalshiNbaTrades → NowIso` | cross_community | 7 |
| `UpsertWatchlist → NowIso` | cross_community | 6 |
| `SendSqliteSnapshot → EnsureSchemaMigrationsTable` | cross_community | 6 |
| `SendSqliteSnapshot → GetAppliedVersion` | cross_community | 6 |
| `ListFinishedGameIncidents → NowIso` | cross_community | 6 |
| `GetRuntimeAudit → NowIso` | cross_community | 6 |
| `DeleteWatchlist → NowIso` | cross_community | 6 |
| `SyncPolymarketNbaMarkets → EnsureSchemaMigrationsTable` | cross_community | 5 |
| `SyncPolymarketNbaMarkets → GetAppliedVersion` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Routes | 1 calls |

## How to Explore

1. `gitnexus_context({name: "applyMigrations"})` — see callers and callees
2. `gitnexus_query({query: "cluster_106"})` — find related execution flows
3. Read key files listed above for implementation details
