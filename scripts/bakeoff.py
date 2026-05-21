#!/usr/bin/env python3
"""
Signal bake-off — Phase 2 "find the best signal" experiment.

Compares candidate suspend-signal detectors on the locked output shape
(research/BAKEOFF_SHAPE.md). Pre-committed "best" metric = lead-time at a fixed,
desk-tolerable false-positive rate. Read-only on the 52GB store.

Detectors:
  board-eq / board-vw : whole-board game-state volatility (sampled quote_ticks),
                        equal- and volume-weighted, causal trailing baseline.
  exact-prop          : the disputed prop's own sampled price crossing interior->extreme.
  paired-player       : earliest big sampled move across credited+rightful cluster.
  offprice-print      : concentrated off-price trade-tape print (Polymarket, 18 games).
  ensemble-OR         : board-eq OR offprice-print fires.

For each detector we report, per labeled incident: caught? (within [T0-60s,T0+300s])
and detection-confirmed lead vs T0. Plus a broad false-positive density (fires per
in-play minute) so detectors are comparable at a common operating point.
"""
import json, re, sqlite3, statistics, math
from collections import defaultdict
from datetime import datetime, timezone

DB = "data/signal-console.sqlite"
BUCKET = 60; FRESH_CAP = 300; W = 20; WARMUP = 8
K_SWEEP = [3.0, 4.0, 5.0, 6.0, 8.0]
# Detection windows around T0 (s). FIX 2: bucketed board may use [-60,+300] because a
# 60s bucket-START legitimately precedes the event it contains; point detectors
# (exact-prop / paired / off-price trade prints) must use [0,+300] -- a pre-event move
# is noise, not a catch.
CATCH_LO, CATCH_HI = -60, 300        # board (bucketed)
POINT_LO = 0                         # point detectors: at/after the event only
# exact/paired sampled-price move thresholds
EXACT_LO, EXACT_HI, EXT_HI, EXT_LO = 0.15, 0.85, 0.90, 0.10
PAIR_DELTA = 0.12                    # "big" sampled move for cluster cascade
# offprice: FIX 1 -- volume_share gate AND an off-price-DISTANCE gate
# (|trade_price - prevailing| >= THR_OFF) so ordinary near-certainty prints
# (e.g. a 0.99 print when the prevailing price is already ~0.99) do not count.
THR_SHARE, THR_OFF = 0.10, 0.35
PH_MOVE = 0.15                       # decisive move threshold for lead_vs_pricehist

def ts(s):
    if s is None: return None
    s = s.replace("Z", "+00:00")
    try: return datetime.fromisoformat(s).timestamp()
    except ValueError:
        m = re.match(r"(.*\.\d{1,6})\d*(\+00:00)$", s)
        return datetime.fromisoformat(m.group(1)+m.group(2)).timestamp() if m else None

def iso(t): return None if t is None else datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
def med(xs): return statistics.median(xs) if xs else 0.0
def mad(xs):
    if not xs: return 0.0
    m=statistics.median(xs); return statistics.median([abs(x-m) for x in xs])
def pctl(xs,p):
    if not xs: return None
    xs=sorted(xs); k=(len(xs)-1)*p; f=int(k)
    return xs[f]+(xs[f+1]-xs[f])*(k-f) if f+1<len(xs) else xs[f]

def main():
    db = sqlite3.connect(DB); db.execute("PRAGMA busy_timeout=120000"); cur=db.cursor()
    labels = json.load(open("outputs/innovation-team-suspend-signal-report/research/labels.json"))
    incidents = [i for i in labels["incidents"] if i.get("second_anchorable")]

    games = [r[0] for r in cur.execute("SELECT DISTINCT game_id FROM nba_play_by_play_actions").fetchall()]
    windows={}
    for g in games:
        lo,hi=cur.execute("SELECT MIN(time_actual),MAX(time_actual) FROM nba_play_by_play_actions WHERE game_id=?",(g,)).fetchone()
        windows[g]=(ts(lo),ts(hi))

    # ---- cache each game's board buckets (eq+vw) and per-market sampled series ----
    def game_series(g):
        t0,t1=windows[g]
        if t0 is None: return {},{},0,{}
        rows=cur.execute("""SELECT q.source_market_id,q.captured_at,q.implied_probability,q.volume,
                                   mi.display_label, mi.family
                            FROM quote_ticks q JOIN source_markets sm ON q.source_market_id=sm.id
                            LEFT JOIN market_instruments mi ON sm.instrument_id=mi.id
                            WHERE sm.game_id=? AND q.is_heartbeat=0 AND q.implied_probability IS NOT NULL
                            ORDER BY q.source_market_id,q.captured_at""",(g,)).fetchall()
        series=defaultdict(list); labelmap={}
        for smid,cap,ip,vol,lab,fam in rows:
            if ip==0.5: continue
            t=ts(cap)
            if t is None or t<t0 or t>t1: continue
            series[smid].append((t,ip,vol or 0.0)); labelmap[smid]=(lab or "",fam or "")
        eq=defaultdict(float); vw=defaultdict(float)
        for smid,pts in series.items():
            for i in range(1,len(pts)):
                gap=pts[i][0]-pts[i-1][0]
                if gap<=0 or gap>FRESH_CAP: continue
                d=abs(pts[i][1]-pts[i-1][1])
                if d==0: continue
                b=int(pts[i][0]//BUCKET)*BUCKET
                eq[b]+=d; vw[b]+=d*math.log1p(pts[i][2])
        return eq,vw,len(series),(series,labelmap)

    boards={}; seriescache={}
    for g in games:
        eq,vw,nm,sc=game_series(g)
        boards[g]=(eq,vw,nm); seriescache[g]=sc

    # board fire times for a game at threshold K (causal trailing). returns sorted fire bucket-STARTS
    def board_fires(intensity,K):
        if len(intensity)<WARMUP+1: return []
        bs=sorted(intensity); vals=[intensity[b] for b in bs]; fires=[]
        for i in range(WARMUP,len(bs)):
            win=vals[max(0,i-W):i]
            if vals[i]>=med(win)+K*(mad(win) or 1e-9) and vals[i]>0: fires.append(bs[i])
        return fires

    # ---- broad FP density (fires per in-play minute) for board detectors at each K ----
    def fp_density(which,K):
        tot_fires=0; tot_min=0.0
        for g in games:
            eq,vw,nm=boards[g]; inten = eq if which=="eq" else vw
            t0,t1=windows[g]
            if t0 is None or not inten: continue
            tot_fires+=len(board_fires(inten,K)); tot_min+=(t1-t0)/60.0
        return tot_fires/tot_min if tot_min else None

    # ---- per-incident board catch/lead ----
    def board_incident(inc,which,K):
        leads=[]
        for bg in inc["board_games"]:
            eq,vw,nm=boards.get(bg,({},{},0)); inten= eq if which=="eq" else vw
            if not inten: continue
            T0=ts(inc["t0"])
            for b in board_fires(inten,K):
                conf=b+BUCKET  # bucket-end = causal confirm time
                if CATCH_LO<=(b-T0)<=CATCH_HI:    # fire bucket overlaps window
                    leads.append(conf-T0); break
        return min(leads) if leads else None

    # ---- exact-prop / paired-player on sampled series ----
    def crossing_after(series,smids,T0,extreme=True):
        best=None
        for smid in smids:
            pts=series.get(smid,[]); prev_int=False
            for t,ip,_ in pts:
                if extreme:
                    if EXACT_LO<=ip<=EXACT_HI: prev_int=True
                    elif prev_int and (ip>=EXT_HI or ip<=EXT_LO) and t>=T0+POINT_LO:
                        best=min(best,t) if best else t; break
            # paired uses big-delta instead
        return best
    def bigmove_after(series,smids,T0):
        best=None
        for smid in smids:
            pts=series.get(smid,[])
            for i in range(1,len(pts)):
                if pts[i][0]<T0+POINT_LO: continue
                if abs(pts[i][1]-pts[i-1][1])>=PAIR_DELTA:
                    best=min(best,pts[i][0]) if best else pts[i][0]; break
        return best
    def player_smids(series,labelmap,names):
        out=[]
        for smid,(lab,fam) in labelmap.items():
            if any(n.split('.')[-1].strip() in lab for n in names): out.append(smid)
        return out

    def exact_paired_incident(inc,mode):
        res=None
        for bg in inc["board_games"]:
            series,labelmap=seriescache.get(bg,({},{})); T0=ts(inc["t0"])
            if mode=="exact":
                names=[inc.get("credited") or "", inc.get("rightful") or ""]
                # exact = the disputed STAT prop for credited player
                smids=[s for s in player_smids(series,labelmap,[n for n in names if n])
                       if inc["stat"][:4] in labelmap[s][0].lower()]
                got=crossing_after(series,smids,T0)
            else:
                names=[n for n in [inc.get("credited"),inc.get("rightful")] if n]
                smids=player_smids(series,labelmap,names)
                got=bigmove_after(series,smids,T0)
            if got and POINT_LO<=(got-T0)<=CATCH_HI:
                res=min(res,got-T0) if res else (got-T0)
        return res

    # ---- offprice-print (trade tape) ----
    def offprice_incident(inc):
        T0=ts(inc["t0"]); best=None
        bgs=set(inc["board_games"]+([inc["trade_game"]] if inc.get("trade_game") else []))
        for bg in bgs:
            rows=cur.execute("""SELECT event_timestamp,trade_price,previous_price,volume_share
                                FROM market_microstructure_events
                                WHERE game_id=? AND event_type='trade' ORDER BY event_timestamp""",(bg,)).fetchall()
            for etx,tp,pp,vs in rows:
                t=ts(etx)
                if t is None or not (T0+POINT_LO<=t<=T0+CATCH_HI): continue   # FIX 2: [0,+300]
                # FIX 1: volume_share gate AND off-price distance gate vs prevailing price
                if (vs is not None and vs>=THR_SHARE
                        and tp is not None and pp is not None and abs(tp-pp)>=THR_OFF):
                    best=min(best,t-T0) if best is not None else (t-T0); break
        return best
    # offprice FP density across the 18 trade-tape games (FIX 1: same gated definition)
    def offprice_fp():
        tg=[r[0] for r in cur.execute("SELECT DISTINCT game_id FROM market_microstructure_events").fetchall()]
        fires=0; mins=0.0
        for g in tg:
            n=cur.execute("""SELECT COUNT(*) FROM market_microstructure_events
                             WHERE game_id=? AND event_type='trade' AND volume_share>=?
                               AND previous_price IS NOT NULL AND trade_price IS NOT NULL
                               AND ABS(trade_price-previous_price)>=?""",(g,THR_SHARE,THR_OFF)).fetchone()[0]
            fires+=n
            w=windows.get(g)
            if w and w[0]: mins+=(w[1]-w[0])/60.0
        return fires/mins if mins else None

    # ---- lead_vs_pricehist: broad trade-tape-vs-sampled-price distribution (FIX 4) ----
    # The statistically meaningful n: across the 18 trade-tape games, per market, how many
    # seconds does the raw trade tape lead the naive sampled-price-history watcher? Both
    # detected by the same decisive-move rule (>=PH_MOVE), no-future-leakage (in-play window,
    # last-tick-at-or-before). Positive lead = trade tape earlier than sampled price.
    def lead_vs_pricehist():
        tg=[r[0] for r in cur.execute("SELECT DISTINCT game_id FROM market_microstructure_events").fetchall()]
        leads=[]; earlier=0; n=0
        for g in tg:
            w=windows.get(g)
            if not w or w[0] is None: continue
            t0w,t1w=w
            # trade tape: first decisive off-price move per instrument
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
                if abs(tp-pp)>=PH_MOVE: t_tape[iid]=t
            if not t_tape: continue
            # sampled price: first decisive |Δ implied_prob| per instrument from quote_ticks
            srows=cur.execute("""SELECT sm.instrument_id,q.captured_at,q.implied_probability
                                 FROM quote_ticks q JOIN source_markets sm ON q.source_market_id=sm.id
                                 WHERE sm.game_id=? AND q.is_heartbeat=0 AND q.implied_probability IS NOT NULL
                                   AND sm.instrument_id IS NOT NULL
                                 ORDER BY sm.instrument_id,q.captured_at""",(g,)).fetchall()
            prev={}; t_price={}
            for iid,cap,ip in srows:
                if iid in t_price or ip==0.5: continue
                t=ts(cap)
                if t is None or t<t0w or t>t1w: continue
                if iid in prev and abs(ip-prev[iid])>=PH_MOVE: t_price[iid]=t
                prev[iid]=ip
            for iid,tt in t_tape.items():
                tp_=t_price.get(iid)
                if tp_ is None: continue
                lead=tp_-tt        # sampled catches up later => positive lead for the tape
                leads.append(lead); n+=1
                if tt<tp_: earlier+=1
        if not leads: return None
        return {"n":n,"median":round(med(leads),1),"p25":round(pctl(leads,0.25),1),
                "p75":round(pctl(leads,0.75),1),"frac_earlier":round(earlier/n,3)}
    PRICEHIST=lead_vs_pricehist()

    # ---- assemble results ----
    out=[]
    inc_ids=[i["id"] for i in incidents]
    # board detectors swept over K
    for which,name in [("eq","board-eq"),("vw","board-vw")]:
        for K in K_SWEEP:
            per={i["id"]: board_incident(i,which,K) for i in incidents}
            caught=sum(1 for v in per.values() if v is not None)
            out.append({"detector":name,"K":K,"fp_fires_per_inplay_min":round(fp_density(which,K),4),
                        "frac_incidents_caught":round(caught/len(incidents),3),"n_incidents":len(incidents),
                        "per_incident_lead_s":{k:(round(v,1) if v is not None else None) for k,v in per.items()},
                        "lead_vs_pricehist":None})
    # exact-prop, paired-player, offprice (single config each)
    per_exact={i["id"]:exact_paired_incident(i,"exact") for i in incidents}
    per_pair ={i["id"]:exact_paired_incident(i,"paired") for i in incidents}
    per_off  ={i["id"]:offprice_incident(i) for i in incidents}
    OFFPRICE_FP=offprice_fp()
    for nm,per,fp,ph in [("exact-prop",per_exact,None,None),("paired-player",per_pair,None,None),
                         ("offprice-print",per_off,OFFPRICE_FP,PRICEHIST)]:
        caught=sum(1 for v in per.values() if v is not None)
        out.append({"detector":nm,"K":None,"fp_fires_per_inplay_min":(round(fp,4) if fp else None),
                    "frac_incidents_caught":round(caught/len(incidents),3),"n_incidents":len(incidents),
                    "per_incident_lead_s":{k:(round(v,1) if v is not None else None) for k,v in per.items()},
                    "lead_vs_pricehist":ph})
    # ensemble-OR: combine the RECOMMENDED board lane (board-vw @ K=3) with the off-price lane.
    # An OR-ensemble must dominate its components (fire when EITHER fires), so it cannot be slower
    # or catch fewer than its best lane. Using the weak eq@6 board here produced an ensemble that
    # looked worse than board-vw@3 alone -- a logical contradiction. FIX 3: ensemble FP = the SUM
    # of the two lanes' densities (either lane firing is a fire).
    K=3.0; per_ens={}
    for i in incidents:
        a=board_incident(i,"vw",K); b=per_off[i["id"]]
        cands=[x for x in (a,b) if x is not None]
        per_ens[i["id"]]=min(cands) if cands else None
    caught=sum(1 for v in per_ens.values() if v is not None)
    ens_fp=round(fp_density("vw",3.0)+(OFFPRICE_FP or 0.0),4)
    out.append({"detector":"ensemble-OR(board-vw@3,offprice)","K":3.0,
                "fp_fires_per_inplay_min":ens_fp,
                "frac_incidents_caught":round(caught/len(incidents),3),"n_incidents":len(incidents),
                "per_incident_lead_s":{k:(round(v,1) if v is not None else None) for k,v in per_ens.items()},
                "lead_vs_pricehist":PRICEHIST})

    res={"incidents":inc_ids,"detectors":out,"lead_vs_pricehist":PRICEHIST}
    json.dump(res,open("outputs/innovation-team-suspend-signal-report/research/bakeoff-results.json","w"),indent=1,default=str)
    print("INCIDENTS:",inc_ids)
    print("LEAD_VS_PRICEHIST:",PRICEHIST)
    print(f"{'detector':<34}{'K':>4}{'FP/min':>9}{'caught':>8}   per-incident lead(s)")
    for d in out:
        leads=" ".join(f"{k.split('_')[0][:5]}={d['per_incident_lead_s'][k]}" for k in inc_ids)
        print(f"{d['detector']:<34}{str(d['K']):>4}{str(d['fp_fires_per_inplay_min']):>9}{d['frac_incidents_caught']:>8}   {leads}")
    print("\nwrote bakeoff-results.json")

if __name__=="__main__": main()
