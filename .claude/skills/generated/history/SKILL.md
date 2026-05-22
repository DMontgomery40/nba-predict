---
name: history
description: "Skill for the History area of nba-predict. 14 symbols across 1 files."
---

# History

14 symbols | 1 files | Cohesion: 65%

## When to Use

- Working with code in `apps/`
- Understanding how buildHistoricalGapSummary, HistoryPage, updateHistoryFilters work
- Modifying history-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/features/history/HistoryPage.tsx` | localDateInputValue, yesterdayDateInputValue, averageDefinedNumbers, formatScoreline, formatPeakMoment (+9) |

## Entry Points

Start here when exploring this area:

- **`buildHistoricalGapSummary`** (Function) — `apps/web/src/features/history/HistoryPage.tsx:167`
- **`HistoryPage`** (Function) — `apps/web/src/features/history/HistoryPage.tsx:307`
- **`updateHistoryFilters`** (Function) — `apps/web/src/features/history/HistoryPage.tsx:321`
- **`reviewDateLabel`** (Function) — `apps/web/src/features/history/HistoryPage.tsx:315`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `buildHistoricalGapSummary` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 167 |
| `HistoryPage` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 307 |
| `updateHistoryFilters` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 321 |
| `reviewDateLabel` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 315 |
| `localDateInputValue` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 50 |
| `yesterdayDateInputValue` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 55 |
| `averageDefinedNumbers` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 83 |
| `formatScoreline` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 95 |
| `formatPeakMoment` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 116 |
| `findGameStateAt` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 142 |
| `selectHighlightRows` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 263 |
| `marketFamilyFromParam` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 294 |
| `formatPlayerPropCount` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 303 |
| `formatReviewDateLabel` | Function | `apps/web/src/features/history/HistoryPage.tsx` | 61 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `HistoryPage → LocalDateInputValue` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Components | 6 calls |
| Event | 3 calls |
| Settings | 2 calls |
| Cluster_47 | 2 calls |
| Desk | 1 calls |

## How to Explore

1. `gitnexus_context({name: "buildHistoricalGapSummary"})` — see callers and callees
2. `gitnexus_query({query: "history"})` — find related execution flows
3. Read key files listed above for implementation details
