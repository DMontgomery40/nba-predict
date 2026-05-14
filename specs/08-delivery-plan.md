# Delivery Plan

## Completed Slices

1. Live storage model and repositories
2. Instrument-first research APIs
3. Honest readiness and source/admin surfaces
4. NBA sidecar scaffold plus worker ingest seam
5. Removal of presentation-only runtime paths from source, docs, and regenerated build output
6. Repo-root env loading and SQLite cleanup migration for the live-only runtime
7. Polymarket NBA game-market ingestion plus the missing game-level workspace and CSV export
8. Bet365 backup ingestion through Odds-API.io, persisted under the native live source model
9. Direct Kalshi NBA market-data ingestion through `KALSHI_API_KEY`, including player props and broader game-related event families
10. Package-first exports route with a full SQLite handoff plus streamed CSV/JSONL table and quote-slice downloads for data engineering
11. Generalized prediction-market anomaly API/UI surface with persisted microstructure event storage, score configuration, desk queue, and `/market-anomalies` route

## Next Slices

1. Direct Polymarket Data API trade ingestion into `market_microstructure_events`
2. Direct Kalshi trade/orderbook/candlestick microstructure ingestion into `market_microstructure_events`
3. Direct public Bet365 capture
4. Broader live validation of Kalshi/Polymarket anomaly scoring against real slates
5. Deeper charting and executable admin workflows
