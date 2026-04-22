# bet365 NBA Signal Console

## A prediction-market intelligence layer for faster pricing, sharper trader decisions, and cleaner risk management

**Prepared for:** bet365 product, trading, and quantitative stakeholders  
**Concept:** Internal trader console, not a customer-facing odds screen  
**Primary sport:** NBA  
**Core signal stack:** bet365 internal odds and exposure + Kalshi + Polymarket + NBA data

---

## Executive summary

The strongest version of the prediction-market idea is **not** “let’s use Kalshi and Polymarket to predict games better than everyone else.”

The stronger bet365 version is this:

> **Build an internal market-intelligence console that treats prediction markets as external sensor networks.**
> Kalshi and Polymarket become high-signal inputs for price discovery, divergence detection, and trader workflow acceleration. bet365’s own lines, limits, and exposure remain the operational source of truth.

That framing matters because it turns the idea from a clever analytics project into a product that can improve:

- **repricing speed** when new information hits the market
- **trader confidence** when multiple sources converge
- **risk management** when external markets move before internal lines do
- **post-game learning** through systematic backtesting of which source led price discovery

The result is a **three-pane trader console** inspired by the Codex desktop app: a focused workspace with a left navigation rail, a center “active matchup” analysis thread, and a right review pane for action recommendations, risk notes, and source trust.

---

## The pitch in one sentence

**bet365 should use Kalshi, Polymarket, and NBA data as a real-time intelligence layer that explains when the market knows something before the book does.**

---

## Why this is better than the original draft

Your original write-up is technically ambitious and interesting, but it reads more like a personal quant project than a bet365-ready product proposal. It leans heavily on “build a model” and “let Claude interpret it.” For a sportsbook operator, that is not enough.

This upgraded version improves the idea in five ways:

1. **It is built for sportsbook operations.**  
   The core job is not just predicting winners. It is helping traders price faster, size risk better, and understand why a market should move.

2. **It uses prediction markets the right way.**  
   Kalshi and Polymarket are not treated as magical oracles. They are treated as external, measurable information markets with different microstructures, different participant mixes, and different trust levels.

3. **It keeps bet365’s own book at the center.**  
   Internal odds, exposure, liability, parlay concentration, and customer sharpness remain first-class inputs. That makes the system useful to the actual trading desk.

4. **It moves the LLM out of the critical path.**  
   Any LLM layer should explain, summarize, and draft trader notes. It should not be the final pricing engine.

5. **It has a product-grade UI and workflow.**  
   Instead of dumping probabilities into charts, it gives traders a workspace with alerts, evidence, confidence scores, and recommended actions.

---

## Product thesis

Prediction markets are valuable to bet365 for one reason above all:

**they are often faster than narrative.**

When a lineup whisper, injury expectation, rest signal, or matchup-specific sentiment starts spreading, it may appear first as subtle price motion, depth imbalance, or volume acceleration before a clean news headline arrives.

That creates a practical opportunity:

- if **Kalshi moves first** and the move is liquid, that matters
- if **Polymarket moves first** and the move is broad and persistent, that matters
- if **both move together** while bet365 remains static, that matters more
- if **both move but the NBA fundamentals disagree**, that matters in a different way
- if **one market jumps without confirmation**, that is also useful because it may be noise rather than information

The job of this product is to separate those cases in real time.

---

## Product goal

Create an internal dashboard that ranks every NBA market by:

1. **divergence** from bet365’s current price
2. **confidence** in that divergence
3. **probable cause** of the divergence
4. **recommended trader action**

---

## The operating model

### This is not an execution engine

The console does **not** blindly mirror external markets.

### This is not a generic prediction dashboard

The console does **not** stop at “Team A has a 63% chance to win.”

### This is a trader intelligence system

The console answers practical questions:

- Are we off-market?
- Are we off-market for a good reason or a bad reason?
- Which external source moved first?
- Is the move liquid or thin?
- Does the NBA data support the move?
- Is our liability high enough that we should act now?
- Should we reprice, reduce limits, or monitor?

---

## Core product concept

## 1) Divergence Radar

For every game and market type, compare:

- bet365 implied probability
- Kalshi implied probability
- Polymarket implied probability
- internal ML estimate
- closing-line calibration baseline
- current liability and stake concentration

The system then produces a single **Signal Score**.

### Example Signal Score

```text
Signal Score =
  0.30 * zscore(abs(bet365_prob - kalshi_prob))
+ 0.25 * zscore(abs(bet365_prob - polymarket_prob))
+ 0.15 * zscore(kalshi_price_velocity)
+ 0.10 * zscore(polymarket_depth_imbalance)
+ 0.10 * zscore(model_edge_vs_book)
+ 0.10 * zscore(liability_pressure)
```

This lets traders scan an NBA slate and see where the interesting fires are, not just where the numbers are different.

---

## 2) Source Trust Engine

Not all divergences deserve the same respect.

The console assigns dynamic trust weights based on:

- market liquidity
- bid-ask spread / depth quality
- persistence of move
- source agreement
- NBA context support
- confirmation from official game/injury signals
- historical predictive reliability by market type

### Practical weighting logic

- **Trust Kalshi more** when liquidity is solid, order books are balanced, and price velocity sustains through multiple intervals.
- **Trust Polymarket more** when the move is persistent, depth is healthy, and multiple related markets confirm the shift.
- **Trust the internal model more** when external markets are thin, noisy, or unsupported by NBA fundamentals.
- **Trust none of them completely** when signals conflict and data quality is weak.

---

## 3) Information Shock Detection

The biggest value is often not the absolute number. It is the **timing**.

The console flags:

- one source moving sharply while the others stay flat
- both external markets moving before bet365
- live market drift after lineup/injury confirmation
- props or derivatives still lagging after the main market has already moved
- suspicious or noisy moves that reverse quickly

### Alert types

- **Shock**: price changes more than threshold in short interval
- **Consensus Drift**: Kalshi + Polymarket both move against bet365
- **False Spike**: one market moves, then mean-reverts with no confirmation
- **Exposure Heat**: divergence exists where bet365 liability is already elevated
- **Prop Lag**: side market still stale after parent market reprices

---

## 4) Explainable trader notes

The system should generate trader-ready summaries such as:

> Kalshi and Polymarket both moved toward Boston over the last 11 minutes, with Polymarket leading first and Kalshi confirming on higher-quality liquidity. NBA fundamentals already favor Boston on rest, recent net rating, and late-game efficiency. Internal book is still 3.8 implied points lighter than consensus. Recommend repricing main line and tightening high-liability props.

That is where an LLM helps:

- write concise notes
- summarize evidence
- highlight the main risk
- produce post-shift explanations

But the explanation layer should be **downstream of structured signals**, not upstream of them.

---

## System architecture

## Data sources

| Source                         | What it contributes                                                                                         | Why it matters             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------- |
| **bet365 internal pricing**    | Current odds, line history, exposure, parlay concentration, customer sharpness                              | Operational truth          |
| **Kalshi**                     | Exchange market data, order books, candlesticks, sports filtering, live basketball data                     | Structured external signal |
| **Polymarket**                 | Market discovery, token prices, order books, price history, sports metadata, team mapping, sports WebSocket | High-velocity crowd signal |
| **NBA data via nba_api**       | Historical stats, team trends, box score and live data access via NBA.com endpoints                         | Basketball context         |
| **Optional news/injury layer** | Injury reports, lineup confirmations, beat-writer signals                                                   | Event confirmation         |

---

## Why Kalshi belongs in the stack

Kalshi is especially attractive because it can serve as a cleaner institutional signal source than a purely social or retail feed.

What is useful here:

- official API documentation for **real-time market data and trade execution**
- public market-data access without authentication for several endpoints
- official **TypeScript** and **Python** SDKs
- sports-aware filtering
- Pro Basketball live data support, including play-by-play game stats for supported milestones
- market candlesticks for intraday and daily movement analysis

For bet365, that means Kalshi is not just “another odds source.” It can be used as a structured external market-data input for:

- pregame price monitoring
- intraday velocity tracking
- live repricing support
- postmortem price-discovery analysis

---

## Why Polymarket belongs in the stack

Polymarket adds a different texture of signal:

- public market discovery through Gamma
- public prices, order books, spreads, and price history through the CLOB
- sports metadata and team mapping endpoints
- a public sports WebSocket for real-time sports match updates

That makes Polymarket especially valuable for:

- rapid signal detection
- crowd sentiment shifts
- cross-market confirmation
- faster monitoring of derivatives and long-tail market interest

Polymarket should not be treated as identical to Kalshi. It is a different venue with different market structure and user behavior. That is exactly why it is useful.

---

## Why nba_api still belongs in the stack

`nba_api` remains valuable because it makes NBA.com data easier to use across historical and live workflows. But it should be wrapped carefully.

For bet365, its role is to supply:

- team form
- rolling Four Factors
- pace and efficiency
- rest and schedule pressure
- ELO / power ratings
- matchup context
- box score and live-state context

The right way to use it in production is behind a provider abstraction with:

- caching
- retries
- snapshot storage
- failure fallbacks
- schema monitoring

That matters because the package itself notes that NBA.com can add, change, or remove endpoints without formal change notices.

---

## Recommended signal architecture

## Layer 1: Market microstructure

Inputs:

- order book depth
- midpoint
- spread
- price velocity
- candlesticks
- volume
- open interest where available

Outputs:

- liquidity confidence
- move quality score
- reversal risk
- early-move detector

## Layer 2: Basketball context

Inputs:

- rolling team strength
- Four Factors
- net rating
- pace
- rest and back-to-back status
- home/away splits
- lineup continuity
- head-to-head only as a weak secondary feature

Outputs:

- matchup confidence
- model probability
- margin projection
- contextual support score

## Layer 3: bet365 book state

Inputs:

- current price
- previous price
- exposure/liability
- customer sharpness segmentation
- parlay linkage
- market type
- time to tipoff

Outputs:

- operational urgency
- exposure pressure
- repricing recommendation
- limit adjustment recommendation

## Layer 4: Synthesis

Outputs:

- final Signal Score
- trader summary
- recommended action
- confidence band
- audit trail

---

## Recommended product workflow

### Pregame workflow

1. Ingest slate and canonical matchup mapping.
2. Normalize prices from bet365, Kalshi, and Polymarket to implied probabilities.
3. Run NBA matchup model.
4. Score divergences.
5. Rank the slate by opportunity and risk.
6. Push alerts to the console.
7. Allow trader action: reprice, tighten, watch, dismiss.

### Live workflow

1. Subscribe to live market updates.
2. Recompute divergence deltas.
3. Watch for shock events.
4. Compare to live game context.
5. Trigger higher-priority alerts when exposure is elevated.

### Postgame workflow

1. Compare opening, interim, and closing states.
2. Record which source led the move.
3. Measure whether alert-generated actions improved closing-line quality.
4. Use results to recalibrate source trust weights.

---

## UI vision

## React + TypeScript + Tailwind

## Inspired by the Codex desktop app’s layout logic, not by sportsbook clutter

The UI should feel like a **focused operator workstation**, not a marketing site and not a consumer betting app.

### Design principles

- calm, dark workspace
- pane-based organization
- quiet borders and strong spacing
- dense information without visual chaos
- monospace treatment for prices, IDs, and timestamps
- one accent color for urgency and another for consensus
- keyboard-first interactions and command palette

### Codex-inspired layout

The Codex app is described as a focused desktop experience with a **project sidebar, active thread, review pane, and sidebar/artifacts**. That is the right organizational model for this product.

### Proposed layout

**Left rail**

- Slates
- Alerts
- Markets
- Backtests
- Sources
- Playbooks
- Saved filters

**Center pane**

- active matchup “thread”
- price timeline
- divergence cards
- source comparison
- trader note
- scenario tabs: Winner / Spread / Total / Props / Live

**Right pane**

- recommended action
- confidence explanation
- exposure hot spots
- source trust details
- audit events
- one-click handoff note

### Typography

Use a restrained, modern system:

- body: clean sans stack
- metrics and timestamps: monospace stack
- larger numerals and tighter tracking for probabilities
- compact but breathable rhythm

### Visual tone

Think:

- analytical, not flashy
- terminal-adjacent, not retro
- premium internal tool, not public sportsbook chrome

---

## What should be on the main screen

## Header

- current slate selector
- search / command palette
- filters for game state, market type, alert severity, liquidity

## Match list

- all NBA matchups
- small consensus strip showing bet365 vs Kalshi vs Polymarket vs model
- severity badge
- time to tipoff
- exposure badge

## Active matchup panel

- matchup header
- implied probability comparison
- sparkline or bar timeline for last movement
- evidence blocks:
  - market microstructure
  - NBA fundamentals
  - internal exposure
  - related props

## Review pane

- recommendation:
  - reprice now
  - reduce limits
  - watch
  - ignore
- risk note
- confidence explanation
- action log

---

## Example of the user experience

### Trader opens “Tonight’s Slate”

The top alert is:

**Knicks @ Celtics | Severity: High | 38 min to tip**

The console shows:

- bet365 home implied probability: 58.1%
- Kalshi: 62.4%
- Polymarket: 64.1%
- internal model: 61.5%

The note explains:

- Polymarket moved first
- Kalshi confirmed with tighter, more trustworthy market structure
- Boston has rest advantage and stronger rolling net rating
- bet365 has rising parlay exposure on the away side
- props still underreacted relative to winner market

Recommended action:

- move main line
- lower limits on selected props
- monitor lineup confirmation channel

That is a real product moment. It is specific, operational, and trader-friendly.

---

## What the MVP should include

### MVP scope

- NBA winner markets first
- pregame focus
- Kalshi + Polymarket + bet365 + nba_api
- ranking, alerting, and explanation
- one-screen desktop console
- backtest module for signal quality

### MVP non-goals

- full autonomous repricing
- every prop market on day one
- LLM-generated odds
- direct execution to external exchanges
- broad public rollout

---

## 30 / 60 / 90 day plan

| Timeframe   | Deliverables                                                                                                                       | Outcome                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **30 days** | Canonical team and market mapping, Kalshi + Polymarket ingestion, bet365 odds feed integration, NBA model baseline, first UI shell | End-to-end signal pipeline |
| **60 days** | Divergence scoring, source trust model, alert feed, trader notes, backtest dashboard                                               | Usable internal pilot      |
| **90 days** | Exposure-aware actions, live update support, props expansion, model calibration and postmortems                                    | Desk-ready product         |

---

## KPIs that leadership will care about

| KPI                                          | Why it matters                            |
| -------------------------------------------- | ----------------------------------------- |
| **Time-to-reprice after market-moving info** | Measures workflow speed                   |
| **Alert precision**                          | Prevents noisy systems from being ignored |
| **Closing-line quality on flagged markets**  | Ties alerts to market performance         |
| **Liability avoided on high-risk moves**     | Connects product to risk savings          |
| **Trader adoption / active sessions**        | Shows the console is actually useful      |
| **Backtest lift vs internal baseline**       | Quantifies improvement                    |

---

## Risk and governance

This idea gets much stronger when it is framed with adult supervision.

### Guardrails

- external prediction markets are **advisory inputs**, not automatic pricing commands
- every alert should have an audit trail
- human approval remains in the loop for repricing
- source quality should be explicit, not hidden
- live dependency failures should degrade gracefully
- legal/compliance should approve any embedded external views or direct linking

### Data quality considerations

- canonical team mapping is mandatory
- event and market taxonomy should be versioned
- every price snapshot needs a timestamp and source ID
- NBA data ingestion should be cached and monitored
- all source transforms should be testable and replayable

---

## Why this could scale beyond NBA

NBA is the right starting point because it is:

- data-rich
- schedule-dense
- lineup-sensitive
- fast-moving
- relatively structured

Once the console works for NBA, the same operating model can extend to:

- NFL sides and totals
- soccer match odds
- tennis match markets
- award / futures markets
- player props where market microstructure is especially informative

The point is not to build a one-off NBA dashboard.
The point is to build a reusable **external-signal operating layer** for bet365 trading.

---

## Recommendation

If this is presented to bet365, pitch it as:

### “A market-intelligence console for NBA trading”

not

### “a model that uses prediction markets”

That single reframing makes the whole idea more credible.

The strongest final message is:

> **Prediction markets are not the product.**
> **The product is a trader workstation that turns external market motion into actionable pricing intelligence.**

That is the version most likely to sound serious, differentiated, and fundable inside a sportsbook.

---

## Suggested closing line for the room

> We should not ask Kalshi and Polymarket to replace our book. We should use them as early-warning radar, fuse them with NBA context and our own exposure data, and give traders a cleaner, faster way to see when the market already knows something.

---

## Technical notes informing this proposal

This proposal assumes the following current capabilities:

- Kalshi publishes API documentation for real-time market data and trade execution, provides public market-data access for some endpoints, offers official Python and TypeScript SDKs, supports sports filtering, candlesticks, and Pro Basketball live-data endpoints.
- Polymarket documents public Gamma market discovery, public CLOB market-data endpoints such as price, book, midpoint, spread, and price history, plus sports metadata, teams, and a public sports WebSocket.
- `nba_api` remains a useful wrapper for NBA.com data, but production use should account for endpoint drift and operational fragility.
