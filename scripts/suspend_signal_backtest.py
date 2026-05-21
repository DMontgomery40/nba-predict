#!/usr/bin/env python3
"""
Suspend-signal backtest.

Question: can prediction-market activity act as an EARLY tripwire that an NBA
player prop has gone bad (stat misallocation / correction)?

This script computes, to the second, three candidate signals per Polymarket
player-prop market and the lead-time between them. It needs NO incident labels
for the headline result (trade-tape vs sampled-price lead); labels only matter
for precision/recall, which we report as a census (noise floor) instead.

Signals (per player-prop instrument, Polymarket only — the only venue with a
trade tape in this store):
  S_price : first time the sampled price-history (quote_ticks.implied_probability)
            crosses from interior (0.15..0.85) to extreme (>=0.90 or <=0.10).
            This is the "naive price watcher" baseline.
  S_trade : first concentrated off-price print — a trade with volume_share>=THR_SHARE
            whose trade_price is >= THR_OFF away from the prevailing sampled price.
  S_board : (game-level) first 60s bucket whose cross-instrument repricing
            intensity exceeds a robust baseline (median + K*MAD).

Outputs JSON + a console summary. Read-only on the DB.
"""
import json, re, sqlite3, statistics, sys
from collections import defaultdict
from datetime import datetime

DB = "data/signal-console.sqlite"
THR_SHARE = 0.10      # concentrated print: >=10% of final market volume
THR_OFF   = 0.35      # off-price: trade_price this far from prevailing sampled price
LO, HI    = 0.15, 0.85   # interior band
EXT_HI, EXT_LO = 0.90, 0.10  # extreme band (resolution-like)
BUCKET = 60           # board bucket seconds
K_MAD = 6.0           # board threshold = median + K_MAD * MAD

def ts(s):
    # parse ISO8601 with optional fractional seconds and trailing Z
    if s is None: return None
    s = s.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s).timestamp()
    except ValueError:
        # tolerate variable fractional digit counts
        m = re.match(r"(.*\.\d{1,6})\d*(\+00:00)$", s)
        if m:
            return datetime.fromisoformat(m.group(1) + m.group(2)).timestamp()
        return None

def pctl(xs, p):
    if not xs: return None
    xs = sorted(xs); k = (len(xs)-1)*p; f = int(k)
    if f+1 < len(xs): return xs[f] + (xs[f+1]-xs[f])*(k-f)
    return xs[f]

def fmt_secs(x):
    if x is None: return "n/a"
    sign = "+" if x >= 0 else "-"
    x = abs(x); return f"{sign}{int(x//60)}m{int(x%60):02d}s"

def main():
    db = sqlite3.connect(DB)
    db.execute("PRAGMA busy_timeout=120000")
    cur = db.cursor()

    # microstructure games
    games = [r[0] for r in cur.execute(
        "SELECT DISTINCT game_id FROM market_microstructure_events").fetchall()]

    # player-prop instruments that have at least one trade, with their polymarket source_markets
    rows = cur.execute("""
        SELECT mi.id, mi.display_label, mi.game_id
        FROM market_instruments mi
        WHERE mi.family='player-prop'
          AND mi.id IN (SELECT DISTINCT instrument_id FROM market_microstructure_events
                        WHERE instrument_id IS NOT NULL AND event_type='trade')
    """).fetchall()
    instruments = {r[0]: {"label": r[1], "game_id": r[2]} for r in rows}

    # map instrument -> polymarket source_market ids
    sm = defaultdict(list)
    for iid, smid in cur.execute("""
        SELECT instrument_id, id FROM source_markets
        WHERE source='polymarket' AND instrument_id IS NOT NULL
    """).fetchall():
        sm[iid].append(smid)

    results = []
    leads = []          # S_price - S_trade  (positive => trade earlier)
    trade_only = 0      # markets with a concentrated off-price print but no price-history jump
    price_only = 0
    both = 0
    n_conc_prints_total = 0

    for iid, meta in instruments.items():
        smids = sm.get(iid, [])
        if not smids: continue
        ph = []
        qmarks = ",".join("?"*len(smids))
        for cap, ip in cur.execute(
            f"""SELECT captured_at, implied_probability FROM quote_ticks
                WHERE source_market_id IN ({qmarks}) AND implied_probability IS NOT NULL
                  AND is_heartbeat=0 ORDER BY captured_at""", smids).fetchall():
            t = ts(cap)
            if t is not None: ph.append((t, ip))
        trades = []
        for et, tp, vs, notion, size in cur.execute(
            """SELECT event_timestamp, trade_price, volume_share, notional, size
               FROM market_microstructure_events
               WHERE instrument_id=? AND event_type='trade' ORDER BY event_timestamp""",
            (iid,)).fetchall():
            t = ts(et)
            if t is not None: trades.append((t, tp, vs, notion, size))
        if not trades: continue

        # S_price: first interior->extreme crossing
        s_price = None; prev_interior = False
        for t, ip in ph:
            if LO <= ip <= HI: prev_interior = True
            elif prev_interior and (ip >= EXT_HI or ip <= EXT_LO):
                s_price = t; break

        # prevailing price lookup (last ph tick at/before t)
        def prevailing(t):
            lo, hi, best = 0, len(ph)-1, None
            while lo <= hi:
                mid = (lo+hi)//2
                if ph[mid][0] <= t: best = ph[mid][1]; lo = mid+1
                else: hi = mid-1
            return best

        # S_trade: first concentrated off-price print
        s_trade = None; s_trade_detail = None; conc = 0
        for t, tp, vs, notion, size in trades:
            if vs is not None and vs >= THR_SHARE:
                conc += 1
                pv = prevailing(t)
                off = abs(tp - pv) if (pv is not None and tp is not None) else None
                if s_trade is None and off is not None and off >= THR_OFF:
                    s_trade = t
                    s_trade_detail = {"price": tp, "prevailing": pv, "off": off,
                                      "vol_share": vs, "notional": notion, "size": size}
        n_conc_prints_total += conc

        lead = (s_price - s_trade) if (s_price is not None and s_trade is not None) else None
        if s_price is not None and s_trade is not None:
            both += 1; leads.append(lead)
        elif s_trade is not None: trade_only += 1
        elif s_price is not None: price_only += 1

        results.append({
            "instrument_id": iid, "label": meta["label"], "game_id": meta["game_id"],
            "n_price_ticks": len(ph), "n_trades": len(trades), "n_conc_prints": conc,
            "s_price_ts": s_price, "s_trade_ts": s_trade,
            "lead_trade_vs_price_s": lead, "trade_detail": s_trade_detail,
        })

    # ---- board signal per game (cross-instrument repricing intensity) ----
    board = {}
    for gid in games:
        # all polymarket player-prop ticks for this game's instruments
        iids = [iid for iid, m in instruments.items() if m["game_id"] == gid]
        if not iids: continue
        smids = [s for iid in iids for s in sm.get(iid, [])]
        if not smids: continue
        series = defaultdict(list)  # smid -> [(t, ip)]
        qmarks = ",".join("?"*len(smids))
        for smid, cap, ip in cur.execute(
            f"""SELECT source_market_id, captured_at, implied_probability FROM quote_ticks
                WHERE source_market_id IN ({qmarks}) AND implied_probability IS NOT NULL
                  AND is_heartbeat=0 ORDER BY captured_at""", smids).fetchall():
            t = ts(cap)
            if t is not None: series[smid].append((t, ip))
        # per-bucket sum of |delta| across instruments
        bucket_intensity = defaultdict(float)
        for smid, pts in series.items():
            for i in range(1, len(pts)):
                d = abs(pts[i][1] - pts[i-1][1])
                b = int(pts[i][0] // BUCKET) * BUCKET
                bucket_intensity[b] += d
        if len(bucket_intensity) < 5: continue
        vals = list(bucket_intensity.values())
        med = statistics.median(vals)
        mad = statistics.median([abs(v-med) for v in vals]) or 1e-9
        thr = med + K_MAD*mad
        fired = sorted([b for b, v in bucket_intensity.items() if v >= thr])
        board[gid] = {"s_board_ts": (fired[0] if fired else None),
                      "n_buckets": len(bucket_intensity), "thr": thr, "med": med}

    # board vs player (earliest off-price trade) per game
    earliest_trade = {}
    for r in results:
        if r["s_trade_ts"] is not None:
            g = r["game_id"]
            earliest_trade[g] = min(earliest_trade.get(g, 1e18), r["s_trade_ts"])

    board_vs_player = []
    for gid, b in board.items():
        if b["s_board_ts"] is not None and gid in earliest_trade:
            board_vs_player.append({
                "game_id": gid,
                "board_minus_trade_s": b["s_board_ts"] - earliest_trade[gid]})

    summary = {
        "params": {"THR_SHARE": THR_SHARE, "THR_OFF": THR_OFF, "BUCKET": BUCKET, "K_MAD": K_MAD},
        "n_instruments_with_trades": len(instruments),
        "n_instruments_analyzed": len(results),
        "n_conc_prints_total": n_conc_prints_total,
        "markets_both_signals": both,
        "markets_trade_only": trade_only,
        "markets_price_only": price_only,
        "lead_trade_vs_price_seconds": {
            "n": len(leads),
            "median": pctl(leads, 0.5), "p25": pctl(leads, 0.25), "p75": pctl(leads, 0.75),
            "min": min(leads) if leads else None, "max": max(leads) if leads else None,
            "frac_trade_earlier": (sum(1 for x in leads if x > 0)/len(leads)) if leads else None,
        },
        "board_vs_player_seconds": {
            "n": len(board_vs_player),
            "median": pctl([x["board_minus_trade_s"] for x in board_vs_player], 0.5),
            "frac_board_earlier": (sum(1 for x in board_vs_player if x["board_minus_trade_s"] < 0)/len(board_vs_player)) if board_vs_player else None,
        },
    }

    print(json.dumps(summary, indent=2, default=str))
    print("\n=== Lead distribution (trade tape leads naive price watcher) ===")
    print(f"N markets with both signals: {both}")
    if leads:
        print(f"median lead: {fmt_secs(summary['lead_trade_vs_price_seconds']['median'])}  "
              f"p25 {fmt_secs(summary['lead_trade_vs_price_seconds']['p25'])}  "
              f"p75 {fmt_secs(summary['lead_trade_vs_price_seconds']['p75'])}")
        print(f"frac where trade tape earlier: {summary['lead_trade_vs_price_seconds']['frac_trade_earlier']:.2%}")
    print("\n=== Top off-price-print markets (case-study candidates) ===")
    top = sorted([r for r in results if r["trade_detail"]],
                 key=lambda r: -(r["trade_detail"]["vol_share"] or 0))[:20]
    for r in top:
        d = r["trade_detail"]
        print(f"{r['game_id']} | {r['label']:42s} | share {d['vol_share']:.2%} @ {d['price']:.3f} "
              f"(prev {d['prevailing']:.3f}) lead {fmt_secs(r['lead_trade_vs_price_s'])}")

    out = {"summary": summary, "results": results, "board": board,
           "board_vs_player": board_vs_player}
    with open("outputs/innovation-team-suspend-signal-report/research/backtest-results.json", "w") as f:
        json.dump(out, f, default=str, indent=1)
    print("\nwrote backtest-results.json")

if __name__ == "__main__":
    main()
