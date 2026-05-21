import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import {
  BOARD_ALERT_KIND_LABELS,
  buildFallbackReviewTargetsFromPredictionMarketContext,
  buildReviewSourceAlerts,
  buildReviewTargets,
  displayBoardAlertEntity,
  listNearbyIncidentRows,
  listRelatedPlayerIncidents,
  pickNearestPbp,
  preferredFallbackParticipantKey,
  sortPredictionMarketContextByImpact,
  buildTraderRead,
  formatTimestampToSecond,
  selectAnchorAlert,
  type BoardAlertPbpRow,
  type BoardAlertPredictionMarketRow,
  type BoardAlertPredictionSourceSummary,
} from "./boardAlertReview";
import {
  NbaFeedSection,
  PredictionMarketEvidenceSection,
  PredictionSourcesSection,
  ReplayFooter,
  ReviewTargetsSection,
  SameBurstFollowUpSection,
  TraderReadSection,
} from "./BoardAlertsReplaySections";
import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Primitives";
import {
  getBoardAlertEventContext,
  getBoardAlertReplay,
  getBoardAlerts,
  getBoardIncidents,
  type BoardIncidentDto,
} from "../../data/api";

export function BoardAlertsReplayPage() {
  const params = useParams<{ gameId: string }>();
  const [search] = useSearchParams();
  const gameId = params.gameId ?? "";
  const anchorAt = search.get("at") ?? new Date().toISOString();
  const alertId = search.get("alertId");
  const dateParam = search.get("date");
  const labelParam = search.get("label");
  const backToDeskPath = dateParam
    ? `/board-alerts?date=${encodeURIComponent(dateParam)}`
    : "/board-alerts";

  const anchorMs = useMemo(() => {
    const ms = Date.parse(anchorAt);
    return Number.isFinite(ms) ? ms : Date.now();
  }, [anchorAt]);
  const windowStart = useMemo(
    () => new Date(anchorMs - 30 * 60_000).toISOString(),
    [anchorMs]
  );
  const windowEnd = useMemo(
    () => new Date(anchorMs + 30 * 60_000).toISOString(),
    [anchorMs]
  );
  const replayEnabled = gameId.length > 0 && !dateParam;

  const replayQuery = useQuery({
    enabled: replayEnabled,
    queryFn: () =>
      getBoardAlertReplay({
        gameId,
        windowStart,
        windowEnd,
        stepSeconds: 30,
      }),
    queryKey: ["board-alert-replay", gameId, windowStart, windowEnd],
  });

  const ctxQuery = useQuery({
    enabled: gameId.length > 0,
    queryFn: () =>
      getBoardAlertEventContext({
        alertId: dateParam ? (alertId ?? undefined) : undefined,
        gameId,
        at: anchorAt,
        limit: dateParam ? 2000 : 400,
        windowSecondsBefore: 1800,
        windowSecondsAfter: 1800,
      }),
    queryKey: [
      "board-alert-event-context",
      gameId,
      anchorAt,
      alertId ?? "",
      dateParam ?? "",
    ],
  });

  const anchorAlertQuery = useQuery({
    enabled: gameId.length > 0 && !dateParam,
    queryFn: () =>
      getBoardAlerts({
        contextWindowMinutes: 30,
        limit: 20,
        now: anchorAt,
      }),
    queryKey: ["board-alert-anchor", gameId, anchorAt],
  });

  const historicalIncidentsQuery = useQuery({
    enabled: gameId.length > 0 && dateParam != null,
    queryFn: () => getBoardIncidents({ date: dateParam!, gameId, limit: 50 }),
    queryKey: ["board-alert-historical-incidents", gameId, dateParam ?? ""],
  });

  const historicalIncidents = useMemo<BoardIncidentDto[]>(
    () =>
      (historicalIncidentsQuery.data?.data ?? []).filter(
        (row) => row.gameId === gameId
      ),
    [gameId, historicalIncidentsQuery.data]
  );
  const liveGameAlerts = useMemo(
    () =>
      (anchorAlertQuery.data?.data ?? []).filter(
        (row) => row.gameId === gameId
      ),
    [anchorAlertQuery.data, gameId]
  );
  const requestedLiveExactAlert = useMemo(
    () =>
      !dateParam && alertId
        ? (liveGameAlerts.find((row) => row.id === alertId) ?? null)
        : null,
    [alertId, dateParam, liveGameAlerts]
  );
  const historicalAnchorIncident = useMemo(
    () =>
      dateParam
        ? (ctxQuery.data?.data?.resolvedIncident ??
          selectAnchorAlert(historicalIncidents, gameId, anchorAt, alertId))
        : null,
    [alertId, anchorAt, ctxQuery.data, dateParam, gameId, historicalIncidents]
  );
  const liveAnchorAlert = useMemo(
    () =>
      !dateParam
        ? selectAnchorAlert(liveGameAlerts, gameId, anchorAt, alertId)
        : null,
    [alertId, anchorAt, dateParam, gameId, liveGameAlerts]
  );
  const requestedLiveAlertMissing = Boolean(
    !dateParam &&
    alertId &&
    liveGameAlerts.length > 0 &&
    requestedLiveExactAlert == null &&
    (historicalAnchorIncident ?? liveAnchorAlert)
  );

  const ctx = ctxQuery.data?.data ?? null;
  const resolvedHistoricalIncident = ctx?.resolvedIncident ?? null;
  const predictionSources = useMemo<BoardAlertPredictionSourceSummary[]>(
    () => ctx?.predictionMarketContext.bySource ?? [],
    [ctx]
  );
  const predictionMarketContext = useMemo<BoardAlertPredictionMarketRow[]>(
    () => ctx?.predictionMarketContext.rows ?? [],
    [ctx]
  );
  const pbp = useMemo<BoardAlertPbpRow[]>(() => ctx?.playByPlay ?? [], [ctx]);
  const incidentPbp = historicalAnchorIncident?.playByPlay ?? null;
  const nearestPbp = useMemo(
    () => pickNearestPbp(incidentPbp, pbp),
    [incidentPbp, pbp]
  );
  const sortedPredictionMarketContext = useMemo(
    () => sortPredictionMarketContextByImpact(predictionMarketContext),
    [predictionMarketContext]
  );
  const anchorAlert = historicalAnchorIncident ?? liveAnchorAlert;

  const gameLabel = ctx?.gameLabel ?? labelParam ?? gameId;
  const pbpMissing = ctx ? !(incidentPbp?.available ?? pbp.length > 0) : false;
  const sameBurstSourceAlerts = dateParam
    ? historicalIncidents
    : liveGameAlerts;
  const playerFocusedIncidents = useMemo(
    () =>
      listRelatedPlayerIncidents(anchorAlert, anchorAt, sameBurstSourceAlerts),
    [anchorAlert, anchorAt, sameBurstSourceAlerts]
  );
  const reviewSourceAlerts = useMemo(() => {
    return buildReviewSourceAlerts(anchorAlert, playerFocusedIncidents);
  }, [anchorAlert, playerFocusedIncidents]);
  const reviewTargets = useMemo(
    () => buildReviewTargets(reviewSourceAlerts),
    [reviewSourceAlerts]
  );
  const fallbackParticipantKey = useMemo(
    () =>
      preferredFallbackParticipantKey({
        alert: anchorAlert,
        alertId,
      }),
    [alertId, anchorAlert]
  );
  const effectiveReviewTargets = useMemo(
    () =>
      reviewTargets.length > 0
        ? reviewTargets
        : buildFallbackReviewTargetsFromPredictionMarketContext(
            sortedPredictionMarketContext,
            fallbackParticipantKey
          ),
    [fallbackParticipantKey, reviewTargets, sortedPredictionMarketContext]
  );
  const nearbyIncidentRows = useMemo(() => {
    return listNearbyIncidentRows({
      anchorAlert,
      anchorAt,
      historicalIncidents,
      liveAlerts: liveGameAlerts,
      replayDeck: replayQuery.data?.data?.alertDeck ?? [],
    });
  }, [
    anchorAlert,
    anchorAt,
    historicalIncidents,
    liveGameAlerts,
    replayQuery.data,
  ]);
  const traderRead = useMemo(
    () => buildTraderRead(anchorAlert, playerFocusedIncidents),
    [anchorAlert, playerFocusedIncidents]
  );
  const summaryTitle = anchorAlert?.primaryEntityKey
    ? `${displayBoardAlertEntity(anchorAlert.primaryEntityKey)} incident review`
    : `${gameLabel} ${
        anchorAlert
          ? BOARD_ALERT_KIND_LABELS[anchorAlert.shockKind]
          : "tripwire"
      } review`;
  const anchorLoading = dateParam
    ? historicalIncidentsQuery.isLoading && resolvedHistoricalIncident == null
    : anchorAlertQuery.isLoading;
  const anchorError = dateParam
    ? historicalIncidentsQuery.isError && resolvedHistoricalIncident == null
    : anchorAlertQuery.isError;
  const historicalIncidentStillResolving = Boolean(
    dateParam &&
    resolvedHistoricalIncident == null &&
    anchorLoading &&
    predictionMarketContext.length > 0
  );
  const fallbackContextOnly = Boolean(
    anchorAlert == null &&
    !anchorLoading &&
    (effectiveReviewTargets.length > 0 ||
      predictionSources.length > 0 ||
      sortedPredictionMarketContext.length > 0)
  );

  return (
    <PageFrame>
      <Panel
        className="board-alerts-shell"
        aria-label="Trader incident inspect timeline"
      >
        <header className="board-alerts-header">
          <div className="eyebrow">{gameLabel} · Trader incident review</div>
          <h1>{summaryTitle}</h1>
          <p>
            At <strong>{formatTimestampToSecond(anchorAt)}</strong>.{" "}
            {nearestPbp
              ? pbpMissing
                ? "The nearest persisted NBA feed row is shown below, even though no NBA action row falls inside this exact ±30m window."
                : "The nearest NBA feed row is included below so the trader can line up market activity with game context."
              : pbpMissing
                ? "Persisted NBA play-by-play is missing here, so game-clock confirmation is incomplete."
                : "No persisted NBA action row falls inside this exact ±30m window, so the trader only has wall-clock context here."}
          </p>
          {requestedLiveAlertMissing && anchorAlert ? (
            <p className="board-alert-callout board-alert-callout-warning">
              Requested live alert id was not present in the persisted live deck
              at this anchor. Showing the closest persisted alert from{" "}
              <strong>{formatTimestampToSecond(anchorAlert.firstPopAt)}</strong>{" "}
              instead.
            </p>
          ) : null}
        </header>
        {ctxQuery.isLoading || (replayEnabled && replayQuery.isLoading) ? (
          <div className="board-alerts-empty">Loading replay…</div>
        ) : ctxQuery.isError || ctxQuery.data?.meta?.error ? (
          <div className="board-alerts-empty board-alerts-empty-error">
            Could not load event context. {ctxQuery.data?.meta?.error ?? ""}
          </div>
        ) : (
          <>
            {historicalIncidentStillResolving ? (
              <section className="board-alert-card board-alert-card-primary">
                <header className="board-alert-card-header">
                  <div>
                    <div className="board-alert-game">
                      Persisted incident read still resolving
                    </div>
                    <div className="board-alert-kind">
                      Canonical prediction-market context is already available
                      below
                    </div>
                  </div>
                </header>
                <p className="board-alert-reason">
                  The historical incident payload for this exact alert is still
                  resolving. The source-by-source context and fallback review
                  targets below already reflect the persisted canonical
                  quote/trade evidence in this window.
                </p>
              </section>
            ) : anchorLoading ? (
              <div className="board-alerts-empty">
                Loading selected incident…
              </div>
            ) : anchorError ? (
              <div className="board-alerts-empty board-alerts-empty-error">
                Could not reconstruct the selected incident.
              </div>
            ) : anchorAlert ? (
              <TraderReadSection
                anchorAlert={anchorAlert}
                anchorAt={anchorAt}
                nearestPbp={nearestPbp}
                pbpMissing={pbpMissing}
                traderRead={traderRead}
              />
            ) : fallbackContextOnly ? (
              <section className="board-alert-card board-alert-card-primary">
                <header className="board-alert-card-header">
                  <div>
                    <div className="board-alert-game">
                      Fallback window context
                    </div>
                    <div className="board-alert-kind">
                      No persisted alert reconstructs at this exact anchor
                    </div>
                  </div>
                </header>
                <p className="board-alert-reason">
                  Showing persisted prediction-market context and fallback
                  review targets from this window so the trader can still
                  inspect the implicated markets.
                </p>
              </section>
            ) : (
              <div className="board-alerts-empty board-alerts-empty-error">
                No incident reconstructs at this anchor timestamp.
              </div>
            )}

            <ReviewTargetsSection reviewTargets={effectiveReviewTargets} />
            <PredictionSourcesSection predictionSources={predictionSources} />
            <PredictionMarketEvidenceSection
              predictionSources={predictionSources}
            />
            <SameBurstFollowUpSection
              anchorAt={anchorAt}
              dateParam={dateParam}
              nearbyIncidentRows={nearbyIncidentRows}
            />
            <NbaFeedSection
              nearestPbp={nearestPbp}
              pbp={pbp}
              pbpMissing={pbpMissing}
            />
            <ReplayFooter backToDeskPath={backToDeskPath} />
          </>
        )}
      </Panel>
    </PageFrame>
  );
}
