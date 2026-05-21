#!/usr/bin/env python3
"""
Board-state-volatility signal v2 — the PRIMARY suspend-signal hypothesis.

Fixes over scripts/suspend_signal_backtest.py (v1):
  - Universe = ALL 64 PBP games (not the 18 trade-instrumented games).
  - Board aggregate spans ALL families for the game (player-prop, team-prop,
    total, spread, moneyline, other) via source_markets.game_id — not just
    player-props that happened to have a trade.
  - In-play window per game derived from nba_play_by_play_actions.time_actual
    (MIN/MAX); every signal restricted to that window (kills the +-47h artifact).
  - Sanitize: drop is_heartbeat, drop implied_probability exactly 0.500 (the
    Polymarket opening anchor), cap stale deltas (gap > FRESH_CAP seconds).
  - Causal, phase-adaptive baseline: trailing-window median + K*MAD over the
    PRIOR W buckets only (no future leakage), so quarter/halftime regime shifts
    are absorbed instead of dominating a single global threshold.
  - Two aggregates computed and compared: EQUAL-weight (every quoted instrument
    counts the same) and VOLUME-weight (|delta| weighted by log1p(tick volume),
    closer to trader exposure; thin team/quarter churn is down-weighted).

Outputs distributions + a false-positive census (board fire-rate per in-play
minute across all games) and incident anchoring for the two PBP-confirmed
misallocation events. Read-only on the DB.
"""
import json, re, sqlite3, statistics
from collections import defaultdict
from datetime import datetime, timezone

DB = "data/signal-console.sqlite"
BUCKET = 60          # board bucket seconds
FRESH_CAP = 300      # ignore a per-market delta if the gap to prior tick > this
W = 20               # trailing baseline window (buckets)
K_MAD = 6.0          # fire threshold = trailing median + K_MAD * trailing MAD
WARMUP = 8           # need this many prior buckets before we will fire

# PBP-confirmed misallocation anchors (event_time UTC, game played).
# Reaves rebound is filed under 223 (Polymarket) / 224 (PBP) per the known
# back-to-back game_id mapping bug; we evaluate the board on both ids.
INCIDENTS = [
    {"name": "Reaves/Hayes rebound", "pbp_game": "nba-0042500224",
     "board_games": ["nba-0042500224", "nba-0042500223"],
     "event": "2026-05-12T04:51:40.2Z"},
    {"name": "Hartenstein/C.Wallace rebound", "pbp_game": "nba-0042500222",
     "board_games": ["nba-0042500222"],
     "event": "2026-05-08T03:12:36.8Z"},
]


def ts(s):
    if s is None:
        return None
    s = s.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s).timestamp()
    except ValueError:
        m = re.match(r"(.*\.\d{1,6})\d*(\+00:00)$", s)
        if m:
            return datetime.fromisoformat(m.group(1) + m.group(2)).timestamp()
        return None


def iso(t):
    if t is None:
        return None
    return datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def pctl(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    f = int(k)
    if f + 1 < len(xs):
        return xs[f] + (xs[f + 1] - xs[f]) * (k - f)
    return xs[f]


def mad(xs):
    if not xs:
        return 0.0
    m = statistics.median(xs)
    return statistics.median([abs(x - m) for x in xs])


def build_board(cur, game_id, t0, t1):
    """Return {bucket_start -> (eq_intensity, vw_intensity)} for in-play window."""
    rows = cur.execute(
        """SELECT q.source_market_id, q.captured_at, q.implied_probability, q.volume
           FROM quote_ticks q
           WHERE q.source_market_id IN (SELECT id FROM source_markets WHERE game_id=?)
             AND q.is_heartbeat=0 AND q.implied_probability IS NOT NULL
           ORDER BY q.source_market_id, q.captured_at""",
        (game_id,)).fetchall()
    series = defaultdict(list)
    for smid, cap, ip, vol in rows:
        if ip == 0.5:            # opening-anchor placeholder
            continue
        t = ts(cap)
        if t is None or t < t0 or t > t1:
            continue
        series[smid].append((t, ip, vol or 0.0))
    eq = defaultdict(float)
    vw = defaultdict(float)
    n_markets = len(series)
    for smid, pts in series.items():
        for i in range(1, len(pts)):
            gap = pts[i][0] - pts[i - 1][0]
            if gap <= 0 or gap > FRESH_CAP:
                continue
            d = abs(pts[i][1] - pts[i - 1][1])
            if d == 0:
                continue
            b = int(pts[i][0] // BUCKET) * BUCKET
            eq[b] += d
            # log-volume weight; thin churn down-weighted
            import math
            vw[b] += d * math.log1p(pts[i][2])
    return eq, vw, n_markets


def first_fire(intensity):
    """Causal trailing-baseline fire detection. Returns (first_fire_bucket,
    n_fires, n_buckets, fire_rate)."""
    if len(intensity) < WARMUP + 1:
        return None, 0, len(intensity), None
    buckets = sorted(intensity.keys())
    vals = [intensity[b] for b in buckets]
    fires = []
    for i in range(len(buckets)):
        if i < WARMUP:
            continue
        window = vals[max(0, i - W):i]
        med = statistics.median(window)
        m = mad(window) or 1e-9
        thr = med + K_MAD * m
        if vals[i] >= thr and vals[i] > 0:
            fires.append(buckets[i])
    n_b = len(buckets)
    return (fires[0] if fires else None), len(fires), n_b, (len(fires) / n_b if n_b else None)


def main():
    db = sqlite3.connect(DB)
    db.execute("PRAGMA busy_timeout=120000")
    cur = db.cursor()

    games = [r[0] for r in cur.execute(
        "SELECT DISTINCT game_id FROM nba_play_by_play_actions").fetchall()]
    windows = {}
    for g in games:
        lo, hi = cur.execute(
            "SELECT MIN(time_actual), MAX(time_actual) FROM nba_play_by_play_actions WHERE game_id=?",
            (g,)).fetchone()
        windows[g] = (ts(lo), ts(hi))

    per_game = []
    fire_rates_eq = []
    fire_rates_vw = []
    for g in games:
        t0, t1 = windows[g]
        if t0 is None or t1 is None:
            continue
        eq, vw, n_markets = build_board(cur, g, t0, t1)
        ff_eq, nf_eq, nb_eq, fr_eq = first_fire(eq)
        ff_vw, nf_vw, nb_vw, fr_vw = first_fire(vw)
        per_game.append({
            "game_id": g, "n_markets": n_markets,
            "inplay_min": iso(t0), "inplay_max": iso(t1),
            "dur_min": round((t1 - t0) / 60, 1) if (t0 and t1) else None,
            "eq": {"n_buckets": nb_eq, "n_fires": nf_eq, "fire_rate": fr_eq, "first_fire": iso(ff_eq)},
            "vw": {"n_buckets": nb_vw, "n_fires": nf_vw, "fire_rate": fr_vw, "first_fire": iso(ff_vw)},
        })
        if fr_eq is not None:
            fire_rates_eq.append(fr_eq)
        if fr_vw is not None:
            fire_rates_vw.append(fr_vw)
        print(f"{g} | mkts {n_markets:4d} | dur {per_game[-1]['dur_min']!s:>6} min "
              f"| EQ fires {nf_eq:3d}/{nb_eq:3d} rate {fr_eq if fr_eq is None else round(fr_eq,3)} "
              f"| VW fires {nf_vw:3d}/{nb_vw:3d}")

    # ---- Incident anchoring ----
    incident_results = []
    for inc in INCIDENTS:
        ev = ts(inc["event"])
        for bg in inc["board_games"]:
            # use the PBP game's in-play window for the board (event is within it)
            w = windows.get(inc["pbp_game"])
            if not w or w[0] is None:
                continue
            eq, vw, n_markets = build_board(cur, bg, w[0], w[1])
            # first fire AT OR AFTER the event (causal: what a live watcher sees)
            def fire_after(intensity, ev):
                if len(intensity) < WARMUP + 1:
                    return None
                buckets = sorted(intensity.keys())
                vals = [intensity[b] for b in buckets]
                for i in range(WARMUP, len(buckets)):
                    window = vals[max(0, i - W):i]
                    med = statistics.median(window)
                    m = mad(window) or 1e-9
                    if vals[i] >= med + K_MAD * m and vals[i] > 0 and buckets[i] >= ev - BUCKET:
                        return buckets[i]
                return None
            f_eq = fire_after(eq, ev)
            f_vw = fire_after(vw, ev)
            incident_results.append({
                "incident": inc["name"], "board_game": bg, "n_markets": n_markets,
                "event": inc["event"],
                "board_fire_eq": iso(f_eq),
                "board_fire_eq_lead_s": (f_eq - ev) if f_eq else None,
                "board_fire_vw": iso(f_vw),
                "board_fire_vw_lead_s": (f_vw - ev) if f_vw else None,
            })

    summary = {
        "params": {"BUCKET": BUCKET, "FRESH_CAP": FRESH_CAP, "W": W, "K_MAD": K_MAD, "WARMUP": WARMUP},
        "n_games": len([p for p in per_game if p["eq"]["fire_rate"] is not None]),
        "fp_census_eq": {
            "median_fire_rate": pctl(fire_rates_eq, 0.5),
            "p25": pctl(fire_rates_eq, 0.25), "p75": pctl(fire_rates_eq, 0.75),
            "max": max(fire_rates_eq) if fire_rates_eq else None,
            "mean_fires_per_game": statistics.mean([p["eq"]["n_fires"] for p in per_game]) if per_game else None,
        },
        "fp_census_vw": {
            "median_fire_rate": pctl(fire_rates_vw, 0.5),
            "p25": pctl(fire_rates_vw, 0.25), "p75": pctl(fire_rates_vw, 0.75),
            "max": max(fire_rates_vw) if fire_rates_vw else None,
            "mean_fires_per_game": statistics.mean([p["vw"]["n_fires"] for p in per_game]) if per_game else None,
        },
        "incidents": incident_results,
    }
    print("\n=== SUMMARY ===")
    print(json.dumps(summary, indent=2, default=str))
    out = {"summary": summary, "per_game": per_game}
    with open("outputs/innovation-team-suspend-signal-report/research/board-signal-v2.json", "w") as f:
        json.dump(out, f, default=str, indent=1)
    print("\nwrote board-signal-v2.json")


if __name__ == "__main__":
    main()
