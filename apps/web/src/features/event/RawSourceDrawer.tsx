import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge } from "../../components/Primitives";
import { getInstrumentRawSource } from "../../data/api";
import { formatOperatorDateTime } from "../../lib/time-format";

const preferredSourceOrder = ["bet365", "kalshi", "polymarket", "nba"];

function orderSourceIds(sourceIds: string[]) {
  const uniqueSourceIds = [...new Set(sourceIds.filter(Boolean))];
  const preferredSourceIds = preferredSourceOrder.filter((sourceId) =>
    uniqueSourceIds.includes(sourceId)
  );
  const remainingSourceIds = uniqueSourceIds.filter(
    (sourceId) => !preferredSourceOrder.includes(sourceId)
  );
  return [...preferredSourceIds, ...remainingSourceIds];
}

function toneForMapping(status?: string) {
  if (!status) {
    return "neutral" as const;
  }
  if (status === "auto" || status === "manual") {
    return "positive" as const;
  }
  return "warning" as const;
}

function formatQuoteStatus(value?: string | null) {
  switch (value) {
    case "fresh":
      return "under 1m";
    case "aging":
      return "1-5m";
    case "stale":
      return "over 5m";
    case "offline":
      return "no quote";
    default:
      return value ?? "n/a";
  }
}

export function RawSourceDrawer({
  gameId,
  instrumentId,
  onClose,
  open,
  preferredSourceId,
  sourceIds,
}: {
  gameId: string;
  instrumentId: string;
  onClose: () => void;
  open: boolean;
  preferredSourceId?: string | null;
  sourceIds: string[];
}) {
  const orderedSourceIds = orderSourceIds(sourceIds);
  const [activeSourceId, setActiveSourceId] = useState(
    orderedSourceIds[0] ?? sourceIds[0] ?? "bet365"
  );

  useEffect(() => {
    if (!orderedSourceIds.includes(activeSourceId)) {
      setActiveSourceId(orderedSourceIds[0] ?? sourceIds[0] ?? "bet365");
    }
  }, [activeSourceId, orderedSourceIds, sourceIds]);

  useEffect(() => {
    if (!preferredSourceId || !orderedSourceIds.includes(preferredSourceId)) {
      return;
    }

    setActiveSourceId(preferredSourceId);
  }, [orderedSourceIds, preferredSourceId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const source = useQuery({
    enabled: open,
    queryKey: ["instrument-raw", gameId, instrumentId, activeSourceId],
    queryFn: () => getInstrumentRawSource(gameId, instrumentId, activeSourceId),
  });

  if (!open || orderedSourceIds.length === 0) {
    return null;
  }

  const payload = source.data?.data;
  const latestRawPayload = payload?.rawPayloads[0];
  const latestRawPayloadJson = latestRawPayload
    ? JSON.stringify(latestRawPayload.payloadJson, null, 2)
    : null;

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside
        aria-label="Source record"
        className="raw-drawer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="raw-drawer-header">
          <div>
            <div className="eyebrow">Source record</div>
            <h2>{activeSourceId}</h2>
            <p className="muted">
              Last stored quote and mapping record for this source.
            </p>
          </div>
          <button className="ghost-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <div className="raw-drawer-body">
          <nav className="raw-drawer-nav">
            {orderedSourceIds.map((sourceId) => (
              <button
                className={`raw-source-button ${activeSourceId === sourceId ? "raw-source-button-active" : ""}`}
                key={sourceId}
                onClick={() => setActiveSourceId(sourceId)}
                type="button"
              >
                <div>
                  <strong>{sourceId}</strong>
                  <span>{sourceId === activeSourceId ? "active" : "open"}</span>
                </div>
                <Badge tone="neutral">{sourceId}</Badge>
              </button>
            ))}
          </nav>

          <div className="raw-drawer-detail">
            {source.isLoading ? (
              <p className="muted">Loading source record…</p>
            ) : payload ? (
              <>
                <div className="context-meta">
                  <div>
                    <span>Mapping</span>
                    <strong>{payload.sourceMarket.mappingStatus}</strong>
                  </div>
                  <div>
                    <span>Quote age</span>
                    <strong>
                      {formatQuoteStatus(
                        payload.captureDiagnostics.freshnessBand
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Last quote</span>
                    <strong>
                      {formatOperatorDateTime(
                        payload.captureDiagnostics.lastQuoteCapturedAt
                      )}
                    </strong>
                  </div>
                </div>

                <div className="raw-detail-grid">
                  <article className="note-card">
                    <h3>Normalized quote</h3>
                    <p>
                      Implied probability:{" "}
                      {payload.parserOutput.impliedProbability == null
                        ? "n/a"
                        : `${(payload.parserOutput.impliedProbability * 100).toFixed(1)}%`}
                    </p>
                    <p>Line: {payload.parserOutput.line ?? "n/a"}</p>
                    <p>Odds: {payload.parserOutput.odds ?? "n/a"}</p>
                  </article>

                  <article className="note-card">
                    <h3>Market record</h3>
                    <p>Label: {payload.sourceMarket.rawLabel ?? "n/a"}</p>
                    <p>Market id: {payload.sourceMarket.sourceMarketKey}</p>
                    <Badge
                      tone={toneForMapping(payload.sourceMarket.mappingStatus)}
                    >
                      {payload.sourceMarket.mappingStatus}
                    </Badge>
                  </article>

                  <article className="note-card raw-payload-card">
                    <h3>Latest raw payload</h3>
                    {latestRawPayload ? (
                      <>
                        <p>
                          Captured:{" "}
                          {formatOperatorDateTime(latestRawPayload.capturedAt)}
                        </p>
                        <pre className="raw-payload-json">
                          {latestRawPayloadJson}
                        </pre>
                      </>
                    ) : (
                      <p>
                        No persisted raw payload is attached to this source.
                      </p>
                    )}
                  </article>
                </div>
              </>
            ) : (
              <p className="muted">
                No source record is available for this market.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
