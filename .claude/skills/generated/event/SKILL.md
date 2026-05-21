---
name: event
description: "Skill for the Event area of nba-predict. 34 symbols across 12 files."
---

# Event

34 symbols | 12 files | Cohesion: 67%

## When to Use

- Working with code in `apps/`
- Understanding how getInstrumentTimelineExportUrl, setSourceValue, formatTimelineChartData work
- Modifying event-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/features/event/EventWorkspacePage.tsx` | toneForMappingStatus, formatMinutes, formatDuration, formatProbability, formatLine (+5) |
| `apps/web/src/features/event/timeline-chart.ts` | setSourceValue, formatTimelineChartData, formatDivergenceChartData, formatTimelineTimestamp |
| `apps/web/src/features/event/SignalQualityStrip.tsx` | formatNumber, SignalQualityStrip, deltaSummary, keys |
| `apps/web/src/components/DivergenceMiniChart.tsx` | formatDuration, pathForValues, DivergenceMiniChart |
| `apps/web/src/features/desk/TraderDeskPage.tsx` | formatDuration, InstrumentTrace, formatTimestamp |
| `apps/web/src/features/event/RawSourceDrawer.tsx` | toneForMapping, formatQuoteStatus, RawSourceDrawer |
| `apps/web/src/features/history/HistoryPage.tsx` | formatTimestamp, formatGameContext |
| `apps/web/src/data/api.ts` | getInstrumentTimelineExportUrl |
| `apps/web/src/lib/market-format.ts` | formatGapPoints |
| `apps/web/src/lib/time-format.ts` | formatOperatorDateTime |

## Entry Points

Start here when exploring this area:

- **`getInstrumentTimelineExportUrl`** (Function) — `apps/web/src/data/api.ts:1793`
- **`setSourceValue`** (Function) — `apps/web/src/features/event/timeline-chart.ts:19`
- **`formatTimelineChartData`** (Function) — `apps/web/src/features/event/timeline-chart.ts:30`
- **`formatDivergenceChartData`** (Function) — `apps/web/src/features/event/timeline-chart.ts:81`
- **`formatTimelineTimestamp`** (Function) — `apps/web/src/features/event/timeline-chart.ts:129`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getInstrumentTimelineExportUrl` | Function | `apps/web/src/data/api.ts` | 1793 |
| `setSourceValue` | Function | `apps/web/src/features/event/timeline-chart.ts` | 19 |
| `formatTimelineChartData` | Function | `apps/web/src/features/event/timeline-chart.ts` | 30 |
| `formatDivergenceChartData` | Function | `apps/web/src/features/event/timeline-chart.ts` | 81 |
| `formatTimelineTimestamp` | Function | `apps/web/src/features/event/timeline-chart.ts` | 129 |
| `formatGapPoints` | Function | `apps/web/src/lib/market-format.ts` | 8 |
| `DivergenceMiniChart` | Function | `apps/web/src/components/DivergenceMiniChart.tsx` | 52 |
| `EventWorkspacePage` | Function | `apps/web/src/features/event/EventWorkspacePage.tsx` | 170 |
| `SignalQualityStrip` | Function | `apps/web/src/features/event/SignalQualityStrip.tsx` | 16 |
| `formatOperatorDateTime` | Function | `apps/web/src/lib/time-format.ts` | 0 |
| `RawSourceDrawer` | Function | `apps/web/src/features/event/RawSourceDrawer.tsx` | 34 |
| `buildLatestComparison` | Function | `apps/web/src/lib/divergence-history.ts` | 185 |
| `latestComparison` | Function | `apps/web/src/features/event/EventWorkspacePage.tsx` | 201 |
| `deltaSummary` | Function | `apps/web/src/features/event/SignalQualityStrip.tsx` | 41 |
| `keys` | Function | `apps/web/src/features/event/SignalQualityStrip.tsx` | 62 |
| `formatDuration` | Function | `apps/web/src/components/DivergenceMiniChart.tsx` | 8 |
| `pathForValues` | Function | `apps/web/src/components/DivergenceMiniChart.tsx` | 18 |
| `formatDuration` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 122 |
| `InstrumentTrace` | Function | `apps/web/src/features/desk/TraderDeskPage.tsx` | 348 |
| `toneForMappingStatus` | Function | `apps/web/src/features/event/EventWorkspacePage.tsx` | 50 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `EventWorkspacePage → IsApiRequestError` | cross_community | 4 |
| `EventWorkspacePage → Cx` | cross_community | 4 |
| `OnSuccess → FormatOperatorDateTime` | cross_community | 4 |
| `EventWorkspacePage → SectionTitle` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Components | 6 calls |
| Settings | 1 calls |
| Games | 1 calls |
| Cluster_76 | 1 calls |
| Alerts | 1 calls |

## How to Explore

1. `gitnexus_context({name: "getInstrumentTimelineExportUrl"})` — see callers and callees
2. `gitnexus_query({query: "event"})` — find related execution flows
3. Read key files listed above for implementation details
