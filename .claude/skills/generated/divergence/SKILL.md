---
name: divergence
description: "Skill for the Divergence area of nba-predict. 14 symbols across 2 files."
---

# Divergence

14 symbols | 2 files | Cohesion: 85%

## When to Use

- Working with code in `apps/`
- Understanding how formatOperatorTime, DivergenceExplorerPage, updateFilters work
- Modifying divergence-related functionality

## Key Files

| File                                                          | Symbols                                                                                   |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | buildNextSearchParams, severityClass, sourceLabel, formatDuration, marketTimingLabel (+8) |
| `apps/web/src/lib/time-format.ts`                             | formatOperatorTime                                                                        |

## Entry Points

Start here when exploring this area:

- **`formatOperatorTime`** (Function) — `apps/web/src/lib/time-format.ts:20`
- **`DivergenceExplorerPage`** (Function) — `apps/web/src/features/divergence/DivergenceExplorerPage.tsx:155`
- **`updateFilters`** (Function) — `apps/web/src/features/divergence/DivergenceExplorerPage.tsx:183`
- **`showAllPlayerProps`** (Function) — `apps/web/src/features/divergence/DivergenceExplorerPage.tsx:187`
- **`resetFilters`** (Function) — `apps/web/src/features/divergence/DivergenceExplorerPage.tsx:197`

## Key Symbols

| Symbol                   | Type     | File                                                          | Line |
| ------------------------ | -------- | ------------------------------------------------------------- | ---- |
| `formatOperatorTime`     | Function | `apps/web/src/lib/time-format.ts`                             | 20   |
| `DivergenceExplorerPage` | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 155  |
| `updateFilters`          | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 183  |
| `showAllPlayerProps`     | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 187  |
| `resetFilters`           | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 197  |
| `buildNextSearchParams`  | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 46   |
| `severityClass`          | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 75   |
| `sourceLabel`            | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 88   |
| `formatDuration`         | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 101  |
| `marketTimingLabel`      | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 114  |
| `matchLabel`             | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 132  |
| `rowPeakGap`             | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 147  |
| `rowLatestGap`           | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 151  |
| `buildSearchParams`      | Function | `apps/web/src/features/divergence/DivergenceExplorerPage.tsx` | 63   |

## Connected Areas

| Area  | Connections |
| ----- | ----------- |
| Event | 2 calls     |

## How to Explore

1. `gitnexus_context({name: "formatOperatorTime"})` — see callers and callees
2. `gitnexus_query({query: "divergence"})` — find related execution flows
3. Read key files listed above for implementation details
