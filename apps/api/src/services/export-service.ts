import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";

import {
  backupDatabase,
  getDatabase,
  getDatabasePath,
} from "@signal-console/shared";

type ExportFormat = "csv" | "jsonl";

type ExportQuery = {
  family?: string;
  from?: string;
  gameId?: string;
  league?: string;
  source?: string;
  sport?: string;
  to?: string;
};

type DatasetDefinition = {
  columns: string[];
  countSql: string;
  filename: string;
  fromColumn?: string;
  gameIdColumn?: string;
  leagueColumn?: string;
  sourceColumn?: string;
  sportColumn?: string;
  familyColumn?: string;
  sql: string;
  title: string;
};

const datasetDefinitions = {
  "adapter-runs": {
    columns: [
      "id",
      "source",
      "capture_mode",
      "started_at",
      "finished_at",
      "status",
      "error_code",
      "error_message",
      "records_seen",
      "records_written",
    ],
    countSql: "SELECT COUNT(*) AS count FROM adapter_runs",
    filename: "adapter-runs",
    fromColumn: "ar.started_at",
    sourceColumn: "ar.source",
    sql: `
      SELECT id, source, capture_mode, started_at, finished_at, status,
             error_code, error_message, records_seen, records_written
      FROM adapter_runs ar
    `,
    title: "Adapter runs",
  },
  games: {
    columns: [
      "id",
      "sport",
      "league",
      "source_game_key_nba",
      "scheduled_start",
      "away_key",
      "away_name",
      "away_short_name",
      "away_abbreviation",
      "home_key",
      "home_name",
      "home_short_name",
      "home_abbreviation",
    ],
    countSql: "SELECT COUNT(*) AS count FROM games",
    filename: "games",
    fromColumn: "g.scheduled_start",
    gameIdColumn: "g.id",
    leagueColumn: "g.league",
    sportColumn: "g.sport",
    sql: `
      SELECT
        g.id,
        g.sport,
        g.league,
        g.source_game_key_nba,
        g.scheduled_start,
        json_extract(g.away_participant_json, '$.key') AS away_key,
        json_extract(g.away_participant_json, '$.name') AS away_name,
        json_extract(g.away_participant_json, '$.shortName') AS away_short_name,
        json_extract(g.away_participant_json, '$.abbreviation') AS away_abbreviation,
        json_extract(g.home_participant_json, '$.key') AS home_key,
        json_extract(g.home_participant_json, '$.name') AS home_name,
        json_extract(g.home_participant_json, '$.shortName') AS home_short_name,
        json_extract(g.home_participant_json, '$.abbreviation') AS home_abbreviation
      FROM games g
    `,
    title: "Games",
  },
  "game-states": {
    columns: [
      "id",
      "game_id",
      "sport",
      "league",
      "scheduled_start",
      "captured_at",
      "status",
      "period",
      "clock",
      "home_score",
      "away_score",
      "is_final",
      "started_at",
      "final_at",
    ],
    countSql: "SELECT COUNT(*) AS count FROM game_states",
    filename: "game-states",
    fromColumn: "gs.captured_at",
    gameIdColumn: "g.id",
    leagueColumn: "g.league",
    sportColumn: "g.sport",
    sql: `
      SELECT gs.id, gs.game_id, g.sport, g.league, g.scheduled_start,
             gs.captured_at, gs.status, gs.period, gs.clock, gs.home_score,
             gs.away_score, gs.is_final, gs.started_at, gs.final_at
      FROM game_states gs
      JOIN games g ON g.id = gs.game_id
    `,
    title: "Game states",
  },
  "game-outcomes": {
    columns: [
      "game_id",
      "sport",
      "league",
      "scheduled_start",
      "final_home_score",
      "final_away_score",
      "winner_key",
      "captured_at",
    ],
    countSql: "SELECT COUNT(*) AS count FROM game_outcomes",
    filename: "game-outcomes",
    fromColumn: "go.captured_at",
    gameIdColumn: "g.id",
    leagueColumn: "g.league",
    sportColumn: "g.sport",
    sql: `
      SELECT go.game_id, g.sport, g.league, g.scheduled_start,
             go.final_home_score, go.final_away_score, go.winner_key,
             go.captured_at
      FROM game_outcomes go
      JOIN games g ON g.id = go.game_id
    `,
    title: "Game outcomes",
  },
  "market-instruments": {
    columns: [
      "id",
      "game_id",
      "sport",
      "league",
      "scheduled_start",
      "family",
      "selection",
      "line",
      "participant_key",
      "in_play",
      "display_label",
    ],
    countSql: "SELECT COUNT(*) AS count FROM market_instruments",
    familyColumn: "mi.family",
    filename: "market-instruments",
    fromColumn: "g.scheduled_start",
    gameIdColumn: "g.id",
    leagueColumn: "g.league",
    sportColumn: "g.sport",
    sql: `
      SELECT mi.id, mi.game_id, g.sport, g.league, g.scheduled_start,
             mi.family, mi.selection, mi.line, mi.participant_key,
             mi.in_play, mi.display_label
      FROM market_instruments mi
      JOIN games g ON g.id = mi.game_id
    `,
    title: "Market instruments",
  },
  "market-quotes": {
    columns: [
      "quote_tick_id",
      "source",
      "game_id",
      "sport",
      "league",
      "scheduled_start",
      "away_key",
      "away_name",
      "home_key",
      "home_name",
      "instrument_id",
      "family",
      "display_label",
      "participant_key",
      "selection",
      "line",
      "source_market_id",
      "source_market_key",
      "source_selection_key",
      "raw_family",
      "raw_label",
      "captured_at",
      "price_raw",
      "odds_raw",
      "line_raw",
      "implied_probability",
      "best_bid",
      "best_ask",
      "volume",
      "depth_score",
      "is_heartbeat",
    ],
    countSql: "SELECT COUNT(*) AS count FROM quote_ticks",
    familyColumn: "COALESCE(mi.family, sm.raw_family)",
    filename: "market-quotes",
    fromColumn: "qt.captured_at",
    gameIdColumn: "g.id",
    leagueColumn: "g.league",
    sourceColumn: "sm.source",
    sportColumn: "g.sport",
    sql: `
      SELECT
        qt.id AS quote_tick_id,
        sm.source,
        g.id AS game_id,
        g.sport,
        g.league,
        g.scheduled_start,
        json_extract(g.away_participant_json, '$.key') AS away_key,
        json_extract(g.away_participant_json, '$.name') AS away_name,
        json_extract(g.home_participant_json, '$.key') AS home_key,
        json_extract(g.home_participant_json, '$.name') AS home_name,
        mi.id AS instrument_id,
        COALESCE(mi.family, sm.raw_family) AS family,
        mi.display_label,
        mi.participant_key,
        mi.selection,
        mi.line,
        sm.id AS source_market_id,
        sm.source_market_key,
        sm.source_selection_key,
        sm.raw_family,
        sm.raw_label,
        qt.captured_at,
        qt.price_raw,
        qt.odds_raw,
        qt.line_raw,
        qt.implied_probability,
        qt.best_bid,
        qt.best_ask,
        qt.volume,
        qt.depth_score,
        qt.is_heartbeat
      FROM quote_ticks qt
      JOIN source_markets sm ON sm.id = qt.source_market_id
      JOIN games g ON g.id = sm.game_id
      LEFT JOIN market_instruments mi ON mi.id = sm.instrument_id
    `,
    title: "Market quote ticks",
  },
  "raw-payloads": {
    columns: [
      "id",
      "source",
      "captured_at",
      "entity_type",
      "entity_id",
      "content_hash",
      "payload_json",
    ],
    countSql: "SELECT COUNT(*) AS count FROM raw_payloads",
    filename: "raw-payloads",
    fromColumn: "rp.captured_at",
    sourceColumn: "rp.source",
    sql: `
      SELECT id, source, captured_at, entity_type, entity_id, content_hash,
             payload_json
      FROM raw_payloads rp
    `,
    title: "Raw payloads",
  },
  "source-markets": {
    columns: [
      "id",
      "source",
      "source_market_key",
      "source_selection_key",
      "game_id",
      "sport",
      "league",
      "scheduled_start",
      "instrument_id",
      "family",
      "raw_family",
      "raw_label",
      "mapping_status",
      "raw_metadata_json",
    ],
    countSql: "SELECT COUNT(*) AS count FROM source_markets",
    familyColumn: "COALESCE(mi.family, sm.raw_family)",
    filename: "source-markets",
    fromColumn: "g.scheduled_start",
    gameIdColumn: "g.id",
    leagueColumn: "g.league",
    sourceColumn: "sm.source",
    sportColumn: "g.sport",
    sql: `
      SELECT sm.id, sm.source, sm.source_market_key, sm.source_selection_key,
             sm.game_id, g.sport, g.league, g.scheduled_start,
             sm.instrument_id, COALESCE(mi.family, sm.raw_family) AS family,
             sm.raw_family, sm.raw_label,
             sm.mapping_status, sm.raw_metadata_json
      FROM source_markets sm
      JOIN games g ON g.id = sm.game_id
      LEFT JOIN market_instruments mi ON mi.id = sm.instrument_id
    `,
    title: "Source markets",
  },
} satisfies Record<string, DatasetDefinition>;

export type ExportDataset = keyof typeof datasetDefinitions;

function csvCell(value: unknown) {
  const text =
    value == null
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function buildFilteredSql(definition: DatasetDefinition, query: ExportQuery) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (
    column: string | undefined,
    operator: string,
    value?: string
  ) => {
    if (!column || !value) return;
    clauses.push(`${column} ${operator} ?`);
    params.push(value);
  };

  add(definition.sourceColumn, "=", query.source);
  add(definition.familyColumn, "=", query.family);
  add(definition.gameIdColumn, "=", query.gameId);
  add(definition.leagueColumn, "=", query.league);
  add(definition.sportColumn, "=", query.sport);
  add(definition.fromColumn, ">=", query.from);
  add(definition.fromColumn, "<=", query.to);

  const where = clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "";
  return { params, sql: `${definition.sql}${where}` };
}

function* rowsToCsv(
  definition: DatasetDefinition,
  rows: Iterable<Record<string, unknown>>
) {
  yield `${definition.columns.map(csvCell).join(",")}\n`;
  for (const row of rows) {
    yield `${definition.columns.map((column) => csvCell(row[column])).join(",")}\n`;
  }
}

function* rowsToJsonl(rows: Iterable<Record<string, unknown>>) {
  for (const row of rows) {
    yield `${JSON.stringify(row)}\n`;
  }
}

export function getExportCatalogPayload() {
  const db = getDatabase();
  const datasets = Object.entries(datasetDefinitions).map(
    ([id, definition]) => {
      const row = db.prepare(definition.countSql).get() as
        | { count: number }
        | undefined;
      return {
        formats: ["csv", "jsonl"],
        id,
        rowCount: Number(row?.count ?? 0),
        title: definition.title,
      };
    }
  );

  return {
    data: {
      datasets: [
        ...datasets,
        {
          formats: ["sqlite"],
          id: "sqlite",
          rowCount: null,
          title: "SQLite database snapshot",
        },
      ],
      filters: {
        family: "Applies to market quote, market, and instrument exports.",
        from: "Captured-at lower bound where available; scheduled-start for game-level datasets.",
        gameId: "Canonical game id.",
        league: "League code, for example NBA.",
        source: "Provider source, for example bet365, kalshi, polymarket.",
        sport: "Sport key, for example basketball.",
        to: "Captured-at upper bound where available; scheduled-start for game-level datasets.",
      },
    },
    meta: { generatedAt: new Date().toISOString() },
  };
}

export function buildDatasetExport(options: {
  dataset: string;
  format: ExportFormat;
  query?: ExportQuery;
}) {
  const definition = datasetDefinitions[options.dataset as ExportDataset];
  if (!definition) {
    return null;
  }

  const { params, sql } = buildFilteredSql(definition, options.query ?? {});
  const iterator = getDatabase()
    .prepare(sql)
    .iterate(...params) as Iterable<Record<string, unknown>>;
  const body =
    options.format === "csv"
      ? Readable.from(rowsToCsv(definition, iterator))
      : Readable.from(rowsToJsonl(iterator));
  const stamp = new Date().toISOString().replaceAll(":", "-");
  return {
    body,
    contentType:
      options.format === "csv"
        ? "text/csv; charset=utf-8"
        : "application/x-ndjson; charset=utf-8",
    filename: `${definition.filename}-${stamp}.${options.format}`,
  };
}

export function getSqliteExportPath() {
  return getDatabasePath();
}

export async function createSqliteExportSnapshot() {
  const tempDir = mkdtempSync(join(tmpdir(), "signal-console-export-"));
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const filename = `signal-console-${stamp}.sqlite`;
  const snapshotPath = join(tempDir, filename);

  try {
    await backupDatabase(snapshotPath);
  } catch (error) {
    rmSync(tempDir, { force: true, recursive: true });
    throw error;
  }

  let cleaned = false;
  return {
    cleanup() {
      if (cleaned) return;
      cleaned = true;
      rmSync(tempDir, { force: true, recursive: true });
    },
    filename,
    path: snapshotPath,
  };
}
