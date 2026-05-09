import { researchSourceIdSchema } from "@signal-console/domain";
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
  const data = listResearchGames(query);
  logger.debug({ count: data.length, query }, "Built games payload.");
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
  const data = listResearchDivergence(query);
  logger.debug(
    { count: data.length, query },
    "Built research divergence payload."
  );
  return {
    data,
    meta: generatedMeta(),
  };
}

export function getSignalMismatchesPayload(context?: ServiceContext) {
  const logger = getLogger(context, "getSignalMismatchesPayload");
  const data = listSignalMismatches();
  logger.debug({ count: data.length }, "Built signal mismatches payload.");
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
