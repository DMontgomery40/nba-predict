# Demo Runbook

## Goal

Run the trader desk against David's large persisted SQLite DB, not the empty packaged DB and not the e2e fixture.

## One-command local env append

```bash
cd /Users/davidmontgomery/nba-predict && printf '%s\n' 'SIGNAL_CONSOLE_DB_PATH=/Users/davidmontgomery/nba-predict/data/signal-console.sqlite' 'PORT=8788' 'VITE_API_BASE_URL=http://localhost:8788' >> .env.local
```

## Audit the DB before opening the desk

```bash
cd /Users/davidmontgomery/nba-predict && pnpm db:audit
```

Good result ends with:

```text
DB_AUDIT_PASS active DB has a persisted live-data footprint.
```

Bad result usually means the process is pointed at the packaged empty DB or the e2e seed DB.

## Start API, worker, and web

```bash
cd /Users/davidmontgomery/nba-predict && pnpm dev
```

## Open these URLs

```text
http://localhost:4121/
http://localhost:4121/settings
http://localhost:8788/api/v1/admin/runtime-audit
http://localhost:8788/health/ready
```

## Demo talk track

Use this sentence:

```text
This is a live source-disagreement and calibration console. It ranks where outside prediction markets, sportsbook pricing, and game state disagree, then shows whether those sources historically deserved trust.
```

Do not say:

```text
This places bets.
This is connected to the internal book feed.
This proves there is an edge.
```

Use this instead for the current Bet365 leg:

```text
The current prototype uses proxy sportsbook pricing for the book-side leg until the internal book feed is wired.
```

## Sanity checks during demo

On the Settings page, verify:

- Runtime evidence shows the live DB path.
- Quote ticks are large, roughly hundreds of thousands.
- Raw payloads are present.
- Polymarket and Kalshi source counts are nonzero.
- Bet365 is clearly understood as thin/proxy coverage until internal feed integration.
