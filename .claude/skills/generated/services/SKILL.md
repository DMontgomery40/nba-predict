---
name: services
description: "Skill for the Services area of nba-predict. 226 symbols across 33 files."
---

# Services

226 symbols | 33 files | Cohesion: 76%

## When to Use

- Working with code in `packages/`
- Understanding how sendSqliteSnapshot, getSqliteExportPath, createSqliteExportSnapshot work
- Modifying services-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/shared/src/live-repository.ts` | parseJson, stringifyJson, toBoolean, freshnessBandFromMs, rowToGame (+66) |
| `apps/api/src/services/research-service.ts` | getLogger, getAdminRuntimeConfigPayload, getGamesPayload, getResearchDivergencePayload, getSignalMismatchesPayload (+34) |
| `apps/worker/src/nba-sidecar.ts` | trimTrailingSlash, buildNbaSidecarUrl, formatDateUtc, parseScore, deriveFinalSidecarResultFromPlayByPlay (+7) |
| `packages/shared/src/signal-quality.ts` | bucketStartIso, buildDeltaSeriesFromBucketRows, clampProbability, listClosedGameSummaries, getInstrumentDeltaSeries (+6) |
| `packages/shared/src/db-core.ts` | currentTimestamp, getDatabasePath, executeDatabaseOperation, getDatabase, getDatabaseSchemaVersion (+5) |
| `apps/api/src/routes/research.ts` | parseClosingCutoff, parseIntegerParam, parseNumberParam, parseBooleanParam, parseDateParam (+3) |
| `packages/shared/src/errors.ts` | DatabaseFailureError, AppError, InvalidModeError, EventNotFoundError, GameNotFoundError (+2) |
| `apps/api/src/services/export-service.ts` | getSqliteExportPath, createSqliteExportSnapshot, buildFilteredSql, add, getExportCatalogPayload (+1) |
| `apps/api/src/services/health-service.ts` | appVersion, getOddsApiKey, buildBaseHealthMetadata, checkNbaSidecarReadiness, buildLivenessPayload (+1) |
| `packages/shared/src/board-volatility-baselines.ts` | quantile, resolveFallbackBoardVolatilityBaseline, getLatestBoardVolatilityBaselineVersion, resolveBoardVolatilityBaseline, rebuildBoardVolatilityBaselines |

## Entry Points

Start here when exploring this area:

- **`sendSqliteSnapshot`** (Function) — `apps/api/src/routes/exports.ts:18`
- **`getSqliteExportPath`** (Function) — `apps/api/src/services/export-service.ts:456`
- **`createSqliteExportSnapshot`** (Function) — `apps/api/src/services/export-service.ts:460`
- **`buildWorkerHeartbeatSummary`** (Function) — `apps/worker/src/index.ts:325`
- **`buildNbaSidecarUrl`** (Function) — `apps/worker/src/nba-sidecar.ts:92`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DatabaseFailureError` | Class | `packages/shared/src/errors.ts` | 130 |
| `AppError` | Class | `packages/shared/src/errors.ts` | 45 |
| `InvalidModeError` | Class | `packages/shared/src/errors.ts` | 79 |
| `EventNotFoundError` | Class | `packages/shared/src/errors.ts` | 91 |
| `GameNotFoundError` | Class | `packages/shared/src/errors.ts` | 104 |
| `InstrumentNotFoundError` | Class | `packages/shared/src/errors.ts` | 117 |
| `AdapterFailureError` | Class | `packages/shared/src/errors.ts` | 144 |
| `sendSqliteSnapshot` | Function | `apps/api/src/routes/exports.ts` | 18 |
| `getSqliteExportPath` | Function | `apps/api/src/services/export-service.ts` | 456 |
| `createSqliteExportSnapshot` | Function | `apps/api/src/services/export-service.ts` | 460 |
| `buildWorkerHeartbeatSummary` | Function | `apps/worker/src/index.ts` | 325 |
| `buildNbaSidecarUrl` | Function | `apps/worker/src/nba-sidecar.ts` | 92 |
| `buildNbaSidecarDateWindow` | Function | `apps/worker/src/nba-sidecar.ts` | 183 |
| `fetchNbaSidecarScoreboard` | Function | `apps/worker/src/nba-sidecar.ts` | 205 |
| `fetchNbaSidecarPlayByPlay` | Function | `apps/worker/src/nba-sidecar.ts` | 236 |
| `ingestNbaSidecarScoreboard` | Function | `apps/worker/src/nba-sidecar.ts` | 268 |
| `ingestNbaSidecarPlayByPlay` | Function | `apps/worker/src/nba-sidecar.ts` | 300 |
| `syncNbaSidecarScoreboard` | Function | `apps/worker/src/nba-sidecar.ts` | 326 |
| `syncNbaSidecarWindow` | Function | `apps/worker/src/nba-sidecar.ts` | 371 |
| `openBet365Browser` | Function | `packages/adapters/src/bet365-direct.ts` | 163 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `SendSqliteSnapshot → InternalAppError` | cross_community | 8 |
| `SendSqliteSnapshot → NowIso` | cross_community | 8 |
| `RegisterDivergenceRoutes → InternalAppError` | cross_community | 7 |
| `SyncKalshiNbaTrades → InternalAppError` | cross_community | 7 |
| `SyncKalshiNbaTrades → NowIso` | cross_community | 7 |
| `RegisterDivergenceRoutes → GetDatabasePath` | cross_community | 6 |
| `RegisterDivergenceRoutes → RowToOutcome` | cross_community | 6 |
| `RegisterDivergenceRoutes → AsString` | cross_community | 6 |
| `RegisterDivergenceRoutes → AsNumber` | cross_community | 6 |
| `RebuildBoardVolatilityBaselines → InternalAppError` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Board-anomaly | 19 calls |
| Cluster_110 | 10 calls |
| Cluster_124 | 5 calls |
| Cluster_109 | 5 calls |
| Cluster_1 | 5 calls |
| Cluster_82 | 4 calls |
| Cluster_114 | 3 calls |
| Cluster_103 | 3 calls |

## How to Explore

1. `gitnexus_context({name: "sendSqliteSnapshot"})` — see callers and callees
2. `gitnexus_query({query: "services"})` — find related execution flows
3. Read key files listed above for implementation details
