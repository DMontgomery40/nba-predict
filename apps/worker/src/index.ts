import {
  ensureFixturesLoaded,
  getModeSnapshot,
} from "@signal-console/adapters";
import {
  checkDatabaseHealth,
  closeDatabase,
  createAppLogger,
  getDatabasePath,
  serializeErrorForLog,
  type AppLogger,
} from "@signal-console/shared";

const defaultIntervalMs = Number(process.env.WORKER_INTERVAL_MS ?? "30000");
const defaultMaxBackoffMs = Number(
  process.env.WORKER_MAX_BACKOFF_MS ?? String(defaultIntervalMs * 4)
);
const workerLogger = createAppLogger({ component: "worker" });

export type WorkerHeartbeatSummary = {
  capturedAt: string;
  database: ReturnType<typeof checkDatabaseHealth>;
  dbPath: string;
  demoStoryline: string;
  liveDegradedSources: string[];
  replayFrame: number;
  replayStoryline: string;
};

export function calculateBackoffDelay(
  intervalMs: number,
  consecutiveFailures: number,
  maxBackoffMs = defaultMaxBackoffMs
) {
  return Math.min(intervalMs * 2 ** consecutiveFailures, maxBackoffMs);
}

export function buildWorkerHeartbeatSummary(options?: {
  now?: () => Date;
  resolveSnapshot?: typeof getModeSnapshot;
}) {
  const resolveSnapshot = options?.resolveSnapshot ?? getModeSnapshot;
  const now = options?.now ?? (() => new Date());
  const demoSnapshot = resolveSnapshot("demo");
  const replaySnapshot = resolveSnapshot("replay");
  const liveSnapshot = resolveSnapshot("live");

  return {
    capturedAt: now().toISOString(),
    database: checkDatabaseHealth(),
    dbPath: getDatabasePath(),
    demoStoryline: demoSnapshot.storyline.id,
    liveDegradedSources: liveSnapshot.frame.sourceHealth
      .filter((source) => source.status !== "healthy")
      .map((source) => source.sourceId),
    replayFrame: replaySnapshot.frame.frameIndex,
    replayStoryline: replaySnapshot.storyline.id,
  } satisfies WorkerHeartbeatSummary;
}

export async function runWorkerCycle(options?: {
  consecutiveFailures?: number;
  ensureLoaded?: typeof ensureFixturesLoaded;
  intervalMs?: number;
  logger?: AppLogger;
  maxBackoffMs?: number;
  now?: () => Date;
  onHeartbeat?: (summary: WorkerHeartbeatSummary) => Promise<void> | void;
  resolveSnapshot?: typeof getModeSnapshot;
}) {
  const ensureLoaded = options?.ensureLoaded ?? ensureFixturesLoaded;
  const intervalMs = options?.intervalMs ?? defaultIntervalMs;
  const logger = options?.logger ?? workerLogger;
  const maxBackoffMs = options?.maxBackoffMs ?? defaultMaxBackoffMs;
  const consecutiveFailures = options?.consecutiveFailures ?? 0;

  try {
    ensureLoaded();
    const summary = buildWorkerHeartbeatSummary({
      now: options?.now,
      resolveSnapshot: options?.resolveSnapshot,
    });

    await options?.onHeartbeat?.(summary);
    logger.info(summary, "Worker heartbeat completed.");

    return {
      nextDelayMs: intervalMs,
      ok: true as const,
      summary,
    };
  } catch (error) {
    const nextDelayMs = calculateBackoffDelay(
      intervalMs,
      consecutiveFailures + 1,
      maxBackoffMs
    );

    logger.error(
      {
        error: serializeErrorForLog(error),
        nextDelayMs,
      },
      "Worker cycle failed."
    );

    return {
      error,
      nextDelayMs,
      ok: false as const,
    };
  }
}

export function startWorker(options?: {
  intervalMs?: number;
  logger?: AppLogger;
  maxBackoffMs?: number;
}) {
  const intervalMs = options?.intervalMs ?? defaultIntervalMs;
  const logger = options?.logger ?? workerLogger;
  const maxBackoffMs = options?.maxBackoffMs ?? defaultMaxBackoffMs;
  let stopped = false;
  let consecutiveFailures = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = (reason: string) => {
    if (stopped) {
      return;
    }

    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    closeDatabase();
    logger.info({ reason }, "Worker shutdown complete.");
  };

  const scheduleNext = (delayMs: number) => {
    if (stopped) {
      return;
    }

    timer = setTimeout(async () => {
      const cycleLogger = logger.child({ cycleDelayMs: delayMs });
      const result = await runWorkerCycle({
        consecutiveFailures,
        intervalMs,
        logger: cycleLogger,
        maxBackoffMs,
      });

      consecutiveFailures = result.ok ? 0 : consecutiveFailures + 1;
      scheduleNext(result.nextDelayMs);
    }, delayMs);
  };

  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  logger.info(
    {
      intervalMs,
      maxBackoffMs,
    },
    "Worker started."
  );

  scheduleNext(0);

  return {
    stop,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker();
}
