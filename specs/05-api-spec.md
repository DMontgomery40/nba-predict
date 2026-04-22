# API Spec

## API Principles

- `API-001` All routes shall be namespaced under `/api/v1` except for health probes.
- `API-002` All route params and query strings shall validate with Zod.
- `API-003` Responses shall include `mode` and `generatedAt` metadata where the client may compare freshness across requests.
- `API-024` Every request shall receive an `x-request-id` response header for correlation across logs and error envelopes.

## Routes

### `GET /health/live`

- Purpose: process liveness
- Response:
  - `status`
  - `version`
  - `uptimeMs`
  - `checks`

### `GET /health/ready`

- Purpose: runtime readiness backed by real dependency checks
- Response:
  - `status`
  - `version`
  - `uptimeMs`
  - `checks`
  - `summary`

### `GET /health`

- Purpose: backward-compatible aggregate health summary
- Response:
  - `status`
  - `version`
  - `uptimeMs`
  - `ready`
  - `endpoints`

### `GET /api/v1/modes`

- `API-004` Return supported operating modes, the active mode, and replay/demo selections.

### `GET /api/v1/overview`

- `API-005` Return dashboard cards, quick stats, top watchlist rows, and source-health summary.
- Query params:
  - `mode`
  - `storylineId?`
  - `severity?`
  - `sort?`
  - `limit?`

### `GET /api/v1/events/:eventId`

- `API-006` Return full event workspace data including quotes, scoring, reasons, narrative cards, suggested actions, and audit summary.
- Query params:
  - `mode`
  - `storylineId?`
  - `frameIndex?`

### `GET /api/v1/events/:eventId/timeline`

- `API-007` Return timeline overlays, annotations, and replay metadata for one event.
- Query params:
  - `mode`
  - `storylineId?`
  - `window?`

### `GET /api/v1/divergence`

- `API-008` Return a filterable table of divergence records across events.
- Query params:
  - `mode`
  - `severity?`
  - `confidenceBand?`
  - `freshness?`
  - `team?`
  - `sort?`
  - `page?`
  - `pageSize?`

### `GET /api/v1/watchlist`

- `API-009` Return persisted watchlist items plus supporting event summary data.
- Query params:
  - `mode`
  - `status?`

### `POST /api/v1/watchlist`

- `API-010` Add or update a watchlist item.
- Body:
  - `eventId`
  - `priority?`
  - `status?`
  - `note?`

### `DELETE /api/v1/watchlist/:eventId`

- `API-011` Remove a watchlist item for the current operator context.

### `GET /api/v1/diagnostics`

- `API-012` Return source health, config warnings, fixture availability, stale counts, and last sync times.
- Query params:
  - `mode`

### `POST /api/v1/replay/select`

- `API-013` Select a replay storyline and optional frame index for session-local use.
- Body:
  - `storylineId`
  - `frameIndex?`

## Validation Rules

- `API-014` Invalid enum values shall return `400` with stable validation details.
- `API-015` Missing event IDs shall return `404`.
- `API-016` Replay frame indices outside the valid range shall return `422`.
- `API-025` Health readiness shall return `503` when database, fixture, replay-selection, or mode-resolution checks fail.

## Response Shape Rules

- `API-017` List responses shall return `{ data, meta }`.
- `API-018` Event detail shall return `{ data: { event, signal, sources, timelinePreview, narrative, actions, audit }, meta }`.
- `API-019` Diagnostics shall return grouped summaries for `mode`, `sources`, `fixtures`, and `storage`.
- `API-026` Error responses shall return `{ error: { code, message, details?, operatorHint?, requestId? } }`.

## Rate-Limiting and Caching Assumptions

- `API-020` Demo and replay mode routes may be cached briefly in-process because they are deterministic for a selected fixture/frame.
- `API-021` Live-mode responses shall prefer freshness correctness over aggressive caching.

## Auth Assumptions

- `API-022` The initial implementation assumes trusted internal usage with no application auth flow.
- `API-023` Diagnostics endpoints shall be coded so they can be protected later without reshaping response contracts.
