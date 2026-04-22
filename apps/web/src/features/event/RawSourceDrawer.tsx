import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Badge } from "../../components/Primitives";
import { getInstrumentRawSource } from "../../data/api";

const preferredSourceOrder = ["bet365", "kalshi", "polymarket", "nba"];

function toneForMapping(status?: string) {
  if (!status) {
    return "neutral" as const;
  }
  if (status === "auto" || status === "manual") {
    return "positive" as const;
  }
  return "warning" as const;
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
  const orderedSourceIds = preferredSourceOrder.filter((sourceId) =>
    sourceIds.includes(sourceId)
  );
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

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside
        aria-label="Raw source inspection"
        className="raw-drawer"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="raw-drawer-header">
          <div>
            <div className="eyebrow">Raw Source Inspection</div>
            <h2>{activeSourceId}</h2>
            <p className="muted">
              Inspect the latest normalized parser output and persisted raw
              payloads for one source market.
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
              <p className="muted">Loading source payload…</p>
            ) : payload ? (
              <>
                <div className="context-meta">
                  <div>
                    <span>Mapping</span>
                    <strong>{payload.sourceMarket.mappingStatus}</strong>
                  </div>
                  <div>
                    <span>Freshness</span>
                    <strong>{payload.captureDiagnostics.freshnessBand}</strong>
                  </div>
                  <div>
                    <span>Last quote</span>
                    <strong>
                      {payload.captureDiagnostics.lastQuoteCapturedAt ?? "n/a"}
                    </strong>
                  </div>
                </div>

                <div className="raw-detail-grid">
                  <article className="note-card">
                    <h3>Parser output</h3>
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
                    <h3>Source market</h3>
                    <p>Label: {payload.sourceMarket.rawLabel ?? "n/a"}</p>
                    <p>Key: {payload.sourceMarket.sourceMarketKey}</p>
                    <Badge
                      tone={toneForMapping(payload.sourceMarket.mappingStatus)}
                    >
                      {payload.sourceMarket.mappingStatus}
                    </Badge>
                  </article>
                </div>

                <div className="raw-json-shell">
                  <div className="raw-json-header">
                    <div className="eyebrow">Latest raw payload</div>
                  </div>
                  <pre>
                    {JSON.stringify(
                      payload.rawPayloads[0]?.payloadJson ?? {},
                      null,
                      2
                    )}
                  </pre>
                </div>
              </>
            ) : (
              <p className="muted">
                No raw payload is available for this source.
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
