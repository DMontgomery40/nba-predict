import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { buildApiServer } from "../../api/src/server";
import { removeDatabaseArtifacts } from "../../../packages/shared/src/index";

const dbPath =
  process.env.SIGNAL_CONSOLE_DB_PATH ??
  resolve(process.cwd(), "../../data/signal-console.e2e.sqlite");
const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? "8787");

removeDatabaseArtifacts(dbPath);
mkdirSync(dirname(dbPath), { recursive: true });

const app = buildApiServer();
await app.listen({ host, port });

const shutdown = async () => {
  await app.close();
  process.exit(0);
};

process.once("SIGINT", () => {
  void shutdown();
});
process.once("SIGTERM", () => {
  void shutdown();
});
