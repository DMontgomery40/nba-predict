import { QueryClient } from "@tanstack/react-query";

import { clientLogger } from "../lib/client-logger";

type ApiErrorResponse = {
  error?: {
    code?: string;
    details?: unknown;
    message?: string;
    operatorHint?: string;
    requestId?: string;
  };
};

type RequestOptions = {
  allowStatuses?: number[];
};

const API_REQUEST_TIMEOUT_MS = 10_000;

export class ApiRequestError extends Error {
  readonly code: string;
  readonly details?: unknown;
  readonly operatorHint?: string;
  readonly requestId?: string;
  readonly status: number;

  constructor(options: {
    code: string;
    details?: unknown;
    message: string;
    operatorHint?: string;
    requestId?: string;
    status: number;
  }) {
    super(options.message);
    this.name = "ApiRequestError";
    this.code = options.code;
    this.details = options.details;
    this.operatorHint = options.operatorHint;
    this.requestId = options.requestId;
    this.status = options.status;
  }
}

export function isApiRequestError(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError;
}

function shouldRetryQuery(failureCount: number, error: Error) {
  if (isApiRequestError(error)) {
    if (error.status >= 500 || error.status === 0) {
      return failureCount < 1;
    }

    return false;
  }

  return failureCount < 1;
}

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
    },
  });
}

export const queryClient = createAppQueryClient();

async function request<T>(
  path: string,
  init?: RequestInit,
  options?: RequestOptions
): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    API_REQUEST_TIMEOUT_MS
  );

  try {
    response = await fetch(path, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    const apiError = new ApiRequestError({
      code: "NETWORK_ERROR",
      details:
        error instanceof Error
          ? { cause: error.message }
          : { cause: String(error) },
      message: "The console could not reach the API.",
      operatorHint:
        "Confirm the API server is running and reachable from the research console.",
      status: 0,
    });

    clientLogger.error("api-request-network-failed", {
      error: {
        code: apiError.code,
        message: apiError.message,
        operatorHint: apiError.operatorHint,
      },
      path,
    });

    throw apiError;
  } finally {
    clearTimeout(timeoutId);
  }

  const payload = (await response.json().catch(() => null)) as
    | T
    | ApiErrorResponse
    | null;

  const allowStatus =
    options?.allowStatuses?.includes(response.status) ?? false;

  if (!response.ok && !allowStatus) {
    const apiError = new ApiRequestError({
      code: (payload as ApiErrorResponse | null)?.error?.code ?? "HTTP_ERROR",
      details: (payload as ApiErrorResponse | null)?.error?.details,
      message:
        (payload as ApiErrorResponse | null)?.error?.message ??
        response.statusText,
      operatorHint: (payload as ApiErrorResponse | null)?.error?.operatorHint,
      requestId:
        (payload as ApiErrorResponse | null)?.error?.requestId ??
        response.headers.get("x-request-id") ??
        undefined,
      status: response.status,
    });

    clientLogger.error("api-request-failed", {
      error: {
        code: apiError.code,
        message: apiError.message,
        operatorHint: apiError.operatorHint,
        requestId: apiError.requestId,
        status: apiError.status,
      },
      path,
    });

    throw apiError;
  }

  return payload as T;
}

export type GamesPayload = {
  data: Array<{
    activeInstrumentCount: number;
    coverage: {
      activeSourceCount: number;
      availableSources: string[];
      missingSources: string[];
      unmappedSourceMarketCount: number;
    };
    game: {
      awayParticipant: {
        abbreviation?: string | null;
        key: string;
        name: string;
        shortName: string;
      };
      homeParticipant: {
        abbreviation?: string | null;
        key: string;
        name: string;
        shortName: string;
      };
      id: string;
      league: string;
      scheduledStart: string;
      sport: string;
    };
    gameState?: {
      awayScore?: number | null;
      capturedAt?: string | null;
      clock?: string | null;
      finalAt?: string | null;
      gameId?: string | null;
      homeScore?: number | null;
      id?: number | null;
      isFinal?: boolean | null;
      period?: number | null;
      startedAt?: string | null;
      status: string;
    } | null;
    hasUnmappedMarkets: boolean;
    outcome?: {
      capturedAt?: string | null;
      finalAwayScore: number;
      finalHomeScore: number;
      gameId?: string | null;
      winnerKey?: string | null;
    } | null;
    topDivergences: Array<{
      comparisonSummary?: InstrumentDivergenceSummary | null;
      displayLabel: string;
      family: string;
      impliedProbabilityGap: number;
      instrumentId: string;
      lineMismatch: boolean;
      severity: string;
    }>;
  }>;
  meta: {
    generatedAt: string;
  };
};

export type InstrumentDivergenceSummary = {
  aboveThresholdDurationMs: number;
  comparisonCount: number;
  firstAboveThresholdAt?: string | null;
  firstComparisonAt?: string | null;
  latestComparisonAt?: string | null;
  latestGap?: number | null;
  latestSignedGap?: number | null;
  latestSourceProbabilities?: Record<string, number | null>;
  maxGap?: number | null;
  maxGapAt?: string | null;
  maxGapSourceProbabilities?: Record<string, number | null>;
  minGap?: number | null;
  threshold: number;
};

export type GameMarketsPayload = {
  data: {
    game: GamesPayload["data"][number]["game"];
    gameState?: GamesPayload["data"][number]["gameState"] | null;
    outcome?: GamesPayload["data"][number]["outcome"] | null;
    groups: Record<
      string,
      Array<{
        comparableState: string;
        comparisonSummary?: InstrumentDivergenceSummary | null;
        impliedProbabilityGap?: number | null;
        instrument: {
          displayLabel: string;
          family: string;
          id: string;
          inPlay: boolean;
          line?: number | null;
          selection: string;
        };
        lineMismatch: boolean;
        mappingStatus: string;
        signalPriority: number;
        sources: Array<{
          capturedAt?: string | null;
          freshnessMs?: number | null;
          impliedProbability?: number | null;
          mappingStatus: string;
          raw: {
            depthScore?: number | null;
            label?: string | null;
            line?: number | null;
            odds?: string | null;
            price?: number | null;
            selectionKey?: string | null;
            volume?: number | null;
          };
          source: string;
          sourceMarketId: string;
        }>;
      }>
    >;
    items: Array<{
      comparableState: string;
      comparisonSummary?: InstrumentDivergenceSummary | null;
      impliedProbabilityGap?: number | null;
      instrument: {
        displayLabel: string;
        family: string;
        id: string;
        inPlay: boolean;
        line?: number | null;
        selection: string;
      };
      lineMismatch: boolean;
      mappingStatus: string;
      signalPriority: number;
      sources: Array<{
        capturedAt?: string | null;
        freshnessMs?: number | null;
        impliedProbability?: number | null;
        mappingStatus: string;
        raw: {
          depthScore?: number | null;
          label?: string | null;
          line?: number | null;
          odds?: string | null;
          price?: number | null;
          selectionKey?: string | null;
          volume?: number | null;
        };
        source: string;
        sourceMarketId: string;
      }>;
    }>;
  };
  meta: {
    generatedAt: string;
  };
};

export type GamePayload = {
  data: {
    coverageSummary: GamesPayload["data"][number]["coverage"];
    game: GamesPayload["data"][number]["game"];
    gameState?: GamesPayload["data"][number]["gameState"] | null;
    marketFamilyCounts: Array<{
      count: number;
      family: string;
    }>;
    outcome?: {
      finalAwayScore: number;
      finalHomeScore: number;
      winnerKey?: string | null;
    } | null;
  };
  meta: {
    generatedAt: string;
  };
};

export type InstrumentPayload = {
  data: {
    derivedComparison: {
      comparableState: string;
      comparisonSummary?: InstrumentDivergenceSummary | null;
      impliedProbabilityGap?: number | null;
      lineMismatch: boolean;
      sourceCount: number;
    };
    gameState?: GamesPayload["data"][number]["gameState"] | null;
    instrument: {
      displayLabel: string;
      family: string;
      id: string;
      inPlay: boolean;
      line?: number | null;
      selection: string;
    };
    latestQuotesBySource: Array<{
      capturedAt?: string | null;
      freshnessMs?: number | null;
      impliedProbability?: number | null;
      lastPayloadId?: number | null;
      mappingStatus: string;
      raw: {
        bestAsk?: number | null;
        bestBid?: number | null;
        depthScore?: number | null;
        label?: string | null;
        line?: number | null;
        odds?: string | null;
        price?: number | null;
        selectionKey?: string | null;
        volume?: number | null;
      };
      source: string;
      sourceMarketId: string;
    }>;
    latestRawReferences: Array<{
      capturedAt: string;
      payloadId: number;
      source: string;
    }>;
  };
  meta: {
    generatedAt: string;
  };
};

export type InstrumentTimelinePayload = {
  data: {
    annotations: Array<{
      capturedAt: string;
      detail: string;
      label: string;
      source?: string;
    }>;
    gameStateSeries: Array<{
      awayScore?: number | null;
      capturedAt: string;
      clock?: string | null;
      homeScore?: number | null;
      period?: number | null;
      status: string;
    }>;
    lineMismatchWindows: Array<{
      end?: string | null;
      sources: string[];
      start: string;
    }>;
    quoteSeriesBySource: Record<
      string,
      Array<{
        capturedAt: string;
        depthScore?: number | null;
        impliedProbability?: number | null;
        isHeartbeat: boolean;
        line?: number | null;
        source: string;
        volume?: number | null;
      }>
    >;
  };
  meta: {
    generatedAt: string;
  };
};

export type InstrumentSourcesPayload = {
  data: Array<{
    diagnostics: {
      captureLagMs?: number | null;
      lineMismatch: boolean;
      mappingStatus: string;
    };
    freshnessMs?: number | null;
    latestQuote?: {
      bestAsk?: number | null;
      bestBid?: number | null;
      capturedAt: string;
      depthScore?: number | null;
      impliedProbability?: number | null;
      lineRaw?: number | null;
      oddsRaw?: string | null;
      priceRaw?: number | null;
      volume?: number | null;
    } | null;
    latestRawPayload?: {
      capturedAt: string;
      id: number;
      payloadJson: Record<string, unknown>;
      source: string;
    } | null;
    source: string;
    sourceMarket: {
      gameId: string;
      id: string;
      mappingStatus: string;
      rawFamily?: string | null;
      rawLabel?: string | null;
      rawMetadata?: Record<string, unknown> | null;
      source: string;
      sourceMarketKey: string;
      sourceSelectionKey?: string | null;
    };
  }>;
  meta: {
    generatedAt: string;
  };
};

export type RawSourcePayload = {
  data: {
    captureDiagnostics: {
      freshnessBand: string;
      lastQuoteCapturedAt?: string | null;
      mappingStatus: string;
    };
    latestQuote?: {
      bestAsk?: number | null;
      bestBid?: number | null;
      capturedAt: string;
      depthScore?: number | null;
      impliedProbability?: number | null;
      lineRaw?: number | null;
      oddsRaw?: string | null;
      priceRaw?: number | null;
      volume?: number | null;
    } | null;
    parserOutput: {
      impliedProbability?: number | null;
      line?: number | null;
      odds?: string | null;
      price?: number | null;
    };
    rawPayloads: Array<{
      capturedAt: string;
      id: number;
      payloadJson: Record<string, unknown>;
      source: string;
    }>;
    sourceMarket: {
      id: string;
      mappingStatus: string;
      rawFamily?: string | null;
      rawLabel?: string | null;
      source: string;
      sourceMarketKey: string;
    };
  };
  meta: {
    generatedAt: string;
  };
};

export type DivergenceQuery = {
  date?: string;
  family?: string;
  freshness?: "aging" | "fresh" | "offline" | "stale";
  limit?: number;
  mappedState?:
    | "comparable"
    | "line-mismatch"
    | "selection-mismatch"
    | "unmapped";
  severity?: "critical" | "high" | "low" | "medium";
  sort?:
    | "captureRecency"
    | "divergence"
    | "freshness"
    | "lineMismatch"
    | "signalPriority";
};

export type DivergencePayload = {
  data: Array<{
    captureRecencyMs?: number | null;
    comparableState: string;
    comparisonSummary?: InstrumentDivergenceSummary | null;
    displayLabel: string;
    family: string;
    gameId: string;
    gameStatus?: string;
    impliedProbabilityGap?: number | null;
    inPlay: boolean;
    instrumentId: string;
    lineMismatch: boolean;
    mappingStatus: string;
    severity: string;
    signalPriority: number;
    sources: string[];
    scheduledStart?: string;
  }>;
  meta: {
    generatedAt: string;
  };
};

export type SignalMismatchesPayload = {
  data: Array<{
    bet365ImpliedProbability?: number | null;
    captureRecencyMs?: number | null;
    comparableState: string;
    directionalDisagreement: boolean;
    displayLabel: string;
    family: string;
    finalAwayScore?: number | null;
    finalHomeScore?: number | null;
    gameLabel: string;
    gameId: string;
    gameStatus: string;
    impliedProbabilityGap?: number | null;
    instrumentId: string;
    kalshiImpliedProbability?: number | null;
    lineMismatch: boolean;
    mappingStatus: string;
    polymarketImpliedProbability?: number | null;
    scheduledStart: string;
    severity: string;
    signalPriority: number;
  }>;
  meta: {
    generatedAt: string;
  };
};

export type PlayerPropAlertsPayload = {
  data: Array<{
    absoluteDelta: number;
    action: "manual-review";
    bet365: {
      bestAsk?: number | null;
      bestBid?: number | null;
      capturedAt: string;
      impliedProbability: number;
      lineRaw?: number | null;
      mappingStatus: string;
      oddsRaw?: string | null;
      priceRaw?: number | null;
      rawLabel?: string | null;
      source: "bet365";
      sourceMarketId: string;
      sourceMarketKey: string;
      sourceSelectionKey?: string | null;
      volume?: number | null;
    };
    detectedAt: string;
    direction: "bet365-higher" | "prediction-market-higher";
    displayLabel: string;
    freshness: {
      bet365AgeMs: number;
      predictionMarketAgeMs: number;
      quoteTimeGapMs?: number;
    };
    gameId: string;
    gameLabel: string;
    id: string;
    inPlay: boolean;
    instrumentId: string;
    league: string;
    line?: number | null;
    lineMismatch: boolean;
    participantKey?: string | null;
    predictionMarket: {
      bestAsk?: number | null;
      bestBid?: number | null;
      capturedAt: string;
      impliedProbability: number;
      lineRaw?: number | null;
      mappingStatus: string;
      oddsRaw?: string | null;
      priceRaw?: number | null;
      rawLabel?: string | null;
      source: "kalshi" | "polymarket";
      sourceMarketId: string;
      sourceMarketKey: string;
      sourceSelectionKey?: string | null;
      volume?: number | null;
    };
    riskScore: number;
    scheduledStart: string;
    selection: string;
    severity: string;
    signedDelta: number;
    sport: string;
  }>;
  meta: {
    generatedAt: string;
  };
};

export type PlayerPropAlertPlaybackPayload = {
  data: Array<{
    alertCount: number;
    alerts: PlayerPropAlertsPayload["data"];
    capturedAt: string;
    error?: {
      code?: string;
      message: string;
    };
    notifiedAlertIds: string[];
    poll: {
      includeStale: boolean;
      limit: number;
      maxQuoteTimeGapMinutes: number;
      maxQuoteAgeMinutes: number;
      minDelta: number;
    };
    source: "player-prop-alert-watch";
  }>;
  meta: {
    generatedAt: string;
  };
};

export type AdminSourcesPayload = {
  data: Array<{
    authState: string;
    bootstrapState?: string;
    configured: boolean;
    currentBackoffMs?: number | null;
    lagMs?: number | null;
    lastSuccessAt?: string | null;
    source: string;
    status: "error" | "ok";
    subscriptionState?: string;
  }>;
  meta: {
    generatedAt: string;
  };
};

export type AdminRuntimeConfigPayload = {
  data: Array<{
    category: string;
    configured: boolean;
    defaultValue?: string | null;
    description: string;
    inputType:
      | "boolean"
      | "number"
      | "password"
      | "path"
      | "select"
      | "text"
      | "url";
    key: string;
    label: string;
    options?: string[];
    restartRequired: boolean;
    sensitive: boolean;
    source: "env";
    valuePreview?: string | null;
  }>;
  meta: {
    generatedAt: string;
  };
};

export type AdminCaptureRunsPayload = {
  data: Array<{
    errorCode?: string | null;
    errorMessage?: string | null;
    finishedAt?: string | null;
    id: number;
    recordsSeen: number;
    recordsWritten: number;
    source: string;
    startedAt: string;
    status: string;
  }>;
  meta: {
    generatedAt: string;
  };
};

export type AdminStorageCoveragePayload = {
  data: Array<{
    family?: string | null;
    gameId: string;
    league: string;
    quoteTickCount: number;
    rawPayloadCount: number;
    source: string;
    sourceMarketCount: number;
    sport: string;
  }>;
  meta: {
    generatedAt: string;
  };
};

export type AdminUnmappedMarketsPayload = {
  data: Array<{
    game?: GamesPayload["data"][number]["game"] | null;
    latestQuote?: {
      capturedAt?: string | null;
      impliedProbability?: number | null;
      lineRaw?: number | null;
    } | null;
    sourceMarket: {
      gameId: string;
      id: string;
      mappingStatus: string;
      rawFamily?: string | null;
      rawLabel?: string | null;
      source: string;
      sourceMarketKey: string;
    };
  }>;
  meta: {
    generatedAt: string;
  };
};

export type ResearchCoveragePayload = {
  data: Array<{
    availableSources: string[];
    family?: string | null;
    gameId: string;
    instrumentId?: string | null;
    missingSources: string[];
    unmappedSources: string[];
  }>;
  meta: {
    generatedAt: string;
  };
};

export type ExportCatalogPayload = {
  data: {
    datasets: Array<{
      formats: string[];
      id: string;
      rowCount: number | null;
      title: string;
    }>;
    filters: Record<string, string>;
  };
  meta: {
    generatedAt: string;
  };
};

export type LivenessPayload = {
  checks: Array<{
    name: string;
    status: "ok";
    summary: string;
  }>;
  generatedAt: string;
  status: "ok";
  uptimeMs: number;
  version: string;
};

export type ReadinessPayload = {
  checks: Array<{
    details?: Record<string, unknown>;
    name: string;
    operatorHint?: string;
    status: "error" | "ok";
    summary: string;
  }>;
  generatedAt: string;
  status: "error" | "ok";
  summary: {
    database: {
      appStateKeys: string[];
      counts: {
        adminActionCount: number;
        gameCount: number;
        quoteTickCount: number;
        rawPayloadCount: number;
        sourceMarketCount: number;
        watchlistCount: number;
      };
      path: string;
      schemaVersion: number | null;
      status: "error" | "ok";
    };
    ingest: {
      games: number;
      quoteTicks: number;
      sourceMarkets: number;
    };
  };
  uptimeMs: number;
  version: string;
};

export type QueuedAdminActionPayload = {
  data: {
    actionType: string;
    id: number;
    requestedAt: string;
    status: string;
  };
  meta: {
    generatedAt: string;
  };
};

export type MappingResolutionPayload = {
  data: {
    resolutionId: number;
    status: string;
  };
  meta: {
    generatedAt: string;
  };
};

export function getGames(filters: { limit?: number } = {}) {
  const query = new URLSearchParams();

  if (filters.limit != null) {
    query.set("limit", String(filters.limit));
  }

  const suffix = query.toString();
  return request<GamesPayload>(`/api/v1/games${suffix ? `?${suffix}` : ""}`);
}

export function getGameMarkets(gameId: string) {
  return request<GameMarketsPayload>(`/api/v1/games/${gameId}/markets`);
}

export function getGame(gameId: string) {
  return request<GamePayload>(`/api/v1/games/${gameId}`);
}

export function getInstrument(gameId: string, instrumentId: string) {
  return request<InstrumentPayload>(
    `/api/v1/games/${gameId}/markets/${instrumentId}`
  );
}

export function getInstrumentTimeline(gameId: string, instrumentId: string) {
  return request<InstrumentTimelinePayload>(
    `/api/v1/games/${gameId}/markets/${instrumentId}/timeline`
  );
}

export function getInstrumentSources(gameId: string, instrumentId: string) {
  return request<InstrumentSourcesPayload>(
    `/api/v1/games/${gameId}/markets/${instrumentId}/sources`
  );
}

export function getInstrumentRawSource(
  gameId: string,
  instrumentId: string,
  sourceId: string
) {
  return request<RawSourcePayload>(
    `/api/v1/games/${gameId}/markets/${instrumentId}/raw/${sourceId}`
  );
}

export function getDivergence(filters: DivergenceQuery = {}) {
  const query = new URLSearchParams();

  if (filters.date) {
    query.set("date", filters.date);
  }
  if (filters.family) {
    query.set("family", filters.family);
  }
  if (filters.severity) {
    query.set("severity", filters.severity);
  }
  if (filters.freshness) {
    query.set("freshness", filters.freshness);
  }
  if (filters.mappedState) {
    query.set("mappedState", filters.mappedState);
  }
  if (filters.sort) {
    query.set("sort", filters.sort);
  }
  if (filters.limit != null) {
    query.set("limit", String(filters.limit));
  }

  const suffix = query.toString();
  return request<DivergencePayload>(
    `/api/v1/divergence${suffix ? `?${suffix}` : ""}`
  );
}

export function getAdminSources() {
  return request<AdminSourcesPayload>("/api/v1/admin/sources");
}

export function getAdminCaptureRuns() {
  return request<AdminCaptureRunsPayload>("/api/v1/admin/capture/runs");
}

export function getAdminRuntimeConfig() {
  return request<AdminRuntimeConfigPayload>("/api/v1/admin/runtime-config");
}

export function getAdminStorageCoverage() {
  return request<AdminStorageCoveragePayload>("/api/v1/admin/storage/coverage");
}

export function getAdminUnmappedMarkets() {
  return request<AdminUnmappedMarketsPayload>("/api/v1/admin/unmapped-markets");
}

export function getResearchCoverage() {
  return request<ResearchCoveragePayload>("/api/v1/research/coverage");
}

export function getSignalMismatches(options?: {
  date?: string;
  family?: string;
}) {
  const params = new URLSearchParams();
  if (options?.date) {
    params.set("date", options.date);
  }
  if (options?.family) {
    params.set("family", options.family);
  }

  const suffix = params.toString();
  return request<SignalMismatchesPayload>(
    `/api/v1/research/signal-mismatches${suffix ? `?${suffix}` : ""}`
  );
}

export function getPlayerPropAlerts(options?: {
  includeStale?: boolean;
  limit?: number;
  maxQuoteAgeMinutes?: number;
  maxQuoteTimeGapMinutes?: number;
  minDelta?: number;
}) {
  const params = new URLSearchParams();
  if (options?.includeStale != null) {
    params.set("includeStale", String(options.includeStale));
  }
  if (options?.limit != null) {
    params.set("limit", String(options.limit));
  }
  if (options?.maxQuoteTimeGapMinutes != null) {
    params.set(
      "maxQuoteTimeGapMinutes",
      String(options.maxQuoteTimeGapMinutes)
    );
  }
  if (options?.maxQuoteAgeMinutes != null) {
    params.set("maxQuoteAgeMinutes", String(options.maxQuoteAgeMinutes));
  }
  if (options?.minDelta != null) {
    params.set("minDelta", String(options.minDelta));
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<PlayerPropAlertsPayload>(
    `/api/v1/research/player-prop-alerts${suffix}`
  );
}

export function getPlayerPropAlertPlayback(options?: {
  date?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (options?.date) {
    params.set("date", options.date);
  }
  if (options?.limit != null) {
    params.set("limit", String(options.limit));
  }
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<PlayerPropAlertPlaybackPayload>(
    `/api/v1/research/player-prop-alert-playback${suffix}`
  );
}

export function getExportCatalog() {
  return request<ExportCatalogPayload>("/api/v1/exports");
}

export type SourceClosingProbability = {
  source: string;
  impliedProbability: number | null;
  capturedAt: string | null;
  freshnessMs: number | null;
};

export type ClosedGameInstrumentSummary = {
  gameId: string;
  instrumentId: string;
  family: string;
  selection: string;
  displayLabel: string;
  participantKey: string | null;
  finalAt: string | null;
  outcome: { winnerKey: string | null; winnerProbability: 0 | 1 | null };
  sources: SourceClosingProbability[];
};

export type ClosedGameSummary = {
  gameId: string;
  matchup: string;
  league: string;
  sport: string;
  scheduledStart: string;
  finalAt: string | null;
  finalHomeScore: number | null;
  finalAwayScore: number | null;
  winnerKey: string | null;
  moneylineByParticipant: ClosedGameInstrumentSummary[];
};

export type SignalQualityReportPayload = {
  data: {
    sampleCount: number;
    perSource: Array<{
      source: string;
      sampleCount: number;
      brier: number | null;
      logLoss: number | null;
      closingWinnerAccuracy: number | null;
      calibrationSlope: number | null;
      calibrationIntercept: number | null;
    }>;
  };
  meta: { generatedAt: string };
};

export type ClosedGamesPayload = {
  data: ClosedGameSummary[];
  meta: { generatedAt: string };
};

export type DeltaSeriesPayload = {
  data: Array<{
    bucketAt: string;
    bet365Probability: number | null;
    externalAverage: number | null;
    perSource: Record<string, number | null>;
    absoluteDelta: number | null;
    signedDelta: number | null;
  }>;
  meta: { generatedAt: string };
};

export type LeadLagPayload = {
  data: {
    bucketSeconds: number;
    insufficientData: boolean;
    pairs: Array<{
      pair: [string, string];
      bestLagBuckets: number;
      bestCorrelation: number;
      leadSource: string;
      lagSource: string;
      sampleCount: number;
    }>;
  };
  meta: { generatedAt: string };
};

export type LeadLagSeriesPayload = {
  data: {
    bucketSeconds: number;
    insufficientData: boolean;
    primaryPair: [string, string] | null;
    overall: {
      bestLagBuckets: number;
      bestCorrelation: number;
      leadSource: string;
      lagSource: string;
      sampleCount: number;
    } | null;
    offsetSeries: Array<{
      bucketAt: string;
      lagBuckets: number | null;
      correlation: number | null;
    }>;
    offsetHistogram: Array<{ lagBuckets: number; count: number }>;
  };
  meta: { generatedAt: string };
};

type ClosingCutoff = "live-final" | "pregame";

export function getSignalQualityReport(options?: {
  closingCutoff?: ClosingCutoff;
  league?: string;
  since?: string;
  until?: string;
}) {
  const params = new URLSearchParams();
  if (options?.closingCutoff)
    params.set("closingCutoff", options.closingCutoff);
  if (options?.league) params.set("league", options.league);
  if (options?.since) params.set("since", options.since);
  if (options?.until) params.set("until", options.until);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<SignalQualityReportPayload>(
    `/api/v1/research/signal-quality${suffix}`
  );
}

export function getClosedGames(options?: {
  closingCutoff?: ClosingCutoff;
  league?: string;
  limit?: number;
  since?: string;
  until?: string;
}) {
  const params = new URLSearchParams();
  if (options?.closingCutoff)
    params.set("closingCutoff", options.closingCutoff);
  if (options?.league) params.set("league", options.league);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.since) params.set("since", options.since);
  if (options?.until) params.set("until", options.until);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<ClosedGamesPayload>(`/api/v1/research/closed-games${suffix}`);
}

export function getInstrumentDeltaSeries(
  gameId: string,
  instrumentId: string,
  options?: { bucketSeconds?: number }
) {
  const params = new URLSearchParams();
  if (options?.bucketSeconds)
    params.set("bucketSeconds", String(options.bucketSeconds));
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<DeltaSeriesPayload>(
    `/api/v1/games/${gameId}/markets/${instrumentId}/delta-series${suffix}`
  );
}

export function getInstrumentLeadLag(
  gameId: string,
  instrumentId: string,
  options?: { bucketSeconds?: number; maxLagBuckets?: number }
) {
  const params = new URLSearchParams();
  if (options?.bucketSeconds)
    params.set("bucketSeconds", String(options.bucketSeconds));
  if (options?.maxLagBuckets)
    params.set("maxLagBuckets", String(options.maxLagBuckets));
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<LeadLagPayload>(
    `/api/v1/games/${gameId}/markets/${instrumentId}/lead-lag${suffix}`
  );
}

export function getInstrumentLeadLagSeries(
  gameId: string,
  instrumentId: string,
  options?: {
    bucketSeconds?: number;
    maxLagBuckets?: number;
    windowBuckets?: number;
  }
) {
  const params = new URLSearchParams();
  if (options?.bucketSeconds)
    params.set("bucketSeconds", String(options.bucketSeconds));
  if (options?.maxLagBuckets)
    params.set("maxLagBuckets", String(options.maxLagBuckets));
  if (options?.windowBuckets)
    params.set("windowBuckets", String(options.windowBuckets));
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  return request<LeadLagSeriesPayload>(
    `/api/v1/games/${gameId}/markets/${instrumentId}/lead-lag-series${suffix}`
  );
}

export function getLiveHealth() {
  return request<LivenessPayload>("/health/live");
}

export function getReadyHealth() {
  return request<ReadinessPayload>("/health/ready", undefined, {
    allowStatuses: [503],
  });
}

export function getInstrumentTimelineExportUrl(
  gameId: string,
  instrumentId: string
) {
  return `/api/v1/games/${gameId}/markets/${instrumentId}/export.csv`;
}

export function getDatasetExportUrl(
  dataset: string,
  format: "csv" | "jsonl",
  filters: Record<string, string | null | undefined> = {}
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const suffix = params.toString();
  return `/api/v1/exports/${dataset}.${format}${suffix ? `?${suffix}` : ""}`;
}

export function getSqliteExportUrl() {
  return "/api/v1/exports/sqlite";
}

export function getFullPackageExportUrl() {
  return "/api/v1/exports/full-package.sqlite";
}

export function postCaptureRestart(body: { source?: string }) {
  return request<QueuedAdminActionPayload>("/api/v1/admin/capture/restart", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

export function postBackfillGames(body: {
  dateFrom: string;
  dateTo: string;
  league: string;
  sport: string;
}) {
  return request<QueuedAdminActionPayload>("/api/v1/admin/backfill/games", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

export function postBackfillMarkets(body: {
  dateFrom?: string;
  dateTo?: string;
  gameId?: string;
  source?: string;
}) {
  return request<QueuedAdminActionPayload>("/api/v1/admin/backfill/markets", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

export function postResolveMapping(body: {
  instrumentId: string;
  reason: string;
  sourceMarketId: string;
}) {
  return request<MappingResolutionPayload>("/api/v1/admin/mappings/resolve", {
    body: JSON.stringify(body),
    method: "POST",
  });
}

export function postTimelineMaterializationRebuild() {
  return request<QueuedAdminActionPayload>(
    "/api/v1/admin/timeline-materializations/rebuild",
    {
      method: "POST",
    }
  );
}
