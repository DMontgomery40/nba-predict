---
name: services
description: "Skill for the Services area of nba-predict. 101 symbols across 21 files."
---

# Services

101 symbols | 21 files | Cohesion: 81%

## When to Use

- Working with code in `apps/`
- Understanding how parseWithSchema, registerAdminRoutes, registerDivergenceRoutes work
- Modifying services-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/services/research-service.ts` | getLogger, getAdminRuntimeConfigPayload, buildInstrumentExportFilename, getGamesPayload, getGamePayload (+33) |
| `apps/api/src/routes/research.ts` | parseClosingCutoff, parseIntegerParam, parseNumberParam, parseBooleanParam, parseDateParam (+3) |
| `packages/shared/src/live-repository.ts` | enqueueAdminAction, enqueueCaptureRestart, enqueueGameBackfill, enqueueMarketBackfill, enqueueTimelineMaterializationRebuild (+1) |
| `apps/api/src/services/health-service.ts` | appVersion, getOddsApiKey, buildBaseHealthMetadata, checkNbaSidecarReadiness, buildLivenessPayload (+1) |
| `apps/api/src/services/export-service.ts` | getSqliteExportPath, buildFilteredSql, add, getExportCatalogPayload, buildDatasetExport |
| `packages/shared/src/db-core.ts` | getDatabasePath, countTable, countTableHighWaterMark, countTableForHealth, checkDatabaseHealth |
| `apps/api/src/services/nba-sidecar-service.ts` | getNbaSidecarBaseUrl, getGameRow, countPersistedPlayByPlay, fetchNbaSidecarPlayByPlay, ensureNbaPlayByPlayPersisted |
| `apps/api/src/services/board-alert-service.ts` | getBoardAnomalyAlertsPayload, getBoardGameStateVolatilityPayload, getBoardAnomalyEventContextPayload, getBoardAnomalyReplayPayload |
| `packages/shared/src/errors.ts` | GameNotFoundError, InstrumentNotFoundError, formatValidationIssues, AdapterFailureError |
| `apps/api/src/services/board-alert-incident-payload.ts` | hydrateMissingBoardIncidentPlayByPlay, collectMissingPlayByPlayGameIds, dedupeAndSortBoardIncidents, getBoardAnomalyIncidentsPayload |

## Entry Points

Start here when exploring this area:

- **`parseWithSchema`** (Function) — `apps/api/src/lib/http.ts:9`
- **`registerAdminRoutes`** (Function) — `apps/api/src/routes/admin.ts:23`
- **`registerDivergenceRoutes`** (Function) — `apps/api/src/routes/divergence.ts:7`
- **`registerGamesRoutes`** (Function) — `apps/api/src/routes/games.ts:20`
- **`registerResearchRoutes`** (Function) — `apps/api/src/routes/research.ts:111`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `GameNotFoundError` | Class | `packages/shared/src/errors.ts` | 104 |
| `InstrumentNotFoundError` | Class | `packages/shared/src/errors.ts` | 117 |
| `AdapterFailureError` | Class | `packages/shared/src/errors.ts` | 144 |
| `parseWithSchema` | Function | `apps/api/src/lib/http.ts` | 9 |
| `registerAdminRoutes` | Function | `apps/api/src/routes/admin.ts` | 23 |
| `registerDivergenceRoutes` | Function | `apps/api/src/routes/divergence.ts` | 7 |
| `registerGamesRoutes` | Function | `apps/api/src/routes/games.ts` | 20 |
| `registerResearchRoutes` | Function | `apps/api/src/routes/research.ts` | 111 |
| `buildBoardAlertWindowQuery` | Function | `apps/api/src/services/board-alert-service-support.ts` | 29 |
| `getBoardAnomalyAlertsPayload` | Function | `apps/api/src/services/board-alert-service.ts` | 24 |
| `getBoardGameStateVolatilityPayload` | Function | `apps/api/src/services/board-alert-service.ts` | 45 |
| `getBoardAnomalyEventContextPayload` | Function | `apps/api/src/services/board-alert-service.ts` | 68 |
| `getBoardAnomalyReplayPayload` | Function | `apps/api/src/services/board-alert-service.ts` | 139 |
| `getAdminRuntimeConfigPayload` | Function | `apps/api/src/services/research-service.ts` | 646 |
| `getGamesPayload` | Function | `apps/api/src/services/research-service.ts` | 693 |
| `getGamePayload` | Function | `apps/api/src/services/research-service.ts` | 710 |
| `getGameMarketsPayload` | Function | `apps/api/src/services/research-service.ts` | 724 |
| `getInstrumentPayload` | Function | `apps/api/src/services/research-service.ts` | 760 |
| `getInstrumentTimelinePayload` | Function | `apps/api/src/services/research-service.ts` | 789 |
| `getInstrumentTimelineCsvExport` | Function | `apps/api/src/services/research-service.ts` | 819 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `RegisterDivergenceRoutes → InternalAppError` | cross_community | 7 |
| `RegisterDivergenceRoutes → GetDatabasePath` | cross_community | 6 |
| `RegisterDivergenceRoutes → RowToOutcome` | cross_community | 6 |
| `RegisterDivergenceRoutes → AsString` | cross_community | 6 |
| `RegisterDivergenceRoutes → AsNumber` | cross_community | 6 |
| `SendSqliteSnapshot → GetDatabasePath` | cross_community | 6 |
| `RegisterResearchRoutes → DatabaseFailureError` | cross_community | 5 |
| `RegisterResearchRoutes → GetDatabasePath` | cross_community | 5 |
| `RegisterResearchRoutes → FreshnessBandFromMs` | cross_community | 5 |
| `RegisterResearchRoutes → DeriveResearchGameStatus` | cross_community | 5 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Routes | 31 calls |
| Cluster_94 | 6 calls |
| Board-anomaly | 4 calls |
| Cluster_109 | 3 calls |
| Cluster_1 | 2 calls |
| Cluster_98 | 1 calls |
| Cluster_53 | 1 calls |
| Cluster_107 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "parseWithSchema"})` — see callers and callees
2. `gitnexus_query({query: "services"})` — find related execution flows
3. Read key files listed above for implementation details
