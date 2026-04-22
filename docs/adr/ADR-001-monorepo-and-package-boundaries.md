# ADR-001: Use a pnpm Monorepo with Shared Domain, Adapter, and UI Packages

## Status

Accepted

## Context

The seed repo contains only product artifacts: one proposal, one memo, one rendered mock, and a single-file React component. There is no build system, API, fixture pipeline, package boundary, or reusable contract layer.

The product must support:

- a polished web console
- an API with deterministic signal outputs
- worker-oriented polling and replay ingestion
- shared contracts between all of the above

## Decision

Adopt a `pnpm` monorepo with this shape:

- `apps/web` for the operator console
- `apps/api` for Fastify routes and service orchestration
- `apps/worker` for polling, replay ingestion, and snapshot generation
- `packages/domain` for canonical models, Zod schemas, and signal-engine logic
- `packages/adapters` for source normalization, health rules, and live/demo/replay source adapters
- `packages/shared` for utility code, config, and persistence helpers
- `packages/ui` for shared visual primitives and layout pieces

## Consequences

Positive:

- one source of truth for contracts and deterministic scoring logic
- clear boundaries between product surfaces and data sources
- straightforward reuse of fixtures across unit, integration, and UI tests
- a clean path to future Postgres migration without rewriting the entire product

Negative:

- slightly more initial setup cost than a single Vite app
- requires discipline around package boundaries to avoid circular imports

## Follow-Up

- Put all Zod schemas and domain identifiers in `packages/domain`.
- Keep adapter-specific raw response handling out of `apps/api`.
- Keep demo/replay fixtures consumable by both the API and Playwright.
