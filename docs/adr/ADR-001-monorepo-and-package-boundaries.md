# ADR-001: Monorepo And Package Boundaries

## Decision

Keep a monorepo with separate web, API, worker, and NBA sidecar apps plus shared domain and repository packages.

## Rationale

- live research workflows span browser, HTTP API, ingest orchestration, and Python NBA normalization
- shared contracts and repositories reduce drift between those layers
- the workspace can validate TypeScript and Python slices independently
