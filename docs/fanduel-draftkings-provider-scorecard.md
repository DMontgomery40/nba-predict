# FanDuel / DraftKings Provider Scorecard (operator action plan)

This is the Phase 3 deliverable: a scorecard the operator can act on without re-doing web research, plus the exact commands to verify each provider against a real account. Live vendor lookups from inside this Claude session continue to return `400 This model does not support the effort parameter` for both `WebSearch` and `WebFetch`, so the pricing/coverage figures below are flagged as "operator-verify" until someone runs the listed commands against a real account. The recommendation, however, does not depend on those numbers.

## Recommended path: extend the existing Odds-API.io adapter

The fastest path with the smallest integration delta is to widen `OddsApiBookmakerName` from `"Bet365" | "Kalshi"` to include `"FanDuel"` and `"DraftKings"`, since the rest of the adapter, the canonical instrument resolver, the `quote_ticks` writer, the `raw_payloads` writer, and the `adapter_runs` logger are all bookmaker-agnostic today. Code-level evidence:

- `packages/adapters/src/odds-api.ts:18` — bookmaker union, hard-coded.
- `packages/adapters/src/odds-api.ts:99` — `bookmakerSourceMap`, hard-coded.
- `packages/adapters/src/odds-api.ts:1156` — the request is parameterised on `bookmakers`; Odds-API.io accepts that parameter for any of its supported books.
- `packages/shared/src/live-repository.ts` — `quote_ticks` schema already carries every field FD/DK quotes need.

Engineering work to land this is roughly 80 lines: type widen, source map entries, two new `researchSourceIds`, env-var allowlist (`ODDS_API_BOOKMAKERS=FanDuel,DraftKings`), and four fixture additions to `packages/adapters/src/__tests__/odds-api.test.ts`. **Do this first** — it unblocks the trader-desk cross-surface comparison the moment the bookmakers field is verified.

The operator-verifiable question that gates implementation is exactly: does Odds-API.io expose FD and DK NBA player-prop markets on the current paid plan? Two curl checks answer it.

## Operator verification commands (run these against a real account)

Replace `$KEY` with the live `ODDS_API_KEY`. These hit Odds-API.io v3.

```sh
# 1. Does the account return FanDuel for NBA player-prop markets?
curl -s "https://api.odds-api.io/v3/odds/multi?apiKey=$KEY&bookmakers=FanDuel&eventIds=<nba_event_id>" | jq '.[0].bookmakers | keys, .[0].bookmakers.FanDuel | length'

# 2. Same for DraftKings.
curl -s "https://api.odds-api.io/v3/odds/multi?apiKey=$KEY&bookmakers=DraftKings&eventIds=<nba_event_id>" | jq '.[0].bookmakers | keys, .[0].bookmakers.DraftKings | length'

# 3. Confirm the player-prop families come back, not only spreads/totals.
curl -s "https://api.odds-api.io/v3/odds/multi?apiKey=$KEY&bookmakers=FanDuel&eventIds=<nba_event_id>" | jq '[.[0].bookmakers.FanDuel[].name] | unique'
```

A successful response (non-empty `FanDuel` / `DraftKings` arrays, market `name` set including `player_points` / `player_rebounds` / `player_assists` or vendor-specific equivalents) is the green light to land the 80-line extension. An empty array or a 400 means the account tier does not include those bookmakers and Path A is blocked — fall through to Path B.

## Provider comparison (operator-verify)

| Provider                         | NBA player-prop FD coverage          | NBA player-prop DK coverage          | Pregame                        | Live                | Historical                               | Integration effort                                    | Operator verification                                  |
| -------------------------------- | ------------------------------------ | ------------------------------------ | ------------------------------ | ------------------- | ---------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| Odds-API.io (Path A)             | operator-verify (above)              | operator-verify (above)              | yes (already wired for bet365) | yes (already wired) | only as we persist; no historical replay | ~80 LOC type widen + tests                            | the three curl commands above                          |
| OpticOdds (Path B)               | operator-verify                      | operator-verify                      | yes                            | yes                 | yes (line history endpoint advertised)   | new adapter, ~400 LOC, similar shape to `odds-api.ts` | docs at `opticodds.com` / API key required             |
| SportsGameOdds (Path C)          | operator-verify                      | operator-verify                      | yes                            | yes                 | unclear                                  | new adapter, ~400 LOC                                 | docs at `sportsgameodds.com`                           |
| Direct FD/DK public web (Path D) | requires Playwright scraper per book | requires Playwright scraper per book | yes                            | yes                 | none                                     | ~600 LOC per book, brittle, hostile bot defences      | not recommended as primary path; reserve for forensics |

Path B is the fallback if Path A fails the operator-verify step. Path D is only viable if both A and B are blocked, since the maintenance cost is high.

## What the detector needs from any FD/DK source

The board-anomaly detector consumes whatever is written to `quote_ticks` (and optionally `market_microstructure_events` for trade-level data). Sportsbook adapters write quote rows; they do not need to provide trades. The minimum field set per FD/DK quote write is:

- `source` = `"fanduel"` or `"draftkings"` (after adding them to `researchSourceIds`)
- `source_market_key` = vendor's market id
- `source_selection_key` = over/under or selection id
- `game_id` = canonical NBA id
- `instrument_id` = canonical instrument id (must match what bet365 maps to so cross-source pairing works)
- `implied_probability` = `1 / decimal_odds`
- `odds_raw` and `line_raw` = preserved from vendor
- `captured_at` = local poll time
- `is_heartbeat` = `0` on every fresh tick

That is the same write shape `syncOddsApiBookmaker` already uses for bet365 and kalshi.

## What is out of scope

- Two-sided pairing for FD/DK vig de-vig at ingest. The existing `buildVigAdjustedComparison` in `packages/shared/src/board-anomaly-repository.ts` pairs over/under at read time per source and works automatically once both sides are persisted.
- Trade-level FD/DK data. FD and DK do not expose order-book or trade APIs; sportsbook microstructure is the line/odds movement itself plus suspensions, all of which `quote_ticks` already captures.
- Live worker-loop polling cadence tuning. Use the same `WORKER_INTERVAL_MS` cadence as bet365; no special handling needed.

## Honest blocker

Live vendor docs lookup from inside this session returned `400 This model does not support the effort parameter` for both `WebSearch` and `WebFetch` on multiple retries. The pricing column above is therefore intentionally left as "operator-verify" rather than fabricated. The operator-verify commands take under five minutes to run against a real account and convert the recommendation into a yes/no implementation decision. The detector code does not block on FD/DK ingest — it picks up whichever sources are persisted.
