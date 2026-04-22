# Next Agent Handoff Prompt

You are taking over `Signal Console` in `/Users/davidmontgomery/nba-predict`.

Your job is **not** to redesign the product from scratch and **not** to pivot away from the current spec-driven direction. The product shell, core demo/replay mode concept, deterministic signal engine, API routes, and operator-console UI are already in place. The next step is to turn this from a polished-but-thin internal prototype into a **more legitimate internal application** by filling in the missing engineering basics that can no longer be skipped:

- structured logging
- real error handling
- observability and health surfaces
- stronger test coverage
- stronger linting / verification
- robust internal CI
- operational hygiene around the worker, API, and frontend

You should assume the user wants you to **implement the next hardening slice**, not merely describe it.

## Read This First

1. `PLAN.md`
2. `README.md`
3. `specs/00-repo-audit.md`
4. `specs/01-product-requirements.md`
5. `specs/03-architecture-spec.md`
6. `specs/04-data-contracts.md`
7. `specs/06-signal-engine-spec.md`
8. `specs/07-test-plan.md`
9. `docs/traceability-matrix.md`
10. `docs/adr/ADR-001-monorepo-and-package-boundaries.md`
11. `docs/adr/ADR-002-demo-replay-live-source-strategy.md`
12. `docs/adr/ADR-003-deterministic-signal-engine-and-explainability-boundary.md`

These docs are not optional context. If you materially change contracts, validation behavior, runtime architecture, or acceptance scope, update the relevant spec docs and the traceability matrix.

## Current Repo State

This is a `pnpm` monorepo with these live surfaces:

- `apps/web`
  - React + Vite operator console
  - overview, event workspace, divergence explorer, timeline, watchlist, settings
- `apps/api`
  - Fastify API serving demo / replay / live-mode read models
- `apps/worker`
  - very thin worker / heartbeat scaffold
- `packages/domain`
  - canonical types, storylines, deterministic signal engine
- `packages/shared`
  - SQLite-backed storage and app state
- `packages/adapters`
  - mode snapshot selection and light live degradation shaping
- `packages/ui`
  - tiny shared UI helper

Current top-level commands:

```bash
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm verify
```

As of handoff, these passed:

- `pnpm verify`
- `pnpm build`

Runtime sanity was also checked:

- API served `/api/v1/overview?mode=demo`
- API served `/api/v1/events/knicks-celtics?mode=demo`
- web served `http://127.0.0.1:4173/`

## Where Things Are

### Product and Specs

- Product brief / direction:
  - `PLAN.md`
  - `bet365_nba_signal_console_proposal.md`
  - `docs/source-materials/bet365_nba_signal_console_memo.md`
- Specs:
  - `specs/*.md`
- Architecture decisions:
  - `docs/adr/*.md`
- requirement mapping:
  - `docs/traceability-matrix.md`

### Backend

- Fastify bootstrap:
  - `apps/api/src/server.ts`
- route registration:
  - `apps/api/src/routes/*.ts`
- API service layer:
  - `apps/api/src/services/console-service.ts`
- validation helper:
  - `apps/api/src/lib/http.ts`
- API tests:
  - `apps/api/src/__tests__/routes.test.ts`

### Domain / Data / Scoring

- domain exports:
  - `packages/domain/src/index.ts`
- types:
  - `packages/domain/src/types.ts`
- enums / modes:
  - `packages/domain/src/modes.ts`
- schemas:
  - `packages/domain/src/schemas/core.ts`
- storylines / fixtures:
  - `packages/domain/src/fixtures/storylines.ts`
- scoring:
  - `packages/domain/src/signal-engine/index.ts`
- domain tests:
  - `packages/domain/src/__tests__/signal-engine.test.ts`

### Persistence

- SQLite access and schema bootstrap:
  - `packages/shared/src/db.ts`
- persistence tests:
  - `packages/shared/src/__tests__/db.test.ts`
- current DB artifact:
  - `data/signal-console.sqlite`

### Adapters

- mode and storyline selection:
  - `packages/adapters/src/index.ts`

### Frontend

- app root:
  - `apps/web/src/app/App.tsx`
- shell:
  - `apps/web/src/app/ShellLayout.tsx`
- local state:
  - `apps/web/src/app/store.ts`
- API client:
  - `apps/web/src/data/api.ts`
- major pages:
  - `apps/web/src/features/overview/OverviewPage.tsx`
  - `apps/web/src/features/event/EventWorkspacePage.tsx`
  - `apps/web/src/features/divergence/DivergenceExplorerPage.tsx`
  - `apps/web/src/features/timeline/TimelinePage.tsx`
  - `apps/web/src/features/watchlist/WatchlistPage.tsx`
  - `apps/web/src/features/settings/SettingsPage.tsx`
  - `apps/web/src/features/command/CommandPalette.tsx`
- shared web components:
  - `apps/web/src/components/*.tsx`
- styling:
  - `apps/web/src/styles/app.css`

### Worker

- worker entry:
  - `apps/worker/src/index.ts`

## What Is Good Enough Already

Do **not** waste the turn rebuilding these from zero:

- monorepo structure
- demo/replay/live mode concept
- current UI visual direction
- deterministic signal engine as the product center
- Fastify route topology
- SQLite-backed local state as the current portable storage layer

Keep and harden. Do not replace with a brand new stack just because it feels cleaner.

## What Is Obviously Thin / Cracked Right Now

This is the important section.

### 1. Logging is still barely there

Current state:

- API uses Fastify logger with `pino-pretty` in dev inside `apps/api/src/server.ts`
- errors are just passed through a minimal error handler
- worker uses raw `console.log` in `apps/worker/src/index.ts`
- frontend has no structured client-side logging or error reporting path

What is missing:

- consistent structured logger abstraction
- child loggers with context
- request IDs / correlation IDs
- per-route/service logging
- DB-operation logging
- worker job-step logging
- operator-friendly error hints
- production-safe log shape

### 2. Error handling is too primitive

Current state:

- API throws generic `Error`
- ad hoc `statusCode` mutation on errors
- no typed domain / transport error taxonomy
- no frontend error boundary
- no query-level retry / fallback strategy beyond TanStack defaults
- no safe normalization of unexpected DB / JSON / route errors

What is missing:

- typed app error classes with codes
- route-safe error envelopes
- Zod validation failures normalized consistently
- “not found”, “invalid mode”, “fixture missing”, “db failure”, “adapter failure” classes
- frontend error boundary and page-level failure states
- clear operator-facing failure copy

### 3. Observability is shallow

Current state:

- `/health` only returns status/version/uptime
- diagnostics page is product-facing, but not a real operational health/readiness surface
- no readiness vs liveness distinction
- no metrics-ish counters
- no health breakdown for DB/storyline availability/replay selection validity

What is missing:

- readiness endpoint
- structured health checks
- DB connectivity check
- storyline hydration check
- watchlist store / app_state integrity checks
- degraded-source counts emitted in a consistent health payload
- optional simple internal metrics surface

### 4. Testing is too thin

Current state:

- domain tests exist
- shared DB tests exist
- API route tests exist
- web has no real tests
- worker has no tests
- no e2e coverage even though `test:e2e` script exists
- no Playwright config or authored scenarios

What is missing:

- frontend component / route tests
- API integration tests for failure paths
- worker tests
- end-to-end demo-mode smoke tests
- replay-mode behavior tests
- stronger contract tests
- broader bug-family coverage, not just narrow happy path

### 5. CI and verification are still beginner-grade

Current state:

- local scripts exist
- no GitHub Actions or other internal CI config in repo
- no split verify pipeline
- no coverage reporting
- no artifact or test result publishing
- lint is basic ESLint only

What is missing:

- `.github/workflows/ci.yml` or equivalent internal CI
- separate jobs for lint / typecheck / unit / build / e2e
- caching for pnpm
- deterministic Playwright install/run
- coverage threshold enforcement where realistic
- format check and perhaps markdown/json validation
- stronger linting for imports, dead code, maybe dependency boundaries

### 6. Worker is not a real worker yet

Current state:

- `apps/worker/src/index.ts` is a heartbeat logger over mode snapshots

What is missing:

- job wrapper with lifecycle logging
- graceful shutdown
- interval control abstraction
- exception isolation around polling cycles
- backoff / retry behavior
- persistence-aware tasks
- meaningful replay/demo hydration checks

### 7. DB and persistence need operational hardening

Current state:

- `packages/shared/src/db.ts` bootstraps schema inline
- no migration system
- no explicit schema versioning
- no DB health abstraction
- singleton database handle only

What is missing:

- schema version strategy
- migration mechanism, even lightweight
- integrity / readiness checks
- better error wrapping
- cleanup / close hooks for tests and worker
- stronger test coverage around corrupted / missing state

### 8. Frontend robustness still has holes

Current state:

- app is functional and visually coherent
- command palette and shell work
- data hooks are lightweight fetch wrappers

What is missing:

- React error boundary
- better loading and failure states
- no reusable query hook layer with invalidation discipline
- no mutation error feedback
- no retry/backoff policy documentation
- no frontend tests
- no route guards for missing IDs / invalid state

### 9. Artifact hygiene is sloppy

Current state:

- `dist/` artifacts exist in repo
- `data/signal-console.sqlite`, `-wal`, and `-shm` exist

You should decide carefully whether these should remain committed / present. If you change artifact strategy, do it intentionally and update `.gitignore`, docs, and workflows accordingly.

## The Next Step You Should Actually Build

Do **not** try to solve every missing thing in one giant chaotic pass.

Build the next slice as **“production hardening foundation”** with these concrete deliverables:

### A. Introduce a real app-level logging and error system

Minimum expected outcomes:

- shared logger utility package or module
- typed app error classes
- standardized API error envelope with stable code + message + details + optional operator hint
- request ID support in API
- service-layer log calls in `console-service.ts`
- worker logs moved off raw console printing into the shared logger abstraction

Strongly consider using the `operator-hint-logging` skill guidance if it helps shape this cleanly.

### B. Strengthen backend operational endpoints

Add:

- `/health/live`
- `/health/ready`
- or a similarly clear liveness/readiness split

Those endpoints should meaningfully validate:

- DB openability
- fixture/storyline presence
- replay selection validity
- current mode snapshot resolution

Do not make health endpoints fake.

### C. Build real frontend failure handling

At minimum:

- top-level React error boundary
- page-level error states for query failures
- retry affordance on failing surfaces
- mutation failure messaging for watchlist / replay / demo selection actions

### D. Add the first real frontend + e2e tests

At minimum:

- component or route test for overview render
- route test for event workspace failure or fallback path
- Playwright smoke test for demo mode
- Playwright flow for opening an event from overview
- replay or settings mode selection smoke

If a broader shared suite makes sense, use it. Do not drop hyper-specific one-off tests if a matrix or integration style is more honest.

### E. Add internal CI

Add a robust CI workflow with:

- checkout
- pnpm install
- lint
- typecheck
- unit/integration tests
- build
- e2e smoke if feasible in headless mode

If e2e is too heavy for every job, split it into a separate workflow or job. But don’t skip CI entirely.

### F. Improve lint / verification beyond the basics

Add only what is worth the complexity, but do add more than the current baseline. Good candidates:

- `eslint-plugin-import` or equivalent
- no-cycle / import-order / dependency-boundary rules
- prettier check script
- maybe markdown/json/yaml validation if a lightweight tool fits
- coverage reporting or at least coverage generation hooks

## Recommended Order of Work

Do the work in this order unless inspection shows a better local truth:

1. Audit current scripts/configs and locate the exact missing infra files.
2. Add shared logger + error abstraction.
3. Refactor API to use typed errors and route-safe envelopes.
4. Harden worker logging + lifecycle.
5. Add readiness/liveness checks and richer diagnostics integration.
6. Add frontend error boundary and mutation/query failure UX.
7. Add frontend tests and Playwright config/tests.
8. Add CI workflow and stronger verify scripts.
9. Update specs / traceability / README for any changed contracts or validation gates.
10. Run the full changed-surface tests plus repo-standard verify/build.

## Concrete Files You Will Probably Touch

Very likely:

- `package.json`
- `eslint.config.js`
- `vitest.config.ts`
- `.gitignore`
- `README.md`
- `apps/api/src/server.ts`
- `apps/api/src/lib/http.ts`
- `apps/api/src/services/console-service.ts`
- `apps/worker/src/index.ts`
- `packages/shared/src/db.ts`
- `apps/web/src/app/App.tsx`
- `apps/web/src/app/ShellLayout.tsx`
- `apps/web/src/data/api.ts`
- `apps/web/src/features/settings/SettingsPage.tsx`
- `apps/web/src/features/event/EventWorkspacePage.tsx`

Likely new files:

- `packages/shared/src/logger.ts` or similar
- `packages/shared/src/errors.ts` or similar
- `apps/web/src/app/ErrorBoundary.tsx`
- `apps/web/src/**/*.test.tsx`
- `apps/web/playwright.config.ts`
- `apps/web/tests/*.spec.ts`
- `.github/workflows/ci.yml`

Possibly:

- a more formal DB migration file or folder
- a health-check helper module
- docs/ADR if you materially change logging/error architecture

## Guardrails

- Do not replace SQLite right now.
- Do not replace Fastify right now.
- Do not replace Vite/React right now.
- Do not “solve” observability by pasting in a giant enterprise framework.
- Do not invent fake live behavior and call it production readiness.
- Do not turn the product into a public sportsbook UI.
- Do not break the current demo/replay flows in pursuit of infra purity.

## Acceptance Criteria For Your Turn

Your turn is successful if all of the following are true:

- logging is materially better and more structured across API and worker
- API error handling is standardized and typed
- frontend has real failure handling beyond default crashes
- there are real frontend and/or e2e tests, not only backend/domain tests
- CI exists in-repo and runs meaningful gates
- verify/build/test still pass
- specs/docs are updated where the hardening work changed contracts or quality gates

## Commands To Run Before You Stop

At minimum:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm verify
```

If you add e2e:

```bash
pnpm test:e2e
```

If any of these fail, do not handwave it. Say exactly what failed, what you fixed, what remains, and whether the blocker is environmental or code-related.

## Suggested Opening Move

Start by reading:

- `apps/api/src/server.ts`
- `apps/api/src/services/console-service.ts`
- `apps/worker/src/index.ts`
- `packages/shared/src/db.ts`
- `apps/web/src/app/App.tsx`
- `apps/web/src/data/api.ts`
- `package.json`
- `eslint.config.js`
- `vitest.config.ts`

Then make a short implementation plan focused on **hardening foundation**, not on new product features.

The right mindset for this turn is:

“Keep the current app shape, make it much more legitimate, and close the engineering cracks that are currently too basic to ignore.”
