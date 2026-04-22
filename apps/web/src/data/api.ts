import { QueryClient } from "@tanstack/react-query";

import type { OperatingMode } from "@signal-console/domain";

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
  allowErrorStatus?: boolean;
};

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
  try {
    response = await fetch(path, {
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      ...init,
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
        "Confirm the API server is running and reachable from the operator console.",
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
  }

  const payload = (await response.json().catch(() => null)) as
    | T
    | ApiErrorResponse
    | null;

  if (!response.ok && !options?.allowErrorStatus) {
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

export type ModesPayload = {
  data: {
    supportedModes: OperatingMode[];
    activeMode: OperatingMode;
    demoStorylineId: string | null;
    replaySelection: {
      storylineId: string | null;
      frameIndex: number;
    };
    availableStorylines: Array<{
      id: string;
      name: string;
      description: string;
      defaultFrameIndex: number;
    }>;
  };
  meta: {
    generatedAt: string;
  };
};

export type OverviewPayload = {
  data: {
    mode: OperatingMode;
    generatedAt: string;
    storyline: {
      id: string;
      name: string;
      description: string;
      fixturePack: string;
    };
    cards: Array<{
      eventId: string;
      label: string;
      severityBand: string;
      confidenceBand: string;
      watchlistPriority: number;
      divergenceScore: number;
      confidenceScore: number;
      tipoffLabel: string;
      interestingNow: string;
      isWatched: boolean;
    }>;
    quickStats: Array<{
      label: string;
      value: string;
      tone: "neutral" | "positive" | "warning";
    }>;
    watchlist: Array<{
      eventId: string;
      eventLabel: string;
      watchlistPriority: number;
      severityBand: string;
      confidenceBand: string;
      divergenceScore: number;
      tipoffLabel: string;
      reasonCodes: string[];
      narrative: string;
    }>;
    interestingNow: Array<{
      title: string;
      body: string;
    }>;
    sourceHealth: Array<{
      sourceId: string;
      status: string;
      lagMs: number;
      message: string;
    }>;
  };
  meta: {
    generatedAt: string;
  };
};

export type EventPayload = {
  data: {
    event: {
      id: string;
      tipoffAt: string;
      homeTeam: { shortName: string; abbreviation: string };
      awayTeam: { shortName: string; abbreviation: string };
      venue: string;
    };
    signal: {
      eventId: string;
      eventLabel: string;
      tipoffLabel: string;
      bookProbability: number;
      consensusProbability: number;
      divergenceScore: number;
      confidenceScore: number;
      watchlistPriority: number;
      severityBand: string;
      confidenceBand: string;
      narrativeTitle: string;
      narrative: string;
      evidence: string[];
      reasonCodes: string[];
      sourceTrust: Array<{
        sourceId: string;
        score: number;
        note: string;
      }>;
      quotes: Record<
        string,
        {
          probability: number;
          freshnessStatus: string;
        }
      >;
      suggestedActions: Array<{
        label: string;
        detail: string;
        priority: string;
      }>;
      audit: Array<{
        id: string;
        capturedAt: string;
        label: string;
        message: string;
        tone: string;
      }>;
      context: {
        exposureScore: number;
        volatilityScore: number;
        liquidityRisk: number;
        noteTags: string[];
      };
    };
    storyline: {
      id: string;
      name: string;
      summary: string;
      frameIndex: number;
    };
    sourceHealth: Array<{
      sourceId: string;
      status: string;
      lagMs: number;
      message: string;
    }>;
    timeline: Array<{
      capturedAt: string;
      summary: string;
      bet365: number;
      kalshi: number;
      polymarket: number;
      model: number;
      consensus: number;
      divergenceScore: number;
      confidenceScore: number;
      annotations: Array<{
        capturedAt: string;
        label: string;
        message: string;
      }>;
    }>;
  };
  meta: {
    mode: OperatingMode;
    generatedAt: string;
  };
};

export type TimelinePayload = {
  data: EventPayload["data"]["timeline"];
  meta: {
    generatedAt: string;
    mode: OperatingMode;
    storylineId: string;
  };
};

export type DivergencePayload = {
  data: Array<{
    eventId: string;
    label: string;
    bet365: number;
    consensus: number;
    divergenceScore: number;
    confidenceScore: number;
    severityBand: string;
    confidenceBand: string;
    tipoffLabel: string;
    leadingSource: string;
    watchlistPriority: number;
    reasonCodes: string[];
  }>;
  meta: {
    generatedAt: string;
    mode: OperatingMode;
  };
};

export type WatchlistPayload = {
  data: Array<{
    eventId: string;
    eventLabel: string;
    watchlistPriority: number;
    severityBand: string;
    confidenceBand: string;
    divergenceScore: number;
    confidenceScore: number;
    narrative: string;
    reasonCodes: string[];
    tipoffLabel: string;
    watch: {
      eventId: string;
      priority: number | null;
      status: "queued" | "monitoring";
      note: string | null;
      updatedAt: string;
    };
  }>;
  meta: {
    generatedAt: string;
    mode: OperatingMode;
  };
};

export type DiagnosticsPayload = {
  data: {
    mode: OperatingMode;
    storyline: {
      id: string;
      name: string;
      description: string;
    };
    storage: {
      integrityStatus: "error" | "ok";
      path: string;
      schemaVersion: number | null;
    };
    sources: Array<{
      sourceId: string;
      status: string;
      lagMs: number;
      message: string;
    }>;
    fixtures: Array<{
      id: string;
      name: string;
      description: string;
      defaultFrameIndex: number;
    }>;
    replaySelection: {
      storylineId: string | null;
      frameIndex: number;
    };
    selections: {
      demo: {
        frameIndex: number | null;
        maxFrameIndex: number | null;
        requestedStorylineId: string | null;
        resolvedStorylineId: string | null;
        valid: boolean;
      };
      replay: {
        frameIndex: number | null;
        maxFrameIndex: number | null;
        requestedStorylineId: string | null;
        resolvedStorylineId: string | null;
        valid: boolean;
      };
    };
    warnings: Array<{
      sourceId: string;
      message: string;
    }>;
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
        storylineCount: number;
        watchlistCount: number;
      };
      path: string;
      schemaVersion: number | null;
      status: "error" | "ok";
    };
    liveSources: {
      degraded: number;
      healthy: number;
      offline: number;
    };
    modes: Array<{
      degradedSourceCount: number;
      frameIndex: number | null;
      mode: OperatingMode;
      sourceCounts: {
        degraded: number;
        healthy: number;
        offline: number;
      };
      status: "error" | "ok";
      storylineId: string | null;
    }>;
    selections: {
      demo: DiagnosticsPayload["data"]["selections"]["demo"];
      replay: DiagnosticsPayload["data"]["selections"]["replay"];
    };
    storylineCount: number;
  };
  uptimeMs: number;
  version: string;
};

export function getModes() {
  return request<ModesPayload>("/api/v1/modes");
}

export function getOverview(mode: OperatingMode) {
  return request<OverviewPayload>(`/api/v1/overview?mode=${mode}`);
}

export function getEvent(mode: OperatingMode, eventId: string) {
  return request<EventPayload>(`/api/v1/events/${eventId}?mode=${mode}`);
}

export function getTimeline(mode: OperatingMode, eventId: string) {
  return request<TimelinePayload>(
    `/api/v1/events/${eventId}/timeline?mode=${mode}`
  );
}

export function getDivergence(mode: OperatingMode, search = "") {
  const query = new URLSearchParams({ mode });
  if (search) {
    query.set("team", search);
  }
  return request<DivergencePayload>(`/api/v1/divergence?${query.toString()}`);
}

export function getWatchlist(mode: OperatingMode) {
  return request<WatchlistPayload>(`/api/v1/watchlist?mode=${mode}`);
}

export function getDiagnostics(mode: OperatingMode) {
  return request<DiagnosticsPayload>(`/api/v1/diagnostics?mode=${mode}`);
}

export function getLiveHealth() {
  return request<LivenessPayload>("/health/live");
}

export function getReadyHealth() {
  return request<ReadinessPayload>("/health/ready", undefined, {
    allowErrorStatus: true,
  });
}

export function queueWatchlist(eventId: string, note?: string) {
  return request<{ data: { ok: true } }>("/api/v1/watchlist", {
    body: JSON.stringify({
      eventId,
      note,
      status: "queued",
    }),
    method: "POST",
  });
}

export function removeWatchlist(eventId: string) {
  return request<{ data: { ok: true } }>(`/api/v1/watchlist/${eventId}`, {
    method: "DELETE",
  });
}

export function setReplaySelection(storylineId: string, frameIndex: number) {
  return request<{ data: { ok: true } }>("/api/v1/replay/select", {
    body: JSON.stringify({ storylineId, frameIndex }),
    method: "POST",
  });
}

export function setDemoStoryline(storylineId: string) {
  return request<{ data: { ok: true } }>("/api/v1/demo/storyline", {
    body: JSON.stringify({ storylineId }),
    method: "POST",
  });
}
