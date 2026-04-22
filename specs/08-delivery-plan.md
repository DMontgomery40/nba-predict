# Delivery Plan

## Milestones

### Milestone 1: Spec and Contract Foundation

- repo audit
- memo extraction
- requirements, UX, architecture, data, API, signal, and test specs
- ADRs and traceability matrix

### Milestone 2: Runtime Scaffold

- `pnpm` workspace
- shared TypeScript, lint, format, and test tooling
- domain package with schemas and fixtures
- base Fastify and React apps

### Milestone 3: Demo / Replay Engine

- normalized fixture ingestion
- replay storyline indexing
- overview and event-detail API read models

### Milestone 4: Operator Console Core

- shell layout
- overview dashboard
- event workspace
- divergence explorer
- timeline

### Milestone 5: Diagnostics, Watchlist, and Polish

- settings / diagnostics
- watchlist persistence
- command palette and keyboard flows
- skeletons, error states, and final verification

## Vertical Slice Order

1. Specs and docs
2. Shared contracts and demo fixtures
3. API overview + diagnostics
4. Web overview shell
5. Event workspace
6. Divergence explorer and timeline
7. Watchlist and settings
8. Final polish and verification

## What Gets Built First

- demo-safe fixture-driven flows
- source health and provenance visibility
- deterministic scoring
- overview-to-detail workflow

## What Can Be Deferred

- fully live adapter wiring to real external endpoints
- advanced backtesting analytics
- multi-user workflow or auth
- prop-market depth beyond representative demo coverage

## Demo-Critical Path

- deterministic storyline fixtures
- high-quality three-pane shell
- honest diagnostics
- clear action recommendation and explainability surfaces
