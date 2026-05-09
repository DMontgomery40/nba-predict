import {
  syncKalshiNbaDirect,
  syncOddsApiBet365NbaMarkets,
  syncPolymarketNbaMarkets,
} from "@signal-console/adapters";
import {
  checkDatabaseHealth,
  closeDatabase,
  createAppLogger,
  getDatabasePath,
  loadRuntimeEnv,
  serializeErrorForLog,
  type AppLogger,
} from "@signal-console/shared";

import { syncNbaSidecarWindow } from "./nba-sidecar";

const workerLogger = createAppLogger({ component: "worker" });

function getDefaultIntervalMs() {
  return Number(process.env.WORKER_INTERVAL_MS ?? "30000");
}

function getDefaultMaxBackoffMs(intervalMs = getDefaultIntervalMs()) {
  return Number(process.env.WORKER_MAX_BACKOFF_MS ?? String(intervalMs * 4));
}

function getSidecarLookbackDays() {
  return Number(process.env.NBA_SIDECAR_LOOKBACK_DAYS ?? "1");
}

function getSidecarLookaheadDays() {
  return Number(process.env.NBA_SIDECAR_LOOKAHEAD_DAYS ?? "3");
}

export type WorkerHeartbeatSummary = {
  bet365GamesMatched: number;
  bet365SourceMarketsObserved: number;
  capturedAt: string;
  database: ReturnType<typeof checkDatabaseHealth>;
  dbPath: string;
  kalshiGamesMatched: number;
  kalshiSourceMarketsObserved: number;
  nbaGamesObserved: number;
  nbaSidecarConfigured: boolean;
  polymarketGamesMatched: number;
  polymarketSourceMarketsObserved: number;
};

export function calculateBackoffDelay(
  intervalMs: number,
  consecutiveFailures: number,
  maxBackoffMs = getDefaultMaxBackoffMs(intervalMs)
) {
  return Math.min(intervalMs * 2 ** consecutiveFailures, maxBackoffMs);
}

export function buildWorkerHeartbeatSummary(options?: {
  bet365GamesMatched?: number;
  bet365SourceMarketsObserved?: number;
  kalshiGamesMatched?: number;
  kalshiSourceMarketsObserved?: number;
  nbaGameCount?: number;
  nbaSidecarConfigured?: boolean;
  now?: () => Date;
  polymarketGamesMatched?: number;
  polymarketSourceMarketsObserved?: number;
}) {
  loadRuntimeEnv();
  const now = options?.now ?? (() => new Date());

  return {
    bet365GamesMatched: options?.bet365GamesMatched ?? 0,
    bet365SourceMarketsObserved: options?.bet365SourceMarketsObserved ?? 0,
    capturedAt: now().toISOString(),
    database: checkDatabaseHealth(),
    dbPath: getDatabasePath(),
    kalshiGamesMatched: options?.kalshiGamesMatched ?? 0,
    kalshiSourceMarketsObserved: options?.kalshiSourceMarketsObserved ?? 0,
    nbaGamesObserved: options?.nbaGameCount ?? 0,
    nbaSidecarConfigured:
      options?.nbaSidecarConfigured ??
      Boolean(process.env.NBA_SIDECAR_BASE_URL),
    polymarketGamesMatched: options?.polymarketGamesMatched ?? 0,
    polymarketSourceMarketsObserved:
      options?.polymarketSourceMarketsObserved ?? 0,
  } satisfies WorkerHeartbeatSummary;
}

export async function runWorkerCycle(options?: {
  consecutiveFailures?: number;
  intervalMs?: number;
  logger?: AppLogger;
  maxBackoffMs?: number;
  now?: () => Date;
  onHeartbeat?: (summary: WorkerHeartbeatSummary) => Promise<void> | void;
  syncBet365?: typeof syncOddsApiBet365NbaMarkets;
  syncKalshi?: typeof syncKalshiNbaDirect;
  syncNbaSidecar?: typeof syncNbaSidecarWindow;
  syncPolymarket?: typeof syncPolymarketNbaMarkets;
}) {
  loadRuntimeEnv();
  const intervalMs = options?.intervalMs ?? getDefaultIntervalMs();
  const logger = options?.logger ?? workerLogger;
  const maxBackoffMs =
    options?.maxBackoffMs ?? getDefaultMaxBackoffMs(intervalMs);
  const consecutiveFailures = options?.consecutiveFailures ?? 0;
  const syncBet365 = options?.syncBet365 ?? syncOddsApiBet365NbaMarkets;
  const syncKalshi = options?.syncKalshi ?? syncKalshiNbaDirect;
  const syncNbaSidecar = options?.syncNbaSidecar ?? syncNbaSidecarWindow;
  const syncPolymarket = options?.syncPolymarket ?? syncPolymarketNbaMarkets;

  try {
    let bet365GamesMatched = 0;
    let bet365SourceMarketsObserved = 0;
    let kalshiGamesMatched = 0;
    let kalshiSourceMarketsObserved = 0;
    let nbaGameCount = 0;
    let polymarketGamesMatched = 0;
    let polymarketSourceMarketsObserved = 0;
    const nbaSidecarConfigured = Boolean(process.env.NBA_SIDECAR_BASE_URL);
    const oddsApiConfigured = Boolean(
      process.env.ODDS_API_KEY ?? process.env.ODDS_API_IO_KEY
    );
    const kalshiDirectConfigured = Boolean(process.env.KALSHI_API_KEY);

    if (nbaSidecarConfigured) {
      const syncResult = await syncNbaSidecar({
        lookaheadDays: getSidecarLookaheadDays(),
        lookbackDays: getSidecarLookbackDays(),
        now: options?.now,
      });
      nbaGameCount = syncResult.gamesSeen;
      logger.info(syncResult, "NBA sidecar sync completed.");
    }

    if (oddsApiConfigured) {
      const bet365Result = await syncBet365({
        now: options?.now,
      });
      bet365GamesMatched = bet365Result.gamesMatched;
      bet365SourceMarketsObserved = bet365Result.sourceMarketsObserved;
      logger.info(bet365Result, "Bet365 sync completed.");
    }

    if (kalshiDirectConfigured) {
      const kalshiResult = await syncKalshi({
        now: options?.now,
      });
      kalshiGamesMatched = kalshiResult.gamesMatched;
      kalshiSourceMarketsObserved = kalshiResult.sourceMarketsObserved;
      logger.info(kalshiResult, "Kalshi sync completed.");
    }

    const polymarketResult = await syncPolymarket({
      now: options?.now,
    });
    polymarketGamesMatched = polymarketResult.gamesMatched;
    polymarketSourceMarketsObserved = polymarketResult.sourceMarketsObserved;
    logger.info(polymarketResult, "Polymarket sync completed.");

    const summary = buildWorkerHeartbeatSummary({
      bet365GamesMatched,
      bet365SourceMarketsObserved,
      kalshiGamesMatched,
      kalshiSourceMarketsObserved,
      nbaGameCount,
      nbaSidecarConfigured,
      now: options?.now,
      polymarketGamesMatched,
      polymarketSourceMarketsObserved,
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
  loadRuntimeEnv();
  const intervalMs = options?.intervalMs ?? getDefaultIntervalMs();
  const logger = options?.logger ?? workerLogger;
  const maxBackoffMs =
    options?.maxBackoffMs ?? getDefaultMaxBackoffMs(intervalMs);
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
