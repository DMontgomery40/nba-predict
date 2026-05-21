---
name: routes
description: "Skill for the Routes area of nba-predict. 122 symbols across 17 files."
---

# Routes

122 symbols | 17 files | Cohesion: 74%

## When to Use

- Working with code in `packages/`
- Understanding how sendSqliteSnapshot, createSqliteExportSnapshot, buildNbaSidecarUrl work
- Modifying routes-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `packages/shared/src/live-repository.ts` | parseJson, stringifyJson, toBoolean, freshnessBandFromMs, rowToGame (+58) |
| `apps/worker/src/nba-sidecar.ts` | trimTrailingSlash, buildNbaSidecarUrl, formatDateUtc, parseScore, deriveFinalSidecarResultFromPlayByPlay (+7) |
| `packages/adapters/src/bet365-historical.ts` | buildRawPayloadHash, buildOddsApiUrl, getOddsApiKey, isWithinDateRange, enumerateIsoDates (+4) |
| `packages/adapters/src/bet365-internal-dump.ts` | americanToImplied, decimalToImplied, normalizeImpliedProbability, buildRawPayloadHash, parseBet365DumpLine (+3) |
| `packages/adapters/src/odds-api.ts` | buildRawPayloadHash, getOddsApiKey, syncOddsApiBookmaker, syncOddsApiBet365NbaMarkets, syncOddsApiKalshiNbaMarkets |
| `packages/shared/src/db-core.ts` | currentTimestamp, executeDatabaseOperation, getDatabase, getDatabaseSchemaVersion, backupDatabase |
| `packages/adapters/src/bet365-direct.ts` | buildRawPayloadHash, openBet365Browser, persistBet365Snapshot, syncBet365DirectLive |
| `packages/adapters/src/polymarket.ts` | buildRawPayloadHash, fetchPolymarketNbaEvents, syncPolymarketNbaMarkets |
| `packages/shared/src/signal-quality.ts` | clampProbability, listClosedGameSummaries, getSignalQualityReport |
| `packages/shared/src/watchlist-repository.ts` | getWatchlist, upsertWatchlist, deleteWatchlist |

## Entry Points

Start here when exploring this area:

- **`sendSqliteSnapshot`** (Function) — `apps/api/src/routes/exports.ts:18`
- **`createSqliteExportSnapshot`** (Function) — `apps/api/src/services/export-service.ts:460`
- **`buildNbaSidecarUrl`** (Function) — `apps/worker/src/nba-sidecar.ts:92`
- **`buildNbaSidecarDateWindow`** (Function) — `apps/worker/src/nba-sidecar.ts:183`
- **`fetchNbaSidecarScoreboard`** (Function) — `apps/worker/src/nba-sidecar.ts:205`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DatabaseFailureError` | Class | `packages/shared/src/errors.ts` | 130 |
| `sendSqliteSnapshot` | Function | `apps/api/src/routes/exports.ts` | 18 |
| `createSqliteExportSnapshot` | Function | `apps/api/src/services/export-service.ts` | 460 |
| `buildNbaSidecarUrl` | Function | `apps/worker/src/nba-sidecar.ts` | 92 |
| `buildNbaSidecarDateWindow` | Function | `apps/worker/src/nba-sidecar.ts` | 183 |
| `fetchNbaSidecarScoreboard` | Function | `apps/worker/src/nba-sidecar.ts` | 205 |
| `fetchNbaSidecarPlayByPlay` | Function | `apps/worker/src/nba-sidecar.ts` | 236 |
| `ingestNbaSidecarScoreboard` | Function | `apps/worker/src/nba-sidecar.ts` | 268 |
| `ingestNbaSidecarPlayByPlay` | Function | `apps/worker/src/nba-sidecar.ts` | 300 |
| `syncNbaSidecarScoreboard` | Function | `apps/worker/src/nba-sidecar.ts` | 326 |
| `syncNbaSidecarWindow` | Function | `apps/worker/src/nba-sidecar.ts` | 371 |
| `openBet365Browser` | Function | `packages/adapters/src/bet365-direct.ts` | 163 |
| `persistBet365Snapshot` | Function | `packages/adapters/src/bet365-direct.ts` | 239 |
| `syncBet365DirectLive` | Function | `packages/adapters/src/bet365-direct.ts` | 318 |
| `syncBet365Historical` | Function | `packages/adapters/src/bet365-historical.ts` | 281 |
| `parseBet365DumpLine` | Function | `packages/adapters/src/bet365-internal-dump.ts` | 98 |
| `pick` | Function | `packages/adapters/src/bet365-internal-dump.ts` | 116 |
| `syncBet365InternalDump` | Function | `packages/adapters/src/bet365-internal-dump.ts` | 245 |
| `syncOddsApiBet365NbaMarkets` | Function | `packages/adapters/src/odds-api.ts` | 1431 |
| `syncOddsApiKalshiNbaMarkets` | Function | `packages/adapters/src/odds-api.ts` | 1444 |

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
| `UpsertWatchlist → InternalAppError` | cross_community | 6 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_75 | 4 calls |
| Cluster_94 | 3 calls |
| Cluster_63 | 3 calls |
| Cluster_61 | 3 calls |
| Cluster_108 | 2 calls |
| Cluster_98 | 2 calls |
| Services | 2 calls |
| Cluster_53 | 2 calls |

## How to Explore

1. `gitnexus_context({name: "sendSqliteSnapshot"})` — see callers and callees
2. `gitnexus_query({query: "routes"})` — find related execution flows
3. Read key files listed above for implementation details
