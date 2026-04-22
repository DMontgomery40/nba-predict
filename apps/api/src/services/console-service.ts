import { z } from "zod";

import {
  getModeSnapshot,
  validateDemoStorylineSelection,
  validateReplaySelection,
} from "@signal-console/adapters";
import {
  buildDivergenceRows,
  buildEventDetail,
  buildOverviewData,
  buildTimelineData,
  buildWatchlistRows,
  confidenceBands,
  operatingModes,
  severityBands,
} from "@signal-console/domain";
import {
  EventNotFoundError,
  FixtureNotFoundError,
  InvalidModeError,
  ReplayFrameOutOfRangeError,
  checkDatabaseHealth,
  createAppLogger,
  deleteWatchlist,
  formatValidationIssues,
  getDatabasePath,
  getReplaySelection,
  getStoryline,
  getWatchlist,
  setDemoStorylineId,
  setReplaySelection,
  upsertWatchlist,
} from "@signal-console/shared";

type ServiceLogger = {
  child: (bindings: Record<string, unknown>) => ServiceLogger;
  debug: (bindings: Record<string, unknown>, message?: string) => void;
  info: (bindings: Record<string, unknown>, message?: string) => void;
  warn: (bindings: Record<string, unknown>, message?: string) => void;
};

type ServiceContext = {
  logger?: ServiceLogger;
};

const serviceLogger = createAppLogger({ component: "console-service" });

function getLogger(context: ServiceContext | undefined, operation: string) {
  return (context?.logger ?? serviceLogger).child({ operation });
}

export const modeSchema = z.enum(operatingModes).default("demo");

export const overviewQuerySchema = z.object({
  mode: z.string().optional(),
  severity: z.enum(severityBands).optional(),
  sort: z.enum(["priority", "divergence", "confidence"]).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export const eventQuerySchema = z.object({
  mode: z.string().optional(),
});

export const divergenceQuerySchema = z.object({
  mode: z.string().optional(),
  severity: z.enum(severityBands).optional(),
  confidenceBand: z.enum(confidenceBands).optional(),
  team: z.string().optional(),
  sort: z.enum(["priority", "divergence", "confidence"]).optional(),
});

export const watchlistQuerySchema = z.object({
  mode: z.string().optional(),
  status: z.enum(["queued", "monitoring"]).optional(),
});

export const replaySelectBodySchema = z.object({
  storylineId: z.string().min(1),
  frameIndex: z.number().int().min(0).optional(),
});

export const watchlistBodySchema = z.object({
  eventId: z.string().min(1),
  priority: z.number().min(0).max(100).optional(),
  status: z.enum(["queued", "monitoring"]).optional(),
  note: z.string().optional(),
});

function resolveMode(input: string | undefined) {
  const parsed = modeSchema.safeParse(input ?? "demo");
  if (parsed.success) {
    return parsed.data;
  }

  throw new InvalidModeError(
    input,
    formatValidationIssues(parsed.error.issues)
  );
}

export function getModesPayload(modeInput?: string, context?: ServiceContext) {
  const logger = getLogger(context, "getModesPayload");
  const mode = resolveMode(modeInput);
  const snapshot = getModeSnapshot(mode);

  logger.debug(
    {
      availableStorylines: snapshot.availableStorylines.length,
      mode,
      storylineId: snapshot.storyline.id,
    },
    "Resolved operating mode payload."
  );

  return {
    data: {
      supportedModes: operatingModes,
      activeMode: mode,
      demoStorylineId:
        snapshot.mode === "replay" ? null : snapshot.storyline.id,
      replaySelection: getReplaySelection(),
      availableStorylines: snapshot.availableStorylines,
    },
    meta: {
      generatedAt: snapshot.frame.capturedAt,
    },
  };
}

export function getOverviewPayload(
  query: z.infer<typeof overviewQuerySchema>,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getOverviewPayload");
  const mode = resolveMode(query.mode);
  const snapshot = getModeSnapshot(mode);
  const overview = buildOverviewData(
    snapshot.storyline,
    snapshot.frame,
    mode,
    getWatchlist()
  );

  let cards = overview.cards;
  if (query.severity) {
    cards = cards.filter((card) => card.severityBand === query.severity);
  }

  if (query.sort === "divergence") {
    cards = [...cards].sort(
      (left, right) => right.divergenceScore - left.divergenceScore
    );
  } else if (query.sort === "confidence") {
    cards = [...cards].sort(
      (left, right) => right.confidenceScore - left.confidenceScore
    );
  }

  if (query.limit) {
    cards = cards.slice(0, query.limit);
  }

  logger.debug(
    {
      cardCount: cards.length,
      mode,
      sort: query.sort ?? "priority",
    },
    "Built overview payload."
  );

  return {
    data: {
      ...overview,
      cards,
    },
    meta: {
      generatedAt: snapshot.frame.capturedAt,
    },
  };
}

export function getEventPayload(
  eventId: string,
  query: z.infer<typeof eventQuerySchema>,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getEventPayload");
  const mode = resolveMode(query.mode);
  const snapshot = getModeSnapshot(mode);
  const detail = buildEventDetail(snapshot.storyline, snapshot.frame, eventId);

  if (!detail) {
    logger.warn(
      { eventId, mode, storylineId: snapshot.storyline.id },
      "Event detail was not found."
    );
    throw new EventNotFoundError(eventId, {
      mode,
      storylineId: snapshot.storyline.id,
    });
  }

  logger.debug(
    {
      eventId,
      mode,
      storylineId: snapshot.storyline.id,
    },
    "Built event detail payload."
  );

  return {
    data: detail,
    meta: {
      mode,
      generatedAt: snapshot.frame.capturedAt,
    },
  };
}

export function getTimelinePayload(
  eventId: string,
  query: z.infer<typeof eventQuerySchema>,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getTimelinePayload");
  const mode = resolveMode(query.mode);
  const snapshot = getModeSnapshot(mode);
  const timeline = buildTimelineData(snapshot.storyline, eventId);

  if (timeline.length === 0) {
    logger.warn(
      { eventId, mode, storylineId: snapshot.storyline.id },
      "Timeline payload could not resolve the requested event."
    );
    throw new EventNotFoundError(eventId, {
      mode,
      storylineId: snapshot.storyline.id,
    });
  }

  logger.debug(
    {
      eventId,
      frameCount: timeline.length,
      mode,
    },
    "Built event timeline payload."
  );

  return {
    data: timeline,
    meta: {
      mode,
      generatedAt: snapshot.frame.capturedAt,
      storylineId: snapshot.storyline.id,
    },
  };
}

export function getDivergencePayload(
  query: z.infer<typeof divergenceQuerySchema>,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getDivergencePayload");
  const mode = resolveMode(query.mode);
  const snapshot = getModeSnapshot(mode);

  const scoredRows = buildDivergenceRows(snapshot.frame).map((row) => {
    const detail = buildEventDetail(
      snapshot.storyline,
      snapshot.frame,
      row.eventId
    );
    return {
      ...row,
      watchlistPriority: detail?.signal.watchlistPriority ?? 0,
    };
  });

  let rows = scoredRows;

  if (query.severity) {
    rows = rows.filter((row) => row.severityBand === query.severity);
  }
  if (query.confidenceBand) {
    rows = rows.filter((row) => row.confidenceBand === query.confidenceBand);
  }
  if (query.team) {
    const team = query.team.toLowerCase();
    rows = rows.filter((row) => row.label.toLowerCase().includes(team));
  }

  if (query.sort === "divergence") {
    rows = [...rows].sort(
      (left, right) => right.divergenceScore - left.divergenceScore
    );
  } else if (query.sort === "confidence") {
    rows = [...rows].sort(
      (left, right) => right.confidenceScore - left.confidenceScore
    );
  } else {
    rows = [...rows].sort(
      (left, right) => right.watchlistPriority - left.watchlistPriority
    );
  }

  logger.debug(
    {
      mode,
      rowCount: rows.length,
      search: query.team ?? null,
    },
    "Built divergence payload."
  );

  return {
    data: rows,
    meta: {
      mode,
      generatedAt: snapshot.frame.capturedAt,
    },
  };
}

export function getWatchlistPayload(
  query: z.infer<typeof watchlistQuerySchema>,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getWatchlistPayload");
  const mode = resolveMode(query.mode);
  const snapshot = getModeSnapshot(mode);
  let rows = buildWatchlistRows(snapshot.frame, getWatchlist());

  if (query.status) {
    rows = rows.filter((row) => row.watch.status === query.status);
  }

  logger.debug(
    {
      mode,
      rowCount: rows.length,
      status: query.status ?? null,
    },
    "Built watchlist payload."
  );

  return {
    data: rows,
    meta: {
      mode,
      generatedAt: snapshot.frame.capturedAt,
    },
  };
}

export function upsertWatchlistPayload(
  body: z.infer<typeof watchlistBodySchema>,
  context?: ServiceContext
) {
  const logger = getLogger(context, "upsertWatchlistPayload");
  upsertWatchlist(body);

  logger.info(
    {
      eventId: body.eventId,
      status: body.status ?? "queued",
    },
    "Upserted watchlist item."
  );

  return {
    data: {
      ok: true,
    },
    meta: {
      updatedAt: new Date().toISOString(),
    },
  };
}

export function deleteWatchlistPayload(
  eventId: string,
  context?: ServiceContext
) {
  const logger = getLogger(context, "deleteWatchlistPayload");
  deleteWatchlist(eventId);

  logger.info({ eventId }, "Deleted watchlist item.");

  return {
    data: {
      ok: true,
    },
    meta: {
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getDiagnosticsPayload(
  modeInput?: string,
  context?: ServiceContext
) {
  const logger = getLogger(context, "getDiagnosticsPayload");
  const mode = resolveMode(modeInput);
  const snapshot = getModeSnapshot(mode);
  const replaySelection = getReplaySelection();
  const degradedSources = snapshot.frame.sourceHealth.filter(
    (source) => source.status !== "healthy"
  );
  const dbHealth = checkDatabaseHealth();
  const demoSelection = validateDemoStorylineSelection();
  const replayValidation = validateReplaySelection();
  const warnings = [
    ...degradedSources.map((source) => ({
      sourceId: source.sourceId,
      message: source.message,
    })),
    ...(demoSelection.valid
      ? []
      : [
          {
            sourceId: "demo-selection",
            message:
              "Persisted demo storyline selection is invalid and will fall back until repaired.",
          },
        ]),
    ...(replayValidation.valid
      ? []
      : [
          {
            sourceId: "replay-selection",
            message:
              "Persisted replay storyline or frame selection is invalid and needs repair.",
          },
        ]),
  ];

  logger.debug(
    {
      degradedSourceCount: degradedSources.length,
      mode,
      warningCount: warnings.length,
    },
    "Built diagnostics payload."
  );

  return {
    data: {
      mode,
      storyline: {
        id: snapshot.storyline.id,
        name: snapshot.storyline.name,
        description: snapshot.storyline.description,
      },
      storage: {
        integrityStatus: dbHealth.status,
        path: getDatabasePath(),
        schemaVersion: dbHealth.schemaVersion,
      },
      sources: snapshot.frame.sourceHealth,
      fixtures: snapshot.availableStorylines,
      replaySelection,
      selections: {
        demo: demoSelection,
        replay: replayValidation,
      },
      warnings,
    },
    meta: {
      generatedAt: snapshot.frame.capturedAt,
    },
  };
}

export function postReplaySelectionPayload(
  body: z.infer<typeof replaySelectBodySchema>,
  context?: ServiceContext
) {
  const logger = getLogger(context, "postReplaySelectionPayload");
  const selectedStoryline = getStoryline(body.storylineId);
  if (!selectedStoryline) {
    logger.warn(
      { storylineId: body.storylineId },
      "Replay storyline selection was not found."
    );
    throw new FixtureNotFoundError(body.storylineId);
  }

  const nextFrameIndex = body.frameIndex ?? selectedStoryline.defaultFrameIndex;
  const maxFrameIndex = Math.max(selectedStoryline.frames.length - 1, 0);
  if (nextFrameIndex > maxFrameIndex) {
    logger.warn(
      {
        frameIndex: nextFrameIndex,
        maxFrameIndex,
        storylineId: body.storylineId,
      },
      "Replay frame index was outside the available range."
    );
    throw new ReplayFrameOutOfRangeError(
      body.storylineId,
      nextFrameIndex,
      maxFrameIndex
    );
  }

  setReplaySelection(selectedStoryline.id, nextFrameIndex);

  logger.info(
    {
      frameIndex: nextFrameIndex,
      storylineId: selectedStoryline.id,
    },
    "Updated replay selection."
  );

  return {
    data: {
      ok: true,
      replaySelection: getReplaySelection(),
    },
    meta: {
      updatedAt: new Date().toISOString(),
    },
  };
}

export function postDemoStorylinePayload(
  storylineId: string,
  context?: ServiceContext
) {
  const logger = getLogger(context, "postDemoStorylinePayload");
  const selectedStoryline = getStoryline(storylineId);
  if (!selectedStoryline) {
    logger.warn({ storylineId }, "Demo storyline selection was not found.");
    throw new FixtureNotFoundError(storylineId);
  }

  setDemoStorylineId(storylineId);
  logger.info({ storylineId }, "Updated demo storyline selection.");

  return {
    data: {
      ok: true,
      storylineId,
    },
    meta: {
      updatedAt: new Date().toISOString(),
    },
  };
}
