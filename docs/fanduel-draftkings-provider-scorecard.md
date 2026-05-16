# FanDuel / DraftKings Provider Scorecard (May 2026)

This scorecard is the deliverable for Phase 3 of the board-anomaly roadmap. The detector treats FanDuel and DraftKings as two of its five source families (alongside bet365, kalshi, polymarket), but the repo today persists no FanDuel or DraftKings rows. This document records which paths exist, which can be implemented quickly on top of the existing live-only data model, and the current blocker.

The roadmap's success criterion is "either implement the chosen practical source path, or write a concise endpoint scorecard explaining why implementation is blocked." This is the latter, with a concrete extension path called out so a follow-up session with provider keys can land the implementation in one pass.

## Repo Baseline (Verified From Code)

- `packages/adapters/src/odds-api.ts` already implements Odds-API.io ingest. The bookmaker union is hard-coded today as `OddsApiBookmakerName = "Bet365" | "Kalshi"` (file: `packages/adapters/src/odds-api.ts:18`) and the source map at `odds-api.ts:99` is `{ Bet365: "bet365", Kalshi: "kalshi" }`. The HTTP plumbing, event discovery, multi-odds fetcher, and persistence path are all generic.
- No FanDuel or DraftKings adapter exists in `packages/adapters/src/`.
- `live-types.researchSourceIds` includes only `bet365`, `kalshi`, `polymarket`, `nba`. Adding `fanduel` and `draftkings` requires extending that union and the `MarketMicrostructureEvent.source` constraint.
- The repo has no environment variable scaffolding for FanDuel or DraftKings credentials. The closest analog is `ODDS_API_KEY` for the Odds-API.io backup path.

## Path A — Extend Odds-API.io To FanDuel / DraftKings (Recommended)

Minimum-effort path because it reuses the existing event discovery, multi-odds fetcher, mapping resolver, and `quote_ticks` / `raw_payloads` / `adapter_runs` persistence.

Engineering work, scoped:

1. Widen `OddsApiBookmakerName` to include `"FanDuel"` and `"DraftKings"`.
2. Extend `bookmakerSourceMap` to map them to new `researchSourceIds` entries `fanduel` and `draftkings`.
3. Add `researchSourceIds` entries and update `MarketMicrostructureEvent.source` to allow them.
4. Add `ODDS_API_BOOKMAKERS` (comma-separated allowlist) and per-bookmaker enable flags; default off so unverified bookmakers do not run silently.
5. Add per-source readiness checks and migration to register the new sources in any existing `source_markets` filters and admin UI listings.
6. Extend `packages/adapters/src/__tests__/odds-api.test.ts` with FanDuel and DraftKings response shapes.

Blocker: Odds-API.io's current (May 2026) **NBA player-prop** coverage for FanDuel and DraftKings has not been verified in this session because the WebSearch and WebFetch tools both returned `400 This model does not support the effort parameter` on every call attempted this session (see "Session blocker" below). Before extending the adapter, the following must be confirmed against the live Odds-API.io account:

- Are `FanDuel` and `DraftKings` valid `bookmakers` query values on the v3 endpoints?
- Does the player-props coverage include the milestone families the board detector needs (`player_points`, `player_rebounds`, `player_assists`, `player_threes`, `player_steals`, `player_blocks`, plus combined `player_pra` / `player_ra` / `player_pa` and double / triple-double markets)?
- Are pregame and in-play snapshots both available?
- What is the per-call cost and the per-day request budget on the current paid tier?
- Is line history available, or only current snapshots?

## Path B — OpticOdds API

Documented in vendor materials as offering FanDuel and DraftKings NBA player-prop coverage with sub-minute snapshots and historical line history. Integration cost is higher (new adapter, new auth) but coverage breadth is the strongest candidate if it includes per-snapshot timestamps and a documented historical replay surface.

Cannot be verified this session (see blocker). Items to confirm:

- Current pricing tier and request budget for live NBA player-prop coverage of FanDuel and DraftKings.
- Snapshot cadence (sub-minute is the requirement for the board detector's residual windows).
- Whether the API exposes `suspended` / `removed` flags per market.
- Whether the API exposes traded volume or only line / odds.
- Time-to-first-snapshot vs. an order-of-magnitude estimate.

## Path C — SportsGameOdds / Rundown / Pinnacle-Adjacent Aggregators

Lower-confidence candidates. Several aggregators advertise FanDuel and DraftKings NBA player-prop coverage but their snapshot cadence, suspension reporting, and historical depth are uneven. Cannot be ranked here without live verification.

## Path D — Direct FanDuel / DraftKings Public Web (Playwright)

Possible (the repo already has a `bet365-direct.ts` Playwright path) but operationally risky: the public sites use frequently-rotating endpoints and have hostile bot defenses. Not recommended as the primary FanDuel / DraftKings path. Should be reserved for incident forensics on individual games if the aggregator coverage misses an event the desk needed.

## Path E — Internal Bet365 / Bookmaker Feeds

Out of scope per the goal prompt: "Bet365 is represented by an outside API in this repo. In production, Bet365/internal teams will wire up their own data. That production integration is not this task." The same applies to FanDuel and DraftKings in the production sense — the detector should accept their data through the same adapter contract whether the source is an external aggregator or an internal feed.

## Session Blocker

This scorecard could not be backed by live vendor evidence (pricing pages, current docs, trial calls) because the WebSearch, WebFetch, and subagent tools all returned `400 This model does not support the effort parameter` on every external lookup attempted in this session. That is a harness configuration issue, not a vendor or repo issue. The next session that has working external research should:

1. Re-run the Path A questions against the active Odds-API.io account.
2. Re-run the Path B questions against OpticOdds.
3. Confirm or rule out Path C aggregators.
4. Land Path A first if confirmed, since it carries the smallest integration delta against the existing live-only data model.

## Detector Compatibility Note

The board-anomaly detector is intentionally agnostic to which sportsbook adapters are wired. When FanDuel and DraftKings rows arrive in `quote_ticks` (and optionally `market_microstructure_events`), the detector immediately includes them in:

- the per-source `source_kind = sportsbook` microstructure scoring branch,
- the cross-surface disagreement component (sportsbook vs prediction-market),
- the fanout / coherence graph, since their mapped instruments share `participant_key` and `family` with bet365 / kalshi / polymarket.

No detector-side change is required when those adapters land. This means Phases 4 – 11 of the roadmap are not blocked on the provider research above; they proceed against the existing bet365 / kalshi / polymarket data shapes and pick up FanDuel / DraftKings rows automatically when they arrive.
