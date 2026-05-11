import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  ErrorState,
  InlineAlert,
  LoadingState,
} from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
import {
  getAdminCaptureRuns,
  getAdminStorageCoverage,
  getAdminSources,
  getAdminUnmappedMarkets,
  getLiveHealth,
  getReadyHealth,
  getResearchCoverage,
  getSignalMismatches,
  postBackfillGames,
  postBackfillMarkets,
  postCaptureRestart,
  postResolveMapping,
  postTimelineMaterializationRebuild,
  type QueuedAdminActionPayload,
} from "../../data/api";
import {
  formatMarketSourceList,
  hasNbaStateSource,
} from "../../lib/source-coverage";

function todayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "n/a";
  }

  return value.replace("T", " ").replace("Z", "");
}

function formatMinutes(value?: number | null) {
  if (value == null) {
    return "n/a";
  }

  return `${(value / 60_000).toFixed(1)} min`;
}

function toneForStatus(status: string) {
  return status === "ok" || status === "configured"
    ? ("positive" as const)
    : ("critical" as const);
}

function toneForMappingStatus(status: string) {
  if (status === "auto") {
    return "positive" as const;
  }
  if (status === "manual") {
    return "warning" as const;
  }
  return "critical" as const;
}

type QueuedActionNotice = {
  detail: string;
  id: number;
  title: string;
};

function buildQueuedActionNotice(
  payload: QueuedAdminActionPayload["data"],
  title: string
) {
  return {
    detail: `${payload.actionType} queued at ${formatTimestamp(payload.requestedAt)} · status ${payload.status}`,
    id: payload.id,
    title,
  } satisfies QueuedActionNotice;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [queuedActions, setQueuedActions] = useState<QueuedActionNotice[]>([]);
  const [gameBackfillForm, setGameBackfillForm] = useState({
    dateFrom: todayDateValue(),
    dateTo: todayDateValue(),
    league: "NBA",
    sport: "basketball",
  });
  const [marketBackfillForm, setMarketBackfillForm] = useState({
    dateFrom: "",
    dateTo: "",
    gameId: "",
    source: "",
  });
  const [mappingDrafts, setMappingDrafts] = useState<
    Record<
      string,
      {
        instrumentId: string;
        reason: string;
      }
    >
  >({});

  const sources = useQuery({
    queryKey: ["admin-sources"],
    queryFn: getAdminSources,
  });
  const captureRuns = useQuery({
    queryKey: ["admin-capture-runs"],
    queryFn: getAdminCaptureRuns,
  });
  const storageCoverage = useQuery({
    queryKey: ["admin-storage-coverage"],
    queryFn: getAdminStorageCoverage,
  });
  const unmappedMarkets = useQuery({
    queryKey: ["admin-unmapped-markets"],
    queryFn: getAdminUnmappedMarkets,
  });
  const coverage = useQuery({
    queryKey: ["research-coverage"],
    queryFn: getResearchCoverage,
  });
  const signalMismatches = useQuery({
    queryKey: ["research-signal-mismatches"],
    queryFn: () => getSignalMismatches(),
  });
  const liveHealth = useQuery({
    queryKey: ["health-live"],
    queryFn: getLiveHealth,
  });
  const readyHealth = useQuery({
    queryKey: ["health-ready"],
    queryFn: getReadyHealth,
  });

  const restartCapture = useMutation({
    mutationFn: postCaptureRestart,
    onSuccess: (payload, variables) => {
      setQueuedActions((current) => [
        buildQueuedActionNotice(
          payload.data,
          variables.source
            ? `Restart queued for ${variables.source}`
            : "Restart queued for all sources"
        ),
        ...current,
      ]);
    },
  });
  const backfillGames = useMutation({
    mutationFn: postBackfillGames,
    onSuccess: (payload) => {
      setQueuedActions((current) => [
        buildQueuedActionNotice(payload.data, "Game backfill queued"),
        ...current,
      ]);
    },
  });
  const backfillMarkets = useMutation({
    mutationFn: postBackfillMarkets,
    onSuccess: (payload) => {
      setQueuedActions((current) => [
        buildQueuedActionNotice(payload.data, "Market backfill queued"),
        ...current,
      ]);
    },
  });
  const rebuildTimelines = useMutation({
    mutationFn: postTimelineMaterializationRebuild,
    onSuccess: (payload) => {
      setQueuedActions((current) => [
        buildQueuedActionNotice(
          payload.data,
          "Timeline materialization rebuild queued"
        ),
        ...current,
      ]);
    },
  });
  const resolveMapping = useMutation({
    mutationFn: postResolveMapping,
    onSuccess: (_payload, variables) => {
      setMappingDrafts((current) => ({
        ...current,
        [variables.sourceMarketId]: {
          instrumentId: "",
          reason: current[variables.sourceMarketId]?.reason ?? "manual review",
        },
      }));
      void queryClient.invalidateQueries({
        queryKey: ["admin-unmapped-markets"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["research-coverage"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["games"],
      });
    },
  });

  if (
    sources.isLoading ||
    captureRuns.isLoading ||
    storageCoverage.isLoading ||
    unmappedMarkets.isLoading ||
    coverage.isLoading ||
    signalMismatches.isLoading ||
    liveHealth.isLoading ||
    readyHealth.isLoading ||
    (!sources.data && !sources.isError) ||
    (!captureRuns.data && !captureRuns.isError) ||
    (!storageCoverage.data && !storageCoverage.isError) ||
    (!unmappedMarkets.data && !unmappedMarkets.isError) ||
    (!coverage.data && !coverage.isError) ||
    (!signalMismatches.data && !signalMismatches.isError) ||
    (!liveHealth.data && !liveHealth.isError) ||
    (!readyHealth.data && !readyHealth.isError)
  ) {
    return <LoadingState message="Loading operational status…" />;
  }

  if (
    sources.isError ||
    captureRuns.isError ||
    storageCoverage.isError ||
    unmappedMarkets.isError ||
    coverage.isError ||
    signalMismatches.isError ||
    !sources.data ||
    !captureRuns.data ||
    !storageCoverage.data ||
    !unmappedMarkets.data ||
    !coverage.data ||
    !signalMismatches.data ||
    liveHealth.isError ||
    readyHealth.isError
  ) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle
              eyebrow="Fallback"
              title="Operational state unavailable"
            />
          </Panel>
        }
      >
        <ErrorState
          description="Health, source, or coverage data could not be loaded."
          error={
            sources.error ??
            captureRuns.error ??
            storageCoverage.error ??
            unmappedMarkets.error ??
            coverage.error ??
            signalMismatches.error ??
            liveHealth.error ??
            readyHealth.error
          }
          onAction={() => {
            void sources.refetch();
            void captureRuns.refetch();
            void storageCoverage.refetch();
            void unmappedMarkets.refetch();
            void coverage.refetch();
            void signalMismatches.refetch();
            void liveHealth.refetch();
            void readyHealth.refetch();
          }}
          title="Settings failed to load"
        />
      </PageFrame>
    );
  }

  const mutationError =
    restartCapture.error ??
    backfillGames.error ??
    backfillMarkets.error ??
    rebuildTimelines.error ??
    resolveMapping.error;

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Coverage"
            title={`${coverage.data.data.length} coverage rows`}
            body="Every backend research surface now lands somewhere in the frontend, so this page acts as the operator-facing bridge for health, admin, and coverage APIs."
          />
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Operations</div>
          <h1>Source and readiness status</h1>
          <p>
            Track live dependencies, capture history, research mismatches, and
            admin controls without hiding backend capabilities behind API-only
            routes.
          </p>
        </div>
      </section>

      {readyHealth.data.status === "error" ? (
        <InlineAlert message="Readiness is currently failing. Inspect the checks below before trusting operator traffic." />
      ) : (
        <InlineAlert
          message="Readiness is passing and the runtime checks are green."
          tone="positive"
        />
      )}
      {mutationError ? (
        <InlineAlert
          message={
            mutationError instanceof Error
              ? mutationError.message
              : "An admin action request failed."
          }
        />
      ) : null}

      <Panel>
        <SectionTitle eyebrow="Health" title="Liveness and readiness" />
        <div className="stack">
          <div className="health-row">
            <div>
              <div className="health-name">Liveness</div>
              <div className="muted">
                Uptime {Math.round(liveHealth.data.uptimeMs / 1000)}s
              </div>
            </div>
            <Badge tone="positive">{liveHealth.data.status}</Badge>
          </div>

          <div className="health-row">
            <div>
              <div className="health-name">Readiness</div>
              <div className="muted">
                {readyHealth.data.status === "ok"
                  ? "All runtime checks are passing."
                  : "One or more runtime checks are failing."}
              </div>
            </div>
            <Badge
              tone={readyHealth.data.status === "ok" ? "positive" : "critical"}
            >
              {readyHealth.data.status}
            </Badge>
          </div>

          {readyHealth.data.checks.map((check) => (
            <div className="note-card" key={check.name}>
              <h3>{check.name}</h3>
              <p>{check.summary}</p>
              {check.operatorHint ? <p>{check.operatorHint}</p> : null}
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Sources"
          title="Configured capture dependencies"
          body="This section exposes the admin source-health route in more detail so bootstrap state, lag, and subscription status are visible to the operator."
        />
        <div className="source-compare-grid">
          {sources.data.data.map((source) => (
            <div className="source-compare-card" key={source.source}>
              <div className="source-compare-head">
                <strong>{source.source}</strong>
                <Badge tone={toneForStatus(source.status)}>
                  {source.status}
                </Badge>
              </div>
              <div className="source-compare-body">
                <span>auth {source.authState}</span>
                <span>configured {String(source.configured)}</span>
                <span>bootstrap {source.bootstrapState ?? "n/a"}</span>
                <span>subscription {source.subscriptionState ?? "n/a"}</span>
                <span>
                  last success {formatTimestamp(source.lastSuccessAt)}
                </span>
                <span>lag {formatMinutes(source.lagMs)}</span>
                <span>backoff {formatMinutes(source.currentBackoffMs)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Mismatch Research"
          title="Directional disagreement and probability splits"
          body="This is the operator-facing view of the research mismatch route so sharp disagreement between Bet365 and prediction markets is visible without leaving the console."
        />
        <div className="stack">
          {signalMismatches.data.data.length === 0 ? (
            <p className="muted">No signal mismatch rows are available yet.</p>
          ) : (
            signalMismatches.data.data.slice(0, 8).map((row) => (
              <div className="note-card compact" key={row.instrumentId}>
                <h3>{row.displayLabel}</h3>
                <p>
                  gap{" "}
                  {row.impliedProbabilityGap == null
                    ? "n/a"
                    : `${(row.impliedProbabilityGap * 100).toFixed(1)}%`}{" "}
                  · bet365 {row.bet365ImpliedProbability ?? "n/a"} · kalshi{" "}
                  {row.kalshiImpliedProbability ?? "n/a"} · polymarket{" "}
                  {row.polymarketImpliedProbability ?? "n/a"}
                </p>
                <div className="tag-row">
                  <Badge
                    tone={row.directionalDisagreement ? "warning" : "neutral"}
                  >
                    {row.directionalDisagreement
                      ? "directional disagreement"
                      : "same direction"}
                  </Badge>
                  <Badge tone={toneForMappingStatus(row.mappingStatus)}>
                    {row.mappingStatus}
                  </Badge>
                  <Badge tone={row.lineMismatch ? "warning" : "positive"}>
                    {row.lineMismatch ? "line mismatch" : "line aligned"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Coverage"
          title="Research coverage gaps"
          body="This surfaces the research coverage route directly so missing sources and unmapped rows are visible even before opening a specific game."
        />
        <div className="stack">
          {coverage.data.data.length === 0 ? (
            <p className="muted">
              No research coverage rows are available yet.
            </p>
          ) : (
            coverage.data.data.slice(0, 10).map((row) => (
              <div
                className="storage-coverage-row"
                key={`${row.gameId}-${row.instrumentId ?? "game"}-${row.family ?? "all"}`}
              >
                {(() => {
                  const hasNbaState = hasNbaStateSource(row.availableSources);

                  return (
                    <>
                      <div>
                        <strong>{row.gameId}</strong>
                        <p>
                          {row.instrumentId ?? "game aggregate"} ·{" "}
                          {row.family ?? "all families"}
                        </p>
                      </div>
                      <div className="storage-coverage-metrics">
                        <span>
                          market feeds{" "}
                          {formatMarketSourceList(row.availableSources)}
                        </span>
                        <span>
                          NBA state {hasNbaState ? "available" : "missing"}
                        </span>
                        <span>
                          missing market feeds{" "}
                          {row.missingSources.join(", ") || "none"}
                        </span>
                        <span>
                          unmapped {row.unmappedSources.join(", ") || "none"}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Capture Runs"
          title="Latest adapter activity"
          body="These rows reflect actual adapter runs written by the worker, not a synthetic status shell."
        />
        <div className="stack">
          {captureRuns.data.data.length === 0 ? (
            <p className="muted">No capture runs have been recorded yet.</p>
          ) : (
            captureRuns.data.data.slice(0, 8).map((run) => (
              <div className="health-row" key={run.id}>
                <div>
                  <div className="health-name">{run.source}</div>
                  <div className="muted">
                    {run.recordsSeen} seen · {run.recordsWritten} written ·
                    started {formatTimestamp(run.startedAt)}
                  </div>
                  {run.errorMessage ? (
                    <div className="muted">{run.errorMessage}</div>
                  ) : null}
                </div>
                <Badge tone={run.status === "ok" ? "positive" : "critical"}>
                  {run.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Admin Actions"
          title="Queue backend control routes from the UI"
          body="These controls make the admin POST routes visible in the frontend, even though the backend currently queues work instead of executing it inline."
        />
        <div className="stack">
          <div className="note-card">
            <h3>Restart capture</h3>
            <p>Queue a capture restart for all sources or one source.</p>
            <div className="tag-row">
              <button
                className="primary-button"
                disabled={restartCapture.isPending}
                onClick={() => restartCapture.mutate({})}
                type="button"
              >
                Restart all capture
              </button>
              {sources.data.data.map((source) => (
                <button
                  className="ghost-button"
                  disabled={restartCapture.isPending}
                  key={source.source}
                  onClick={() =>
                    restartCapture.mutate({ source: source.source })
                  }
                  type="button"
                >
                  Restart {source.source}
                </button>
              ))}
            </div>
          </div>

          <div className="note-card">
            <h3>Backfill games</h3>
            <p>Queue a canonical game-state backfill over a date range.</p>
            <div className="action-form-grid">
              <label className="filter-field">
                <span>Date from</span>
                <input
                  className="search-input"
                  onChange={(event) =>
                    setGameBackfillForm((current) => ({
                      ...current,
                      dateFrom: event.target.value,
                    }))
                  }
                  type="date"
                  value={gameBackfillForm.dateFrom}
                />
              </label>
              <label className="filter-field">
                <span>Date to</span>
                <input
                  className="search-input"
                  onChange={(event) =>
                    setGameBackfillForm((current) => ({
                      ...current,
                      dateTo: event.target.value,
                    }))
                  }
                  type="date"
                  value={gameBackfillForm.dateTo}
                />
              </label>
              <label className="filter-field">
                <span>League</span>
                <input
                  className="search-input"
                  onChange={(event) =>
                    setGameBackfillForm((current) => ({
                      ...current,
                      league: event.target.value,
                    }))
                  }
                  value={gameBackfillForm.league}
                />
              </label>
              <label className="filter-field">
                <span>Sport</span>
                <input
                  className="search-input"
                  onChange={(event) =>
                    setGameBackfillForm((current) => ({
                      ...current,
                      sport: event.target.value,
                    }))
                  }
                  value={gameBackfillForm.sport}
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                className="primary-button"
                disabled={backfillGames.isPending}
                onClick={() => backfillGames.mutate(gameBackfillForm)}
                type="button"
              >
                Queue game backfill
              </button>
            </div>
          </div>

          <div className="note-card">
            <h3>Backfill markets</h3>
            <p>
              Queue a market-history backfill scoped by source, game, or date.
            </p>
            <div className="action-form-grid">
              <label className="filter-field">
                <span>Source</span>
                <input
                  className="search-input"
                  onChange={(event) =>
                    setMarketBackfillForm((current) => ({
                      ...current,
                      source: event.target.value,
                    }))
                  }
                  placeholder="bet365"
                  value={marketBackfillForm.source}
                />
              </label>
              <label className="filter-field">
                <span>Game id</span>
                <input
                  className="search-input"
                  onChange={(event) =>
                    setMarketBackfillForm((current) => ({
                      ...current,
                      gameId: event.target.value,
                    }))
                  }
                  placeholder="nba-0042500173"
                  value={marketBackfillForm.gameId}
                />
              </label>
              <label className="filter-field">
                <span>Date from</span>
                <input
                  className="search-input"
                  onChange={(event) =>
                    setMarketBackfillForm((current) => ({
                      ...current,
                      dateFrom: event.target.value,
                    }))
                  }
                  type="date"
                  value={marketBackfillForm.dateFrom}
                />
              </label>
              <label className="filter-field">
                <span>Date to</span>
                <input
                  className="search-input"
                  onChange={(event) =>
                    setMarketBackfillForm((current) => ({
                      ...current,
                      dateTo: event.target.value,
                    }))
                  }
                  type="date"
                  value={marketBackfillForm.dateTo}
                />
              </label>
            </div>
            <div className="form-actions">
              <button
                className="primary-button"
                disabled={backfillMarkets.isPending}
                onClick={() =>
                  backfillMarkets.mutate({
                    dateFrom: marketBackfillForm.dateFrom || undefined,
                    dateTo: marketBackfillForm.dateTo || undefined,
                    gameId: marketBackfillForm.gameId || undefined,
                    source: marketBackfillForm.source || undefined,
                  })
                }
                type="button"
              >
                Queue market backfill
              </button>
              <button
                className="ghost-button"
                disabled={rebuildTimelines.isPending}
                onClick={() => rebuildTimelines.mutate()}
                type="button"
              >
                Queue timeline rebuild
              </button>
            </div>
          </div>

          <div className="note-card">
            <h3>Queued results in this session</h3>
            <p>
              The backend returns queued action metadata immediately, so this
              list keeps those responses visible even before a dedicated admin
              action read route exists.
            </p>
            <div className="stack">
              {queuedActions.length === 0 ? (
                <p className="muted">No admin actions have been queued yet.</p>
              ) : (
                queuedActions.map((action) => (
                  <div className="health-row" key={action.id}>
                    <div>
                      <div className="health-name">{action.title}</div>
                      <div className="muted">{action.detail}</div>
                    </div>
                    <Badge tone="warning">queued #{action.id}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Storage"
          title="Persisted source coverage"
          body="This makes the stored quote and raw-payload footprint visible at the game and family level."
        />
        <div className="stack">
          {storageCoverage.data.data.length === 0 ? (
            <p className="muted">No persisted source coverage rows yet.</p>
          ) : (
            storageCoverage.data.data.slice(0, 10).map((row) => (
              <div
                className="storage-coverage-row"
                key={`${row.source}-${row.gameId}-${row.family ?? "unknown"}`}
              >
                <div>
                  <strong>{row.source}</strong>
                  <p>
                    {row.gameId} · {row.family ?? "unmapped family"} ·{" "}
                    {row.league}
                  </p>
                </div>
                <div className="storage-coverage-metrics">
                  <span>{row.sourceMarketCount} source markets</span>
                  <span>{row.quoteTickCount} quotes</span>
                  <span>{row.rawPayloadCount} raw payloads</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Unmapped"
          title="Markets still awaiting manual review"
          body="This section surfaces both the unmapped-market read route and the mapping resolution write route."
        />
        <div className="stack">
          {unmappedMarkets.data.data.length === 0 ? (
            <p className="muted">
              No unmapped markets are currently outstanding.
            </p>
          ) : (
            unmappedMarkets.data.data.slice(0, 10).map((row) => {
              const draft = mappingDrafts[row.sourceMarket.id] ?? {
                instrumentId: "",
                reason: "manual review",
              };
              const gameLabel = row.game
                ? `${row.game.awayParticipant.shortName} at ${row.game.homeParticipant.shortName}`
                : `No canonical game linked yet (${row.sourceMarket.gameId})`;

              return (
                <div className="note-card compact" key={row.sourceMarket.id}>
                  <h3>{row.sourceMarket.rawLabel ?? row.sourceMarket.id}</h3>
                  <p>
                    {gameLabel} · {row.sourceMarket.source}
                    {row.latestQuote?.capturedAt
                      ? ` · last quote ${formatTimestamp(row.latestQuote.capturedAt)}`
                      : ""}
                  </p>
                  <div className="action-form-grid">
                    <label className="filter-field">
                      <span>Instrument id</span>
                      <input
                        className="search-input"
                        onChange={(event) =>
                          setMappingDrafts((current) => ({
                            ...current,
                            [row.sourceMarket.id]: {
                              ...draft,
                              instrumentId: event.target.value,
                            },
                          }))
                        }
                        placeholder="bos-moneyline"
                        value={draft.instrumentId}
                      />
                    </label>
                    <label className="filter-field">
                      <span>Reason</span>
                      <input
                        className="search-input"
                        onChange={(event) =>
                          setMappingDrafts((current) => ({
                            ...current,
                            [row.sourceMarket.id]: {
                              ...draft,
                              reason: event.target.value,
                            },
                          }))
                        }
                        value={draft.reason}
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button
                      className="primary-button"
                      disabled={
                        resolveMapping.isPending ||
                        draft.instrumentId.length === 0
                      }
                      onClick={() =>
                        resolveMapping.mutate({
                          instrumentId: draft.instrumentId,
                          reason: draft.reason,
                          sourceMarketId: row.sourceMarket.id,
                        })
                      }
                      type="button"
                    >
                      Resolve mapping
                    </button>
                    <Badge
                      tone={toneForMappingStatus(
                        row.sourceMarket.mappingStatus
                      )}
                    >
                      {row.sourceMarket.mappingStatus}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </PageFrame>
  );
}
