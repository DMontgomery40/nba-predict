---
name: desk
description: "Skill for the Desk area of nba-predict. 41 symbols across 7 files."
---

# Desk

41 symbols | 7 files | Cohesion: 81%

## When to Use

- Working with code in `apps/`
- Understanding how formatMarketMatchLabel, TraderDeskPage, isApiRequestError work
- Modifying desk-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/features/desk/TraderDeskPage.tsx` | formatProbability, formatDecimal, formatCount, formatAge, rowTone (+24) |
| `apps/web/src/features/desk/LeadLagOffsetChart.tsx` | tickTime, LeadLagOffsetChart, lineY, lineX |
| `apps/web/src/data/api.ts` | isApiRequestError, shouldRetryQuery |
| `apps/web/src/features/desk/BoardAlertsBanner.tsx` | isTransientBoardAlertError, retry |
| `apps/web/src/features/desk/DivergenceSparkline.tsx` | DivergenceSparkline, toPath |
| `apps/web/src/lib/market-format.ts` | formatMarketMatchLabel |
| `apps/web/src/components/ErrorState.tsx` | getErrorSummary |

## Entry Points

Start here when exploring this area:

- **`formatMarketMatchLabel`** (Function) — `apps/web/src/lib/market-format.ts:29`
- **`TraderDeskPage`** (Function) — `apps/web/src/features/desk/TraderDeskPage.tsx:388`
- **`isApiRequestError`** (Function) — `apps/web/src/data/api.ts:53`
- **`retry`** (Function) — `apps/web/src/features/desk/BoardAlertsBanner.tsx:23`
- **`retry`** (Function) — `apps/web/src/features/desk/TraderDeskPage.tsx:417`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `formatMarketMatchLabel` | Function | `apps/web/src/lib/market-format.ts` | 29 |
| `TraderDeskPage` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 388 |
| `isApiRequestError` | Function | `apps/web/src/data/api.ts` | 53 |
| `retry` | Function | `apps/web/src/features/desk/BoardAlertsBanner.tsx` | 23 |
| `retry` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 417 |
| `LeadLagOffsetChart` | Function | `apps/web/src/features/desk/LeadLagOffsetChart.tsx` | 21 |
| `lineY` | Function | `apps/web/src/features/desk/LeadLagOffsetChart.tsx` | 52 |
| `lineX` | Function | `apps/web/src/features/desk/LeadLagOffsetChart.tsx` | 56 |
| `reviewBet365Rows` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 598 |
| `externalOnlyRows` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 601 |
| `DivergenceSparkline` | Function | `apps/web/src/features/desk/DivergenceSparkline.tsx` | 19 |
| `toPath` | Function | `apps/web/src/features/desk/DivergenceSparkline.tsx` | 69 |
| `formatProbability` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 82 |
| `formatDecimal` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 90 |
| `formatCount` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 98 |
| `formatAge` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 106 |
| `rowTone` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 135 |
| `alertTone` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 148 |
| `volatilityTone` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 161 |
| `formatVolatilityBand` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 168 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `TraderDeskPage → IsApiRequestError` | cross_community | 4 |
| `TraderDeskPage → Cx` | cross_community | 4 |
| `App → SectionTitle` | cross_community | 4 |
| `EventWorkspacePage → IsApiRequestError` | cross_community | 4 |
| `GameWorkspacePage → IsApiRequestError` | cross_community | 4 |
| `SettingsPage → IsApiRequestError` | cross_community | 4 |
| `Render → IsApiRequestError` | cross_community | 4 |
| `App → PageFrame` | cross_community | 3 |
| `App → LoadingState` | cross_community | 3 |
| `App → BuildGameTriage` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Event | 4 calls |
| Components | 3 calls |
| Games | 3 calls |
| Format | 2 calls |
| Cluster_44 | 2 calls |
| Settings | 1 calls |
| Alerts | 1 calls |

## How to Explore

1. `gitnexus_context({name: "formatMarketMatchLabel"})` — see callers and callees
2. `gitnexus_query({query: "desk"})` — find related execution flows
3. Read key files listed above for implementation details
