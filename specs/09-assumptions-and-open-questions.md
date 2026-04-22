# Assumptions And Open Questions

## Assumptions

- `ASSUMP-001` SQLite remains sufficient for local v1 live research work.
- `ASSUMP-002` NBA is the first live league, but contracts stay sport/league aware.
- `ASSUMP-003` `ODDS_API_KEY` is an acceptable backend-only backup provider for Bet365 and Kalshi capture while direct source paths mature.

## Open Questions

- `OPEN-001` How should historical market backfill work for sources that do not expose full history APIs?
- `OPEN-002` What is the right freshness threshold per source and market family once real capture loops are active?
- `OPEN-003` Which additional operator workflows should exist beyond games, divergence, game detail, instrument detail, and operations?
- `OPEN-004` What is the exact direct public-site capture path for Bet365 in this repo once the backup Odds-API.io provider is removed from the critical path?
