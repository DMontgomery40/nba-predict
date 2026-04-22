# Next Agent Handoff Prompt

You are taking over `Signal Console` in `/Users/davidmontgomery/nba-predict`.

This repo is only a few sessions old. Do not mythologize it. Do not act like the current gap is a mysterious research frontier. The product intent is clear. The implementation is incomplete. Your job is to bridge that gap with direct, repo-grounded work.

## Read This First

1. `AGENTS.md`
2. `PLAN.md`
3. `README.md`
4. `bet365_nba_signal_console_proposal.md`
5. `specs/01-product-requirements.md`
6. `specs/02-ux-spec.md`
7. `specs/03-architecture-spec.md`
8. `specs/04-data-contracts.md`
9. `specs/05-api-spec.md`
10. `specs/08-delivery-plan.md`
11. `specs/09-assumptions-and-open-questions.md`
12. `docs/adr/ADR-002-live-only-research-runtime.md`
13. `docs/traceability-matrix.md`

Do not use global cross-project memory. Project-local memory for this repo is effectively empty, so the durable truth is the repo itself plus git history.

## What This Product Is Supposed To Be

Signal Console is supposed to be a live research system for in-game market comparison.

The intended product is:

- an internal operator research console, not a customer sportsbook UI
- live-only, not a demo shell
- instrument-first, not one-row-per-game trivia
- built around real captured source history, not synthetic storylines
- able to compare:
  - bet365 in-game offers captured via scrape-only authenticated browser/session state
  - Kalshi market data via official API or WebSocket access
  - Polymarket market data via official APIs
  - NBA game truth via a Python `nba_api` sidecar
- able to answer, for a live or completed game:
  - final score and final state
  - what each source showed over time
  - when prices moved relative to game-state changes
  - whether disagreement is like-for-like probability divergence or merely a line mismatch

The canonical comparison unit is:

- raw line or offer terms
- plus derived implied probability

The UI is supposed to feel like a serious research console:

- game list with real coverage and top divergence signals
- game detail with market family switching and grouped active instruments
- instrument workspace with meaningful source comparison
- usable live charting and timeline overlays
- raw-source inspection
- honest operator visibility into capture gaps and unmapped markets
- exportable research artifacts

This is a research product. No betting execution. No fixture fallback. No presentation-only pretend data path.

## Three-Session Reconstruction

This repo has three meaningful states:

### Session 1: initial foundation commit

`b888c00 feat: harden signal console foundation @codex review (#1)`

What happened:

- a polished monorepo shell was created quickly
- it included demo, replay, and live modes
- it centered a deterministic signal engine and authored storylines
- it built a lot of UI and API shape fast
- it produced a plausible operator console shell

What that really was:

- a strong shell
- a lot of scaffolding
- a large amount of synthetic runtime
- not the live research product the user actually wanted

### Session 2: minor post-merge cleanup

`4e6afcb fix: stabilize post-merge e2e smoke @codex review (#2)`

What happened:

- tiny smoke-test and handoff adjustments
- no real product-lane correction

### Session 3: current branch live-only rewrite

This is the current branch state headed for PR review.

What happened:

- demo, replay, fixture, and storyline language was removed from source/docs/specs
- live-only research tables and repositories were added
- a Python NBA sidecar scaffold was added
- the API surface was rewritten around games, instruments, research, and admin
- the frontend was partially rewritten around live-only routes
- the old handoff prompt was deleted because it described the wrong product

What did not happen:

- real bet365 capture
- real Kalshi ingestion
- real Polymarket ingestion
- env-to-runtime wiring that actually uses the credentials already present on disk
- meaningful operator UX completion
- export workflows
- real live charts beyond a single simple line chart

## Current Repo Reality

### What now exists for real

- live-only contracts:
  - `packages/domain/src/live-types.ts`
  - `packages/domain/src/schemas/live.ts`
  - `packages/domain/src/schemas/research.ts`
- live SQLite schema and repositories:
  - `packages/shared/src/migrations.ts`
  - `packages/shared/src/db-core.ts`
  - `packages/shared/src/live-repository.ts`
- live API routes:
  - `apps/api/src/routes/games.ts`
  - `apps/api/src/routes/divergence.ts`
  - `apps/api/src/routes/research.ts`
  - `apps/api/src/routes/admin.ts`
- live-oriented API service layer:
  - `apps/api/src/services/research-service.ts`
  - `apps/api/src/services/health-service.ts`
- Python NBA sidecar scaffold using `nba_api`:
  - `apps/nba-sidecar/src/nba_sidecar/main.py`
  - `apps/nba-sidecar/src/nba_sidecar/service.py`
  - `apps/nba-sidecar/src/nba_sidecar/normalizers.py`
- worker ingest seam for NBA scoreboard polling:
  - `apps/worker/src/index.ts`
  - `apps/worker/src/nba-sidecar.ts`
- rewritten web shell:
  - `apps/web/src/features/games/GamesPage.tsx`
  - `apps/web/src/features/divergence/DivergenceExplorerPage.tsx`
  - `apps/web/src/features/event/EventWorkspacePage.tsx`
  - `apps/web/src/features/settings/SettingsPage.tsx`

### What is only partially real

- readiness and admin surfaces are real in shape, but many checks are config- and queue-oriented rather than dependency-reachability and ingest-success oriented
- the NBA sidecar is real, but the worker only ingests scoreboard-shaped state, not the full game-detail or play-by-play product loop
- the frontend is live-only in wording and route shape, but it is still a thin read-only shell

### What does not exist yet

- no bet365 adapter implementation
- no Kalshi adapter implementation
- no Polymarket adapter implementation
- no capture orchestration for those sources
- no real quote ingestion from any external market
- no order book capture loops
- no historical backfill workers
- no live chart/export workflow worth calling useful

## The Critical Findings

These are the main reasons the product still feels hopelessly non-functional.

### 1. The runtime does not actually use the env surface the repo pretends to support

Facts:

- The root `.env` contains source credentials.
- The Node API and worker do not load `.env` themselves.
- There is no `dotenv`-style bootstrap in `apps/api` or `apps/worker`.
- `pnpm dev` runs `tsx watch ...` directly from root scripts.
- The frontend does not use these source creds.

What this means:

- A credential sitting in `.env` is not enough.
- Unless the user exported those vars into the shell before `pnpm dev`, API and worker code never see them.
- Even if they were exported, most of the source adapter code that should consume them does not exist yet.

Additional important detail:

- `.env` currently contains Kalshi and Polymarket keys.
- `.env` does not contain the full live runtime surface described in `README.md`.
- There is no `BET365_SESSION_STATE_PATH` configured in `.env`.
- There is no `NBA_SIDECAR_BASE_URL` configured in `.env`.
- The readiness code requires `KALSHI_API_KEY` and `KALSHI_API_SECRET`, but the on-disk `.env` only surfaced the key when this audit was run. Do not assume readiness will pass just because there is a Kalshi-related entry in the file.
- Polymarket credentials exist on disk, but there is effectively no runtime code path that uses them.

### 2. The product has no real external market capture

Facts:

- `packages/adapters/src/index.ts` is effectively empty.
- Searches for bet365, Kalshi, and Polymarket mostly hit schemas, tests, read-model shaping, and readiness/config code.
- There are no real adapter loops for quote capture.
- There is no browser/session bootstrap flow for bet365 scraping.
- There is no Kalshi API/WebSocket ingestion loop.
- There is no Polymarket discovery/quote/orderbook ingestion loop.

What this means:

- The core product signal does not exist yet.
- The app cannot answer the main research question because it never records the external market data it was built to compare.

### 3. The database is live-only in schema intent but not in actual contents

Facts from `data/signal-console.sqlite` during this audit:

- `games`, `game_states`, `market_instruments`, `source_markets`, `quote_ticks`, `raw_payloads`, `adapter_runs`, `mapping_resolutions`, and `game_outcomes` were all empty
- the SQLite file still contains legacy tables:
  - `storylines`
  - `storyline_frames`
- `app_state` still contains stale legacy keys:
  - `demo_storyline_id`
  - `replay_frame_index`
  - `replay_storyline_id`

What this means:

- source code says live-only
- docs say live-only
- the persisted default database artifact is still contaminated by the old runtime era
- the actual live tables are empty, so the UI has little or nothing meaningful to show

The next agent must not ignore this. Either:

- migrate forward cleanly and remove legacy tables and stale app state keys, or
- recreate the default DB artifact and stop shipping a misleading local database

### 4. The admin/ops surface is partly real and partly a facade

Facts:

- `POST /api/v1/admin/capture/restart`
- `POST /api/v1/admin/backfill/games`
- `POST /api/v1/admin/backfill/markets`
- `POST /api/v1/admin/timeline-materializations/rebuild`

These currently enqueue rows in `admin_actions` through repository helpers.

What they do not currently do:

- restart adapters
- run backfills
- rebuild materializations
- trigger any actual operational worker behavior

What this means:

- the admin API shape exists
- the operational system behind it mostly does not

### 5. The frontend only exposes a narrow slice of the backend surface

What the frontend currently has:

- tracked games page
- divergence page
- instrument page
- settings page
- command palette

What the backend has that the frontend barely or never uses:

- `/api/v1/games/:gameId/markets`
- `/api/v1/games/:gameId/markets/:instrumentId/sources`
- `/api/v1/admin/capture/runs`
- `/api/v1/admin/storage/coverage`
- `/api/v1/admin/unmapped-markets`
- `/api/v1/admin/mappings/resolve`

What is missing in the web app:

- game-level market family workspace using `getGameMarkets`
- full grouped instrument table per game
- dedicated per-source detail view backed by `/sources`
- unmapped-market review/resolution UI
- capture-run history UI
- storage coverage UI
- admin action queue visibility
- export actions

### 6. There is one chart library and one real chart, but not a useful visual analytics surface

Facts:

- `apps/web/package.json` includes `recharts`
- `apps/web/src/features/event/EventWorkspacePage.tsx` renders one simple line chart

What is missing:

- no game-state overlays on the chart
- no clear annotation rendering for score/status transitions
- no orderbook or depth visualization
- no market-family comparison visuals
- no divergence trend summary visuals
- no chart export
- no snapshot or report export

What this means:

- the repo is not missing the ability to render charts in React
- it is missing product implementation of useful charts
- if `recharts` proves limiting, add stronger libs intentionally, but do not use “we need a chart library” as an excuse for the current UX state

### 7. There is no export workflow at all

Searches across docs and web code show no real export/download/report path.

That means:

- no CSV export
- no JSON export from the UI
- no chart export
- no “copy research artifact” workflow
- no downloadable operator snapshot

This is not just a missing button. It is a missing requirement and a missing implementation path. The next agent should add the requirement to specs if they build it, not just slip in a button with no contract.

### 8. The test story is better than before, but still not validating the real product

What is good:

- repository and API tests exist for live read models
- sidecar normalizer tests exist
- worker tests exist
- `pnpm verify` can pass

What is still weak:

- API tests seed the DB directly with synthetic rows
- they validate read-model composition, not real capture loops
- Playwright e2e tests only verify that headings render
- there is no end-to-end proof that env -> adapter -> DB -> API -> UI works for a live source

This is the exact kind of false confidence the user is angry about.

## Answers To The User’s Direct Complaints

### “Why has no one needed my env loaded and all those keys?”

Because the repo does not yet have the runtime paths that would meaningfully use most of them, and the Node services do not appear to load `.env` automatically. The code mostly checks for config presence and shapes admin/readiness output. It does not yet turn those credentials into live capture.

### “Why is there not a god damn export button?”

Because export was never implemented and barely exists as a product requirement. There is no export route, no export UI, and no report artifact workflow.

### “Why is there not a single usable visual chart?”

Because the current web app only renders one basic `recharts` line chart for the instrument timeline. It is not paired with the richer overlays, depth views, or operator workflows the product actually needs.

### “Why are there no libraries to do fancy live data render stuff in react?”

There is already `recharts`, and that is enough to prove charts are possible. The deeper problem is not lack of a library. The deeper problem is that there is almost no captured live data and almost no implemented operator visualization layer.

### “Why is this so entirely completely hopelessly non functional?”

Because the repo currently has:

- almost no real live market ingestion
- empty live research tables in the default DB
- readiness that should stay red
- a frontend that mostly reads empty data
- admin actions that mostly queue rows rather than do work
- env/config that is not actually turning into source capture

In other words:

- the shell exists
- the core product loop does not

## Your Mission

Do not just clean up docs. Do not just write another handoff. Do not just tweak the existing shell.

Your mission is to make the product materially more real by wiring actual live data into the existing live-only architecture and by making the UI show it in a way that is actually useful.

## Highest-Priority Bridge Plan

Follow this order unless live evidence forces a better one.

### 1. Make env/config real

Before anything else:

- inspect `.env` without echoing secret values back to the user
- verify which vars exist by name only
- wire API and worker startup so they can actually consume local env/config intentionally
- document the exact loading model in `README.md`
- do not assume “the shell had vars in its environment already”

Minimum acceptable outcome:

- one documented and working local startup path where API, worker, and sidecar read the intended config

### 2. Clean the default DB artifact and runtime assumptions

You must address the mismatch between source and persisted state.

Do one of these honestly:

- add a migration that removes legacy storyline tables and clears stale demo-era `app_state` keys, or
- recreate the default DB artifact from the current schema and stop carrying legacy state forward

Also:

- verify counts in the live research tables after reset
- verify readiness/error behavior after reset

### 3. Implement at least one real non-NBA external source end-to-end

The repo already has Kalshi and Polymarket credential clues on disk. Use that.

The first meaningful proof should be:

- env/config recognized
- adapter reaches real source
- worker writes `source_markets`, `quote_ticks`, `raw_payloads`, and `adapter_runs`
- API returns those rows
- web shows those rows

The product anchor is still bet365, but if bet365 auth/session state is unavailable right now, do not block the whole repo on that. Prove the pipeline with the source that can be made real first, then layer bet365 in.

What not to do:

- do not fake source rows
- do not seed the DB and call that “live”
- do not write a demo adapter

### 4. Build the real bet365 capture seam

This is core to the product, so even if not completed in the same slice, the next agent must leave it materially closer to real.

Needed shape:

- persistent authenticated browser/session bootstrap
- scrape/network capture of active in-game offers
- raw offer text persisted
- parsed line/price persisted
- derived implied probability persisted
- `source_markets`, `quote_ticks`, and `raw_payloads` written per observed change

If blocked:

- say exactly what artifact is missing
- likely `BET365_SESSION_STATE_PATH`
- likely proxy/bootstrap details
- do not hide that behind generic “future work”

### 5. Finish the game-level operator workflow in the frontend

The API already exposes game-level markets. The frontend does not use them.

Build:

- a game detail view using `GET /api/v1/games/:gameId/markets`
- market family switching
- grouped instrument table
- source comparison rows with timestamps and mapping state
- direct jump into instrument detail

This is the missing middle layer between “Games” and “one instrument.”

### 6. Make the visual layer actually useful

At minimum:

- make the existing instrument chart show real game-state transitions clearly
- render annotations and line mismatch windows meaningfully
- improve color/system semantics for bet365 vs Kalshi vs Polymarket
- add a second useful visual, not just a prettier version of the same line chart

Good candidates:

- divergence-over-time panel
- source freshness and capture cadence panel
- best bid / ask or depth panel where available
- market family summary visual on the game page

If `recharts` becomes limiting:

- add a stronger library intentionally
- explain why
- keep the scope narrow

### 7. Add exportable research artifacts

The user explicitly asked about this. Treat it as a real product gap.

Implement at least one useful export path:

- CSV export for game/instrument timeline data, or
- JSON export for instrument/source history, or
- downloadable chart snapshot/report artifact

If you add an export:

- update the relevant spec docs
- make the route or client contract explicit
- verify the exported output contains provenance and timestamps

### 8. Expose real ops workflows in the UI

The settings page is too thin.

Add at least some of:

- capture run history
- storage coverage
- unmapped market review
- manual mapping resolution
- visibility into queued admin actions

Do not leave important operational routes API-only if the product is supposed to be operator-facing.

## Specific Code Truths To Keep In Mind

- `apps/worker/src/index.ts`
  - currently only runs the NBA sidecar sync loop
- `apps/worker/src/nba-sidecar.ts`
  - ingests scoreboard output only
- `packages/adapters/src/index.ts`
  - currently empty placeholder
- `apps/api/src/services/research-service.ts`
  - admin POSTs mostly enqueue actions, not execute them
- `apps/web/src/features/games/GamesPage.tsx`
  - lists games but jumps directly to a single top instrument
- `apps/web/src/features/event/EventWorkspacePage.tsx`
  - has one basic chart and a raw payload drawer
- `apps/web/src/features/settings/SettingsPage.tsx`
  - does not expose most operator/admin routes
- `apps/web/src/data/api.ts`
  - defines `getGameMarkets`, but the app does not currently use it in a dedicated game page
- `Bet365SignalConsole.tsx`
  - exists at repo root and appears unused; decide whether it is valuable reference material or stale artifact, but do not ignore it forever

## Non-Negotiables

- Do not reintroduce demo, replay, fixtures, or storylines into the runtime.
- Do not invent fallback data for missing live capture.
- Do not claim env is “wired” if the code still does not consume it at runtime.
- Do not call seeded test data “live validation.”
- Do not leave export as a vague future idea if you touch that lane.
- Do not leave the default DB artifact carrying legacy runtime state without explicitly deciding how it is handled.
- Do not print secret values into logs, tests, docs, or user-facing responses.

## Recommended First Commands

Use these to orient quickly:

```bash
git log --oneline --decorate --graph -n 20
git diff --stat HEAD
sqlite3 data/signal-console.sqlite ".tables"
sqlite3 data/signal-console.sqlite "select key, value from app_state order by key;"
sqlite3 data/signal-console.sqlite "select 'games', count(*) from games union all select 'quote_ticks', count(*) from quote_ticks union all select 'source_markets', count(*) from source_markets;"
pnpm verify
cd apps/nba-sidecar && uv run pytest
```

Also inspect env variable names without echoing values.

## Definition Of A Good Next Slice

The next slice is good if it produces all of these:

- source code still live-only
- env/config is actually consumed
- at least one real external market source is ingested end-to-end
- the DB contains real live rows
- the API serves those rows
- the UI shows those rows in a workflow that is actually useful
- readiness/admin surfaces reflect reality honestly
- at least one export workflow exists
- verification covers the changed surface honestly

## Definition Of Failure

The next slice fails if it does any of these:

- spends the whole turn on docs without moving the product
- adds another layer of shell around empty data
- adds tests against seeded rows only and calls it done
- leaves env handling inert
- ignores the user’s explicit export and chart complaints
- ignores the stale DB / legacy state contamination
- punts real source integration again

## Final Instruction

Do the work in the lane the user actually cares about:

- make the live research system real
- make the operator console actually useful
- stop building convincing shells around missing capture
