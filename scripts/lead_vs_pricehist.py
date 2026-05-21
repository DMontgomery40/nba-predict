#!/usr/bin/env python3
"""
Corrected broad lead_vs_pricehist distribution (BAKEOFF_SHAPE.md Fix 4), computed
in isolation so it does not require the 64-game board recompute.

The trade-tape lane exists because the raw tape shows a decisive off-price move that the
sampled price-history (quote_ticks, Polymarket >=1-min candle cadence) reflects LATE or
NEVER (the prices-history structural lag, live-confirmed: "minimum 'fidelity' for '1m'
range is 10"). So the meaningful number is the CATCH-UP LAG:

  For each Polymarket instrument (18 trade-tape games) whose trade tape shows a decisive
  off-price move at t_tape (|trade_price - prevailing| >= MOVE), find the first sampled
  |delta implied_prob| >= MOVE at-or-after t_tape (the sampled series catching up). lag =
  t_sampled - t_tape (>= 0). If the sampled series never reflects the move inside the
  in-play window, count it as "tape-only" (the tape saw something the sampled series never
  showed -- itself a finding, and the reason a raw-tape lane is not redundant).

No future leakage: in-play window only (PBP MIN/MAX time_actual); sampled catch-up is
searched strictly at/after the tape event; 0.500 opening anchor dropped.
"""
import json, re, sqlite3, statistics
from collections import defaultdict
from datetime import datetime

DB="data/signal-console.sqlite"
OUT="outputs/innovation-team-suspend-signal-report/research/bakeoff-results.json"
MOVE=0.15

def ts(s):
    if s is None: return None
    s=s.replace("Z","+00:00")
    try: return datetime.fromisoformat(s).timestamp()
    except ValueError:
        m=re.match(r"(.*\.\d{1,6})\d*(\+00:00)$",s)
        return datetime.fromisoformat(m.group(1)+m.group(2)).timestamp() if m else None
def med(xs): return statistics.median(xs) if xs else None
def pctl(xs,p):
    if not xs: return None
    xs=sorted(xs); k=(len(xs)-1)*p; f=int(k)
    return round(xs[f]+(xs[f+1]-xs[f])*(k-f),1) if f+1<len(xs) else round(xs[f],1)

def main():
    db=sqlite3.connect(DB); db.execute("PRAGMA busy_timeout=120000"); cur=db.cursor()
    tg=[r[0] for r in cur.execute("SELECT DISTINCT game_id FROM market_microstructure_events").fetchall()]
    lags=[]; tape_only=0; n_inst=0
    for g in tg:
        lo,hi=cur.execute("SELECT MIN(time_actual),MAX(time_actual) FROM nba_play_by_play_actions WHERE game_id=?",(g,)).fetchone()
        t0w,t1w=ts(lo),ts(hi)
        if t0w is None: continue
        # tape: first decisive off-price move per instrument, in window
        trows=cur.execute("""SELECT instrument_id,event_timestamp,trade_price,previous_price
                             FROM market_microstructure_events
                             WHERE game_id=? AND event_type='trade' AND instrument_id IS NOT NULL
                               AND trade_price IS NOT NULL AND previous_price IS NOT NULL
                             ORDER BY event_timestamp""",(g,)).fetchall()
        t_tape={}
        for iid,etx,tp,pp in trows:
            if iid in t_tape: continue
            t=ts(etx)
            if t is None or t<t0w or t>t1w: continue
            if abs(tp-pp)>=MOVE: t_tape[iid]=t
        if not t_tape: continue
        # sampled series per instrument: ordered (t, ip)
        srows=cur.execute("""SELECT sm.instrument_id,q.captured_at,q.implied_probability
                             FROM quote_ticks q JOIN source_markets sm ON q.source_market_id=sm.id
                             WHERE sm.game_id=? AND q.is_heartbeat=0 AND q.implied_probability IS NOT NULL
                               AND sm.instrument_id IS NOT NULL
                             ORDER BY sm.instrument_id,q.captured_at""",(g,)).fetchall()
        ser=defaultdict(list)
        for iid,cap,ip in srows:
            if ip==0.5: continue
            t=ts(cap)
            if t is None or t<t0w or t>t1w: continue
            ser[iid].append((t,ip))
        for iid,tt in t_tape.items():
            n_inst+=1
            pts=ser.get(iid,[])
            caught=None
            for i in range(1,len(pts)):
                if pts[i][0] < tt: continue                      # at/after the tape move only
                if abs(pts[i][1]-pts[i-1][1])>=MOVE:
                    caught=pts[i][0]; break
            if caught is None: tape_only+=1
            else: lags.append(caught-tt)
    res={"n_instruments":n_inst,"n_caught_up":len(lags),"n_tape_only":tape_only,
         "catchup_lag_s":{"median":round(med(lags),1) if lags else None,
                          "p25":pctl(lags,0.25),"p75":pctl(lags,0.75)},
         "frac_tape_earlier":round((len([l for l in lags if l>0])+tape_only)/n_inst,3) if n_inst else None,
         "note":"per-Polymarket-instrument over 18 trade-tape games; lag = seconds until sampled price-history reflects a decisive off-price tape move; tape_only = sampled series never reflected it in the in-play window"}
    # patch the bakeoff JSON: top-level + the two trade-tape detector records
    d=json.load(open(OUT))
    d["lead_vs_pricehist"]=res
    for rec in d["detectors"]:
        if rec["detector"] in ("offprice-print",) or rec["detector"].startswith("ensemble-OR"):
            rec["lead_vs_pricehist"]=res
    json.dump(d,open(OUT,"w"),indent=1,default=str)
    print(json.dumps(res,indent=1))

if __name__=="__main__": main()
