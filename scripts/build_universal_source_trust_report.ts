/**
 * Universal Source Trust Report — offline builder.
 *
 * Answers, across all persisted live quotes (Feb–May 2026 playoff window): which
 * sources tend to be right earlier vs later, and how that changes across game
 * markets, broad props, and specifically player props — for a Bet365 trader
 * deciding what to trust more, less, or only in certain contexts.
 *
 * Honest separation:
 *   - SETTLED ACCURACY (Brier/log-loss/accuracy/calibration) is computed only
 *     where deterministic truth exists: full-game moneyline/spread/total from
 *     game_outcomes final scores, and player props from play-by-play stat
 *     reconstruction (validated per game against the final score).
 *   - Everything else (timing, leadership, reaction) is reported as such, never
 *     as "rightness".
 *
 * Run:
 *   SIGNAL_CONSOLE_DB_PATH=$PWD/data/signal-console.sqlite \
 *     node_modules/.bin/tsx scripts/build_universal_source_trust_report.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import Database from "better-sqlite3";

import {
  clampProbability,
  isPeriodMarket,
  matchPbpNameToParticipant,
  normalizeStatFamily,
  reconstructStatsFromPbp,
  settleMoneyline,
  settleSpread,
  settleStatLine,
  settleTotal,
  statForFamily,
  summarizeSettled,
  SETTLEABLE_FAMILIES,
  type PbpStatLine,
  type SettledSample,
  type StatFamily,
} from "../packages/shared/src/source-trust/metrics";
import { getSignalQualityReport } from "../packages/shared/src/signal-quality";

const dbPath = process.env.SIGNAL_CONSOLE_DB_PATH;
if (!dbPath) throw new Error("set SIGNAL_CONSOLE_DB_PATH to the live db");
const OUT_DIR = resolve(process.cwd(), "outputs/universal-source-trust-report");
const QUERY_DIR = resolve(OUT_DIR, "queries");
mkdirSync(QUERY_DIR, { recursive: true });

const db = new Database(dbPath, { readonly: true });
db.pragma("cache_size = -200000");
db.pragma("temp_store = MEMORY");
db.pragma("mmap_size = 4000000000");

const log = (m: string) => console.log(`[${new Date().toISOString()}] ${m}`);
const SOURCES = ["bet365", "kalshi", "polymarket"] as const;
type Source = (typeof SOURCES)[number];

// Freshness caps (seconds) per checkpoint: a quote older than this at the
// anchor is treated as stale and excluded, and counted separately so coverage
// is never hidden behind a least-frequently-updating source.
const FRESHNESS_CAP_SEC: Record<string, number> = {
  pregame_close: 12 * 3600,
  tipoff: 60 * 60,
  final_settle: 4 * 3600,
  post_final_48h: 50 * 3600,
};

const savedQueries: Record<string, string> = {};
function q(name: string, sql: string) {
  savedQueries[name] = sql.trim();
  return sql;
}

// ---------------------------------------------------------------------------
// 1. AUDIT
// ---------------------------------------------------------------------------
log("audit: counts + coverage");
const tableCounts: Record<string, number> = {};
for (const t of [
  "games",
  "game_outcomes",
  "game_states",
  "market_instruments",
  "source_markets",
  "quote_ticks",
  "market_microstructure_events",
  "nba_play_by_play_actions",
  "mapping_resolutions",
  "adapter_runs",
]) {
  tableCounts[t] = (
    db.prepare(`SELECT COUNT(*) c FROM ${t}`).get() as { c: number }
  ).c;
}
const quoteRange = db
  .prepare("SELECT MIN(captured_at) lo, MAX(captured_at) hi FROM quote_ticks")
  .get() as { lo: string; hi: string };
const sourceFamilyMatrix = db
  .prepare(
    `SELECT sm.source source, mi.family family, COUNT(*) instruments
     FROM source_markets sm JOIN market_instruments mi ON mi.id = sm.instrument_id
     GROUP BY sm.source, mi.family ORDER BY sm.source, instruments DESC`
  )
  .all() as Array<{ source: string; family: string; instruments: number }>;
const mappingStatus = db
  .prepare(
    "SELECT mapping_status status, COUNT(*) c FROM source_markets GROUP BY mapping_status"
  )
  .all() as Array<{ status: string; c: number }>;
const microstructureBySource = db
  .prepare(
    "SELECT source, event_type, COUNT(*) c FROM market_microstructure_events GROUP BY source, event_type ORDER BY c DESC"
  )
  .all() as Array<{ source: string; event_type: string; c: number }>;

const pbpGameIds = (
  db
    .prepare("SELECT DISTINCT game_id id FROM nba_play_by_play_actions")
    .all() as Array<{ id: string }>
).map((r) => r.id);
log(`audit: ${pbpGameIds.length} games with play-by-play`);

// ---------------------------------------------------------------------------
// 2. GAME ANCHORS  (temp table tmp_anchor(game_id, checkpoint, ts))
// ---------------------------------------------------------------------------
log("anchors: building game-level checkpoint anchors");
db.exec(
  "CREATE TEMP TABLE tmp_anchor (game_id TEXT, checkpoint TEXT, ts TEXT)"
);
const anchorRows = db
  .prepare(
    q(
      "game_anchors",
      `
      SELECT g.id game_id, g.scheduled_start scheduledStart,
             (SELECT gs.started_at FROM game_states gs WHERE gs.game_id=g.id AND gs.started_at IS NOT NULL ORDER BY gs.captured_at ASC LIMIT 1) startedAt,
             (SELECT gs.final_at FROM game_states gs WHERE gs.game_id=g.id AND gs.is_final=1 AND gs.final_at IS NOT NULL ORDER BY gs.captured_at DESC LIMIT 1) finalAt,
             go.final_home_score finalHome, go.final_away_score finalAway, go.winner_key winnerKey,
             g.home_participant_json homeJson, g.away_participant_json awayJson
      FROM games g JOIN game_outcomes go ON go.game_id=g.id
      `
    )
  )
  .all() as Array<{
  game_id: string;
  scheduledStart: string;
  startedAt: string | null;
  finalAt: string | null;
  finalHome: number;
  finalAway: number;
  winnerKey: string | null;
  homeJson: string;
  awayJson: string;
}>;

function keyOf(json: string): string | null {
  try {
    const o = JSON.parse(json);
    return o.key ?? o.id ?? o.shortName ?? null;
  } catch {
    return null;
  }
}
function plus(ts: string, hours: number): string {
  return new Date(new Date(ts).getTime() + hours * 3600 * 1000).toISOString();
}

type GameAnchor = {
  homeKey: string | null;
  awayKey: string | null;
  finalHome: number;
  finalAway: number;
  finalTotal: number;
  winnerKey: string | null;
  scheduledStart: string;
  finalAt: string | null;
};
const gameAnchors = new Map<string, GameAnchor>();
const insAnchor = db.prepare(
  "INSERT INTO tmp_anchor (game_id, checkpoint, ts) VALUES (?,?,?)"
);
const insAnchorTx = db.transaction((rows: typeof anchorRows) => {
  for (const r of rows) {
    gameAnchors.set(r.game_id, {
      homeKey: keyOf(r.homeJson),
      awayKey: keyOf(r.awayJson),
      finalHome: r.finalHome,
      finalAway: r.finalAway,
      finalTotal: r.finalHome + r.finalAway,
      winnerKey: r.winnerKey,
      scheduledStart: r.scheduledStart,
      finalAt: r.finalAt,
    });
    insAnchor.run(r.game_id, "pregame_close", r.scheduledStart);
    if (r.startedAt) insAnchor.run(r.game_id, "tipoff", r.startedAt);
    if (r.finalAt) {
      insAnchor.run(r.game_id, "final_settle", r.finalAt);
      insAnchor.run(r.game_id, "post_final_48h", plus(r.finalAt, 48));
    }
  }
});
insAnchorTx(anchorRows);
db.exec("CREATE INDEX tmp_anchor_idx ON tmp_anchor(game_id, checkpoint)");

// ---------------------------------------------------------------------------
// 3. CLOSING PROBABILITY EXTRACTION  (last quote <= anchor per source-market)
// ---------------------------------------------------------------------------
type ClosingRow = {
  smid: string;
  source: string;
  iid: string;
  family: string;
  displayLabel: string;
  participantKey: string | null;
  line: number | null;
  selection: string;
  rawFamily: string | null;
  rawLabel: string | null;
  gameId: string;
  checkpoint: string;
  p: number;
  ageSec: number;
};

function fetchClosing(
  queryName: string,
  familyClause: string,
  gameFilter: string
): ClosingRow[] {
  const sql = q(
    queryName,
    `
    SELECT smid, source, iid, family, displayLabel, participantKey, line, selection,
           rawFamily, rawLabel, gameId, checkpoint, p, ageSec FROM (
      SELECT sm.id smid, sm.source source, sm.instrument_id iid, mi.family family,
             mi.display_label displayLabel, mi.participant_key participantKey,
             mi.line line, mi.selection selection, sm.raw_family rawFamily,
             sm.raw_label rawLabel, sm.game_id gameId, a.checkpoint checkpoint,
             q.implied_probability p,
             (julianday(a.ts) - julianday(q.captured_at)) * 86400.0 ageSec,
             ROW_NUMBER() OVER (PARTITION BY sm.instrument_id, sm.source, a.checkpoint ORDER BY q.captured_at DESC) rnInstr
      FROM source_markets sm
      JOIN market_instruments mi ON mi.id = sm.instrument_id
      JOIN tmp_anchor a ON a.game_id = sm.game_id
      JOIN quote_ticks q ON q.source_market_id = sm.id
        AND q.captured_at <= a.ts AND q.implied_probability IS NOT NULL
      WHERE ${familyClause} ${gameFilter}
    ) WHERE rnInstr = 1
    `
  );
  return db.prepare(sql).all() as ClosingRow[];
}

log("closing: extracting game-market closing probabilities (487 games)");
const gameMarketClosing = fetchClosing(
  "closing_game_markets",
  "mi.family IN ('moneyline','spread','total')",
  ""
);
log(`closing: ${gameMarketClosing.length} game-market closing rows`);

const pbpInClause = pbpGameIds.map((id) => `'${id}'`).join(",");
log("closing: extracting player-prop closing probabilities (64 PBP games)");
// Player props only need pregame_close + final_settle for the settled track.
const playerPropClosing = (
  fetchClosing(
    "closing_player_props",
    "mi.family = 'player-prop'",
    `AND sm.game_id IN (${pbpInClause})`
  )
).filter(
  (r) => r.checkpoint === "pregame_close" || r.checkpoint === "final_settle"
);
log(`closing: ${playerPropClosing.length} player-prop closing rows`);

// ---------------------------------------------------------------------------
// 4. PBP RECONSTRUCTION + per-game validation
// ---------------------------------------------------------------------------
log("pbp: reconstructing player final stats + validating vs final score");
const stmtActions = db.prepare(
  "SELECT action_type actionType, description FROM nba_play_by_play_actions WHERE game_id=? ORDER BY action_number"
);
// roster per game = participant_keys that have player-prop instruments
const stmtRoster = db.prepare(
  `SELECT DISTINCT mi.participant_key pk FROM market_instruments mi
   WHERE mi.game_id=? AND mi.family='player-prop' AND mi.participant_key IS NOT NULL`
);

type ReconGame = {
  reconTotal: number;
  finalTotal: number;
  reconciled: boolean;
  statByParticipant: Map<string, PbpStatLine>;
};
const reconByGame = new Map<string, ReconGame>();
let reconciledGames = 0;
for (const gid of pbpGameIds) {
  const actions = stmtActions.all(gid) as Array<{
    actionType: string | null;
    description: string | null;
  }>;
  const statsByName = reconstructStatsFromPbp(actions);
  const roster = (stmtRoster.all(gid) as Array<{ pk: string }>).map((r) => r.pk);
  const statByParticipant = new Map<string, PbpStatLine>();
  let reconTotal = 0;
  for (const [name, line] of statsByName) {
    reconTotal += line.points;
    const pk = matchPbpNameToParticipant(name, roster);
    if (pk) statByParticipant.set(pk, line);
  }
  const ga = gameAnchors.get(gid);
  const finalTotal = ga ? ga.finalTotal : 0;
  const reconciled = ga != null && Math.abs(reconTotal - finalTotal) <= 2;
  if (reconciled) reconciledGames += 1;
  reconByGame.set(gid, { reconTotal, finalTotal, reconciled, statByParticipant });
}
log(
  `pbp: ${reconciledGames}/${pbpGameIds.length} games reconciled (recon points == final ±2)`
);

// ---------------------------------------------------------------------------
// 5. SETTLED GAME-MARKET ANALYSIS  (per family x source x checkpoint)
// ---------------------------------------------------------------------------
log("settled: game markets");
type Cell = {
  samples: SettledSample[];
  pushes: number;
  staleExcluded: number;
};
function newCell(): Cell {
  return { samples: [], pushes: 0, staleExcluded: 0 };
}
const gmCells = new Map<string, Cell>(); // key = family|source|checkpoint
const cellKey = (a: string, b: string, c: string) => `${a}|${b}|${c}`;

for (const r of gameMarketClosing) {
  if (isPeriodMarket(r.displayLabel)) continue; // full-game only
  const ga = gameAnchors.get(r.gameId);
  if (!ga) continue;
  const cap = FRESHNESS_CAP_SEC[r.checkpoint];
  const key = cellKey(r.family, r.source, r.checkpoint);
  let cell = gmCells.get(key);
  if (!cell) {
    cell = newCell();
    gmCells.set(key, cell);
  }
  if (cap != null && r.ageSec > cap) {
    cell.staleExcluded += 1;
    continue;
  }
  let settlement = null;
  if (r.family === "moneyline")
    settlement = settleMoneyline(r.participantKey, ga.winnerKey);
  else if (r.family === "spread")
    settlement = settleSpread({
      participantKey: r.participantKey,
      line: r.line,
      homeKey: ga.homeKey,
      awayKey: ga.awayKey,
      finalHome: ga.finalHome,
      finalAway: ga.finalAway,
      displayLabel: r.displayLabel,
    });
  else if (r.family === "total")
    settlement = settleTotal({
      selection: r.selection,
      line: r.line,
      finalTotal: ga.finalTotal,
    });
  if (!settlement) continue;
  if (settlement.push) {
    cell.pushes += 1;
    continue;
  }
  const p = clampProbability(r.p);
  if (p == null) continue;
  cell.samples.push({ p, actual: settlement.actual });
}

function serializeCells(cells: Map<string, Cell>) {
  const out: Record<
    string,
    Record<
      string,
      Record<
        string,
        ReturnType<typeof summarizeSettled> & {
          pushes: number;
          staleExcluded: number;
        }
      >
    >
  > = {};
  for (const [key, cell] of cells) {
    const [family, source, checkpoint] = key.split("|");
    out[family] ??= {};
    out[family][source] ??= {};
    out[family][source][checkpoint] = {
      ...summarizeSettled(cell.samples),
      pushes: cell.pushes,
      staleExcluded: cell.staleExcluded,
    };
  }
  return out;
}
const settledGameMarkets = serializeCells(gmCells);

// ---------------------------------------------------------------------------
// 6. SETTLED PLAYER-PROP ANALYSIS  (per stat-family x source x checkpoint)
// ---------------------------------------------------------------------------
log("settled: player props by stat family (reconciled PBP games only)");

// Instrument-keyed structure: one realized outcome per canonical instrument,
// plus each source's clamped probability at pregame_close and final_settle.
// This lets us compute both per-source aggregates AND like-for-like head-to-head
// on the SAME (player, stat, line) instruments — the only confound-free compare.
type PpInstr = {
  fam: StatFamily;
  actual: 0 | 1;
  push: boolean;
  bySource: Map<string, { pregame?: number; final?: number }>;
};
const ppInstr = new Map<string, PpInstr>();

for (const r of playerPropClosing) {
  const recon = reconByGame.get(r.gameId);
  if (!recon || !recon.reconciled) continue;
  if (!r.participantKey) continue;
  const statLine = recon.statByParticipant.get(r.participantKey);
  if (!statLine) continue; // player not matched in PBP
  const fam = normalizeStatFamily(r.rawFamily, r.rawLabel);
  if (!SETTLEABLE_FAMILIES[fam]) continue;

  let settlement: { actual: 0 | 1; push: boolean } | null;
  if (fam === "points-leader") {
    let leaderPts = -1;
    for (const sl of recon.statByParticipant.values())
      leaderPts = Math.max(leaderPts, sl.points);
    settlement = {
      actual: statLine.points >= leaderPts && leaderPts >= 0 ? 1 : 0,
      push: false,
    };
  } else {
    const stat = statForFamily(fam as StatFamily, statLine);
    if (stat == null) continue;
    const s = settleStatLine({ selection: r.selection, line: r.line, stat });
    settlement = s ? { actual: s.actual as 0 | 1, push: s.push } : null;
  }
  if (!settlement) continue;

  let entry = ppInstr.get(r.iid);
  if (!entry) {
    entry = { fam, actual: settlement.actual, push: settlement.push, bySource: new Map() };
    ppInstr.set(r.iid, entry);
  }
  if (settlement.push) {
    entry.push = true;
    continue;
  }
  const p = clampProbability(r.p);
  if (p == null) continue;
  let bs = entry.bySource.get(r.source);
  if (!bs) {
    bs = {};
    entry.bySource.set(r.source, bs);
  }
  if (r.checkpoint === "pregame_close") bs.pregame = p;
  else if (r.checkpoint === "final_settle") bs.final = p;
}

// Per-family x source x checkpoint + overall (key family "ALL")
const ppCells = new Map<string, Cell>();
const ppOverall = new Map<string, Cell>();
const ppFamilyCoverage = new Map<string, number>();
const seenInstrByFamily = new Map<string, Set<string>>();
function pushPp(fam: string, source: string, checkpoint: string, sample: SettledSample) {
  for (const famKey of [fam, "ALL"]) {
    const map = famKey === "ALL" ? ppOverall : ppCells;
    const k = cellKey(famKey, source, checkpoint);
    let cell = map.get(k);
    if (!cell) {
      cell = newCell();
      map.set(k, cell);
    }
    cell.samples.push(sample);
  }
}
for (const [iid, entry] of ppInstr) {
  if (entry.push) continue;
  for (const [source, bs] of entry.bySource) {
    if (bs.pregame != null)
      pushPp(entry.fam, source, "pregame_close", { p: bs.pregame, actual: entry.actual });
    if (bs.final != null)
      pushPp(entry.fam, source, "final_settle", { p: bs.final, actual: entry.actual });
  }
  const set = seenInstrByFamily.get(entry.fam) ?? new Set<string>();
  set.add(iid);
  seenInstrByFamily.set(entry.fam, set);
  ppFamilyCoverage.set(entry.fam, set.size);
}
const settledPlayerPropsByFamily = serializeCells(ppCells);
const settledPlayerPropsOverall = serializeCells(ppOverall);

// Like-for-like head-to-head: per source-pair, restricted to instruments where
// BOTH sources quoted the same canonical (player, stat, line) before tip.
log("settled: player-prop head-to-head on shared instruments");
type H2H = { aBrier: number; bBrier: number; n: number };
function headToHead(famFilter?: string) {
  const pairs: Record<string, { aSamp: SettledSample[]; bSamp: SettledSample[] }> = {};
  for (const entry of ppInstr.values()) {
    if (entry.push) continue;
    if (famFilter && entry.fam !== famFilter) continue;
    for (let i = 0; i < SOURCES.length; i++) {
      for (let j = i + 1; j < SOURCES.length; j++) {
        const A = SOURCES[i];
        const B = SOURCES[j];
        const a = entry.bySource.get(A)?.pregame;
        const b = entry.bySource.get(B)?.pregame;
        if (a == null || b == null) continue;
        const key = `${A}__${B}`;
        pairs[key] ??= { aSamp: [], bSamp: [] };
        pairs[key].aSamp.push({ p: a, actual: entry.actual });
        pairs[key].bSamp.push({ p: b, actual: entry.actual });
      }
    }
  }
  const out: Record<string, H2H> = {};
  for (const [key, v] of Object.entries(pairs)) {
    if (v.aSamp.length < 5) continue;
    out[key] = {
      aBrier: summarizeSettled(v.aSamp).brier!,
      bBrier: summarizeSettled(v.bSamp).brier!,
      n: v.aSamp.length,
    };
  }
  return out;
}
const playerPropHeadToHead = {
  overall: headToHead(),
  points: headToHead("points"),
  rebounds: headToHead("rebounds"),
  assists: headToHead("assists"),
};

// ---------------------------------------------------------------------------
// 6b. LEAD-LAG (timing / market leadership) for cross-source player props
// Who repriced first? Measured by cross-correlation best lag on 60s buckets,
// over reconciled-PBP player-prop instruments quoted live by >=2 sources.
// This is the "fast" axis, kept separate from the "right" (accuracy) axis.
// ---------------------------------------------------------------------------
log("lead-lag: bucketed cross-correlation on shared player-prop instruments");
const BUCKET = 60;
const llRows = db
  .prepare(
    q(
      "player_prop_lead_lag_buckets",
      `
      WITH pbp AS (SELECT DISTINCT game_id FROM nba_play_by_play_actions),
      shared AS (
        SELECT sm.instrument_id iid
        FROM source_markets sm
        JOIN market_instruments mi ON mi.id = sm.instrument_id
        JOIN pbp ON pbp.game_id = sm.game_id
        WHERE mi.family = 'player-prop'
        GROUP BY sm.instrument_id
        HAVING COUNT(DISTINCT sm.source) >= 2
      )
      SELECT sm.instrument_id iid, sm.source source,
             (CAST(strftime('%s', q.captured_at) AS INTEGER) / ${BUCKET}) bucket,
             AVG(q.implied_probability) p
      FROM source_markets sm
      JOIN shared ON shared.iid = sm.instrument_id
      JOIN quote_ticks q ON q.source_market_id = sm.id
      WHERE q.implied_probability IS NOT NULL
      GROUP BY sm.instrument_id, sm.source, bucket
      ORDER BY sm.instrument_id, bucket
      `
    )
  )
  .all() as Array<{ iid: string; source: string; bucket: number; p: number }>;

type SeriesByInstr = Map<string, Map<string, Map<number, number>>>;
const seriesByInstr: SeriesByInstr = new Map();
for (const r of llRows) {
  let bySrc = seriesByInstr.get(r.iid);
  if (!bySrc) {
    bySrc = new Map();
    seriesByInstr.set(r.iid, bySrc);
  }
  let buckets = bySrc.get(r.source);
  if (!buckets) {
    buckets = new Map();
    bySrc.set(r.source, buckets);
  }
  buckets.set(r.bucket, r.p);
}

function pearson(pairs: Array<[number, number]>): number | null {
  const n = pairs.length;
  if (n < 8) return null;
  let sa = 0;
  let sb = 0;
  for (const [a, b] of pairs) {
    sa += a;
    sb += b;
  }
  const ma = sa / n;
  const mb = sb / n;
  let num = 0;
  let da = 0;
  let dbb = 0;
  for (const [a, b] of pairs) {
    num += (a - ma) * (b - mb);
    da += (a - ma) ** 2;
    dbb += (b - mb) ** 2;
  }
  if (da === 0 || dbb === 0) return null;
  return num / Math.sqrt(da * dbb);
}

// best lag (in buckets) of B relative to A: positive => A leads B
function bestLag(
  a: Map<number, number>,
  b: Map<number, number>,
  maxLag = 10
): { lag: number; corr: number } | null {
  const buckets = [...a.keys()].filter((k) => b.has(k) || true);
  if (a.size < 8 || b.size < 8) return null;
  const allBuckets = new Set<number>([...a.keys(), ...b.keys()]);
  const sorted = [...allBuckets].sort((x, y) => x - y);
  let best: { lag: number; corr: number; overlap: number } | null = null;
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const pairs: Array<[number, number]> = [];
    for (const t of sorted) {
      const av = a.get(t);
      const bv = b.get(t + lag);
      if (av != null && bv != null) pairs.push([av, bv]);
    }
    const c = pearson(pairs);
    if (c != null && (best == null || c > best.corr))
      best = { lag, corr: c, overlap: pairs.length };
  }
  void buckets;
  return best;
}

type LeadAgg = { aLeads: number; bLeads: number; ties: number; sumLagSec: number; n: number };
const leadLagPairs: Record<string, LeadAgg> = {};
for (const bySrc of seriesByInstr.values()) {
  for (let i = 0; i < SOURCES.length; i++) {
    for (let j = i + 1; j < SOURCES.length; j++) {
      const A = SOURCES[i];
      const B = SOURCES[j];
      const sa = bySrc.get(A);
      const sb = bySrc.get(B);
      if (!sa || !sb) continue;
      const bl = bestLag(sa, sb);
      if (!bl || bl.corr < 0.3) continue; // require real co-movement
      const key = `${A}__${B}`;
      const agg = (leadLagPairs[key] ??= {
        aLeads: 0,
        bLeads: 0,
        ties: 0,
        sumLagSec: 0,
        n: 0,
      });
      if (bl.lag > 0) agg.aLeads += 1;
      else if (bl.lag < 0) agg.bLeads += 1;
      else agg.ties += 1;
      agg.sumLagSec += Math.abs(bl.lag) * BUCKET;
      agg.n += 1;
    }
  }
}
const playerPropLeadLag = Object.fromEntries(
  Object.entries(leadLagPairs).map(([k, v]) => [
    k,
    {
      ...v,
      meanAbsLagSec: v.n > 0 ? v.sumLagSec / v.n : null,
      leader:
        v.aLeads > v.bLeads ? k.split("__")[0] : v.bLeads > v.aLeads ? k.split("__")[1] : "tie",
    },
  ])
);
log(`lead-lag: ${seriesByInstr.size} shared instruments analyzed`);

// ---------------------------------------------------------------------------
// 6c. MICROSTRUCTURE (polymarket-only today) by player-prop stat family
// ---------------------------------------------------------------------------
log("microstructure: polymarket trade activity by player-prop stat family");
const microRows = db
  .prepare(
    q(
      "player_prop_microstructure",
      `
      SELECT e.source source, sm.raw_family rawFamily, sm.raw_label rawLabel,
             COUNT(*) events, SUM(CASE WHEN e.event_type='trade' THEN 1 ELSE 0 END) trades,
             SUM(COALESCE(e.notional,0)) notional,
             SUM(CASE WHEN e.volume_share IS NOT NULL AND e.volume_share >= 0.1 THEN 1 ELSE 0 END) concentratedPrints
      FROM market_microstructure_events e
      JOIN source_markets sm ON sm.id = e.source_market_id
      JOIN market_instruments mi ON mi.id = e.instrument_id
      WHERE mi.family = 'player-prop'
      GROUP BY e.source, sm.raw_family
      `
    )
  )
  .all() as Array<{
  source: string;
  rawFamily: string | null;
  rawLabel: string | null;
  events: number;
  trades: number;
  notional: number;
  concentratedPrints: number;
}>;
const microByFamily: Record<
  string,
  Record<string, { events: number; trades: number; notional: number; concentratedPrints: number }>
> = {};
for (const r of microRows) {
  const fam = normalizeStatFamily(r.rawFamily, r.rawLabel);
  microByFamily[fam] ??= {};
  const cur = (microByFamily[fam][r.source] ??= {
    events: 0,
    trades: 0,
    notional: 0,
    concentratedPrints: 0,
  });
  cur.events += r.events;
  cur.trades += r.trades;
  cur.notional += r.notional;
  cur.concentratedPrints += r.concentratedPrints;
}

// ---------------------------------------------------------------------------
// 6d. CASE STUDIES — concrete instruments with cross-source evidence
// ---------------------------------------------------------------------------
log("case-studies: selecting concrete instrument examples");
function instrumentTimeline(iid: string) {
  const meta = db
    .prepare(
      `SELECT mi.display_label label, mi.game_id gameId, g.home_participant_json hj,
              g.away_participant_json aj, g.scheduled_start sched
       FROM market_instruments mi JOIN games g ON g.id = mi.game_id WHERE mi.id = ?`
    )
    .get(iid) as
    | { label: string; gameId: string; hj: string; aj: string; sched: string }
    | undefined;
  if (!meta) return null;
  const series = db
    .prepare(
      `SELECT sm.source source,
              (CAST(strftime('%s', q.captured_at) AS INTEGER) / 300) * 300 bucket,
              AVG(q.implied_probability) p
       FROM source_markets sm JOIN quote_ticks q ON q.source_market_id = sm.id
       WHERE sm.instrument_id = ? AND q.implied_probability IS NOT NULL
       GROUP BY sm.source, bucket ORDER BY bucket`
    )
    .all(iid) as Array<{ source: string; bucket: number; p: number }>;
  const home = keyOf(meta.hj);
  const away = keyOf(meta.aj);
  return {
    iid,
    label: meta.label,
    matchup: `${away} @ ${home}`,
    scheduledStart: meta.sched,
    finalAt: gameAnchors.get(meta.gameId)?.finalAt ?? null,
    series: series.map((s) => ({
      source: s.source,
      at: new Date(s.bucket * 1000).toISOString(),
      p: s.p,
    })),
  };
}

const caseStudies: Array<Record<string, unknown>> = [];
// CS1: a player prop where kalshi clearly led polymarket in repricing.
let bestKalshiLead: {
  iid: string;
  lag: number;
  corr: number;
  overlap: number;
} | null = null;
for (const [iid, bySrc] of seriesByInstr) {
  const sk = bySrc.get("kalshi");
  const sp = bySrc.get("polymarket");
  if (!sk || !sp) continue;
  const bl = bestLag(sk, sp);
  // require a credible (non-degenerate) fit over a real overlap, not a perfect
  // correlation on a handful of collinear buckets.
  if (bl && bl.lag > 0 && bl.corr >= 0.65 && bl.corr <= 0.97 && bl.overlap >= 15) {
    if (!bestKalshiLead || bl.overlap > bestKalshiLead.overlap)
      bestKalshiLead = { iid, lag: bl.lag, corr: bl.corr, overlap: bl.overlap };
  }
}
if (bestKalshiLead) {
  const tl = instrumentTimeline(bestKalshiLead.iid);
  if (tl) {
    const entry = ppInstr.get(bestKalshiLead.iid);
    caseStudies.push({
      kind: "kalshi-leads-polymarket",
      headline: "Kalshi repriced a player prop ahead of Polymarket",
      leadBuckets: bestKalshiLead.lag,
      crossCorrelation: bestKalshiLead.corr,
      settledOutcome: entry ? entry.actual : null,
      ...tl,
    });
  }
}
// CS2: a bet365 player prop that never repriced live while an exchange did.
for (const [iid, entry] of ppInstr) {
  if (entry.push) continue;
  const b = entry.bySource.get("bet365");
  const other =
    entry.bySource.get("kalshi") ?? entry.bySource.get("polymarket");
  if (!b || !other) continue;
  if (b.pregame == null || b.final == null || other.pregame == null || other.final == null)
    continue;
  if (Math.abs(b.pregame - b.final) < 0.01 && Math.abs(other.pregame - other.final) > 0.2) {
    const tl = instrumentTimeline(iid);
    if (tl) {
      caseStudies.push({
        kind: "bet365-pregame-only",
        headline:
          "Bet365 prop quote stayed at its pregame value while an exchange repriced through the game",
        bet365Pregame: b.pregame,
        bet365Final: b.final,
        exchangePregame: other.pregame,
        exchangeFinal: other.final,
        settledOutcome: entry.actual,
        ...tl,
      });
      break;
    }
  }
}
log(`case-studies: ${caseStudies.length} selected`);

// ---------------------------------------------------------------------------
// 7. RECONCILIATION GATE vs repo read model
// ---------------------------------------------------------------------------
log("reconcile: moneyline pregame vs getSignalQualityReport");
const repoReport = getSignalQualityReport({ closingCutoff: "pregame" });
// our comparable: moneyline pregame_close, but WITHOUT period filter + WITHOUT
// freshness cap, to match the read model exactly.
const reconCells = new Map<string, Cell>();
for (const r of gameMarketClosing) {
  if (r.family !== "moneyline" || r.checkpoint !== "pregame_close") continue;
  const ga = gameAnchors.get(r.gameId);
  if (!ga) continue;
  const s = settleMoneyline(r.participantKey, ga.winnerKey);
  if (!s) continue;
  const p = clampProbability(r.p);
  if (p == null) continue;
  const k = cellKey("moneyline", r.source, "all");
  let cell = reconCells.get(k);
  if (!cell) {
    cell = newCell();
    reconCells.set(k, cell);
  }
  cell.samples.push({ p, actual: s.actual });
}
const reconciliation = SOURCES.map((src) => {
  const repo = repoReport.perSource.find((s) => s.source === src);
  const ours = reconCells.get(cellKey("moneyline", src, "all"));
  const oursSummary = ours ? summarizeSettled(ours.samples) : null;
  return {
    source: src,
    repoBrier: repo?.brier ?? null,
    repoN: repo?.sampleCount ?? null,
    oursBrier: oursSummary?.brier ?? null,
    oursN: oursSummary?.n ?? null,
    matches:
      repo != null &&
      oursSummary != null &&
      Math.abs((repo.brier ?? -9) - (oursSummary.brier ?? 9)) < 1e-4 &&
      repo.sampleCount === oursSummary.n,
  };
});
log(
  `reconcile: ${reconciliation.every((r) => r.matches) ? "ALL MATCH" : "MISMATCH — investigate"}`
);

writeFileSync(
  resolve(OUT_DIR, "report-data.json"),
  JSON.stringify(
    {
      meta: {
        generatedAt: new Date().toISOString(),
        dbPath,
        quoteRange,
        scope:
          "All persisted live quotes, Feb 16 – May 21 2026 (NBA playoff window). Not all-time.",
      },
      audit: {
        tableCounts,
        sourceFamilyMatrix,
        mappingStatus,
        microstructureBySource,
        pbpGames: pbpGameIds.length,
        settleableGames: gameAnchors.size,
      },
      reconciliation,
      settledGameMarkets,
      settledPlayerPropsByFamily,
      settledPlayerPropsOverall,
      playerPropHeadToHead,
      playerPropLeadLag,
      playerPropMicrostructure: microByFamily,
      caseStudies,
      pbp: {
        reconciledGames,
        totalPbpGames: pbpGameIds.length,
        familyCoverage: Object.fromEntries(ppFamilyCoverage),
      },
    },
    null,
    2
  )
);
for (const [name, sql] of Object.entries(savedQueries)) {
  writeFileSync(resolve(QUERY_DIR, `${name}.sql`), sql + "\n");
}
log(`done: wrote report-data.json + ${Object.keys(savedQueries).length} queries`);
