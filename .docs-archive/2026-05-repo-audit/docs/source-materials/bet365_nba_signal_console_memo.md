# bet365 NBA Signal Console Memo

Source: `bet365_nba_signal_console_memo.docx`  
Derived: searchable markdown extraction and light cleanup on 2026-04-21

## Summary

This memo frames the product as an internal trader workstation, not a public betting UI and not an autonomous prediction engine. The core claim is that prediction markets should act as external sensor networks for bet365 traders, with bet365's internal book remaining the operational source of truth.

## Core Thesis

Prediction markets are not the pricing engine. They are the early-warning radar. bet365's own book remains the operational truth, while Kalshi and Polymarket act as external sensor networks that help traders spot information shocks, explain divergences, and act faster.

## Executive Summary

The strongest version of the idea is not "use prediction markets to predict NBA games." The stronger bet365 version is to build an internal trader console that continuously compares bet365 prices and exposure against Kalshi, Polymarket, and NBA context, then turns that divergence into an actionable recommendation.

- Speed up repricing when new information hits the market.
- Increase trader confidence when multiple sources converge.
- Reduce liability by flagging stale prices where external markets moved first.
- Create a reusable signal framework that can later expand beyond NBA.

## Why This Version Is Stronger

- Built for sportsbook operations: the goal is not just prediction accuracy, it is faster, safer, better-informed pricing.
- Uses prediction markets correctly: Kalshi and Polymarket are treated as external information markets with different trust profiles, not magical oracles.
- Keeps bet365 central: internal price, exposure, and trader workflow remain the core operating context.
- Moves LLMs out of the critical path: any language model should summarize and explain, not directly decide the price.
- Feels like a real product: the UI is a trader workstation with alerts, evidence, confidence, and action recommendations.

## Signal Architecture

The system should combine market microstructure, basketball context, and bet365 book state into a single signal score.

| Source                  | What it contributes                                                                      | Why it matters             |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------------------------- |
| bet365 internal pricing | Current odds, line history, exposure, parlay concentration, customer sharpness           | Operational truth          |
| Kalshi                  | Exchange market data, sports filters, candlesticks, live basketball data                 | Structured external signal |
| Polymarket              | Market discovery, prices, books, price history, sports metadata, teams, sports WebSocket | High-velocity crowd signal |
| NBA data via `nba_api`  | Historical stats, team trends, box score and live context                                | Basketball fundamentals    |

## Source Roles

### Kalshi should be used for

- Pregame price monitoring
- Intraday velocity tracking
- Live repricing support
- Candlestick-based move analysis

### Polymarket should be used for

- Rapid crowd-signal detection
- Cross-market confirmation
- Depth and imbalance monitoring
- Sports metadata and team mapping

## Recommended Workflow

- Pregame: normalize bet365, Kalshi, and Polymarket prices, run the NBA model, rank the slate by divergence and risk, then surface the few markets that actually deserve trader attention.
- Live: subscribe to live market updates, detect shock events, compare them with game context and liability, and escalate only when confidence is high enough.
- Postgame: measure which source led price discovery, whether traders acted, and whether the action improved closing-line quality.

## UI Direction

React + TypeScript + Tailwind. Inspired by the Codex desktop app's layout logic: left sidebar, active center thread, and right review pane.

| Left rail | Center pane           | Right pane             |
| --------- | --------------------- | ---------------------- |
| Slates    | Active matchup thread | Recommended action     |
| Alerts    | Probability strip     | Confidence explanation |
| Markets   | Divergence timeline   | Exposure hot spots     |
| Backtests | Trader note           | Source trust           |
| Playbooks | Scenario tabs         | Audit events           |

## Example Alert

Knicks @ Celtics | High severity | 38 minutes to tip

- bet365 58.1%
- Kalshi 62.4%
- Polymarket 64.1%
- Internal model 61.5%

Recommended action: reprice the main line, tighten selected props, and monitor lineup confirmation.

## Delivery Plan and KPIs

| Timeframe | Deliverables                                              | Outcome                    |
| --------- | --------------------------------------------------------- | -------------------------- |
| 30 days   | Mapping, ingestion, odds feed, NBA baseline, UI shell     | End-to-end signal pipeline |
| 60 days   | Divergence scoring, trust model, alerts, notes, backtests | Usable internal pilot      |
| 90 days   | Exposure-aware actions, live updates, props, calibration  | Desk-ready product         |

| KPI                                     | Why it matters                            |
| --------------------------------------- | ----------------------------------------- |
| Time-to-reprice after new info          | Measures workflow speed                   |
| Alert precision                         | Prevents noisy systems from being ignored |
| Closing-line quality on flagged markets | Connects alerts to market performance     |
| Liability avoided on high-risk moves    | Links the product to risk savings         |
| Trader adoption                         | Shows the console is actually useful      |

## Risk and Governance

- External prediction markets are advisory inputs, not automatic pricing commands.
- Every alert should preserve an audit trail.
- Human approval remains in the loop for repricing.
- Source quality must be explicit, not hidden.
- Live dependency failures should degrade gracefully.

## Bottom Line

Prediction markets are not the product. The product is a trader workstation that turns external market motion into actionable pricing intelligence.
