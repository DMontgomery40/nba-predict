# Memory Recovery: NBA Player-Prop Stat-Misallocation Signals

**Date:** 2026-05-21
**Scope:** Local memory, codex project notes, session transcripts, sqlite code index
**Question:** What do stored notes and sessions know about NBA stat-misallocation signals, suspend candidates, and case-study incidents?

---

## 1. .agent-memory-nexus/project-index/chunks.sqlite

**Path:** `/Users/davidmontgomery/nba-predict/.agent-memory-nexus/project-index/chunks.sqlite`
**Size:** ~30 MB
**Schema:** `chunks` table with columns `source_kind`, `source_path`, `text`, `content_hash`, plus FTS5 virtual table and `sources` table.

**What it indexes:** Code and documentation chunks from the nba-predict repo. Source kinds found:

| source_kind | count |
|---|---|
| codex_rollout | 2843 |
| project_memory | 23 |
| claude_transcript | 385 |
| gitnexus_artifact | 53 |
| claude_subagent_transcript | 4 |
| gitnexus_run_log | 1 |

The `project_memory` chunks are the most directly relevant: they contain the full text of the codex AGENTS.md/memory rules, including the Market Incident Analysis Rules section. The `codex_rollout` and `claude_transcript` chunks index repo source files and session outputs, not raw trading emails.

**Conclusion:** This sqlite database is an embedding/chunk index of repo files and session artifacts. It does NOT contain raw trading emails. This was verified by inspecting source kinds and sample `text` values — all retrieved text is code, spec content, or agent rules.

---

## 2. ~/.codex/projects/-Users-davidmontgomery-nba-predict/

**Path:** `~/.codex/projects/-Users-davidmontgomery-nba-predict/`

### MEMORY.md

Title: "Project Memory Index (nba-predict)"

Contains one entry:
- `memory/2026-05-11-browser-ui-verification.md` — Use the Browser plugin for UI verification after UI changes.

### memory/2026-05-11-browser-ui-verification.md

Single preference note: for nba-predict UI work, use the Browser plugin for verification, not terminal-only checks.

### extensions/ad_hoc

One extension directory, `ad_hoc`, present. No substantive content relevant to incidents (not inspected further; directory name suggests ad hoc agent notes).

### AGENTS.md (the main codex project rules file)

This is the load-bearing memory document. It is indexed in chunks.sqlite as `project_memory`. Key sections relevant to this sweep:

**Market Incident Analysis Rules** — full working policy for analyzing NBA stat misallocation, stat correction, player-prop attribution, and prediction-market reaction incidents. Covers:
- Lead with trader action (suspension/review target first, not generic volatility taxonomy)
- Incident Timeline table format (source-local time, UTC, T-offset, affected players, stat/market family)
- Paired-player analysis (credited player + rightful player)
- Volume share as first-class signal (off-price prints, concentrated buys)
- Direct API vs app coverage diagnostics
- Reporting format (compact tables; required sections: Incident Timeline, Venue Coverage, Market Reaction, Read)

**Trader-First Purpose** — explicit statement: "This product exists to help a trader suspend the right markets as fast as possible when a player stat may be misattributed, corrected, or otherwise unstable."

---

## 3. ~/.codex/sessions/ — Grep and Extraction Results

Searched all of `~/.codex/sessions/2026/` and `~/.codex/sessions/2025/` for: `misallocation`, `stat correction`, `Reaves`, `Hayes`, `suspend`, `off-price`, `volume share`, `polymarket`, `kalshi`.

**2026 hits** (excerpt — many files matched on `polymarket`/`kalshi` in scaffolding; hits on `Reaves`, `misallocation`, `off-price`, `suspend` in project-meaningful context are listed below):

- `2026/05/19/rollout-2026-05-19T08-35-43` — TODO.md incident review session; contains the full Reaves/Hayes case study and Queta case study with direct API findings.
- `2026/05/17/rollout-2026-05-17T21-50-13` — trader-desk review session; references `Reaves T+0:38` timestamp anchor, Wade and Reaves screenshot verification, memory update confirming the verify-before-ingest rule.
- `2026/05/17/rollout-2026-05-17T16-43-23` — test-writing session; seeds `sm-polymarket-unmapped-reaves` as a test fixture with `Austin Reaves rebounds O/U 4.5`, `volumeShare: 0.26`, `tradePrice: 0.99`.
- `2026/05/15/rollout-2026-05-15T22-45-02` — board-anomaly detector session; contains the evaluation-label list (Hartenstein/Cason Wallace, Cunningham block, Sasser rebound, LeVert/Jenkins assist).
- `2026/05/11/rollout-2026-05-11T14-16-06` — live desk verification; browser screenshot shows `Austin Reaves over 2.5 threes 57.3% gap - critical` on the desk for Thunder at Lakers, May 11.
- `2026/04/22/rollout-2026-04-22T01-11-29` — context session; Austin Reaves mentioned as injured (oblique strain, ruled out) in Lakers injury recap.
- `2026/05/20/rollout-2026-05-20T17-12-45` — Hartenstein/Cason Wallace context confirmed present.

**2025 hits** — matched only on `polymarket`/`kalshi` in generic scaffolding (HuggingFace jobs, unrelated projects). No stat-misallocation content found in 2025 sessions.

**No raw trading emails found anywhere.** Sessions are agent rollout transcripts (JSON Lines format with `type: response_item`, `type: event_msg` etc.), not email archives.

---

## 4. ~/.claude/projects/-Users-davidmontgomery-nba-predict/memory/

**Path:** `~/.claude/projects/-Users-davidmontgomery-nba-predict/memory/`

All files read. Summary:

| File | Age | Content |
|---|---|---|
| `user_profile.md` | 27 days | David is a new hire at bet365; target audience is bet365 trading staff on six-screen setups. |
| `project_bet365_signal_console.md` | 27 days | "Prediction markets as external sensor networks"; compares bet365 book vs Kalshi/Polymarket vs NBA game-state truth; divergence, source lead/lag, trader-actionable signal events. |
| `project_board_anomaly_detector_2026_05_16.md` | 5 days | Full board-anomaly detector landed 2026-05-16; H0/H1 framing, fanout coherence, 6 shock kinds, 140 tests green. FD/DK ingest still blocked. |
| `project_signal_console_state_2026_04_23.md` | 27 days | Schema v5, all ingest lanes, signal-quality analytics, trader terminal, 70 tests green as of 2026-04-23. |
| `project_data_access.md` | 27 days | David can pull bet365 historical data internally; coworker building per-user action tracking. |
| `feedback_ui_trader_terminal.md` | 27 days | Bloomberg-terminal density, monospace numerics, no consumer-sportsbook chrome. |
| `feedback_verify_existing_before_ingest.md` | 4 days | Key rule: query schema + existing rows before proposing new ingestion; references the Reaves game-id mapping bug. |

---

## 5. Concrete Incident Facts Recovered

The following incidents are documented in memory and sessions with specific timestamps. None originated from raw trading emails — sources are TODO.md, session agent text, spec files, and Twitter screenshots used as evaluation labels.

### Incident A: Thunder at Lakers, 2026-05-11/12 — Reaves / Hayes rebound misattribution

**Status:** Most thoroughly documented case; real Polymarket data verified by direct API.

| Field | Value |
|---|---|
| Game | Oklahoma City Thunder at Los Angeles Lakers |
| Game ID | `nba-okc-lal-2026-05-11` / `nba-0042500224` (Bet365 mapping); also seen as `nba-0042500223` (Polymarket mapping — canonical mapping bug) |
| Date | 2026-05-11 (game local), 2026-05-12 (UTC) |
| Incident time | `05:51:40 UK` / `2026-05-12T04:51:40Z` |
| Event | Rebound assigned live to Austin Reaves; should have been Jaxson Hayes |
| Bet365 exposure | Jaxson Hayes Over 4.5 rebounds |
| Later relevant play | `06:11:49 UK` / `2026-05-12T05:11:49Z` — Hayes had another rebound before end |
| Match finished | `06:23:27 UK` / `2026-05-12T05:23:27Z` — stat not reallocated |

**External market signal found (Polymarket):**

| Venue | Market | Finding |
|---|---|---|
| Polymarket | Austin Reaves: Rebounds O/U 4.5 | Real market existed; confirmed by direct Data API |
| Kalshi | Austin Reaves rebounds | Not present for this game; Kalshi had Reaves assists ladders only |
| Kalshi | Jaxson Hayes rebounds | Not present |
| Polymarket | Jaxson Hayes rebounds | Not present |

**Trade burst near incident:**

| Timestamp | UTC | Event | T-offset |
|---|---|---|---|
| `05:51:40 UK` | `2026-05-12T04:51:40Z` | Rebound credited to Reaves (disputed) | T+0 |
| — | `2026-05-12T04:52:00Z` | Nearest Polymarket price tick (approx 49.5c–51c) | T+00:20 |
| — | `2026-05-12T04:52:18Z` | **Polymarket trade burst: 2 BUY Yes trades, 106.79 shares, ~$105.66 notional** | **T+00:38** |
| — | `2026-05-12T05:12:00Z` | Price drifts to ~51c | T+20:20 |
| — | `2026-05-12T05:26:04Z` | Decisive post-game move: 51c → 99.5c | T+34:24 |

**Classification:** High-priority isolated anomalous print. About 26% of the final reported market volume (~$410) traded at 99c while sampled prices stayed near 49.5c/51c. This is a market-structure anomaly even though it was not sustained immediate repricing.

**App coverage note:** Earlier session claimed "no useful signal" for this incident. Direct API inspection later found the market and trade data. Root cause: Polymarket source_market for this game was mapped to `nba-0042500223`, while Bet365 markets were mapped to `nba-0042500224`. A `WHERE game_id = 'nba-0042500224'` query returned empty even though 31,248 Polymarket data-api/trades rows existed under the sibling game ID.

### Incident B: Celtics at Heat, 2026-04-01/02 — Neemias Queta assist misallocation

| Field | Value |
|---|---|
| Game | Boston Celtics at Miami Heat |
| Date | 2026-04-01/02 |
| Incident time | `01:01:43 UK` — basket scored, assist not allocated; Queta subsequently credited |
| Correction time | `01:08:35 UK` — Queta updated with assist |
| Stat | Assists |

**External market signal:**

| Venue | Market | Finding |
|---|---|---|
| Kalshi | Neemias Queta assists | Not present for this game |
| Polymarket | Neemias Queta assists | Not present for this game |
| Polymarket | Neemias Queta points/rebounds | Present but flat in event window — not a direct assist signal |

**Classification:** Coverage absence. No external market existed for the specific disputed stat. Not evidence that markets ignored the event — simply a coverage gap on player-prop assist markets for Queta.

### Incident C: Thunder (game 5/7/26) — Cason Wallace rebound credited to Hartenstein

**Status:** Used as an evaluation label/intuition pump for the board-anomaly detector. No direct API forensics performed yet.

| Field | Value |
|---|---|
| Source | Twitter: `@PDemilord` (`https://x.com/PDemilord/status/2054919216877146254`) |
| Game | Thunder, 2026-05-07 |
| Incident | Q3 8:19 — rebound credited to Hartenstein (Isaiah Hartenstein), should have been Cason Wallace |
| Player pair | Cason Wallace (rightful) / Isaiah Hartenstein (credited) |
| External market status | Not yet analyzed; no direct API results in sessions |

### Incident D: Additional Twitter evaluation labels (not yet forensically analyzed)

These appeared in the 2026-05-15 session as evaluation labels for the detector:

| Source | Game/Date | Incident |
|---|---|---|
| `@nbastats`, tweet ~2026-05-07 | Unknown | `11:36 3Q C. Cunningham BLOCK (1 BLK)` — stat disputed |
| `@nba_elise`, tweet ~2026-05-07 | Unknown | `07:32 2Q M. Sasser REBOUND` — stat disputed |
| `@nbastatsman01`, tweet ~2026-05-07 | Unknown | `04:13 3Q C. LeVert driving finger roll Layup ... missing Daniss Jenkins assist` |

None of these have been analyzed against API data in any session found.

---

## 6. Raw Trading Emails

**Not present anywhere.** No directory, file, or session content contains raw trading email text, email archives, inbox exports, or email-like artifacts. This is explicitly stated to avoid any fabrication.

The closest approximation is the AGENTS.md codex rule file and TODO.md, which read like internal operational guidance written by someone who has been reviewing real incidents (specific timestamps, Twitter sources, direct API results), but these are agent instructions and working notes, not emails.

---

## 7. Summary of What Exists

| Location | What is there | Relevance |
|---|---|---|
| `.agent-memory-nexus/chunks.sqlite` | Code/doc/session chunk index; ~3,000 codex rollout chunks + 385 claude transcript chunks | Background context; no email or unique incident data beyond what is in other files |
| `~/.codex/projects/.../MEMORY.md` + `memory/` | One UI-preference note | Low — only browser-verification preference |
| `~/.codex/sessions/2026/05/` | Agent rollout transcripts (JSONL) | High — contains the full Reaves/Hayes forensic analysis, evaluation labels, and market reaction data |
| `~/.codex/projects/.../AGENTS.md` (via chunks.sqlite) | Market Incident Analysis Rules, Trader-First Purpose, Guardrails | High — the primary operational rules governing how stat-misallocation incidents are analyzed |
| `~/.claude/projects/.../memory/` | User profile, project context, session state, feedback | Medium — project context but no new incident facts |
| `/nba-predict/TODO.md` | Full incident case studies with exact timestamps | **Highest** — the primary artifact; contains all incident fact tables |

---

## 8. Canonical Source for Incident Case Studies

The file `/Users/davidmontgomery/nba-predict/TODO.md` is the most information-dense artifact. It was written during active incident review sessions and contains:

- Exact UTC and UK-local timestamps for the Reaves/Hayes rebound incident
- Exact Polymarket trade sizes, notionals, prices, and T-offsets
- Explicit venue-coverage results per incident (market exists vs. absent vs. coverage gap)
- The Queta assist incident with venue-coverage finding
- The Hartenstein/Cason Wallace, Cunningham, Sasser, and LeVert/Jenkins incidents as evaluation labels
- Product work backlog derived from the incident review (incident-window API, paired-player expansion, volume-share columns, venue-coverage diagnostics)
