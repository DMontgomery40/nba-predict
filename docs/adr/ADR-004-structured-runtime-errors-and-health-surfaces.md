# ADR-004: Standardize Structured Logging, Typed Runtime Errors, and Split Liveness/Readiness Health Probes

## Status

Accepted

## Context

The initial runtime slice proved the product direction, but several foundations were still too thin for a legitimate internal application:

- API errors were ad hoc `Error` objects with route-local `statusCode` mutation.
- Worker output used raw `console.log` heartbeats with no lifecycle or retry story.
- Health reporting was a single shallow `/health` route with no readiness distinction.
- Frontend fetch failures surfaced as generic thrown errors with no operator-facing detail.

The next hardening slice needed better operator breadcrumbs without replacing the current stack.

## Decision

Adopt a shared runtime foundation with:

- a shared structured logger in `packages/shared`
- typed application errors with stable codes and optional `operatorHint`
- a standardized API error envelope that includes `code`, `message`, `details`, `operatorHint`, and `requestId`
- request-id propagation through Fastify
- split health probes:
  - `/health/live` for process liveness
  - `/health/ready` for database, fixture, selection, and mode-resolution readiness

The worker also moves to structured lifecycle logging with cycle isolation, backoff, and graceful shutdown.

## Consequences

Positive:

- operator-facing failures become traceable across API logs, health checks, and frontend error states
- readiness now validates real runtime dependencies instead of reporting a fake healthy process
- the worker can fail a cycle without crashing the whole process
- frontend failure copy can surface `operatorHint` and `requestId` for faster debugging

Negative:

- more runtime contracts must stay aligned between server, worker, and frontend
- health probes now depend on meaningful database and fixture checks rather than constant-time static responses

## Follow-Up

- keep error-code additions documented in `specs/04-data-contracts.md`
- keep readiness contract updates reflected in `specs/05-api-spec.md`
- keep new health and failure tests mapped in `docs/traceability-matrix.md`
