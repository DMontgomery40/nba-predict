import { existsSync } from "node:fs";

import { checkDatabaseHealth, createAppLogger } from "@signal-console/shared";

function appVersion() {
  return process.env.SIGNAL_CONSOLE_VERSION ?? "0.1.0";
}

function getOddsApiKey() {
  return process.env.ODDS_API_KEY ?? process.env.ODDS_API_IO_KEY;
}

type HealthLogger = {
  child: (bindings: Record<string, unknown>) => HealthLogger;
  debug: (bindings: Record<string, unknown>, message?: string) => void;
};

type HealthCheck = {
  details?: Record<string, unknown>;
  name: string;
  operatorHint?: string;
  status: "ok" | "error";
  summary: string;
};

function buildBaseHealthMetadata() {
  return {
    generatedAt: new Date().toISOString(),
    uptimeMs: Math.round(process.uptime() * 1000),
    version: appVersion(),
  };
}

async function checkNbaSidecarReadiness(
  baseUrl: string | undefined
): Promise<HealthCheck> {
  if (!baseUrl) {
    return {
      details: {
        baseUrl: null,
      },
      name: "nba-sidecar",
      operatorHint:
        "Set NBA_SIDECAR_BASE_URL and bring the sidecar up before advertising live readiness.",
      status: "error",
      summary: "NBA sidecar base URL is missing.",
    };
  }

  const healthUrl = new URL("/health/ready", baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);

  try {
    const response = await fetch(healthUrl, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        details: {
          baseUrl,
          statusCode: response.status,
        },
        name: "nba-sidecar",
        operatorHint:
          "Bring the NBA sidecar to ready state before advertising live game-state readiness.",
        status: "error",
        summary: `NBA sidecar readiness check returned HTTP ${response.status}.`,
      };
    }

    const payload = (await response.json().catch(() => null)) as {
      status?: unknown;
      summary?: unknown;
    } | null;
    if (payload?.status !== "ok") {
      return {
        details: {
          baseUrl,
          sidecarStatus: payload?.status ?? null,
          sidecarSummary: payload?.summary ?? null,
        },
        name: "nba-sidecar",
        operatorHint:
          "Bring the NBA sidecar to ready state before advertising live game-state readiness.",
        status: "error",
        summary: "NBA sidecar did not report ready.",
      };
    }

    return {
      details: {
        baseUrl,
        sidecarSummary: payload.summary ?? null,
      },
      name: "nba-sidecar",
      status: "ok",
      summary: "NBA sidecar is reachable and ready.",
    };
  } catch (error) {
    return {
      details: {
        baseUrl,
        error:
          error instanceof Error
            ? { message: error.message, name: error.name }
            : String(error),
      },
      name: "nba-sidecar",
      operatorHint:
        "Start the NBA sidecar or correct NBA_SIDECAR_BASE_URL before advertising live game-state readiness.",
      status: "error",
      summary: "NBA sidecar readiness check failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function buildLivenessPayload() {
  return {
    ...buildBaseHealthMetadata(),
    checks: [
      {
        name: "process",
        status: "ok" as const,
        summary: "Fastify process is accepting requests.",
      },
    ],
    status: "ok" as const,
  };
}

export async function buildReadinessPayload(context?: {
  logger?: HealthLogger;
}) {
  const logger =
    context?.logger ?? createAppLogger({ component: "api-readiness" });
  const checks: HealthCheck[] = [];
  const dbHealth = checkDatabaseHealth({ integrityCheck: "skip" });

  checks.push({
    details: {
      appStateKeys: dbHealth.appStateKeys,
      countAccuracy: dbHealth.countAccuracy,
      counts: dbHealth.counts,
      path: dbHealth.path,
      schemaVersion: dbHealth.schemaVersion,
    },
    name: "database",
    operatorHint: dbHealth.operatorHint,
    status: dbHealth.status,
    summary: dbHealth.message,
  });

  const nbaSidecarBaseUrl = process.env.NBA_SIDECAR_BASE_URL;
  checks.push(await checkNbaSidecarReadiness(nbaSidecarBaseUrl));

  const oddsApiKey = getOddsApiKey();
  const bet365SessionStatePath = process.env.BET365_SESSION_STATE_PATH;
  const bet365SessionConfigured =
    typeof bet365SessionStatePath === "string" &&
    bet365SessionStatePath.length > 0 &&
    existsSync(bet365SessionStatePath);
  const bet365CaptureReady = Boolean(oddsApiKey);
  checks.push({
    details: {
      directSessionConfigured: bet365SessionConfigured,
      hasOddsApiKey: Boolean(oddsApiKey),
      provider: oddsApiKey
        ? "odds-api.io"
        : bet365SessionConfigured
          ? "session-export"
          : null,
      sessionStatePath: bet365SessionStatePath ?? null,
    },
    name: "bet365-capture",
    operatorHint: bet365CaptureReady
      ? undefined
      : bet365SessionConfigured
        ? "A Bet365 session export is present, but the current worker only runs the Odds-API-backed Bet365 sync path. Set ODDS_API_KEY until direct Bet365 session capture is wired into the worker."
        : "Set ODDS_API_KEY for the current Bet365 ingestion path, or wire the local session export into the worker before advertising readiness.",
    status: bet365CaptureReady ? "ok" : "error",
    summary: bet365CaptureReady
      ? "Bet365 capture is configured through Odds-API.io."
      : bet365SessionConfigured
        ? "A Bet365 session export is configured, but no active ingest path uses it yet."
        : "Bet365 capture is not configured.",
  });

  const kalshiDirectAuthConfigured = Boolean(process.env.KALSHI_API_KEY);
  const kalshiCaptureReady = kalshiDirectAuthConfigured;
  checks.push({
    details: {
      directAuthConfigured: kalshiDirectAuthConfigured,
      hasOddsApiKey: Boolean(oddsApiKey),
      hasApiKey: Boolean(process.env.KALSHI_API_KEY),
      hasApiSecret: Boolean(process.env.KALSHI_API_SECRET),
    },
    name: "kalshi-capture",
    operatorHint: kalshiCaptureReady
      ? undefined
      : "Set KALSHI_API_KEY for the direct Kalshi NBA market-data sync path.",
    status: kalshiCaptureReady ? "ok" : "error",
    summary: kalshiCaptureReady
      ? "Kalshi capture is configured through the direct Kalshi API."
      : "Kalshi capture is not configured.",
  });

  const hasPersistedLiveData =
    dbHealth.status === "ok" &&
    (dbHealth.counts.gameCount > 0 || dbHealth.counts.quoteTickCount > 0);
  checks.push({
    details: {
      gameCount: dbHealth.counts.gameCount,
      quoteTickCount: dbHealth.counts.quoteTickCount,
      sourceMarketCount: dbHealth.counts.sourceMarketCount,
    },
    name: "live-data",
    operatorHint: hasPersistedLiveData
      ? undefined
      : "Start the worker and ingest at least one live capture cycle before treating the system as ready for research use.",
    status: hasPersistedLiveData ? "ok" : "error",
    summary: hasPersistedLiveData
      ? "Persisted live research data is present."
      : "No persisted live research data is present yet.",
  });

  checks.push({
    details: {
      dbPath: dbHealth.path,
      dbStatus: dbHealth.status,
    },
    name: "capture-persistence",
    operatorHint:
      dbHealth.status === "ok"
        ? undefined
        : "Repair SQLite persistence before trusting live capture or research reads.",
    status: dbHealth.status === "ok" ? "ok" : "error",
    summary:
      dbHealth.status === "ok"
        ? "Capture persistence is available."
        : "Capture persistence is unavailable.",
  });

  const payload = {
    ...buildBaseHealthMetadata(),
    checks,
    status: checks.every((check) => check.status === "ok")
      ? ("ok" as const)
      : ("error" as const),
    summary: {
      database: {
        appStateKeys: dbHealth.appStateKeys,
        countAccuracy: dbHealth.countAccuracy,
        counts: dbHealth.counts,
        path: dbHealth.path,
        schemaVersion: dbHealth.schemaVersion,
        status: dbHealth.status,
      },
      ingest: {
        games: dbHealth.counts.gameCount,
        quoteTicks: dbHealth.counts.quoteTickCount,
        sourceMarkets: dbHealth.counts.sourceMarketCount,
      },
    },
  };

  logger.debug({ readiness: payload }, "Computed readiness payload.");

  return payload;
}
