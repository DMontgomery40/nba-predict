---
name: scripts
description: "Skill for the Scripts area of nba-predict. 77 symbols across 8 files."
---

# Scripts

77 symbols | 8 files | Cohesion: 92%

## When to Use

- Working with code in `scripts/`
- Understanding how ts, med, mad work
- Modifying scripts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/bakeoff.py` | ts, med, mad, pctl, main (+11) |
| `scripts/temporary-auth-proxy.mjs` | sendLoginForm, sendAuthChallenge, readRequestBody, handleLogin, isApiPath (+10) |
| `scripts/render_universal_source_trust_report.ts` | esc, f3, f2, pct, intc (+9) |
| `scripts/build_universal_source_trust_report.ts` | newCell, cellKey, serializeCells, pushPp, headToHead (+9) |
| `scripts/board_signal_v2.py` | ts, iso, pctl, mad, build_board (+3) |
| `scripts/suspend_signal_backtest.py` | ts, pctl, fmt_secs, main, prevailing |
| `scripts/lead_vs_pricehist.py` | ts, med, pctl, main |
| `packages/shared/src/source-trust/metrics.ts` | summarizeSettled |

## Entry Points

Start here when exploring this area:

- **`ts`** (Function) — `scripts/bakeoff.py:42`
- **`med`** (Function) — `scripts/bakeoff.py:51`
- **`mad`** (Function) — `scripts/bakeoff.py:52`
- **`pctl`** (Function) — `scripts/bakeoff.py:55`
- **`main`** (Function) — `scripts/bakeoff.py:60`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ts` | Function | `scripts/bakeoff.py` | 42 |
| `med` | Function | `scripts/bakeoff.py` | 51 |
| `mad` | Function | `scripts/bakeoff.py` | 52 |
| `pctl` | Function | `scripts/bakeoff.py` | 55 |
| `main` | Function | `scripts/bakeoff.py` | 60 |
| `game_series` | Function | `scripts/bakeoff.py` | 72 |
| `board_fires` | Function | `scripts/bakeoff.py` | 104 |
| `fp_density` | Function | `scripts/bakeoff.py` | 113 |
| `board_incident` | Function | `scripts/bakeoff.py` | 123 |
| `offprice_incident` | Function | `scripts/bakeoff.py` | 181 |
| `offprice_fp` | Function | `scripts/bakeoff.py` | 197 |
| `lead_vs_pricehist` | Function | `scripts/bakeoff.py` | 215 |
| `ts` | Function | `scripts/board_signal_v2.py` | 48 |
| `iso` | Function | `scripts/board_signal_v2.py` | 61 |
| `pctl` | Function | `scripts/board_signal_v2.py` | 67 |
| `mad` | Function | `scripts/board_signal_v2.py` | 78 |
| `build_board` | Function | `scripts/board_signal_v2.py` | 85 |
| `first_fire` | Function | `scripts/board_signal_v2.py` | 121 |
| `main` | Function | `scripts/board_signal_v2.py` | 142 |
| `fire_after` | Function | `scripts/board_signal_v2.py` | 192 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Server → EmptyStatLine` | cross_community | 5 |
| `Main → Med` | intra_community | 4 |
| `Main → Mad` | intra_community | 4 |
| `Server → ParseCookies` | cross_community | 4 |
| `Server → ConstantTimeMatches` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Source-trust | 3 calls |

## How to Explore

1. `gitnexus_context({name: "ts"})` — see callers and callees
2. `gitnexus_query({query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
