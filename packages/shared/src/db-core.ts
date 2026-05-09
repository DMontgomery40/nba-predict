import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Database from "better-sqlite3";

import {
  DatabaseFailureError,
  serializeErrorForLog,
  toAppError,
} from "./errors";
import { createAppLogger } from "./logger";
import { applyMigrations, currentSchemaVersion } from "./migrations";

const defaultDbPath = resolve(
  fileURLToPath(new URL("../../../data/signal-console.sqlite", import.meta.url))
);

const databaseLogger = createAppLogger({ component: "database" });

let database: Database.Database | null = null;
let activeDatabasePath: string | null = null;

export function currentTimestamp() {
  return new Date().toISOString();
}

export function getDatabasePath() {
  return process.env.SIGNAL_CONSOLE_DB_PATH ?? defaultDbPath;
}

export function executeDatabaseOperation<T>(
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
              "Inspect the SQLite file, migrations, and write path before retrying the failed storage operation.",
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
    applyMigrations(database, dbPath);
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

function countTable(db: Database.Database, tableName: string) {
  return Number(
    (
      db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as
        | { count: number }
        | undefined
    )?.count ?? 0
  );
}

export function checkDatabaseHealth() {
  try {
    const db = getDatabase();
    const integrityResult = String(
      db.prepare("PRAGMA integrity_check").pluck().get() ?? ""
    );
    const appStateKeys = db
      .prepare("SELECT key FROM app_state ORDER BY key ASC")
      .all()
      .map((row) => String((row as { key: string }).key));
    const schemaVersion = getDatabaseSchemaVersion();

    const counts = {
      adminActionCount: countTable(db, "admin_actions"),
      gameCount: countTable(db, "games"),
      quoteTickCount: countTable(db, "quote_ticks"),
      rawPayloadCount: countTable(db, "raw_payloads"),
      sourceMarketCount: countTable(db, "source_markets"),
      watchlistCount: countTable(db, "watchlist"),
    };

    if (integrityResult !== "ok") {
      return {
        appStateKeys,
        counts,
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
      counts,
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
        adminActionCount: 0,
        gameCount: 0,
        quoteTickCount: 0,
        rawPayloadCount: 0,
        sourceMarketCount: 0,
        watchlistCount: 0,
      },
      details: appError.details,
      message: appError.message,
      operatorHint: appError.operatorHint,
      path: getDatabasePath(),
      schemaVersion: existsSync(getDatabasePath())
        ? currentSchemaVersion
        : null,
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

export async function backupDatabase(destinationPath: string) {
  const db = getDatabase();
  await db.backup(destinationPath);
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
