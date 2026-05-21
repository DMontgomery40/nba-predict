---
name: components
description: "Skill for the Components area of nba-predict. 32 symbols across 14 files."
---

# Components

32 symbols | 14 files | Cohesion: 64%

## When to Use

- Working with code in `apps/`
- Understanding how useAppStore, getDatasetExportUrl, getSqliteExportUrl work
- Modifying components-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/components/Primitives.tsx` | Panel, Badge, SectionTitle, MetricTile, ProbabilityPill |
| `apps/web/src/features/games/GameWorkspacePage.tsx` | toneForComparableState, toneForMappingStatus, formatScoreline, formatLine, GameWorkspacePage |
| `apps/web/src/features/anomalies/MarketAnomaliesPage.tsx` | configDraftFrom, updateNumber, MarketAnomaliesPage, onSuccess |
| `apps/web/src/data/api.ts` | getDatasetExportUrl, getSqliteExportUrl, getFullPackageExportUrl |
| `apps/web/src/app/ShellLayout.tsx` | workspaceStatus, workspaceTitle, ShellLayout |
| `apps/web/src/features/exports/ExportsPage.tsx` | formatCount, cleanFilters, ExportsPage |
| `apps/web/src/components/ErrorState.tsx` | InlineAlert, ErrorState |
| `apps/web/src/app/store.ts` | useAppStore |
| `packages/ui/src/index.ts` | cx |
| `apps/web/src/app/App.tsx` | App |

## Entry Points

Start here when exploring this area:

- **`useAppStore`** (Function) — `apps/web/src/app/store.ts:10`
- **`getDatasetExportUrl`** (Function) — `apps/web/src/data/api.ts:1800`
- **`getSqliteExportUrl`** (Function) — `apps/web/src/data/api.ts:1813`
- **`getFullPackageExportUrl`** (Function) — `apps/web/src/data/api.ts:1817`
- **`cx`** (Function) — `packages/ui/src/index.ts:0`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `useAppStore` | Function | `apps/web/src/app/store.ts` | 10 |
| `getDatasetExportUrl` | Function | `apps/web/src/data/api.ts` | 1800 |
| `getSqliteExportUrl` | Function | `apps/web/src/data/api.ts` | 1813 |
| `getFullPackageExportUrl` | Function | `apps/web/src/data/api.ts` | 1817 |
| `cx` | Function | `packages/ui/src/index.ts` | 0 |
| `App` | Function | `apps/web/src/app/App.tsx` | 21 |
| `ShellLayout` | Function | `apps/web/src/app/ShellLayout.tsx` | 98 |
| `InlineAlert` | Function | `apps/web/src/components/ErrorState.tsx` | 31 |
| `ErrorState` | Function | `apps/web/src/components/ErrorState.tsx` | 46 |
| `PageFrame` | Function | `apps/web/src/components/PageFrame.tsx` | 2 |
| `Panel` | Function | `apps/web/src/components/Primitives.tsx` | 4 |
| `Badge` | Function | `apps/web/src/components/Primitives.tsx` | 16 |
| `SectionTitle` | Function | `apps/web/src/components/Primitives.tsx` | 29 |
| `MetricTile` | Function | `apps/web/src/components/Primitives.tsx` | 47 |
| `ProbabilityPill` | Function | `apps/web/src/components/Primitives.tsx` | 69 |
| `SourceHealthPanel` | Function | `apps/web/src/components/SourceHealth.tsx` | 2 |
| `MarketAnomaliesPage` | Function | `apps/web/src/features/anomalies/MarketAnomaliesPage.tsx` | 139 |
| `onSuccess` | Function | `apps/web/src/features/anomalies/MarketAnomaliesPage.tsx` | 178 |
| `CommandPalette` | Function | `apps/web/src/features/command/CommandPalette.tsx` | 11 |
| `ExportsPage` | Function | `apps/web/src/features/exports/ExportsPage.tsx` | 141 |

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
| `GameWorkspacePage → Cx` | intra_community | 4 |
| `SettingsPage → IsApiRequestError` | cross_community | 4 |
| `SettingsPage → Cx` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Event | 5 calls |
| Desk | 3 calls |
| Alerts | 3 calls |
| Settings | 3 calls |
| Cluster_44 | 3 calls |
| Games | 1 calls |
| Divergence | 1 calls |
| Research | 1 calls |

## How to Explore

1. `gitnexus_context({name: "useAppStore"})` — see callers and callees
2. `gitnexus_query({query: "components"})` — find related execution flows
3. Read key files listed above for implementation details
