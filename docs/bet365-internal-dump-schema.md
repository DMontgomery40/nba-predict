# Bet365 Internal Dump Schema

The `bet365-internal-dump` adapter reads JSONL files (one observation per line) from the directory configured via `BET365_INTERNAL_DUMP_DIR`. Each processed file is moved to `${BET365_INTERNAL_DUMP_DIR}/_processed/` after ingest so re-running is safe.

Run it with: `pnpm backfill bet365-internal`

## Accepted file extensions

- `.jsonl`
- `.ndjson`

## Row shape (required fields)

```json
{
  "observed_at": "2026-04-21T22:30:00.000Z",
  "game_date": "2026-04-21",
  "home_team": "PHI",
  "away_team": "BOS",
  "market_family": "moneyline",
  "selection": "phi"
}
```

- `observed_at` — ISO-8601 timestamp when the price was observed internally.
- `game_date` — YYYY-MM-DD, in US Eastern game-date convention (matches the NBA sidecar). ±1 day tolerance is applied.
- `home_team` / `away_team` — team abbreviation (PHI, BOS, LAL, etc.) or full name / short name; matched against canonical games by the NBA sidecar.
- `market_family` — one of `moneyline`, `spread`, `total`, `player-prop`, `team-prop`, `other`.
- `selection` — the selection key (e.g. `phi`, `bos`, `over`, `under`, a player key).

## Optional fields

- `participant_key` — canonical team key (`phi`, `bos`). Defaults to `selection` if omitted.
- `line` — numeric line (required for spread/total/prop).
- `price_decimal` — decimal odds, e.g. `1.53`.
- `odds_american` — American odds, e.g. `-200`.
- `implied_probability` — already-converted 0..1 probability. If absent, derived from `price_decimal` or `odds_american`.
- `in_play` — boolean; defaults to false.

Priority for implied probability: `implied_probability` → american-odds conversion → decimal-odds conversion.

## camelCase aliases

All keys accept both snake_case and camelCase: `observed_at` ↔ `observedAt`, `market_family` ↔ `marketFamily`, etc. Shorter aliases also accepted: `home`, `away`, `family`, `sel`, `price`, `implied`, `prob`, `american`.

## What the adapter does

For each parsed row:

- Upserts a canonical `market_instruments` row using `${gameId}-${family}-${participant}[-${line}]`.
- Upserts a `source_markets` row with `source = 'bet365'`, unique key `bet365-internal-${instrument_id}`.
- Writes one historical `quote_ticks` row via `appendHistoricalTick` (deduped on `(source_market_id, captured_at)`).
- Writes one `raw_payloads` row with the full source JSON for auditability.
- Writes one `adapter_runs` row (`capture_mode = 'historical'`, `source = 'bet365'`).

## Example

```jsonl
{"observed_at":"2026-04-21T22:30:00Z","game_date":"2026-04-21","home_team":"PHI","away_team":"BOS","market_family":"moneyline","selection":"phi","participant_key":"phi","implied_probability":0.12}
{"observed_at":"2026-04-21T22:30:00Z","game_date":"2026-04-21","home_team":"PHI","away_team":"BOS","market_family":"moneyline","selection":"bos","participant_key":"bos","odds_american":-200}
{"observed_at":"2026-04-21T22:30:05Z","game_date":"2026-04-21","home_team":"PHI","away_team":"BOS","market_family":"spread","selection":"phi","participant_key":"phi","line":-2.5,"price_decimal":1.91}
```

If your internal export looks different — different column names, Unix-epoch timestamps, different odds format — paste one row and the adapter's field aliases can be extended to match in one PR.
