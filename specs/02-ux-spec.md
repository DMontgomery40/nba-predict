# UX Spec

## Information Architecture

- `UX-001` Left rail navigation shall group operator destinations into Trading, Analysis, and System sections.
- `UX-002` The center pane shall be the primary workspace for active event analysis.
- `UX-003` The right pane shall contain recommended action, confidence explanation, source trust, and audit context.
- `UX-004` Global mode state shall always be visible from the shell header or control rail.

## Primary Screens

### Overview Dashboard

- `UX-005` Show top divergence cards with severity, confidence, tipoff urgency, and freshness.
- `UX-006` Show quick stats for alert volume, source health, and watchlist changes.
- `UX-007` Show a ranked watchlist table with sticky headers and numeric alignment.

### Event Detail Workspace

- `UX-008` Show a prominent event header with teams, tipoff, market type, and source badges.
- `UX-009` Show a comparison strip for bet365, Kalshi, Polymarket, internal baseline, and consensus.
- `UX-010` Show reason-code-backed narrative cards and confidence factors.
- `UX-011` Support replay controls and raw-source inspection without leaving the workspace.

### Divergence Explorer

- `UX-012` Provide sortable columns for divergence, confidence, freshness, liquidity, and exposure urgency.
- `UX-013` Provide faceted filters for source health, severity, freshness, and team search.

### Timeline

- `UX-014` Show time-series overlays for source movement and consensus evolution.
- `UX-015` Support point inspection with source values, annotations, and reason changes.

### Watchlist / Alerts

- `UX-016` Show priority, alert reason badges, last change time, and source-health context.
- `UX-017` Support add/remove or queue-review actions from both cards and rows.

### Settings / Diagnostics

- `UX-018` Show operating mode, fixture selection, adapter health, environment readiness, and sync lag.

## Interaction Model

- `UX-019` Selecting an overview card or table row shall update the center pane without a full page reload.
- `UX-020` Filters and sorting shall round-trip through the URL for shareable views.
- `UX-021` The command palette shall expose event search, mode switching, and common filter shortcuts.
- `UX-022` Secondary drawers shall be used for raw-source detail and audit history so the primary workspace stays focused.

## Design Language

- `UX-023` The UI shall use a dark command-center visual language with restrained green and steel-blue accents.
- `UX-024` Primary typography shall favor an operator-grade sans face with strong numerics; mono typography shall be used for timestamps, probabilities, IDs, and raw data.
- `UX-025` Numbers shall be visually aligned and easy to compare across sources.
- `UX-026` Charts shall be minimal and comparison-oriented, with no chartjunk or ornamental gradients.

## Empty, Loading, and Error States

- `UX-027` Empty states shall explain what the user can do next, such as selecting a fixture pack or clearing filters.
- `UX-028` Loading states shall use restrained skeletons that preserve final layout structure.
- `UX-029` Error states shall explain whether the issue is source-specific, mode-specific, or systemic.
- `UX-030` Stale sources shall be visibly labeled without blocking access to healthy sources.

## Accessibility

- `UX-031` The shell shall be navigable with keyboard only.
- `UX-032` Contrast shall remain readable in the default dark theme.
- `UX-033` Tables, controls, and drawers shall expose accessible labels and focus states.

## Keyboard and Power-User Flows

- `UX-034` `Cmd/Ctrl+K` opens the command palette.
- `UX-035` `G O`, `G E`, `G D`, `G W`, and `G S` navigate to Overview, Event, Divergence, Watchlist, and Settings.
- `UX-036` `[` and `]` step replay frames when replay mode is active.
- `UX-037` `F` focuses the filter bar in explorer-style surfaces.
