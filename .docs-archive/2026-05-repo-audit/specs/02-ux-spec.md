# UX Spec

## Primary Surfaces

- `UX-001` Games index with score, status, source coverage, and a direct path into the top ranked instrument.
- `UX-002` Divergence explorer with instrument-first rows and filters for family, severity, freshness, and comparison state. Player-prop rows shown there are Bet365 plus at least one Kalshi/Polymarket comparison, not raw prop inventory.
- `UX-003` Instrument workspace with same-time comparison evidence, divergence trace, timeline, and raw-source inspection.
- `UX-004` Operations page with live health, readiness, source auth/config status, research mismatch visibility, and coverage summary.
- `UX-009` Game workspace with market-family switching, grouped instrument rows, per-source comparison cells, and direct links into instrument detail.
- `UX-010` Instrument workspace shall expose a downloadable timeline export and a second capture-health visual alongside the main quote chart.
- `UX-011` Operations shall expose real capture-run history, persisted storage coverage, and unmapped-market backlog visibility.
- `UX-012` Instrument workspace shall expose the dedicated per-source diagnostics route so mapping status, latest quote lag, and latest source record references are visible without leaving the page.
- `UX-013` Operations shall expose frontend controls for the admin restart, backfill, timeline rebuild, and manual mapping endpoints, even when those actions currently queue backend work rather than execute it immediately.
- `UX-014` History shall be a first-class route that surfaces persisted capture runs, storage coverage, research coverage, and signal mismatches even when no games are currently visible on the live slate.
- `UX-015` Exports shall be a first-class, data-engineering-friendly route with a package-first layout: the first control downloads the complete persisted SQLite store, while secondary controls expose API-backed CSV/JSONL tables and provider/family quote slices such as all player props or one provider's prop market family.
- `UX-016` The games index shall not dead-end on an empty slate; it shall point the user toward history, exports, and settings when no canonical games are currently visible.
- `UX-017` The prop-alerts route shall preserve the stricter player-prop attribution risk workflow: current Bet365-vs-exchange prop disagreements should appear in a monitor queue and link directly to the instrument workspace when exact-line evidence exists.
- `UX-018` Player-prop alerts shall have a first-class monitor route that shows the current review queue and the persisted watcher checks for the selected date, including which checks fired desktop notifications.
- `UX-019` Settings shall expose the runtime environment knobs read by the API, worker, adapters, alert watcher, and temporary host. Secrets must be masked, defaults must be visible, and dense tables/native selects should be used instead of cards, pills, chips, or stacked decorative controls.
- `UX-020` Slate and desk surfaces shall call out missing NBA score updates or missing final confirmation only after the scheduled tip grace has elapsed and the game is inside the expected live/final window, rather than flagging normal pre-tip rows as stale or silently displaying an old `scheduled` state once the grace window is over.
- `UX-021` Divergence rows shall show peak divergence, latest measured divergence, threshold duration, and market-match state from DB-backed summaries. Final games may be review evidence; only live games with fresh same-time quotes may read as actionable now.
- `UX-022` Slate and desk game cards shall display market feeds separately from NBA state. A top signal may only appear when a same-time market comparison exists; coverage-only rows must read as coverage or mapping work, not `0.0%` disagreement.
- `UX-024` The trader desk shall allow a broad volatility or weirdness tripwire to appear first when it is the fastest reliable signal, but it shall immediately fan out into the implicated players, props, and related derivative markets that a trader may need to suspend.
- `UX-025` A dedicated market-anomalies route shall expose the anomaly queue and tunable scoring controls. The existing prop-alerts route remains a stricter exact-line compatibility surface, while `/board-alerts` is the broader trader-incident queue and warning-audit route.
- `UX-026` Inspect on a board alert shall show actual local timestamp first, game period/clock if known, the likely review or suspension targets, nearby player-specific follow-up when the first alert was only a broad tripwire, and honest missing-feed or pregame/near-tip notes when the NBA feed cannot yet confirm the event. It shall not present an hours-away NBA row as if it were nearby incident context.

## Interaction Rules

- `UX-005` Every visible quote or comparison should carry enough provenance to inspect the underlying source state.
- `UX-006` Line mismatch should be called out explicitly rather than hidden under a generic severity label.
- `UX-007` Empty and error states should tell the operator whether the issue is missing data, failed ingest, or failed configuration.
- `UX-008` Route state should remain shareable through URLs for the main explorer workflows.
- `UX-023` Search results should promote actionable trading boards only. Scoreboard-only schedule rows belong in quarantined slate sections, not the command palette.
