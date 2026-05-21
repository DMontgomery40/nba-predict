import re, sqlite3
from collections import defaultdict

db = sqlite3.connect("data/signal-console.sqlite")
games = [
    r[0]
    for r in db.execute(
        "SELECT pbp.game_id FROM (SELECT DISTINCT game_id FROM nba_play_by_play_actions) pbp "
        "JOIN game_outcomes go ON go.game_id=pbp.game_id"
    ).fetchall()
]
errs = []
for gid in games:
    fh, fa = db.execute(
        "SELECT final_home_score, final_away_score FROM game_outcomes WHERE game_id=?",
        (gid,),
    ).fetchone()
    n_actions = db.execute(
        "SELECT COUNT(*) FROM nba_play_by_play_actions WHERE game_id=?", (gid,)
    ).fetchone()[0]
    rows = db.execute(
        "SELECT description FROM nba_play_by_play_actions WHERE game_id=? AND description LIKE '%PTS)%' ORDER BY action_number",
        (gid,),
    ).fetchall()
    pts = defaultdict(int)
    for (desc,) in rows:
        m = re.match(r"^([A-Z]\.?\s+[A-Za-z'\-\.]+?)\s.*\((\d+)\s+PTS\)", desc)
        if m:
            pts[m.group(1).strip()] = max(pts[m.group(1).strip()], int(m.group(2)))
    recon = sum(pts.values())
    final = fh + fa
    errs.append((abs(recon - final), recon, final, n_actions, gid))

errs.sort(reverse=True)
within2 = sum(1 for e in errs if e[0] <= 2)
print(f"reconciled (<=2): {within2}/{len(errs)}")
print("worst 12 (abs_err, recon, final, n_actions, gid):")
for e in errs[:12]:
    print("  ", e)
print("min n_actions among reconciled:", min(e[3] for e in errs if e[0] <= 2))
print("max n_actions among failed:", max((e[3] for e in errs if e[0] > 2), default=0))
