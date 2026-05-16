# Product Requirements

## Product Thesis

Signal Console is a sparse NBA board-anomaly detector for Bet365 trader inspection. It continuously compares normal market dynamics against abnormal board shocks across pregame, near-tip, live game, and immediate operational settlement windows on relevant NBA market boards, and surfaces a small number of high-confidence alerts. Sportsbooks (Bet365, FanDuel, DraftKings) and prediction markets (Kalshi, Polymarket) are different signal surfaces and are normalized but not treated as identical microstructure. The system is live-only, persisted-data-only, and does not produce gambling recommendations.

Per-instrument divergence views, per-source microstructure alerts, and the exact-line player-prop monitor are building blocks that feed and explain the board-level alert cards. They are not the headline product.

## Functional Requirements

- `FR-001` The product shall serve live-only research workflows.
- `FR-002` The product shall expose tracked games with current game state, coverage, and top divergence summaries.
- `FR-003` The product shall expose instrument-level views with per-source quotes, raw line terms, implied probabilities, and provenance.
- `FR-004` The product shall expose append-only quote and game-state timelines for one canonical instrument.
- `FR-005` The product shall separate line mismatch from like-for-like probability divergence.
- `FR-006` The product shall expose unmapped markets and allow manual resolution.
- `FR-007` The product shall expose operator-facing source health and readiness state.
- `FR-008` The product shall ingest NBA game-state and outcomes through a Python `nba_api` sidecar.
- `FR-009` The product shall persist enough raw and normalized history to answer what each source showed over time for a completed or live game.
- `FR-010` The product shall expose a game-level workspace with market-family switching, grouped instruments, and direct navigation into one instrument timeline.
- `FR-011` The product shall export instrument timeline research artifacts with provenance and timestamps.
- `FR-012` The product shall ingest live Polymarket NBA game markets through official APIs into canonical instruments, source markets, quote ticks, raw payloads, and adapter runs.
- `FR-013` The product shall expose first-class player-prop attribution risk alerts when mapped Bet365 props and mapped Kalshi/Polymarket props materially disagree inside a fresh quote window. These alerts are manual-review signals, not automatic source correction or settlement decisions.
- `FR-014` The product shall support live player-prop alert monitoring with desktop notification emission and persisted alert checks so trading can inspect what the alert surface showed at the time it fired.
- `FR-015` The product shall expose generalized prediction-market anomaly alerts across Kalshi and Polymarket markets, including off-price prints, volume-share anomalies, volatility shocks, liquidity shocks, and cross-venue disagreement. These alerts do not require knowing a paired/rightful player at detection time.
- `FR-016` The product shall expose board-level NBA anomaly alerts, scored as a likelihood ratio of an abnormal board-shock hypothesis (H1) against normal market dynamics (H0), and aggregated across related markets within the affected game.
- `FR-017` The product shall represent the following H1 shock classes as first-class alert kinds: pregame availability shock, near-tip availability shock, attribution-shaped in-game shock, market-structure shock, cross-surface disagreement, and coverage/mapping/timing gap.
- `FR-018` The product shall suppress alerts when residual movement is explainable by H0 baseline features: ordinary pregame drift, normal close-game global repricing, normal prediction-market bid/ask noise, stale quote age, and normal liquidity/depth conditions.
- `FR-019` The product shall replay completed-game history through the same online detector with no future leakage, surfacing the first alert card that would have appeared, its exact pop time, and a timestamp-ordered alert deck. Post-game current divergence shall not be the primary history signal.
- `FR-020` The trader board-alerts surface shall present one primary alert at a time with optional collapsed secondaries, an exact timestamp, a one-line reason, score/confidence, and an Inspect action. It shall not lead with raw rows, source posts, cluster counts, or chip/pill metadata soup.

## Non-Functional Requirements

- `NFR-001` Runtime errors shall use stable typed envelopes.
- `NFR-002` Health/readiness shall fail honestly when required live dependencies or persisted live data are missing.
- `NFR-003` Storage shall remain portable through SQLite for v1 while preserving append-only history.
- `NFR-004` The system shall never silently substitute synthetic data for missing live data.
- `NFR-005` Node runtime entrypoints shall load repo-local env files without overriding explicit shell exports.
