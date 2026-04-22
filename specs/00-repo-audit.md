# Repo Audit

## Scope

Audit completed against the seed materials present on 2026-04-21.

## What Already Exists

- `bet365_nba_signal_console_proposal.md`
  - strong product framing
  - good stakeholder-oriented pitch language
  - detailed descriptions of signal sources and why each matters
- `bet365_nba_signal_console_memo.docx`
  - formatted executive memo version of the same concept
  - includes a sharper delivery plan, KPIs, and UI direction
- `rendered/page-1.png`, `rendered/page-2.png`, `rendered/page-3.png`
  - visual confirmation of memo hierarchy and desired seriousness
  - reinforces restrained editorial tone rather than casino styling
- `Bet365SignalConsole.tsx`
  - a self-contained design exploration for the three-pane console
  - includes example slate rows, trader note, source trust, action queue, and audit feed

## What Is Salvageable

- Product thesis: prediction markets are an external signal layer, not the pricing engine.
- UI metaphor: left rail, center active workspace, right review pane.
- Visual tone: dark, calm, dense, high-signal, restrained green accent.
- Example story: Knicks @ Celtics divergence with action recommendations.
- Domain language: divergence, trust, exposure, audit trail, repricing, confidence.

## What Should Be Replaced

- The single-file TSX mock should become a real routed application with reusable components.
- Inline example data should move into canonical fixtures and replay frames.
- Unstructured component-local types should move into shared Zod-backed domain contracts.
- The repo needs a real API, persistence layer, tests, and build tooling.

## Risks

- Live source availability may be inconsistent or impossible to validate in a demo environment.
- Team and market identity mapping across bet365, Kalshi, Polymarket, and NBA data may drift.
- An unbounded live-data ambition could dilute the product polish required for the first serious review.
- A generic admin-dashboard implementation would violate the tone of the seed materials.

## Missing Pieces

- Monorepo scaffold and package management
- Shared TypeScript configuration and strict linting/formatting
- Canonical models and normalization contracts
- Deterministic signal engine
- Demo fixtures and replay storylines
- API routes and diagnostics surfaces
- Command palette and keyboard flows
- Traceability matrix and ADRs
- Automated tests and verification commands

## Proposed Architecture Delta

Adopt a `pnpm` monorepo with:

- `apps/web` for the console
- `apps/api` for Fastify routes
- `apps/worker` for polling and replay ingestion
- `packages/domain` for contracts and scoring
- `packages/adapters` for source normalization
- `packages/shared` for persistence, config, and helpers
- `packages/ui` for shared operator-console components

Persist normalized snapshots in SQLite for demo friendliness while keeping the schema portable enough for future Postgres migration.

## Salvage / Replace Matrix

| Artifact             | Keep                        | Replace | Notes                                   |
| -------------------- | --------------------------- | ------- | --------------------------------------- |
| Proposal markdown    | Yes                         | No      | Primary product intent source           |
| Memo docx            | Yes, via extracted markdown | No      | Converted for searchability             |
| Rendered pages       | Yes                         | No      | Visual grounding only                   |
| Single-file TSX mock | Partial                     | Yes     | Reuse layout concepts, not architecture |

## Audit Verdict

The repo is conceptually strong and implementation-light. It is the right kind of seed for a spec-first build, but not yet a working product. The next step is to codify requirements and contracts before writing runtime code.
