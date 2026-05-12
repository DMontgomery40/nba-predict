import { existsSync } from "node:fs";

import {
  researchSourceIdSchema,
  type AdminRuntimeConfigItem,
} from "@signal-console/domain";
import {
  createAppLogger,
  enqueueCaptureRestart,
  enqueueGameBackfill,
  enqueueMarketBackfill,
  enqueueTimelineMaterializationRebuild,
  GameNotFoundError,
  getInstrumentComparison,
  getInstrumentDeltaSeries,
  getInstrumentRawSource,
  getInstrumentSources,
  getInstrumentTimeline,
  getLeadLagSeries,
  listPlayerPropDisagreementAlerts,
  listPlayerPropAlertPlaybackFrames,
  getResearchCoverage,
  getResearchGame,
  getSignalQualityReport,
  getSourceLeadLagReport,
  getStorageCoverage,
  InstrumentNotFoundError,
  listAdapterRuns,
  listAdminSources,
  listClosedGameSummaries,
  listGameMarkets,
  listResearchDivergence,
  listResearchGames,
  listSignalMismatches,
  listUnmappedMarkets,
  resolveSourceMarketMapping,
  type ClosingCutoff,
} from "@signal-console/shared";

type GamesQuery = Parameters<typeof listResearchGames>[0];
type GameMarketsQuery = Parameters<typeof listGameMarkets>[1];
type InstrumentTimelineQuery = Parameters<typeof getInstrumentTimeline>[2];
type ResearchDivergenceQuery = Parameters<typeof listResearchDivergence>[0];
type SignalMismatchesQuery = Parameters<typeof listSignalMismatches>[0];
type PlayerPropAlertQuery = Parameters<
  typeof listPlayerPropDisagreementAlerts
>[0];
type PlayerPropAlertPlaybackQuery = Parameters<
  typeof listPlayerPropAlertPlaybackFrames
>[0];
type MappingResolveBody = Parameters<typeof resolveSourceMarketMapping>[0];
type CaptureRestartBody = {
  source?: string;
};
type BackfillGamesBody = {
  dateFrom: string;
  dateTo: string;
  league: string;
  sport: string;
};
type BackfillMarketsBody = {
  dateFrom?: string;
  dateTo?: string;
  gameId?: string;
  source?: string;
};

type ServiceLogger = {
  child: (bindings: Record<string, unknown>) => ServiceLogger;
  debug: (bindings: Record<string, unknown>, message?: string) => void;
  info: (bindings: Record<string, unknown>, message?: string) => void;
  warn: (bindings: Record<string, unknown>, message?: string) => void;
};

type ServiceContext = {
  logger?: ServiceLogger;
};

const researchLogger = createAppLogger({ component: "research-service" });

function getLogger(context: ServiceContext | undefined, operation: string) {
  return (context?.logger ?? researchLogger).child({ operation });
}

function generatedMeta() {
  return {
    generatedAt: new Date().toISOString(),
  };
}

type RuntimeConfigDefinition = Omit<
  AdminRuntimeConfigItem,
  "configured" | "source" | "valuePreview"
> & {
  envKey?: string;
  validates?: (value: string) => boolean;
};

const runtimeConfigDefinitions: RuntimeConfigDefinition[] = [
  {
    category: "Runtime",
    defaultValue: "8787",
    description: "HTTP port for the Fastify API.",
    inputType: "number",
    key: "PORT",
    label: "API port",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Runtime",
    defaultValue: "0.1.0",
    description: "Version string returned by health probes.",
    inputType: "text",
    key: "SIGNAL_CONSOLE_VERSION",
    label: "Console version",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Runtime",
    description: "SQLite database file used by the live repository.",
    inputType: "path",
    key: "SIGNAL_CONSOLE_DB_PATH",
    label: "SQLite database path",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "NBA sidecar",
    description: "Base URL for the Python NBA game-state sidecar.",
    inputType: "url",
    key: "NBA_SIDECAR_BASE_URL",
    label: "NBA sidecar URL",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "NBA sidecar",
    defaultValue: "1",
    description: "Worker lookback window for NBA state sync.",
    inputType: "number",
    key: "NBA_SIDECAR_LOOKBACK_DAYS",
    label: "NBA lookback days",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "NBA sidecar",
    defaultValue: "3",
    description: "Worker lookahead window for NBA state sync.",
    inputType: "number",
    key: "NBA_SIDECAR_LOOKAHEAD_DAYS",
    label: "NBA lookahead days",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Bet365",
    description: "Odds-API.io key for the current Bet365 ingestion path.",
    inputType: "password",
    key: "ODDS_API_KEY",
    label: "Odds API key",
    restartRequired: true,
    sensitive: true,
  },
  {
    category: "Bet365",
    description: "Alternate Odds-API.io key name supported by adapters.",
    inputType: "password",
    key: "ODDS_API_IO_KEY",
    label: "Odds API alternate key",
    restartRequired: true,
    sensitive: true,
  },
  {
    category: "Bet365",
    defaultValue: "8",
    description: "Future NBA event window for Bet365 backup discovery.",
    inputType: "number",
    key: "ODDS_API_TARGET_LOOKAHEAD_HOURS",
    label: "Bet365 discovery lookahead hours",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Bet365",
    defaultValue: "90",
    description: "Recent NBA event window for Bet365 backup discovery.",
    inputType: "number",
    key: "ODDS_API_TARGET_LOOKBACK_MINUTES",
    label: "Bet365 discovery lookback minutes",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Bet365",
    description: "Legacy Playwright session export for direct Bet365 capture.",
    inputType: "path",
    key: "BET365_SESSION_STATE_PATH",
    label: "Bet365 session state path",
    restartRequired: true,
    sensitive: true,
    validates: (value) => existsSync(value),
  },
  {
    category: "Bet365",
    description: "Directory for internal Bet365 JSONL dump ingestion.",
    inputType: "path",
    key: "BET365_INTERNAL_DUMP_DIR",
    label: "Bet365 internal dump directory",
    restartRequired: true,
    sensitive: false,
    validates: (value) => existsSync(value),
  },
  {
    category: "Kalshi",
    description: "Direct Kalshi NBA market-data API key.",
    inputType: "password",
    key: "KALSHI_API_KEY",
    label: "Kalshi API key",
    restartRequired: true,
    sensitive: true,
  },
  {
    category: "Kalshi",
    description: "Optional Kalshi secret for authenticated routes.",
    inputType: "password",
    key: "KALSHI_API_SECRET",
    label: "Kalshi API secret",
    restartRequired: true,
    sensitive: true,
  },
  {
    category: "Kalshi",
    defaultValue: "200",
    description: "Maximum Kalshi events scanned per live worker cycle.",
    inputType: "number",
    key: "KALSHI_LIVE_MAX_EVENTS",
    label: "Kalshi live max events",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Kalshi",
    defaultValue: "2",
    description: "Recent Kalshi event lookback window for live scans.",
    inputType: "number",
    key: "KALSHI_LIVE_LOOKBACK_DAYS",
    label: "Kalshi live lookback days",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Polymarket",
    description: "Polymarket CLOB API key.",
    inputType: "password",
    key: "POLYMARKET_API_KEY",
    label: "Polymarket API key",
    restartRequired: true,
    sensitive: true,
  },
  {
    category: "Polymarket",
    description: "Polymarket CLOB API secret.",
    inputType: "password",
    key: "POLYMARKET_API_SECRET",
    label: "Polymarket API secret",
    restartRequired: true,
    sensitive: true,
  },
  {
    category: "Polymarket",
    description: "Polymarket CLOB API passphrase.",
    inputType: "password",
    key: "POLYMARKET_API_PASSPHRASE",
    label: "Polymarket passphrase",
    restartRequired: true,
    sensitive: true,
  },
  {
    category: "Worker",
    defaultValue: "30000",
    description: "Worker loop interval in milliseconds.",
    inputType: "number",
    key: "WORKER_INTERVAL_MS",
    label: "Worker interval",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Worker",
    description: "Maximum worker provider-backoff interval in milliseconds.",
    inputType: "number",
    key: "WORKER_MAX_BACKOFF_MS",
    label: "Worker max backoff",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    defaultValue: "10000",
    description: "Player-prop alert watcher poll interval in milliseconds.",
    inputType: "number",
    key: "PLAYER_PROP_ALERT_WATCH_INTERVAL_MS",
    label: "Watcher interval",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    defaultValue: "21600000",
    description: "Watcher run duration in milliseconds.",
    inputType: "number",
    key: "PLAYER_PROP_ALERT_WATCH_DURATION_MS",
    label: "Watcher duration",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    defaultValue: "25",
    description: "Maximum live alert rows returned per watcher poll.",
    inputType: "number",
    key: "PLAYER_PROP_ALERT_LIMIT",
    label: "Watcher alert limit",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    defaultValue: "0.15",
    description: "Minimum Bet365-vs-exchange prop delta.",
    inputType: "number",
    key: "PLAYER_PROP_ALERT_MIN_DELTA",
    label: "Minimum prop delta",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    defaultValue: "10",
    description: "Maximum timestamp gap between same-time provider quotes.",
    inputType: "number",
    key: "PLAYER_PROP_ALERT_MAX_QUOTE_TIME_GAP_MINUTES",
    label: "Max quote gap minutes",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    defaultValue: "10",
    description: "Maximum quote age allowed for fresh prop alerts.",
    inputType: "number",
    key: "PLAYER_PROP_ALERT_MAX_QUOTE_AGE_MINUTES",
    label: "Max quote age minutes",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    defaultValue: "false",
    description: "Include old prop rows in watcher output.",
    inputType: "boolean",
    key: "PLAYER_PROP_ALERT_INCLUDE_STALE",
    label: "Include old prop alerts",
    options: ["false", "true"],
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    defaultValue: "true",
    description: "Send local notifications for newly observed prop alert ids.",
    inputType: "boolean",
    key: "PLAYER_PROP_ALERT_NOTIFY",
    label: "Notify on prop alerts",
    options: ["true", "false"],
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    description: "Directory used for persisted watcher playback JSONL frames.",
    inputType: "path",
    key: "PLAYER_PROP_ALERT_PLAYBACK_DIR",
    label: "Playback directory",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Player prop alerts",
    description: "Time zone used for watcher playback date buckets.",
    inputType: "text",
    key: "PLAYER_PROP_ALERT_TIME_ZONE",
    label: "Playback time zone",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Temporary hosting",
    defaultValue: "4210",
    description: "Port for the authenticated temporary local web proxy.",
    inputType: "number",
    key: "TEMP_HOST_PORT",
    label: "Temporary host port",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Temporary hosting",
    description: "Static web root served by the temporary local proxy.",
    inputType: "path",
    key: "TEMP_HOST_WEB_ROOT",
    label: "Temporary host web root",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Temporary hosting",
    defaultValue: "http://127.0.0.1:8787",
    description: "API target proxied by the temporary host.",
    inputType: "url",
    key: "TEMP_HOST_API_TARGET",
    label: "Temporary host API target",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Temporary hosting",
    description: "HTTP basic-auth username for the temporary host.",
    inputType: "text",
    key: "BASIC_AUTH_USERNAME",
    label: "Basic-auth username",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Temporary hosting",
    description: "HTTP basic-auth password for the temporary host.",
    inputType: "password",
    key: "BASIC_AUTH_PASSWORD",
    label: "Basic-auth password",
    restartRequired: true,
    sensitive: true,
  },
  {
    category: "Temporary hosting",
    description: "Legacy alias for the temporary host username.",
    inputType: "text",
    key: "TEMP_HOST_USERNAME",
    label: "Temporary host username alias",
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Temporary hosting",
    description: "Legacy alias for the temporary host password.",
    inputType: "password",
    key: "TEMP_HOST_PASSWORD",
    label: "Temporary host password alias",
    restartRequired: true,
    sensitive: true,
  },
  {
    category: "Logging",
    defaultValue: "info",
    description: "Application log level.",
    inputType: "select",
    key: "LOG_LEVEL",
    label: "Log level",
    options: ["trace", "debug", "info", "warn", "error", "fatal"],
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Logging",
    description: "Force pretty or JSON logs when set to 1 or 0.",
    inputType: "select",
    key: "LOG_PRETTY",
    label: "Pretty logs",
    options: ["", "0", "1"],
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Node",
    defaultValue: "development",
    description: "Node environment mode.",
    inputType: "select",
    key: "NODE_ENV",
    label: "Node environment",
    options: ["development", "test", "production"],
    restartRequired: true,
    sensitive: false,
  },
  {
    category: "Node",
    description: "Continuous-integration marker used by logger and tests.",
    inputType: "boolean",
    key: "CI",
    label: "CI mode",
    options: ["false", "true"],
    restartRequired: true,
    sensitive: false,
  },
];

function previewRuntimeValue(definition: RuntimeConfigDefinition) {
  const envKey = definition.envKey ?? definition.key;
  const value = process.env[envKey];

  if (value == null || value.length === 0) {
    return null;
  }

  if (definition.sensitive) {
    return "configured";
  }

  return value;
}

function isRuntimeConfigConfigured(definition: RuntimeConfigDefinition) {
  const envKey = definition.envKey ?? definition.key;
  const value = process.env[envKey];
  if (value == null || value.length === 0) {
    return false;
  }

  return definition.validates ? definition.validates(value) : true;
}

export function getAdminRuntimeConfigPayload(context?: ServiceContext) {
  const logger = getLogger(context, "getAdminRuntimeConfigPayload");
  const data = runtimeConfigDefinitions.map((definition) => {
    return {
      category: definition.category,
      configured: isRuntimeConfigConfigured(definition),
      defaultValue: definition.defaultValue,
      description: definition.description,
      inputType: definition.inputType,
      key: definition.key,
      label: definition.label,
      options: definition.options,
      restartRequired: definition.restartRequired,
      sensitive: definition.sensitive,
      source: "env" as const,
      valuePreview: previewRuntimeValue(definition),
    } satisfies AdminRuntimeConfigItem;
  });

  logger.debug({ count: data.length }, "Built admin runtime config payload.");

  return {
    data,
    meta: generatedMeta(),
  };
}

function csvCell(value: unknown) {
  const text =
    value == null
      ? ""
      : typeof value === "string"
        ? value
        : JSON.stringify(value);

  return `"${text.replaceAll('"', '""')}"`;
}

function buildInstrumentExportFilename(
  gameId: string,
  instrumentId: string,
  exportedAt: string
) {
  const stamp = exportedAt.replaceAll(":", "-");
  return `${gameId}-${instrumentId}-${stamp}.csv`;
}

export function getGamesPayload(query: GamesQuery, context?: ServiceContext) {
  const logger = getLogger(context, "getGamesPayload");
  const effectiveQuery = {
    ...query,
    limit: query?.limit ?? 25,
  };
  const data = listResearchGames(effectiveQuery);
  logger.debug(
    { count: data.length, query: effectiveQuery },
    "Built games payload."
  );
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getGamePayload(gameId: string, context?: ServiceContext) {
  const logger = getLogger(context, "getGamePayload");
  const data = getResearchGame(gameId);
  if (!data) {
    logger.warn({ gameId }, "Requested game was not found.");
    throw new GameNotFoundError(gameId);
  }

  return {
    data,
    meta: generatedMeta(),
  };
}

export function getGameMarketsPayload(
  gameId: string,
  query: GameMarketsQuery,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getGameMarketsPayload");
  const game = getResearchGame(gameId);
  if (!game) {
    logger.warn({ gameId }, "Requested game markets could not be resolved.");
    throw new GameNotFoundError(gameId);
  }

  const data = listGameMarkets(gameId, query);
  logger.debug(
    { count: data.length, gameId, query },
    "Built game markets payload."
  );
  return {
    data: {
      game: game.game,
      gameState: game.gameState,
      groups: data.reduce<Record<string, typeof data>>(
        (groups, instrumentView) => {
          const key = instrumentView.instrument.family;
          groups[key] ??= [];
          groups[key].push(instrumentView);
          return groups;
        },
        {}
      ),
      items: data,
    },
    meta: generatedMeta(),
  };
}

export function getInstrumentPayload(
  gameId: string,
  instrumentId: string,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getInstrumentPayload");
  const data = getInstrumentComparison(gameId, instrumentId);
  if (!data) {
    const game = getResearchGame(gameId);
    if (!game) {
      logger.warn(
        { gameId, instrumentId },
        "Requested instrument game was not found."
      );
      throw new GameNotFoundError(gameId);
    }
    logger.warn(
      { gameId, instrumentId },
      "Requested instrument was not found."
    );
    throw new InstrumentNotFoundError(instrumentId, { gameId });
  }

  return {
    data,
    meta: generatedMeta(),
  };
}

export function getInstrumentTimelinePayload(
  gameId: string,
  instrumentId: string,
  query: InstrumentTimelineQuery,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getInstrumentTimelinePayload");
  const data = getInstrumentTimeline(gameId, instrumentId, query);
  if (!data) {
    const game = getResearchGame(gameId);
    if (!game) {
      logger.warn(
        { gameId, instrumentId },
        "Requested instrument timeline game was not found."
      );
      throw new GameNotFoundError(gameId);
    }
    logger.warn(
      { gameId, instrumentId },
      "Requested instrument timeline was not found."
    );
    throw new InstrumentNotFoundError(instrumentId, { gameId });
  }

  return {
    data,
    meta: generatedMeta(),
  };
}

export function getInstrumentTimelineCsvExport(
  gameId: string,
  instrumentId: string,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getInstrumentTimelineCsvExport");
  const game = getResearchGame(gameId);
  if (!game) {
    logger.warn(
      { gameId, instrumentId },
      "Requested instrument export game was not found."
    );
    throw new GameNotFoundError(gameId);
  }

  const instrument = getInstrumentComparison(gameId, instrumentId);
  if (!instrument) {
    logger.warn(
      { gameId, instrumentId },
      "Requested instrument export instrument was not found."
    );
    throw new InstrumentNotFoundError(instrumentId, { gameId });
  }

  const timeline = getInstrumentTimeline(gameId, instrumentId, {});
  if (!timeline) {
    logger.warn(
      { gameId, instrumentId },
      "Requested instrument export timeline was not found."
    );
    throw new InstrumentNotFoundError(instrumentId, { gameId });
  }

  const exportedAt = new Date().toISOString();
  const rows: unknown[][] = [
    [
      "record_type",
      "game_id",
      "game_label",
      "instrument_id",
      "instrument_label",
      "source",
      "captured_at",
      "selection",
      "status",
      "period",
      "clock",
      "home_score",
      "away_score",
      "implied_probability",
      "line",
      "depth_score",
      "is_heartbeat",
      "annotation_label",
      "annotation_detail",
      "exported_at",
    ],
  ];
  const gameLabel = `${game.game.awayParticipant.shortName} at ${game.game.homeParticipant.shortName}`;

  for (const [sourceId, points] of Object.entries(
    timeline.quoteSeriesBySource
  )) {
    for (const point of points) {
      rows.push([
        "quote",
        gameId,
        gameLabel,
        instrumentId,
        instrument.instrument.displayLabel,
        sourceId,
        point.capturedAt,
        instrument.instrument.selection,
        "",
        "",
        "",
        "",
        "",
        point.impliedProbability ?? "",
        point.line ?? "",
        point.depthScore ?? "",
        point.isHeartbeat ? "true" : "false",
        "",
        "",
        exportedAt,
      ]);
    }
  }

  for (const state of timeline.gameStateSeries) {
    rows.push([
      "game_state",
      gameId,
      gameLabel,
      instrumentId,
      instrument.instrument.displayLabel,
      "nba",
      state.capturedAt,
      "",
      state.status,
      state.period ?? "",
      state.clock ?? "",
      state.homeScore ?? "",
      state.awayScore ?? "",
      "",
      "",
      "",
      "",
      "",
      "",
      exportedAt,
    ]);
  }

  for (const annotation of timeline.annotations) {
    rows.push([
      "annotation",
      gameId,
      gameLabel,
      instrumentId,
      instrument.instrument.displayLabel,
      annotation.source ?? "system",
      annotation.capturedAt,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      annotation.label,
      annotation.detail,
      exportedAt,
    ]);
  }

  return {
    body: rows.map((row) => row.map(csvCell).join(",")).join("\n"),
    filename: buildInstrumentExportFilename(gameId, instrumentId, exportedAt),
  };
}

export function getInstrumentSourcesPayload(
  gameId: string,
  instrumentId: string,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getInstrumentSourcesPayload");
  const game = getResearchGame(gameId);
  if (!game) {
    logger.warn(
      { gameId, instrumentId },
      "Requested instrument sources game was not found."
    );
    throw new GameNotFoundError(gameId);
  }

  const data = getInstrumentSources(gameId, instrumentId);
  const comparison = getInstrumentComparison(gameId, instrumentId);
  if (!comparison) {
    logger.warn(
      { gameId, instrumentId },
      "Requested instrument sources instrument was not found."
    );
    throw new InstrumentNotFoundError(instrumentId, { gameId });
  }

  return {
    data,
    meta: generatedMeta(),
  };
}

export function getInstrumentRawPayload(
  gameId: string,
  instrumentId: string,
  sourceId: string,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getInstrumentRawPayload");
  const source = researchSourceIdSchema.parse(sourceId);
  const data = getInstrumentRawSource(gameId, instrumentId, source);
  if (!data) {
    const game = getResearchGame(gameId);
    if (!game) {
      logger.warn(
        { gameId, instrumentId, source },
        "Requested raw-source game was not found."
      );
      throw new GameNotFoundError(gameId);
    }
    logger.warn(
      { gameId, instrumentId, source },
      "Requested raw-source payload was not found."
    );
    throw new InstrumentNotFoundError(instrumentId, { gameId, source });
  }

  return {
    data,
    meta: generatedMeta(),
  };
}

export function getResearchDivergencePayload(
  query: ResearchDivergenceQuery,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getResearchDivergencePayload");
  const effectiveQuery = {
    ...query,
    limit: query?.limit ?? 250,
  };
  const data = listResearchDivergence(effectiveQuery);
  logger.debug(
    { count: data.length, query: effectiveQuery },
    "Built research divergence payload."
  );
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getSignalMismatchesPayload(
  query: SignalMismatchesQuery = {},
  context?: ServiceContext
) {
  const logger = getLogger(context, "getSignalMismatchesPayload");
  const data = listSignalMismatches(query);
  logger.debug(
    { count: data.length, query },
    "Built signal mismatches payload."
  );
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getPlayerPropDisagreementAlertsPayload(
  query: PlayerPropAlertQuery,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getPlayerPropDisagreementAlertsPayload");
  const data = listPlayerPropDisagreementAlerts(query);
  logger.debug(
    { count: data.length, query },
    "Built player prop disagreement alerts payload."
  );
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getPlayerPropAlertPlaybackPayload(
  query: PlayerPropAlertPlaybackQuery,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getPlayerPropAlertPlaybackPayload");
  const data = listPlayerPropAlertPlaybackFrames(query);
  logger.debug(
    { count: data.length, query },
    "Built player prop alert playback payload."
  );
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getResearchCoveragePayload(context?: ServiceContext) {
  const logger = getLogger(context, "getResearchCoveragePayload");
  const data = getResearchCoverage();
  logger.debug({ count: data.length }, "Built research coverage payload.");
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getAdminSourcesPayload(context?: ServiceContext) {
  const logger = getLogger(context, "getAdminSourcesPayload");
  const data = listAdminSources();
  logger.debug({ count: data.length }, "Built admin sources payload.");
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getAdminCaptureRunsPayload(context?: ServiceContext) {
  const logger = getLogger(context, "getAdminCaptureRunsPayload");
  const data = listAdapterRuns();
  logger.debug({ count: data.length }, "Built admin capture runs payload.");
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getAdminUnmappedMarketsPayload(context?: ServiceContext) {
  const logger = getLogger(context, "getAdminUnmappedMarketsPayload");
  const data = listUnmappedMarkets();
  logger.debug({ count: data.length }, "Built admin unmapped markets payload.");
  return {
    data,
    meta: generatedMeta(),
  };
}

export function postMappingsResolvePayload(
  body: MappingResolveBody,
  context?: ServiceContext
) {
  const logger = getLogger(context, "postMappingsResolvePayload");
  const resolutionId = resolveSourceMarketMapping(body);
  logger.info(
    {
      instrumentId: body.instrumentId,
      resolutionId,
      sourceMarketId: body.sourceMarketId,
    },
    "Resolved source market mapping."
  );
  return {
    data: {
      resolutionId,
      status: "ok",
    },
    meta: generatedMeta(),
  };
}

export function postCaptureRestartPayload(
  body: CaptureRestartBody,
  context?: ServiceContext
) {
  const logger = getLogger(context, "postCaptureRestartPayload");
  const action = enqueueCaptureRestart({
    payloadJson: body,
    scope: body.source ?? "all-sources",
  });
  logger.info({ action }, "Queued capture restart action.");
  return {
    data: action,
    meta: generatedMeta(),
  };
}

export function postBackfillGamesPayload(
  body: BackfillGamesBody,
  context?: ServiceContext
) {
  const logger = getLogger(context, "postBackfillGamesPayload");
  const action = enqueueGameBackfill({
    payloadJson: body,
    scope: `${body.league}:${body.dateFrom}:${body.dateTo}`,
  });
  logger.info({ action }, "Queued game backfill action.");
  return {
    data: action,
    meta: generatedMeta(),
  };
}

export function postBackfillMarketsPayload(
  body: BackfillMarketsBody,
  context?: ServiceContext
) {
  const logger = getLogger(context, "postBackfillMarketsPayload");
  const action = enqueueMarketBackfill({
    payloadJson: body,
    scope: body.gameId ?? body.source ?? "markets",
  });
  logger.info({ action }, "Queued market backfill action.");
  return {
    data: action,
    meta: generatedMeta(),
  };
}

export function postTimelineMaterializationRebuildPayload(
  context?: ServiceContext
) {
  const logger = getLogger(
    context,
    "postTimelineMaterializationRebuildPayload"
  );
  const action = enqueueTimelineMaterializationRebuild({
    payloadJson: {},
    scope: "live-timeline-materialization",
  });
  logger.info({ action }, "Queued timeline materialization rebuild action.");
  return {
    data: action,
    meta: generatedMeta(),
  };
}

export function getStorageCoveragePayload(context?: ServiceContext) {
  const logger = getLogger(context, "getStorageCoveragePayload");
  const data = getStorageCoverage();
  logger.debug({ count: data.length }, "Built storage coverage payload.");
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getSignalQualityReportPayload(
  query: {
    closingCutoff?: ClosingCutoff;
    league?: string;
    since?: string;
    until?: string;
  },
  context?: ServiceContext
) {
  const logger = getLogger(context, "getSignalQualityReportPayload");
  const data = getSignalQualityReport(query);
  logger.debug(
    { query, sampleCount: data.sampleCount },
    "Built signal quality report."
  );
  return { data, meta: generatedMeta() };
}

export function getClosedGameSummariesPayload(
  query: {
    closingCutoff?: ClosingCutoff;
    league?: string;
    limit?: number;
    since?: string;
    until?: string;
  },
  context?: ServiceContext
) {
  const logger = getLogger(context, "getClosedGameSummariesPayload");
  const data = listClosedGameSummaries(query);
  logger.debug({ count: data.length, query }, "Built closed-game summaries.");
  return { data, meta: generatedMeta() };
}

export function getInstrumentDeltaSeriesPayload(
  gameId: string,
  instrumentId: string,
  query: { bucketSeconds?: number },
  context?: ServiceContext
) {
  const logger = getLogger(context, "getInstrumentDeltaSeriesPayload");
  const game = getResearchGame(gameId);
  if (!game) {
    logger.warn({ gameId, instrumentId }, "Delta series game not found.");
    throw new GameNotFoundError(gameId);
  }
  const instrument = getInstrumentComparison(gameId, instrumentId);
  if (!instrument) {
    logger.warn({ gameId, instrumentId }, "Delta series instrument not found.");
    throw new InstrumentNotFoundError(instrumentId, { gameId });
  }
  const data = getInstrumentDeltaSeries({
    bucketSeconds: query.bucketSeconds,
    instrumentId,
  });
  logger.debug(
    { count: data.length, gameId, instrumentId, query },
    "Built delta series."
  );
  return { data, meta: generatedMeta() };
}

export function getInstrumentLeadLagPayload(
  gameId: string,
  instrumentId: string,
  query: { bucketSeconds?: number; maxLagBuckets?: number },
  context?: ServiceContext
) {
  const logger = getLogger(context, "getInstrumentLeadLagPayload");
  const game = getResearchGame(gameId);
  if (!game) {
    logger.warn({ gameId, instrumentId }, "Lead-lag game not found.");
    throw new GameNotFoundError(gameId);
  }
  const instrument = getInstrumentComparison(gameId, instrumentId);
  if (!instrument) {
    logger.warn({ gameId, instrumentId }, "Lead-lag instrument not found.");
    throw new InstrumentNotFoundError(instrumentId, { gameId });
  }
  const data = getSourceLeadLagReport({
    bucketSeconds: query.bucketSeconds,
    instrumentId,
    maxLagBuckets: query.maxLagBuckets,
  });
  logger.debug({ gameId, instrumentId, query }, "Built lead-lag report.");
  return { data, meta: generatedMeta() };
}

export function getInstrumentLeadLagSeriesPayload(
  gameId: string,
  instrumentId: string,
  query: {
    bucketSeconds?: number;
    maxLagBuckets?: number;
    windowBuckets?: number;
  },
  context?: ServiceContext
) {
  const logger = getLogger(context, "getInstrumentLeadLagSeriesPayload");
  const game = getResearchGame(gameId);
  if (!game) {
    logger.warn({ gameId, instrumentId }, "Lead-lag series game not found.");
    throw new GameNotFoundError(gameId);
  }
  const instrument = getInstrumentComparison(gameId, instrumentId);
  if (!instrument) {
    logger.warn(
      { gameId, instrumentId },
      "Lead-lag series instrument not found."
    );
    throw new InstrumentNotFoundError(instrumentId, { gameId });
  }
  const data = getLeadLagSeries({
    bucketSeconds: query.bucketSeconds,
    instrumentId,
    maxLagBuckets: query.maxLagBuckets,
    windowBuckets: query.windowBuckets,
  });
  logger.debug(
    { gameId, instrumentId, query },
    "Built lead-lag rolling series."
  );
  return { data, meta: generatedMeta() };
}
