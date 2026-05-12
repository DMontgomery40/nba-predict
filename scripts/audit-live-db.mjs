#!/usr/bin/env node
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireFromShared = createRequire(
  resolve(repoRoot, "packages/shared/package.json")
);
const Database = requireFromShared("better-sqlite3");
const dbPath = process.env.SIGNAL_CONSOLE_DB_PATH
  ? resolve(process.env.SIGNAL_CONSOLE_DB_PATH)
  : resolve(repoRoot, "data/signal-console.sqlite");

function countTable(db, tableName) {
  return Number(
    db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get()?.count ?? 0
  );
}

function sourceBreakdown(db) {
  return db
    .prepare(
      `
        SELECT
          sm.source AS source,
          COUNT(DISTINCT sm.id) AS source_markets,
          COUNT(DISTINCT sm.game_id) AS games,
          COUNT(qt.id) AS quote_ticks,
          MAX(qt.captured_at) AS latest_quote_at
        FROM source_markets sm
        LEFT JOIN quote_ticks qt ON qt.source_market_id = sm.id
        GROUP BY sm.source
        ORDER BY quote_ticks DESC, sm.source ASC
      `
    )
    .all();
}

if (!existsSync(dbPath)) {
  console.error(`DB_AUDIT_FAIL database does not exist: ${dbPath}`);
  process.exit(2);
}

const db = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
  const integrity = String(db.prepare("PRAGMA integrity_check").pluck().get());
  const counts = {
    adapter_runs: countTable(db, "adapter_runs"),
    games: countTable(db, "games"),
    game_outcomes: countTable(db, "game_outcomes"),
    market_instruments: countTable(db, "market_instruments"),
    quote_ticks: countTable(db, "quote_ticks"),
    raw_payloads: countTable(db, "raw_payloads"),
    source_markets: countTable(db, "source_markets"),
  };
  const sources = sourceBreakdown(db);
  const looksLive =
    counts.quote_ticks >= 10_000 && counts.source_markets >= 100;

  console.log(`DB_PATH ${dbPath}`);
  console.log(`SQLITE_INTEGRITY ${integrity}`);
  for (const [name, count] of Object.entries(counts)) {
    console.log(`${name.toUpperCase()} ${count.toLocaleString("en-US")}`);
  }
  console.log("SOURCE_BREAKDOWN");
  for (const row of sources) {
    console.log(
      [
        row.source,
        `ticks=${Number(row.quote_ticks).toLocaleString("en-US")}`,
        `markets=${Number(row.source_markets).toLocaleString("en-US")}`,
        `games=${Number(row.games).toLocaleString("en-US")}`,
        `latest=${row.latest_quote_at ?? "n/a"}`,
      ].join(" ")
    );
  }

  if (integrity !== "ok") {
    console.error("DB_AUDIT_FAIL SQLite integrity check failed.");
    process.exit(3);
  }
  if (!looksLive) {
    console.error(
      "DB_AUDIT_FAIL active DB does not look like persisted live data. Set SIGNAL_CONSOLE_DB_PATH to the live database before demoing."
    );
    process.exit(4);
  }

  console.log("DB_AUDIT_PASS active DB has a persisted live-data footprint.");
} finally {
  db.close();
}
