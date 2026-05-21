---
name: data
description: "Skill for the Data area of nba-predict. 61 symbols across 19 files."
---

# Data

61 symbols | 19 files | Cohesion: 86%

## When to Use

- Working with code in `apps/`
- Understanding how getBoardAlertEventContext, getGameMarkets, getGame work
- Modifying data-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/data/api.ts` | ApiRequestError, request, getBoardAlertEventContext, getGameMarkets, getGame (+36) |
| `apps/web/src/features/anomalies/MarketAnomaliesPage.tsx` | mutationFn, queryFn |
| `apps/web/src/features/settings/SettingsPage.tsx` | queryFn, mutationFn |
| `apps/web/src/features/alerts/BoardAlertsPage.tsx` | queryFn |
| `apps/web/src/features/alerts/BoardAlertsReplayPage.tsx` | queryFn |
| `apps/web/src/features/alerts/PlayerPropAlertsPage.tsx` | queryFn |
| `apps/web/src/features/desk/BoardAlertsBanner.tsx` | queryFn |
| `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | queryFn |
| `apps/web/src/features/event/EventWorkspacePage.tsx` | queryFn |
| `apps/web/src/features/event/RawSourceDrawer.tsx` | queryFn |

## Entry Points

Start here when exploring this area:

- **`getBoardAlertEventContext`** (Function) — `apps/web/src/data/api.ts:947`
- **`getGameMarkets`** (Function) — `apps/web/src/data/api.ts:1280`
- **`getGame`** (Function) — `apps/web/src/data/api.ts:1284`
- **`getInstrument`** (Function) — `apps/web/src/data/api.ts:1288`
- **`getInstrumentTimeline`** (Function) — `apps/web/src/data/api.ts:1294`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ApiRequestError` | Class | `apps/web/src/data/api.ts` | 28 |
| `getBoardAlertEventContext` | Function | `apps/web/src/data/api.ts` | 947 |
| `getGameMarkets` | Function | `apps/web/src/data/api.ts` | 1280 |
| `getGame` | Function | `apps/web/src/data/api.ts` | 1284 |
| `getInstrument` | Function | `apps/web/src/data/api.ts` | 1288 |
| `getInstrumentTimeline` | Function | `apps/web/src/data/api.ts` | 1294 |
| `getInstrumentSources` | Function | `apps/web/src/data/api.ts` | 1300 |
| `getInstrumentRawSource` | Function | `apps/web/src/data/api.ts` | 1306 |
| `getDivergence` | Function | `apps/web/src/data/api.ts` | 1316 |
| `getAdminSources` | Function | `apps/web/src/data/api.ts` | 1347 |
| `getAdminCaptureRuns` | Function | `apps/web/src/data/api.ts` | 1351 |
| `getAdminRuntimeConfig` | Function | `apps/web/src/data/api.ts` | 1355 |
| `getAdminStorageCoverage` | Function | `apps/web/src/data/api.ts` | 1359 |
| `getAdminUnmappedMarkets` | Function | `apps/web/src/data/api.ts` | 1363 |
| `getResearchCoverage` | Function | `apps/web/src/data/api.ts` | 1367 |
| `getSignalMismatches` | Function | `apps/web/src/data/api.ts` | 1371 |
| `getPlayerPropAlerts` | Function | `apps/web/src/data/api.ts` | 1389 |
| `getPlayerPropAlertPlayback` | Function | `apps/web/src/data/api.ts` | 1421 |
| `getBoardAlerts` | Function | `apps/web/src/data/api.ts` | 1438 |
| `getBoardIncidents` | Function | `apps/web/src/data/api.ts` | 1472 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `QueryFn → ApiRequestError` | cross_community | 4 |
| `QueryFn → ApiRequestError` | intra_community | 4 |
| `QueryFn → ApiRequestError` | intra_community | 4 |
| `QueryFn → ApiRequestError` | intra_community | 4 |
| `QueryFn → ApiRequestError` | cross_community | 4 |
| `QueryFn → ApiRequestError` | intra_community | 4 |
| `QueryFn → ApiRequestError` | intra_community | 4 |
| `QueryFn → ApiRequestError` | cross_community | 4 |
| `QueryFn → ApiRequestError` | intra_community | 4 |
| `QueryFn → ApiRequestError` | cross_community | 4 |

## How to Explore

1. `gitnexus_context({name: "getBoardAlertEventContext"})` — see callers and callees
2. `gitnexus_query({query: "data"})` — find related execution flows
3. Read key files listed above for implementation details
