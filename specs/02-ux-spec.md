# UX Spec

## Primary Surfaces

- `UX-001` Games index with score, status, source coverage, and a direct path into the top ranked instrument.
- `UX-002` Divergence explorer with instrument-first rows and filters for family, severity, freshness, and comparison state. Player-prop rows shown there are Bet365 plus at least one Kalshi/Polymarket comparison, not raw prop inventory.
- `UX-003` Instrument workspace with current per-source state, timeline, and raw-source inspection.
- `UX-004` Operations page with live health, readiness, source auth/config status, research mismatch visibility, and coverage summary.
- `UX-009` Game workspace with market-family switching, grouped instrument rows, per-source comparison cells, and direct links into instrument detail.
- `UX-010` Instrument workspace shall expose a downloadable timeline export and a second capture-health visual alongside the main quote chart.
- `UX-011` Operations shall expose real capture-run history, persisted storage coverage, and unmapped-market backlog visibility.
- `UX-012` Instrument workspace shall expose the dedicated per-source diagnostics route so mapping status, latest quote lag, and latest raw payload references are visible without leaving the page.
- `UX-013` Operations shall expose frontend controls for the admin restart, backfill, timeline rebuild, and manual mapping endpoints, even when those actions currently queue backend work rather than execute it immediately.
- `UX-014` History shall be a first-class route that surfaces persisted capture runs, storage coverage, research coverage, and signal mismatches even when no games are currently visible on the live slate.
- `UX-015` Exports shall be a first-class, data-engineering-friendly route with a package-first layout: the first control downloads the complete persisted SQLite store, while secondary controls expose API-backed CSV/JSONL tables and provider/family quote slices such as all player props or one provider's prop market family.
- `UX-016` The games index shall not dead-end on an empty slate; it shall point the user toward history, exports, and settings when no canonical games are currently visible.
- `UX-017` The root trader desk shall prioritize player-prop attribution risk above general research: fresh Bet365-vs-prediction-market prop disagreements should appear in a first-panel queue and trigger a dismissible popup that links directly to the instrument workspace.
- `UX-018` Player-prop alerts shall have a first-class monitor route that shows the current live review queue and the persisted watcher replay tape for the selected date, including which frames fired desktop notifications.
- `UX-019` Settings shall expose the runtime environment knobs read by the API, worker, adapters, alert watcher, and temporary host. Secrets must be masked, defaults must be visible, and dense tables/native selects should be used instead of cards, pills, chips, or stacked decorative controls.
- `UX-020` Slate and desk surfaces shall call out stale or missing NBA game state when a scheduled game is inside the expected live/final window, rather than silently displaying an old `scheduled` state.

## Interaction Rules

- `UX-005` Every visible quote or comparison should carry enough provenance to inspect the underlying source state.
- `UX-006` Line mismatch should be called out explicitly rather than hidden under a generic severity label.
- `UX-007` Empty and error states should tell the operator whether the issue is missing data, failed ingest, or failed configuration.
- `UX-008` Route state should remain shareable through URLs for the main explorer workflows.
