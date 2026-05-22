---
name: components
description: "Skill for the Components area of nba-predict. 25 symbols across 12 files."
---

# Components

25 symbols | 12 files | Cohesion: 54%

## When to Use

- Working with code in `apps/`
- Understanding how buildGameTriage, ErrorState, PageFrame work
- Modifying components-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/components/Primitives.tsx` | Panel, SectionTitle, Badge, MetricTile, ProbabilityPill |
| `apps/web/src/features/anomalies/MarketAnomaliesPage.tsx` | configDraftFrom, updateNumber, MarketAnomaliesPage, onSuccess |
| `apps/web/src/data/api.ts` | getDatasetExportUrl, getSqliteExportUrl, getFullPackageExportUrl |
| `apps/web/src/features/exports/ExportsPage.tsx` | formatCount, cleanFilters, ExportsPage |
| `apps/web/src/components/ErrorState.tsx` | ErrorState, InlineAlert |
| `apps/web/src/features/games/GamesPage.tsx` | formatGameName, GamesPage |
| `apps/web/src/lib/game-triage.ts` | buildGameTriage |
| `apps/web/src/app/ErrorBoundary.tsx` | render |
| `apps/web/src/components/PageFrame.tsx` | PageFrame |
| `apps/web/src/components/SourceHealth.tsx` | SourceHealthPanel |

## Entry Points

Start here when exploring this area:

- **`buildGameTriage`** (Function) — `apps/web/src/lib/game-triage.ts:68`
- **`ErrorState`** (Function) — `apps/web/src/components/ErrorState.tsx:46`
- **`PageFrame`** (Function) — `apps/web/src/components/PageFrame.tsx:2`
- **`Panel`** (Function) — `apps/web/src/components/Primitives.tsx:4`
- **`SectionTitle`** (Function) — `apps/web/src/components/Primitives.tsx:29`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildGameTriage` | Function | `apps/web/src/lib/game-triage.ts` | 68 |
| `ErrorState` | Function | `apps/web/src/components/ErrorState.tsx` | 46 |
| `PageFrame` | Function | `apps/web/src/components/PageFrame.tsx` | 2 |
| `Panel` | Function | `apps/web/src/components/Primitives.tsx` | 4 |
| `SectionTitle` | Function | `apps/web/src/components/Primitives.tsx` | 29 |
| `SourceHealthPanel` | Function | `apps/web/src/components/SourceHealth.tsx` | 2 |
| `MarketAnomaliesPage` | Function | `apps/web/src/features/anomalies/MarketAnomaliesPage.tsx` | 139 |
| `onSuccess` | Function | `apps/web/src/features/anomalies/MarketAnomaliesPage.tsx` | 178 |
| `actions` | Function | `apps/web/src/features/command/CommandPalette.tsx` | 40 |
| `GamesPage` | Function | `apps/web/src/features/games/GamesPage.tsx` | 31 |
| `getDatasetExportUrl` | Function | `apps/web/src/data/api.ts` | 1876 |
| `getSqliteExportUrl` | Function | `apps/web/src/data/api.ts` | 1889 |
| `getFullPackageExportUrl` | Function | `apps/web/src/data/api.ts` | 1893 |
| `cx` | Function | `packages/ui/src/index.ts` | 0 |
| `InlineAlert` | Function | `apps/web/src/components/ErrorState.tsx` | 31 |
| `Badge` | Function | `apps/web/src/components/Primitives.tsx` | 16 |
| `MetricTile` | Function | `apps/web/src/components/Primitives.tsx` | 47 |
| `ProbabilityPill` | Function | `apps/web/src/components/Primitives.tsx` | 69 |
| `ExportsPage` | Function | `apps/web/src/features/exports/ExportsPage.tsx` | 141 |
| `render` | Method | `apps/web/src/app/ErrorBoundary.tsx` | 40 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `TraderDeskPage → IsApiRequestError` | cross_community | 4 |
| `TraderDeskPage → Cx` | cross_community | 4 |
| `App → SectionTitle` | cross_community | 4 |
| `App → Cx` | cross_community | 4 |
| `EventWorkspacePage → IsApiRequestError` | cross_community | 4 |
| `EventWorkspacePage → Cx` | cross_community | 4 |
| `GameWorkspacePage → IsApiRequestError` | cross_community | 4 |
| `GameWorkspacePage → Cx` | cross_community | 4 |
| `SettingsPage → IsApiRequestError` | cross_community | 4 |
| `SettingsPage → Cx` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Event | 4 calls |
| Cluster_40 | 2 calls |
| Cluster_47 | 2 calls |
| Desk | 1 calls |
| Settings | 1 calls |
| Games | 1 calls |
| Anomalies | 1 calls |

## How to Explore

1. `gitnexus_context({name: "buildGameTriage"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
