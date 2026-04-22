# API Spec

## Principles

- `API-001` All application routes shall be namespaced under `/api/v1` except for health probes.
- `API-002` Route params and query strings shall validate with Zod.
- `API-003` Responses shall return `{ data, meta }` for list and read-model routes.
- `API-004` Error responses shall return `{ error: { code, message, details?, operatorHint?, requestId? } }`.

## Health

- `GET /health/live`
- `GET /health/ready`
- `GET /health`

## Research Routes

- `GET /api/v1/games`
- `GET /api/v1/games/:gameId`
- `GET /api/v1/games/:gameId/markets`
- `GET /api/v1/games/:gameId/markets/:instrumentId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/timeline`
- `GET /api/v1/games/:gameId/markets/:instrumentId/raw/:sourceId`
- `GET /api/v1/games/:gameId/markets/:instrumentId/export.csv`
- `GET /api/v1/divergence`
- `GET /api/v1/research/coverage`
- `GET /api/v1/research/signal-mismatches`

## Admin Routes

- `GET /api/v1/admin/sources`
- `GET /api/v1/admin/capture/runs`
- `POST /api/v1/admin/capture/restart`
- `POST /api/v1/admin/backfill/games`
- `POST /api/v1/admin/backfill/markets`
- `GET /api/v1/admin/unmapped-markets`
- `POST /api/v1/admin/mappings/resolve`
- `POST /api/v1/admin/timeline-materializations/rebuild`
- `GET /api/v1/admin/storage/coverage`

## Readiness

- `API-005` Readiness shall return `503` when required live dependencies or persisted live data are missing.
- `API-006` Live routes shall not fall back to synthetic or curated data.
