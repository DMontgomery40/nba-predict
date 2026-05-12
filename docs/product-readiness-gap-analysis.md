# Product Readiness Gap Analysis

## Why this was called a skeleton

The app is not fake. It has real live-data seams, adapters, persisted SQLite storage, operator routes, and a serious trader-desk UX. I called it a skeleton because it still lacks the boring enterprise bones that make a prototype safe to hand to another team without a human hovering over it like an anxious airport marshaller.

A product is not just a working screen. A product is a system where a new operator can answer these questions without asking David:

1. Which DB is active?
2. Which sources are direct versus proxy?
3. Which rows are live, test, historical, stale, or unmapped?
4. Which displayed probability can be traced back to a raw payload?
5. Which source historically deserved trust in this context?
6. Which failure mode is happening right now?
7. Can the whole thing be restarted and audited without tribal knowledge?

## What is real now

- React/Vite/Tailwind trader desk UI.
- Fastify API with games, instruments, divergence, research, admin, and health routes.
- SQLite schema for games, game states, instruments, source markets, quote ticks, raw payloads, adapter runs, outcomes, and admin actions.
- Polymarket adapter surface.
- Odds-API-backed sportsbook/Kalshi adapter surface.
- Kalshi and Polymarket historical backfill modules.
- Python `nba_api` sidecar.
- Calibration and closed-game tape surfaces.
- Raw-source drawer patterns.
- Runtime audit surface added in this pass.

## What blocks it from being a real product

### 1. Source provenance is still too implicit

Every number needs a clickable evidence chain:

```text
screen number -> derived field -> quote tick -> source market -> raw payload -> adapter run -> source endpoint/provider
```

The repo has much of this data, but the UI does not make the chain unavoidable yet.

### 2. Bet365 is not the internal book feed yet

The current packaged code has Odds-API-backed Bet365-like sportsbook pricing. That is useful for research and demoing the concept, but it is not the internal book feed.

Internal language should say:

```text
proxy sportsbook pricing until internal book feed is wired
```

Not:

```text
connected to the bet365 internal book
```

### 3. DB selection can silently change the truth of the app

This was the big trap. The packaged DB is empty/test-sized, while David's running DB is large and real. Product needs runtime DB audit and startup checks. This pass added both a route and a CLI audit, but the app should eventually fail closed when it is launched in demo mode with an empty DB.

### 4. Mapping confidence needs first-class treatment

`mapping_status` exists, but the trader UI needs visible mapping confidence, mapping reason, and source-event matching diagnostics. A bad market mapping is worse than no market because it creates false precision.

### 5. Calibration needs segmentation

A single Brier/log-loss leaderboard is useful, but the product needs slices:

- pregame versus live
- market family
- source pair
- source freshness
- league season
- sample size floor
- line-mismatch excluded versus included
- confidence interval around each metric

### 6. Operational control is queued, not fully executed

Admin POST routes queue actions. That is fine for a prototype, but product needs worker acknowledgement, state transitions, retry state, and job logs.

### 7. Tests need product assertions

Current tests mainly prove routes/components function. Product tests should prove claims:

- empty packaged DB triggers warning
- e2e DB is never labeled live
- live DB audit passes when counts exceed thresholds
- every displayed ranked-row source has raw payload or a visible no-payload warning
- Bet365 proxy feed is labeled proxy until internal source is connected

## Product definition of done

The console becomes product-shaped when:

- `pnpm db:audit` passes on the intended live DB.
- Settings shows `Runtime evidence` as `ready` or `usable-with-warnings` with understood warnings.
- Every ranked instrument has an `OPEN` workflow that shows source IDs, raw payload IDs, capture run IDs, quote timestamps, and mapping status.
- Internal book feed replaces proxy sportsbook pricing, or the UI clearly labels the source as proxy.
- Calibration tables have sample-size and confidence-interval guardrails.
- Admin capture actions have persistent job status.
- The README gives a new operator one successful path from clone to audited runtime.
