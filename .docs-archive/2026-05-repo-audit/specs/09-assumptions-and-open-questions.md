# Assumptions And Open Questions

## Assumptions

- `ASSUMP-001` SQLite remains sufficient for local v1 live research work.
- `ASSUMP-002` NBA is the first live league, but contracts stay sport/league aware.
- `ASSUMP-003` `ODDS_API_KEY` is an acceptable backend-only backup provider for Bet365 capture while the direct Bet365 source path matures.
- `ASSUMP-004` `KALSHI_API_KEY` is sufficient for direct Kalshi market-data capture of NBA game-related event families.

## Open Questions

- `OPEN-001` What concrete internal or licensed feed should provide bet365 historical sportsbook odds for one to two NBA seasons, and can it export rows matching `docs/bet365-internal-dump-schema.md`?
- `OPEN-002` What is the right freshness threshold per source and market family once real capture loops are active?
- `OPEN-003` Which additional operator workflows should exist beyond games, divergence, game detail, instrument detail, and operations?
- `OPEN-004` What is the exact direct public-site capture path for Bet365 in this repo once the backup Odds-API.io provider is removed from the critical path?
- `OPEN-005` Which user behavior event families can be exported at one-second or coarser buckets for Attention Pressure Index research?
