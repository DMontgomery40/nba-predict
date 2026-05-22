---
name: alerts
description: "Skill for the Alerts area of nba-predict. 91 symbols across 9 files."
---

# Alerts

91 symbols | 9 files | Cohesion: 79%

## When to Use

- Working with code in `apps/`
- Understanding how displayBoardAlertEntity, boardAlertTitle, formatTimestampToSecond work
- Modifying alerts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/features/alerts/boardAlertReview.ts` | displayBoardAlertEntity, boardAlertTitle, formatTimestampToSecond, formatOffset, formatPbpGameClock (+36) |
| `apps/web/src/features/alerts/PlayerPropAlertsPage.tsx` | localDateInputValue, isDateInputValue, formatThreshold, rowPeakGap, matchLabel (+13) |
| `apps/web/src/features/alerts/BoardAlertsReplayPage.tsx` | BoardAlertsReplayPage, traderRead, historicalAnchorIncident, liveAnchorAlert, playerFocusedIncidents (+7) |
| `apps/web/src/features/alerts/BoardAlertsReplaySections.tsx` | TraderReadSection, ReviewTargetsSection, SameBurstFollowUpSection, PredictionSourcesSection, NbaFeedSection (+2) |
| `apps/web/src/features/alerts/BoardAlertsPage.tsx` | BoardAlertsPage, setHistoricDateParam, showLiveMode, showHistoricMode, updateHistoricDate (+1) |
| `apps/web/src/lib/divergence-history.ts` | average, inferContinuityWindowMs, buildDivergenceTraceSummary |
| `apps/web/src/features/alerts/BoardAlertsCards.tsx` | BoardAlertCard, VigCalloutCard |
| `apps/web/src/features/desk/BoardAlertsBanner.tsx` | BoardAlertsBanner |
| `apps/web/src/features/event/EventWorkspacePage.tsx` | divergenceTrace |

## Entry Points

Start here when exploring this area:

- **`displayBoardAlertEntity`** (Function) — `apps/web/src/features/alerts/boardAlertReview.ts:74`
- **`boardAlertTitle`** (Function) — `apps/web/src/features/alerts/boardAlertReview.ts:81`
- **`formatTimestampToSecond`** (Function) — `apps/web/src/features/alerts/boardAlertReview.ts:140`
- **`formatOffset`** (Function) — `apps/web/src/features/alerts/boardAlertReview.ts:158`
- **`formatPbpGameClock`** (Function) — `apps/web/src/features/alerts/boardAlertReview.ts:283`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `displayBoardAlertEntity` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 74 |
| `boardAlertTitle` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 81 |
| `formatTimestampToSecond` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 140 |
| `formatOffset` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 158 |
| `formatPbpGameClock` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 283 |
| `describePredictionSourceSummary` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 390 |
| `describeBoardAlertGameClock` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 426 |
| `familyLabel` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 444 |
| `alertFamilies` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 460 |
| `buildTraderRead` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 503 |
| `BoardAlertsReplayPage` | Function | `apps/web/src/features/alerts/BoardAlertsReplayPage.tsx` | 41 |
| `traderRead` | Function | `apps/web/src/features/alerts/BoardAlertsReplayPage.tsx` | 232 |
| `TraderReadSection` | Function | `apps/web/src/features/alerts/BoardAlertsReplaySections.tsx` | 28 |
| `ReviewTargetsSection` | Function | `apps/web/src/features/alerts/BoardAlertsReplaySections.tsx` | 111 |
| `SameBurstFollowUpSection` | Function | `apps/web/src/features/alerts/BoardAlertsReplaySections.tsx` | 164 |
| `PredictionSourcesSection` | Function | `apps/web/src/features/alerts/BoardAlertsReplaySections.tsx` | 216 |
| `NbaFeedSection` | Function | `apps/web/src/features/alerts/BoardAlertsReplaySections.tsx` | 345 |
| `ReplayFooter` | Function | `apps/web/src/features/alerts/BoardAlertsReplaySections.tsx` | 405 |
| `utcIsoDate` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 66 |
| `isDateInputValue` | Function | `apps/web/src/features/alerts/boardAlertReview.ts` | 70 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `TraderReadSection → FormatPeriod` | cross_community | 5 |
| `TraderReadSection → FormatClock` | cross_community | 5 |
| `App → Cx` | cross_community | 4 |
| `TraderReadSection → AsIncidentPlayByPlayContext` | cross_community | 4 |
| `App → IsDateInputValue` | cross_community | 3 |
| `App → UtcIsoDate` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Components | 6 calls |
| Event | 2 calls |
| Games | 1 calls |

## How to Explore

1. `gitnexus_context({name: "displayBoardAlertEntity"})` — see callers and callees
2. `gitnexus_query({query: "alerts"})` — find related execution flows
3. Read key files listed above for implementation details
