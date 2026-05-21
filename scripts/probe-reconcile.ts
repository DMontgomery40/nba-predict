/**
 * One-off reconciliation probe (advisor pre-flight gate).
 * Compares custom settled-moneyline-pregame Brier SQL against the repo's own
 * getSignalQualityReport read model. If these disagree, the JOIN shape is wrong
 * and no further analysis should be trusted.
 *
 * Run: SIGNAL_CONSOLE_DB_PATH=$PWD/data/signal-console.sqlite npx tsx scripts/probe-reconcile.ts
 */
import Database from "better-sqlite3";
import { getSignalQualityReport } from "../packages/shared/src/signal-quality";

const dbPath = process.env.SIGNAL_CONSOLE_DB_PATH;
if (!dbPath) throw new Error("set SIGNAL_CONSOLE_DB_PATH");

function clamp(p: number | null): number | null {
  if (p == null || !Number.isFinite(p)) return null;
  if (p <= 0) return 0.0001;
  if (p >= 1) return 0.9999;
  return p;
}

// --- Repo read model ---
const report = getSignalQualityReport({ closingCutoff: "pregame" });
console.log("=== getSignalQualityReport (pregame) ===");
for (const s of report.perSource) {
  console.log(
    `${s.source.padEnd(11)} n=${String(s.sampleCount).padStart(5)} brier=${s.brier?.toFixed(4)} logLoss=${s.logLoss?.toFixed(4)} acc=${s.closingWinnerAccuracy?.toFixed(4)}`
  );
}

// --- Custom SQL replicating the same logic ---
const db = new Database(dbPath, { readonly: true });
const rows = db
  .prepare(
    `
    WITH cutoffs AS (
      SELECT g.id AS gameId, g.scheduled_start AS cutoff, go.winner_key AS winnerKey
      FROM games g JOIN game_outcomes go ON go.game_id = g.id
    ),
    inst AS (
      SELECT mi.id AS instrumentId, mi.game_id AS gameId, mi.participant_key AS participantKey
      FROM market_instruments mi
      WHERE mi.family = 'moneyline'
    ),
    ranked AS (
      SELECT sm.instrument_id AS instrumentId, sm.source AS source,
             q.implied_probability AS p, q.captured_at AS capturedAt,
             ROW_NUMBER() OVER (PARTITION BY sm.instrument_id, sm.source ORDER BY q.captured_at DESC) rn
      FROM source_markets sm
      JOIN inst ON inst.instrumentId = sm.instrument_id
      JOIN cutoffs c ON c.gameId = sm.game_id
      JOIN quote_ticks q ON q.source_market_id = sm.id
      WHERE q.captured_at <= c.cutoff AND q.implied_probability IS NOT NULL
    )
    SELECT r.source, r.p, inst.participantKey, c.winnerKey
    FROM ranked r
    JOIN inst ON inst.instrumentId = r.instrumentId
    JOIN cutoffs c ON c.gameId = inst.gameId
    WHERE r.rn = 1 AND c.winnerKey IS NOT NULL
  `
  )
  .all() as Array<{
  source: string;
  p: number;
  participantKey: string | null;
  winnerKey: string | null;
}>;

const acc = new Map<
  string,
  { n: number; brier: number; logloss: number; correct: number }
>();
for (const r of rows) {
  const p = clamp(r.p);
  if (p == null || r.participantKey == null) continue;
  const actual = r.participantKey === r.winnerKey ? 1 : 0;
  const a = acc.get(r.source) ?? { n: 0, brier: 0, logloss: 0, correct: 0 };
  a.n += 1;
  a.brier += (p - actual) ** 2;
  a.logloss -= actual * Math.log(p) + (1 - actual) * Math.log(1 - p);
  if ((p >= 0.5 ? 1 : 0) === actual) a.correct += 1;
  acc.set(r.source, a);
}
console.log("\n=== custom SQL (pregame, all moneyline incl period) ===");
for (const [src, a] of acc) {
  console.log(
    `${src.padEnd(11)} n=${String(a.n).padStart(5)} brier=${(a.brier / a.n).toFixed(4)} logLoss=${(a.logloss / a.n).toFixed(4)} acc=${(a.correct / a.n).toFixed(4)}`
  );
}
