import re, sqlite3
from collections import defaultdict

db = sqlite3.connect("data/signal-console.sqlite")
games = db.execute(
    "SELECT pbp.game_id FROM (SELECT DISTINCT game_id FROM nba_play_by_play_actions) pbp "
    "JOIN game_outcomes go ON go.game_id=pbp.game_id ORDER BY pbp.game_id LIMIT 5"
).fetchall()

for (gid,) in games:
    fh, fa, wk = db.execute(
        "SELECT final_home_score, final_away_score, winner_key FROM game_outcomes WHERE game_id=?",
        (gid,),
    ).fetchone()
    rows = db.execute(
        "SELECT description FROM nba_play_by_play_actions WHERE game_id=? AND description LIKE '%PTS)%' ORDER BY action_number",
        (gid,),
    ).fetchall()
    pts = defaultdict(int)
    for (desc,) in rows:
        m = re.match(r"^([A-Z]\.?\s?[A-Za-z'\-\.]+?)\s.*\((\d+)\s+PTS\)", desc)
        if m:
            pts[m.group(1).strip()] = max(pts[m.group(1).strip()], int(m.group(2)))
    total = sum(pts.values())
    print(f"{gid} final={fh}+{fa}={fh+fa} reconstructed={total} players={len(pts)}")
    top = sorted(pts.items(), key=lambda x: -x[1])[:3]
    print("   top:", top)
