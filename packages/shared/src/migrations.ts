import { DatabaseFailureError } from "./errors";

import type Database from "better-sqlite3";

export const currentSchemaVersion = 7;

function nowIso() {
  return new Date().toISOString();
}

function ensureSchemaMigrationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

function getAppliedVersion(db: Database.Database) {
  const row = db
    .prepare(
      "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations"
    )
    .get() as { version: number } | undefined;

  return row?.version ?? 0;
}

function insertMigration(db: Database.Database, version: number, name: string) {
  db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
  ).run(version, name, nowIso());
}

function tableExists(db: Database.Database, tableName: string) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

function normalizeMigrationToken(value: string | number | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildMigrationStableId(
  parts: Array<string | number | null | undefined>
) {
  return parts.map(normalizeMigrationToken).filter(Boolean).join("-");
}

function applyInitialRuntimeSchema(db: Database.Database) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS watchlist (
        event_id TEXT PRIMARY KEY,
        priority REAL,
        status TEXT NOT NULL,
        note TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    insertMigration(db, 1, "initial-runtime-schema");
  })();
}

function applyLiveResearchSchema(db: Database.Database) {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        sport TEXT NOT NULL,
        league TEXT NOT NULL,
        source_game_key_nba TEXT,
        home_participant_json TEXT NOT NULL,
        away_participant_json TEXT NOT NULL,
        scheduled_start TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS game_states (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        status TEXT NOT NULL,
        period INTEGER,
        clock TEXT,
        home_score INTEGER,
        away_score INTEGER,
        is_final INTEGER NOT NULL DEFAULT 0,
        started_at TEXT,
        final_at TEXT,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS market_instruments (
        id TEXT PRIMARY KEY,
        game_id TEXT NOT NULL,
        family TEXT NOT NULL,
        selection TEXT NOT NULL,
        line REAL,
        participant_key TEXT,
        in_play INTEGER NOT NULL DEFAULT 0,
        display_label TEXT NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS source_markets (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        source_market_key TEXT NOT NULL,
        source_selection_key TEXT,
        game_id TEXT NOT NULL,
        instrument_id TEXT,
        raw_family TEXT,
        raw_label TEXT,
        mapping_status TEXT NOT NULL,
        raw_metadata_json TEXT,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
        FOREIGN KEY (instrument_id) REFERENCES market_instruments(id) ON DELETE SET NULL,
        UNIQUE (source, source_market_key, source_selection_key)
      );

      CREATE TABLE IF NOT EXISTS quote_ticks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_market_id TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        price_raw REAL,
        odds_raw TEXT,
        line_raw REAL,
        implied_probability REAL,
        best_bid REAL,
        best_ask REAL,
        volume REAL,
        depth_score REAL,
        is_heartbeat INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (source_market_id) REFERENCES source_markets(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS raw_payloads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        content_hash TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS adapter_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        status TEXT NOT NULL,
        error_code TEXT,
        error_message TEXT,
        records_seen INTEGER NOT NULL DEFAULT 0,
        records_written INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS mapping_resolutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_market_id TEXT NOT NULL,
        instrument_id TEXT NOT NULL,
        resolved_by TEXT NOT NULL,
        resolved_at TEXT NOT NULL,
        reason TEXT NOT NULL,
        FOREIGN KEY (source_market_id) REFERENCES source_markets(id) ON DELETE CASCADE,
        FOREIGN KEY (instrument_id) REFERENCES market_instruments(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS game_outcomes (
        game_id TEXT PRIMARY KEY,
        final_home_score INTEGER NOT NULL,
        final_away_score INTEGER NOT NULL,
        winner_key TEXT,
        captured_at TEXT NOT NULL,
        FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS admin_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT NOT NULL,
        scope TEXT NOT NULL,
        requested_at TEXT NOT NULL,
        requested_by TEXT NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_game_states_game_captured
        ON game_states(game_id, captured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_quote_ticks_source_market_captured
        ON quote_ticks(source_market_id, captured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_quote_ticks_source_market_latest
        ON quote_ticks(source_market_id, captured_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_source_markets_source_key
        ON source_markets(source, source_market_key);
      CREATE INDEX IF NOT EXISTS idx_market_instruments_game_family_inplay
        ON market_instruments(game_id, family, in_play);
      CREATE INDEX IF NOT EXISTS idx_raw_payloads_source_entity
        ON raw_payloads(source, entity_type, entity_id, captured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_raw_payloads_entity_latest
        ON raw_payloads(entity_type, entity_id, captured_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_games_scheduled_date
        ON games(substr(scheduled_start, 1, 10));
      CREATE INDEX IF NOT EXISTS idx_adapter_runs_source_started
        ON adapter_runs(source, started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_mapping_resolutions_source_market
        ON mapping_resolutions(source_market_id, resolved_at DESC);
    `);

    insertMigration(db, 2, "live-research-schema");
  })();
}

function applyLegacyRuntimeCleanup(db: Database.Database) {
  db.transaction(() => {
    db.exec(`
      DROP TABLE IF EXISTS storyline_frames;
      DROP TABLE IF EXISTS storylines;
    `);

    db.prepare(
      `
        DELETE FROM app_state
        WHERE key IN (
          'demo_storyline_id',
          'replay_frame_index',
          'replay_storyline_id'
        )
      `
    ).run();

    insertMigration(db, 3, "legacy-runtime-cleanup");
  })();
}

function applyHistoricalIngestionSupport(db: Database.Database) {
  db.transaction(() => {
    db.exec(`
      DELETE FROM quote_ticks
      WHERE id NOT IN (
        SELECT MIN(id)
        FROM quote_ticks
        GROUP BY source_market_id, captured_at
      );
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_ticks_unique_observation
        ON quote_ticks(source_market_id, captured_at);
    `);

    const adapterRunColumns = db
      .prepare(`PRAGMA table_info('adapter_runs')`)
      .all() as Array<{ name: string }>;

    if (!adapterRunColumns.some((column) => column.name === "capture_mode")) {
      db.exec(`
        ALTER TABLE adapter_runs
          ADD COLUMN capture_mode TEXT NOT NULL DEFAULT 'live';
      `);
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_adapter_runs_source_mode_started
        ON adapter_runs(source, capture_mode, started_at DESC);
    `);

    insertMigration(db, 4, "historical-ingestion-support");
  })();
}

export function applyMigrations(db: Database.Database, dbPath: string) {
  ensureSchemaMigrationsTable(db);
  const appliedVersion = getAppliedVersion(db);

  if (appliedVersion > currentSchemaVersion) {
    throw new DatabaseFailureError(
      "Database schema version is newer than this runtime supports.",
      {
        details: {
          appliedVersion,
          currentSchemaVersion,
          path: dbPath,
        },
        operatorHint:
          "Use a compatible runtime or recreate the local SQLite database with the current schema.",
      }
    );
  }

  if (appliedVersion < 1) {
    applyInitialRuntimeSchema(db);
  }

  if (getAppliedVersion(db) < 2) {
    applyLiveResearchSchema(db);
  }

  if (getAppliedVersion(db) < 3) {
    applyLegacyRuntimeCleanup(db);
  }

  if (getAppliedVersion(db) < 4) {
    applyHistoricalIngestionSupport(db);
  }

  if (getAppliedVersion(db) < 5) {
    applyCanonicalInstrumentConsolidation(db);
  }

  if (getAppliedVersion(db) < 6) {
    applyPolymarketPlayerPropCanonicalIds(db);
  }

  if (getAppliedVersion(db) < 7) {
    applyLatestLookupIndexes(db);
  }
}

function applyCanonicalInstrumentConsolidation(db: Database.Database) {
  db.transaction(() => {
    db.exec(`
      INSERT OR IGNORE INTO market_instruments (
        id, game_id, family, selection, line, participant_key, in_play, display_label
      )
      SELECT
        REPLACE(
          REPLACE(mi.id, '-polymarket-historical', ''),
          '-kalshi', ''
        ) AS canonical_id,
        mi.game_id, mi.family, mi.selection, mi.line,
        mi.participant_key, mi.in_play, mi.display_label
      FROM market_instruments mi
      WHERE mi.id LIKE '%-kalshi'
         OR mi.id LIKE '%-polymarket-historical';
    `);

    db.exec(`
      UPDATE source_markets
      SET instrument_id = REPLACE(
        REPLACE(instrument_id, '-polymarket-historical', ''),
        '-kalshi', ''
      )
      WHERE instrument_id LIKE '%-kalshi'
         OR instrument_id LIKE '%-polymarket-historical';
    `);

    db.exec(`
      DELETE FROM market_instruments
      WHERE id LIKE '%-kalshi'
         OR id LIKE '%-polymarket-historical';
    `);

    insertMigration(db, 5, "canonical-instrument-consolidation");
  })();
}

function applyPolymarketPlayerPropCanonicalIds(db: Database.Database) {
  db.transaction(() => {
    const rows = db
      .prepare(
        `
          SELECT
            sm.id AS sourceMarketId,
            sm.instrument_id AS sourceInstrumentId,
            sm.game_id AS gameId,
            sm.raw_family AS rawFamily,
            mi.id AS instrumentId,
            mi.family AS family,
            mi.selection AS selection,
            mi.line AS line,
            mi.participant_key AS participantKey,
            mi.in_play AS inPlay,
            mi.display_label AS displayLabel
          FROM source_markets sm
          JOIN market_instruments mi ON mi.id = sm.instrument_id
          WHERE sm.source = 'polymarket'
            AND mi.family = 'player-prop'
            AND sm.raw_family IN ('assists', 'points', 'rebounds', 'threes')
            AND mi.participant_key IS NOT NULL
            AND mi.selection IS NOT NULL
        `
      )
      .all() as Array<{
      displayLabel: string;
      family: string;
      gameId: string;
      inPlay: number;
      instrumentId: string;
      line: number | null;
      participantKey: string | null;
      rawFamily: string | null;
      selection: string;
      sourceInstrumentId: string | null;
      sourceMarketId: string;
    }>;

    for (const row of rows) {
      const canonicalId = buildMigrationStableId([
        row.gameId,
        "player-prop",
        row.rawFamily,
        row.participantKey,
        row.selection,
        row.line,
      ]);

      if (!canonicalId || canonicalId === row.instrumentId) {
        continue;
      }

      db.prepare(
        `
          INSERT OR IGNORE INTO market_instruments (
            id, game_id, family, selection, line, participant_key, in_play, display_label
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        canonicalId,
        row.gameId,
        row.family,
        row.selection,
        row.line,
        row.participantKey,
        row.inPlay,
        row.displayLabel
      );

      db.prepare(
        `
          UPDATE source_markets
          SET instrument_id = ?
          WHERE id = ?
        `
      ).run(canonicalId, row.sourceMarketId);

      if (row.sourceInstrumentId) {
        db.prepare(
          `
            DELETE FROM market_instruments
            WHERE id = ?
              AND id != ?
              AND NOT EXISTS (
                SELECT 1
                FROM source_markets sm
                WHERE sm.instrument_id = market_instruments.id
              )
          `
        ).run(row.sourceInstrumentId, canonicalId);
      }
    }

    insertMigration(db, 6, "polymarket-player-prop-canonical-ids");
  })();
}

function applyLatestLookupIndexes(db: Database.Database) {
  db.transaction(() => {
    if (tableExists(db, "quote_ticks")) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_quote_ticks_source_market_latest
          ON quote_ticks(source_market_id, captured_at DESC, id DESC);
      `);
    }

    if (tableExists(db, "raw_payloads")) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_raw_payloads_entity_latest
          ON raw_payloads(entity_type, entity_id, captured_at DESC, id DESC);
      `);
    }

    if (tableExists(db, "games")) {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_games_scheduled_date
          ON games(substr(scheduled_start, 1, 10));
      `);
    }

    insertMigration(db, 7, "latest-lookup-indexes");
  })();
}
