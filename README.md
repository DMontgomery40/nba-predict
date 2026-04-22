# Signal Console

Signal Console is an internal NBA market-intelligence and trader decision-support console. It compares bet365 book state against Kalshi, Polymarket, and an internal baseline, then surfaces divergence, confidence, provenance, and recommended action in a three-pane operator workflow.

## What Is In The Repo

- `apps/web`
  - React operator console with overview, event workspace, divergence explorer, timeline, watchlist, and settings surfaces
- `apps/api`
  - Fastify API that serves normalized demo/replay/live read models
- `apps/worker`
  - fixture hydration and heartbeat worker
- `packages/domain`
  - canonical contracts, fixtures, storylines, and deterministic signal engine
- `packages/shared`
  - SQLite persistence and replay/watchlist state
- `packages/adapters`
  - demo/replay/live mode selection over the normalized fixture store
- `packages/ui`
  - shared UI helper primitives
- `specs`
  - product, UX, architecture, contracts, signal-engine, and delivery specs
- `docs`
  - ADRs, traceability matrix, and searchable source-material extraction

## Run It

```bash
pnpm install
pnpm dev
```

Default local ports:

- web: `http://127.0.0.1:4120`
- api: `http://127.0.0.1:8787`

SQLite state is stored at `data/signal-console.sqlite` by default.
Local SQLite runtime artifacts under `data/*.sqlite*` are generated state and are intentionally git-ignored.

## Quality Gates

```bash
pnpm format:check
pnpm verify
pnpm build
pnpm test:e2e
```

`pnpm verify` runs the repo standard format, lint, typecheck, and test path.

## Operational Surfaces

- `GET /health/live`
  - process liveness and uptime
- `GET /health/ready`
  - SQLite readiness, fixture availability, replay selection validity, and mode-resolution checks
- `GET /api/v1/diagnostics?mode=demo`
  - operator-facing storage, source, selection, and warning detail

## Product Modes

- `demo`
  - presentation-safe curated snapshot flow
- `replay`
  - step-through storyline mode driven by saved frames
- `live`
  - latest normalized snapshot with honest degraded-source labeling

## Seed Materials

The original concept artifacts remain in the repo and are now backed by searchable and implementation-facing docs:

- `bet365_nba_signal_console_proposal.md`
- `bet365_nba_signal_console_memo.docx`
- `docs/source-materials/bet365_nba_signal_console_memo.md`
- `Bet365SignalConsole.tsx`
