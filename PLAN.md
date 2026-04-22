You are Codex, working inside a repo that already contains the seed of an internal product concept for bet365.

Your job is to turn it into a polished, working, spec-driven internal product, not a toy demo and not a generic “NBA dashboard.”

The product is an internal market intelligence and trader decision-support console for NBA markets. It uses external signal sources such as Kalshi and Polymarket, plus NBA data and deterministic internal scoring, to surface divergence, confidence, event context, and “why this matters right now” explanations. It is not a consumer sportsbook UI, not an autonomous betting system, and not a black-box prediction bot.

The goal is to dazzle on product taste, clarity of thinking, and implementation quality. Treat this like something that needs to impress engineers, product people, trading stakeholders, and leadership on a first serious internal review.

IMPORTANT OPERATING MODE

Use a spec-driven development approach.

Do not jump straight into random implementation.

Work in this order:

1. Audit the repo and ingest all seed materials.
2. Write the specs and decision docs.
3. Define contracts and acceptance criteria.
4. Build in thin vertical slices against the specs.
5. Keep the specs updated if implementation forces a change.
6. End with a working, polished product and a concise handoff.

Do not ask the user to make obvious choices unless you are truly blocked. Make sensible defaults, document assumptions, and continue.

If a seed file exists, use it. If it does not exist, proceed without failing.

SEED FILES TO LOOK FOR FIRST

Search the repo for these and ingest them before planning:

- nba-predict.md
- Bet365SignalConsole.tsx
- bet365_nba_signal_console_proposal.md
- bet365_nba_signal_console_memo.docx
- architecture.png
- ui_wireframe.png

If the docx file exists, extract or summarize it into markdown so it becomes searchable and maintainable in-repo.

If the images exist, inspect them and use them as grounding for layout, visual hierarchy, and architecture consistency.

PRODUCT DEFINITION

Build an internal product called something close to:
“Signal Console”
or
“Market Intelligence Console”

Purpose:

- Help internal users compare market signals across sources
- Surface divergence between Kalshi, Polymarket, and internal baseline signals
- Add NBA context, schedule context, and event metadata
- Explain why a market is interesting
- Show whether a divergence is likely noise, stale data, liquidity distortion, or a real information signal
- Support replay and demo mode so the product is impressive even if live APIs are flaky
- Be visibly professional, restrained, and high-signal

Audience:

- Trading
- Product
- Research
- Platform / data engineering
- Leadership watching a demo

NON-GOALS

Do not build:

- A public sportsbook front-end
- A consumer betting flow
- Wallet flows
- Real-money execution
- Fake live data labeled as real
- LLM-driven numeric calculations for core probabilities
- A messy prototype with hardcoded spaghetti logic

VISUAL DIRECTION

The UI should be inspired by the Codex desktop app in organization and tone:

- Dark, calm, command-center feel
- Dense but readable
- Clear paneling and spatial hierarchy
- Left navigation rail
- Strong center workspace
- Secondary detail / insight pane
- Tight typography
- Monospace treatment for numbers, probabilities, spreads, timestamps, IDs, and raw feeds
- Very restrained accent color usage
- No sportsbook neon
- No casino aesthetic
- No glossy marketing-site fluff
- Feels like a serious internal operator tool

Design principles:

- Every screen should answer “what changed, why do I care, and what should I inspect next?”
- Make the important thing visually obvious in under 3 seconds
- Numbers should feel trustworthy
- Charts should be minimal and useful
- Tables should scan quickly
- Provenance should always be visible

SPEC-DRIVEN DEVELOPMENT REQUIREMENTS

Create a /specs directory and write the following before broad implementation starts:

1. specs/00-repo-audit.md
   - What already exists
   - What is salvageable
   - What should be replaced
   - Risks
   - Missing pieces
   - Proposed architecture delta

2. specs/01-product-requirements.md
   - Product summary
   - Personas
   - Primary use cases
   - Functional requirements
   - Non-functional requirements
   - Constraints
   - Success criteria

3. specs/02-ux-spec.md
   - Information architecture
   - Primary screens
   - Interaction model
   - Design language
   - Empty states
   - Loading states
   - Error states
   - Accessibility considerations
   - Keyboard and power-user flows

4. specs/03-architecture-spec.md
   - System overview
   - Frontend architecture
   - Backend architecture
   - Data flow
   - Adapter boundaries
   - Storage decisions
   - Cache strategy
   - Polling / refresh strategy
   - Replay mode strategy

5. specs/04-data-contracts.md
   - Canonical types
   - Domain models
   - Zod schemas
   - API request / response contracts
   - Adapter normalization contracts
   - Provenance rules
   - Freshness rules
   - Error contracts

6. specs/05-api-spec.md
   - Routes
   - Query params
   - Response shapes
   - Validation rules
   - Error responses
   - Rate-limiting / caching assumptions
   - Auth assumptions if any

7. specs/06-signal-engine-spec.md
   - Divergence calculations
   - Confidence logic
   - Freshness weighting
   - Liquidity weighting
   - Consensus scoring
   - Narrative / explainability boundaries
   - When to suppress noisy signals

8. specs/07-test-plan.md
   - Unit tests
   - Contract tests
   - Integration tests
   - E2E tests
   - Demo-mode validation
   - Replay validation
   - Acceptance criteria by feature

9. specs/08-delivery-plan.md
   - Milestones
   - Vertical slices
   - What gets built first
   - What can be deferred
   - Demo-critical path

10. specs/09-assumptions-and-open-questions.md

- Every assumption
- Every unresolved issue
- Recommended next decisions

REQUIREMENT IDS

Use IDs everywhere:

- FR-### for functional requirements
- NFR-### for non-functional requirements
- UX-### for UX requirements
- API-### for API requirements
- DATA-### for data contracts
- SIG-### for signal logic
- TEST-### for tests
- ADR-### for architectural decisions

Create docs/traceability-matrix.md mapping:

- Requirement ID
- Implementing file(s)
- Test(s)
- UI surface
- API route(s)

Create docs/adr/ and write ADRs for major decisions.

If you later change implementation in a way that materially changes a requirement, update the spec and the traceability matrix.

REPO CONVENTIONS

If the repo is empty or weakly structured, use a pnpm monorepo with this shape:

apps/
web/
api/
worker/

packages/
shared/
domain/
adapters/
ui/

docs/
specs/

If the repo already has a strong structure, extend it instead of rewriting it.

PREFERRED STACK

Frontend:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- Zustand or equivalent lightweight state layer
- Zod for client-side validation of server responses
- Recharts for charts
- shadcn/ui only if it helps velocity without making the app feel generic

Backend:

- TypeScript
- Fastify
- Zod validation at the edge
- A small service layer and adapter layer
- Deterministic signal engine logic in plain TypeScript
- Structured logging

Storage:

- SQLite for demo friendliness
- Keep schema portable enough to move to Postgres later
- Store normalized snapshots, signal events, and replay fixtures

Testing:

- Vitest
- Playwright
- ESLint
- Prettier
- Strict TypeScript

DATA SOURCE STRATEGY

Build live adapters and mock adapters.

The product must work beautifully in three modes:

1. demo mode
2. replay mode
3. live mode

Demo mode:

- deterministic fixture data
- curated set of NBA games and market states
- zero external dependency required
- should be presentation-safe

Replay mode:

- use stored snapshots or fixture timelines
- show how divergence evolved over time
- allow stepping through a game / market narrative

Live mode:

- fetch from configured data adapters
- if an adapter fails, degrade gracefully
- clearly label stale or unavailable sources
- never pretend stale data is current

DATA MODEL REQUIREMENTS

Define canonical models such as:

- SportEvent
- Team
- MarketSource
- MarketInstrument
- MarketQuote
- OrderBookSnapshot
- SignalSnapshot
- DivergenceRecord
- ConfidenceAssessment
- NarrativeCard
- WatchlistItem
- TimelineEvent
- AdapterHealth
- ReplayFrame

Each record must carry provenance:

- source name
- source timestamp
- ingested timestamp
- freshness status
- normalization notes if needed

Normalize all probabilities into a canonical internal form.
Do not let each adapter leak raw weirdness throughout the app.

SIGNAL ENGINE REQUIREMENTS

The signal engine must be deterministic and explainable.

Core outputs:

- source-level implied probabilities
- divergence score
- freshness score
- liquidity score
- consensus score
- confidence score
- watchlist priority score
- risk flags
- narrative reason codes

Signal engine rules:

- Core numeric logic must be deterministic and testable
- LLMs may summarize or explain, but may not silently alter core numeric outputs
- Every displayed “why” explanation should be traceable to either source data or deterministic reason codes
- If confidence is low, say so clearly
- If sources disagree because one source is stale, show that
- If liquidity is weak, show that
- If one source is noisy, down-weight it
- If data is missing, degrade gracefully and surface that honestly

Build a first-pass weighting framework that is readable and editable.
Do not hide the logic.

Example concepts to implement:

- freshness_weight
- liquidity_weight
- volatility_weight
- source_reliability_weight
- divergence_severity
- narrative_reason_codes

UI / SCREEN REQUIREMENTS

Minimum screens to ship:

1. Overview Dashboard
   Purpose:
   - Immediate view of most interesting NBA events
   - Ranked by watchlist priority or divergence severity

   Must include:
   - Top divergence cards
   - Source health summary
   - Refresh status
   - Watchlist table
   - Quick stats
   - “Interesting now” panel
   - Command palette entry point

2. Event Detail / Matchup Workspace
   Purpose:
   - Deep dive into one NBA event

   Must include:
   - Header with teams, event time, and source badges
   - Current source probabilities
   - Divergence visualization
   - Timeline of changes
   - Confidence panel
   - Reason codes / narrative cards
   - Raw-source inspection drawer
   - Replay controls if replay data exists

3. Divergence Explorer
   Purpose:
   - Scan across events and compare source disagreement

   Must include:
   - Sortable/filterable table
   - Confidence filters
   - Freshness filters
   - Liquidity filters
   - Search by team / event
   - Expandable row details

4. Signal Timeline
   Purpose:
   - Show how a divergence developed over time

   Must include:
   - Time-series chart
   - Source overlays
   - Annotations
   - Marker events
   - Relative change display
   - Snapshot inspect-on-hover or inspect-on-click

5. Watchlist / Alerts
   Purpose:
   - Internal shortlist of events worth review

   Must include:
   - Add/remove watchlist
   - Priority ranking
   - Alert reasons
   - Last changed time
   - Source health context

6. Settings / Sources / Diagnostics
   Purpose:
   - Make the product demoable and maintainable

   Must include:
   - Live vs replay vs demo mode toggle
   - Source configuration summary
   - Adapter health
   - Last sync times
   - Environment validation
   - Fixture selection in demo mode

OPTIONAL IF TIME ALLOWS

7. Backtest / Replay Lab
   - Compare historical snapshots and reasoning
   - Show whether interesting signals would have been surfaced

USER EXPERIENCE DETAILS

Implement:

- Command palette
- Keyboard-first navigation for major screens
- Consistent hotkeys
- Resizable or collapsible panels if it meaningfully improves workflow
- A polished loading skeleton system
- Error banners that are informative, not alarming
- Empty states that explain what to do next
- Tight spacing and disciplined typography
- Strong desktop experience first, but it should still behave well on a laptop-sized viewport

Typography:

- Use a clean sans font for primary UI
- Use a mono font for numerical surfaces, tables, timestamps, route IDs, and raw data blocks

Tables:

- Sticky headers where appropriate
- Good default sorting
- Row-level quick actions
- Very clear alignment of numeric columns

Charts:

- Minimal
- Useful
- No chartjunk
- Colors should serve comparison, not decoration

LLM USAGE RULES

If an LLM feature is included, keep it narrow and controlled.

Acceptable uses:

- short narrative summaries
- explanation cards
- “why this might matter” synthesis
- converting deterministic reason codes into readable copy
- summarizing source deltas

Do not use LLMs for:

- core numeric computations
- hidden weighting decisions
- silently inventing market context
- fabricating injuries, news, or causes

If live LLM credentials are unavailable:

- the product must still work
- use deterministic fallback copy

IMPLEMENTATION PLAN

Build in vertical slices.

Suggested order:

1. Repo audit + specs + ADRs
2. Shared domain models + contracts + fixtures
3. Backend skeleton + health routes + adapter interfaces
4. Demo fixtures + replay engine
5. Overview dashboard
6. Event detail workspace
7. Divergence explorer
8. Timeline / narrative layer
9. Live adapters
10. Source diagnostics
11. Watchlist / alerts
12. Polish, tests, documentation

DEMO-FIRST STRATEGY

Prioritize demo reliability over fragile “live-only” cleverness.

The product should still feel excellent if external APIs fail.
Create polished fixture-driven flows that make the product look deliberate, not crippled.

Include a seeded storyline:

- at least several NBA events
- at least one event with strong divergence
- at least one stale-source scenario
- at least one low-liquidity scenario
- at least one convergence / agreement scenario

Make the replay mode a strength, not a fallback.

API ROUTES TO IMPLEMENT

Create a clean API surface, for example:

- GET /health
- GET /api/source-health
- GET /api/events
- GET /api/events/:eventId
- GET /api/events/:eventId/timeline
- GET /api/events/:eventId/signals
- GET /api/events/:eventId/raw
- GET /api/watchlist
- POST /api/watchlist
- DELETE /api/watchlist/:eventId
- GET /api/settings
- GET /api/replay/scenarios
- POST /api/replay/select

Use typed contracts end to end.

QUALITY BAR

Before declaring done:

- no obvious TODO junk
- no fake data mislabeled as live
- no dead buttons
- no broken empty states
- no unhandled error states
- no type holes
- no wildly inconsistent spacing or typography
- no route that exists without validation
- no major feature without at least one test
- no design that looks like a default admin template with a new logo

TESTING REQUIREMENTS

At minimum:

- unit tests for signal logic
- unit tests for adapter normalization
- integration tests for key API routes
- Playwright smoke tests for core user paths
- one or more tests that validate provenance/freshness labeling
- one or more tests for demo mode
- one or more tests for replay mode

Each major test file should reference the requirement IDs it covers.

CREATE A REPO-SCOPED CODEX SKILL

Create:
.codex/skills/bet365-signal-console/SKILL.md

Put in it:

- project goal
- visual language rules
- product constraints
- source-of-truth docs
- spec ID conventions
- quality bar
- demo-mode priority
- “do not fake live data”
- “deterministic numeric core”
- “update specs when implementation changes”

This should help future Codex threads stay aligned.

RUNNING AND VALIDATION

Make sure the repo can be started locally with a small number of obvious commands.

At the end, ensure these pass if the stack supports them:

- install
- lint
- typecheck
- test
- build

Also provide a concise README with:

- what the product is
- stack
- folder structure
- how to run demo mode
- how to run replay mode
- how to run live mode
- environment variables
- limitations
- next recommended steps

FINAL DELIVERABLES

When finished, produce:

1. A working product
2. All specs and ADRs
3. Traceability matrix
4. Demo fixtures and replay fixtures
5. Clear README
6. Updated architecture documentation
7. Concise final summary listing:
   - what was built
   - what assumptions were made
   - what remains intentionally deferred
   - exact run commands
   - exact validation results

WORK STYLE

Be autonomous.
Be tasteful.
Be skeptical of your own assumptions.
Choose simple, sharp architecture over complexity theater.
Keep the numeric core deterministic.
Keep the UI polished and serious.
Prefer a smaller product that feels real over a huge product that feels fake.

Start by auditing the repo and creating the specs. Then build the product against those specs.
