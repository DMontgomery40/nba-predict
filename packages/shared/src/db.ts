import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import type {
  Storyline,
  StorylineFrame,
  WatchlistRecord,
} from "@signal-console/domain";

import {
  DatabaseFailureError,
  serializeErrorForLog,
  toAppError,
} from "./errors";
import { createAppLogger } from "./logger";

const defaultDbPath = resolve(
  fileURLToPath(new URL("../../../data/signal-console.sqlite", import.meta.url))
);
const currentSchemaVersion = 1;
const databaseLogger = createAppLogger({ component: "database" });

let database: Database.Database | null = null;
let activeDatabasePath: string | null = null;

function currentTimestamp() {
  return new Date().toISOString();
}

function executeDatabaseOperation<T>(
  operation: string,
  work: () => T,
  context: Record<string, unknown> = {}
) {
  try {
    const result = work();
    databaseLogger.debug(
      { operation, ...context },
      "Database operation completed."
    );
    return result;
  } catch (error) {
    const appError =
      error instanceof DatabaseFailureError
        ? error
        : new DatabaseFailureError("Database operation failed.", {
            cause: error,
            details: {
              ...context,
              operation,
              path: getDatabasePath(),
            },
            operatorHint:
              "Inspect the SQLite file and migration state before retrying the failed storage path.",
          });

    databaseLogger.error(
      {
        operation,
        ...context,
        error: serializeErrorForLog(appError),
      },
      "Database operation failed."
    );

    throw appError;
  }
}

function parseFramePayload(payload: string, context: Record<string, unknown>) {
  try {
    return JSON.parse(payload) as StorylineFrame;
  } catch (error) {
    throw new DatabaseFailureError("Storyline frame payload is corrupt.", {
      cause: error,
      details: context,
      operatorHint:
        "Reset or reseed the local SQLite fixture store because a storyline frame could not be decoded.",
    });
  }
}

function applyMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const row = db
    .prepare(
      "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations"
    )
    .get() as { version: number } | undefined;
  const appliedVersion = row?.version ?? 0;

  if (appliedVersion > currentSchemaVersion) {
    throw new DatabaseFailureError(
      "Database schema version is newer than this runtime supports.",
      {
        details: {
          appliedVersion,
          currentSchemaVersion,
          path: getDatabasePath(),
        },
        operatorHint:
          "Use a compatible runtime or recreate the local SQLite database with the current schema.",
      }
    );
  }

  if (appliedVersion < 1) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS storylines (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          fixture_pack TEXT NOT NULL,
          default_frame_index INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS storyline_frames (
          storyline_id TEXT NOT NULL,
          frame_index INTEGER NOT NULL,
          captured_at TEXT NOT NULL,
          payload TEXT NOT NULL,
          PRIMARY KEY (storyline_id, frame_index),
          FOREIGN KEY (storyline_id) REFERENCES storylines(id) ON DELETE CASCADE
        );

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

      db.prepare(
        "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)"
      ).run(1, "initial-runtime-schema", currentTimestamp());
    })();

    databaseLogger.info(
      {
        path: getDatabasePath(),
        version: 1,
      },
      "Applied database migration."
    );
  }
}

export function getDatabasePath() {
  return process.env.SIGNAL_CONSOLE_DB_PATH ?? defaultDbPath;
}

export function getDatabase() {
  const dbPath = getDatabasePath();
  if (database && activeDatabasePath === dbPath) {
    return database;
  }

  if (database && activeDatabasePath !== dbPath) {
    databaseLogger.info(
      {
        fromPath: activeDatabasePath,
        toPath: dbPath,
      },
      "Switching SQLite handle to a new database path."
    );
    database.close();
    database = null;
  }

  return executeDatabaseOperation("database.open", () => {
    mkdirSync(dirname(dbPath), { recursive: true });
    database = new Database(dbPath);
    activeDatabasePath = dbPath;
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    applyMigrations(database);
    return database;
  });
}

export function getDatabaseSchemaVersion() {
  return executeDatabaseOperation("database.schemaVersion", () => {
    const db = getDatabase();
    const row = db
      .prepare(
        "SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations"
      )
      .get() as { version: number } | undefined;

    return row?.version ?? 0;
  });
}

export function checkDatabaseHealth() {
  try {
    const db = getDatabase();
    const integrityResult = String(
      db.prepare("PRAGMA integrity_check").pluck().get() ?? ""
    );
    const storylineCount = Number(
      (
        db.prepare("SELECT COUNT(*) AS count FROM storylines").get() as
          | { count: number }
          | undefined
      )?.count ?? 0
    );
    const watchlistCount = Number(
      (
        db.prepare("SELECT COUNT(*) AS count FROM watchlist").get() as
          | { count: number }
          | undefined
      )?.count ?? 0
    );
    const appStateKeys = db
      .prepare("SELECT key FROM app_state ORDER BY key ASC")
      .all()
      .map((row) => String((row as { key: string }).key));
    const schemaVersion = getDatabaseSchemaVersion();

    if (integrityResult !== "ok") {
      return {
        appStateKeys,
        counts: {
          storylineCount,
          watchlistCount,
        },
        details: {
          integrityResult,
        },
        message: "SQLite integrity check failed.",
        operatorHint:
          "Recreate or repair the local SQLite database before trusting readiness checks.",
        path: getDatabasePath(),
        schemaVersion,
        status: "error" as const,
      };
    }

    return {
      appStateKeys,
      counts: {
        storylineCount,
        watchlistCount,
      },
      message: "SQLite database opened and passed integrity checks.",
      path: getDatabasePath(),
      schemaVersion,
      status: "ok" as const,
    };
  } catch (error) {
    const appError = toAppError(error);

    return {
      appStateKeys: [] as string[],
      counts: {
        storylineCount: 0,
        watchlistCount: 0,
      },
      details: appError.details,
      message: appError.message,
      operatorHint: appError.operatorHint,
      path: getDatabasePath(),
      schemaVersion: null,
      status: "error" as const,
    };
  }
}

export function closeDatabase() {
  if (!database) {
    return;
  }

  databaseLogger.info(
    { path: activeDatabasePath },
    "Closing SQLite database handle."
  );
  database.close();
  database = null;
  activeDatabasePath = null;
}

export function removeDatabaseArtifacts(dbPath = getDatabasePath()) {
  closeDatabase();
  rmSync(dbPath, { force: true });
  rmSync(`${dbPath}-shm`, { force: true });
  rmSync(`${dbPath}-wal`, { force: true });
}

export function resetDatabase() {
  closeDatabase();
}

export function seedStorylines(storylines: Storyline[]) {
  executeDatabaseOperation(
    "storylines.seed",
    () => {
      const db = getDatabase();
      const insertStoryline = db.prepare(`
        INSERT OR REPLACE INTO storylines (id, name, description, fixture_pack, default_frame_index)
        VALUES (@id, @name, @description, @fixturePack, @defaultFrameIndex)
      `);
      const deleteFrames = db.prepare(
        "DELETE FROM storyline_frames WHERE storyline_id = ?"
      );
      const insertFrame = db.prepare(`
        INSERT INTO storyline_frames (storyline_id, frame_index, captured_at, payload)
        VALUES (@storylineId, @frameIndex, @capturedAt, @payload)
      `);
      const getStateStatement = db.prepare(
        "SELECT value FROM app_state WHERE key = ?"
      );
      const upsertState = db.prepare(`
        INSERT INTO app_state (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `);

      const transaction = db.transaction((items: Storyline[]) => {
        for (const storyline of items) {
          insertStoryline.run(storyline);
          deleteFrames.run(storyline.id);
          for (const frame of storyline.frames) {
            insertFrame.run({
              storylineId: storyline.id,
              frameIndex: frame.frameIndex,
              capturedAt: frame.capturedAt,
              payload: JSON.stringify(frame),
            });
          }
        }

        if (!getStateStatement.get("demo_storyline_id")) {
          upsertState.run("demo_storyline_id", storylines[0]?.id ?? "");
        }
        if (!getStateStatement.get("replay_storyline_id")) {
          upsertState.run("replay_storyline_id", storylines[0]?.id ?? "");
        }
        if (!getStateStatement.get("replay_frame_index")) {
          upsertState.run(
            "replay_frame_index",
            String(storylines[0]?.defaultFrameIndex ?? 0)
          );
        }
      });

      transaction(storylines);
    },
    {
      storylineCount: storylines.length,
    }
  );
}

export function listStorylines() {
  return executeDatabaseOperation("storylines.list", () => {
    const db = getDatabase();
    return db
      .prepare(
        "SELECT id, name, description, fixture_pack AS fixturePack, default_frame_index AS defaultFrameIndex FROM storylines ORDER BY id"
      )
      .all() as Array<{
      id: string;
      name: string;
      description: string;
      fixturePack: string;
      defaultFrameIndex: number;
    }>;
  });
}

export function getStorylineFrame(
  storylineId: string,
  frameIndex?: number
): StorylineFrame | null {
  return executeDatabaseOperation(
    "storylineFrame.get",
    () => {
      const db = getDatabase();
      const row =
        typeof frameIndex === "number"
          ? db
              .prepare(
                "SELECT payload FROM storyline_frames WHERE storyline_id = ? AND frame_index = ?"
              )
              .get(storylineId, frameIndex)
          : db
              .prepare(
                "SELECT payload FROM storyline_frames WHERE storyline_id = ? ORDER BY frame_index DESC LIMIT 1"
              )
              .get(storylineId);

      if (!row || typeof row !== "object" || !("payload" in row)) {
        return null;
      }

      return parseFramePayload(String(row.payload), {
        frameIndex,
        storylineId,
      });
    },
    {
      frameIndex,
      storylineId,
    }
  );
}

export function getStoryline(storylineId: string): Storyline | null {
  return executeDatabaseOperation(
    "storyline.get",
    () => {
      const db = getDatabase();
      const storyline = db
        .prepare(
          "SELECT id, name, description, fixture_pack AS fixturePack, default_frame_index AS defaultFrameIndex FROM storylines WHERE id = ?"
        )
        .get(storylineId) as
        | {
            id: string;
            name: string;
            description: string;
            fixturePack: string;
            defaultFrameIndex: number;
          }
        | undefined;

      if (!storyline) {
        return null;
      }

      const frames = db
        .prepare(
          "SELECT payload FROM storyline_frames WHERE storyline_id = ? ORDER BY frame_index ASC"
        )
        .all(storylineId)
        .map((row, index) =>
          parseFramePayload(String((row as { payload: string }).payload), {
            frameIndex: index,
            storylineId,
          })
        );

      return {
        ...storyline,
        frames,
      };
    },
    {
      storylineId,
    }
  );
}

export function getState(key: string) {
  return executeDatabaseOperation(
    "state.get",
    () => {
      const db = getDatabase();
      const row = db
        .prepare("SELECT value FROM app_state WHERE key = ?")
        .get(key) as { value: string } | undefined;

      return row?.value ?? null;
    },
    {
      key,
    }
  );
}

export function setState(key: string, value: string) {
  executeDatabaseOperation(
    "state.set",
    () => {
      const db = getDatabase();
      db.prepare(
        `
          INSERT INTO app_state (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `
      ).run(key, value);
    },
    {
      key,
    }
  );
}

export function getReplaySelection() {
  return {
    storylineId: getState("replay_storyline_id"),
    frameIndex: Number(getState("replay_frame_index") ?? "0"),
  };
}

export function setReplaySelection(storylineId: string, frameIndex: number) {
  setState("replay_storyline_id", storylineId);
  setState("replay_frame_index", String(frameIndex));
}

export function getDemoStorylineId() {
  return getState("demo_storyline_id");
}

export function setDemoStorylineId(storylineId: string) {
  setState("demo_storyline_id", storylineId);
}

export function getWatchlist(): WatchlistRecord[] {
  return executeDatabaseOperation("watchlist.list", () => {
    const db = getDatabase();
    return db
      .prepare(
        `
          SELECT
            event_id AS eventId,
            priority,
            status,
            note,
            updated_at AS updatedAt
          FROM watchlist
          ORDER BY updated_at DESC
        `
      )
      .all() as WatchlistRecord[];
  });
}

export function upsertWatchlist(entry: {
  eventId: string;
  priority?: number | null;
  status?: "queued" | "monitoring";
  note?: string | null;
}) {
  executeDatabaseOperation(
    "watchlist.upsert",
    () => {
      const db = getDatabase();
      const updatedAt = currentTimestamp();
      db.prepare(
        `
          INSERT INTO watchlist (event_id, priority, status, note, updated_at)
          VALUES (@eventId, @priority, @status, @note, @updatedAt)
          ON CONFLICT(event_id) DO UPDATE SET
            priority = excluded.priority,
            status = excluded.status,
            note = excluded.note,
            updated_at = excluded.updated_at
        `
      ).run({
        eventId: entry.eventId,
        priority: entry.priority ?? null,
        status: entry.status ?? "queued",
        note: entry.note ?? null,
        updatedAt,
      });
    },
    {
      eventId: entry.eventId,
      status: entry.status ?? "queued",
    }
  );
}

export function deleteWatchlist(eventId: string) {
  executeDatabaseOperation(
    "watchlist.delete",
    () => {
      const db = getDatabase();
      db.prepare("DELETE FROM watchlist WHERE event_id = ?").run(eventId);
    },
    {
      eventId,
    }
  );
}
