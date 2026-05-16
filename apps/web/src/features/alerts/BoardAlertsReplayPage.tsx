import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { PageFrame } from "../../components/PageFrame";
import { Panel } from "../../components/Primitives";
import { getBoardAlertEventContext } from "../../data/api";

function formatTimestampToSecond(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso ?? "—";
  return date.toLocaleString("en-US", {
    day: "numeric",
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    month: "short",
    second: "2-digit",
    timeZoneName: "short",
    year: "numeric",
  });
}

function formatOffset(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const abs = Math.abs(seconds);
  const sign = seconds >= 0 ? "+" : "-";
  if (abs < 60) return `T${sign}${abs}s`;
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  if (abs < 3600) return `T${sign}${mins}m${String(secs).padStart(2, "0")}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `T${sign}${hours}h${String(remMins).padStart(2, "0")}m${String(secs).padStart(2, "0")}s`;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(3);
}

function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function BoardAlertsReplayPage() {
  const params = useParams<{ gameId: string }>();
  const [search] = useSearchParams();
  const gameId = params.gameId ?? "";
  const anchorAt = search.get("at") ?? new Date().toISOString();
  const labelParam = search.get("label");

  const ctxQuery = useQuery({
    enabled: gameId.length > 0,
    queryFn: () =>
      getBoardAlertEventContext({
        gameId,
        at: anchorAt,
        windowSecondsBefore: 1800,
        windowSecondsAfter: 1800,
      }),
    queryKey: ["board-alert-event-context", gameId, anchorAt],
  });

  const ctx = ctxQuery.data?.data ?? null;
  const trades = useMemo(() => ctx?.trades ?? [], [ctx]);
  const pbp = useMemo(() => ctx?.playByPlay ?? [], [ctx]);

  const sortedTrades = useMemo(() => {
    if (trades.length === 0) return [];
    return [...trades].sort((a, b) => {
      const aShare = a.volumeShare ?? 0;
      const bShare = b.volumeShare ?? 0;
      if (bShare !== aShare) return bShare - aShare;
      return a.offsetSeconds - b.offsetSeconds;
    });
  }, [trades]);

  const anchor = trades.find((trade) => trade.offsetSeconds === 0);
  const gameLabel = ctx?.gameLabel ?? labelParam ?? gameId;

  return (
    <PageFrame>
      <Panel
        className="board-alerts-shell"
        aria-label="Board alert inspect timeline"
      >
        <header className="board-alerts-header">
          <div className="eyebrow">Inspect — board shock timeline</div>
          <h1>{gameLabel}</h1>
          <p>
            Anchor: <strong>{formatTimestampToSecond(anchorAt)}</strong> · Window:
            ±30 min around the alert. All persisted Polymarket / Kalshi trades and
            NBA play-by-play actions inside the window are listed below.
          </p>
        </header>
        {ctxQuery.isLoading ? (
          <div className="board-alerts-empty">Loading event context…</div>
        ) : ctxQuery.isError || ctxQuery.data?.meta?.error ? (
          <div className="board-alerts-empty board-alerts-empty-error">
            Could not load event context.{" "}
            {ctxQuery.data?.meta?.error ?? ""}
          </div>
        ) : (
          <>
            <section
              aria-label="Anchor trade"
              className="board-alert-card board-alert-card-primary board-alert-card-hot"
            >
              <header className="board-alert-card-header">
                <div>
                  <div className="board-alert-game">Trade at T+0 (anchor)</div>
                  <div className="board-alert-kind">
                    {anchor ? anchor.displayLabel ?? anchor.sourceMarketKey : "no exact trade at this moment"}
                  </div>
                </div>
                <div className="board-alert-time">
                  <div className="metric-label">Anchor time</div>
                  <div>{formatTimestampToSecond(anchorAt)}</div>
                </div>
              </header>
              {anchor ? (
                <div className="board-alert-evidence-grid">
                  <div>
                    <div className="metric-label">Trade price</div>
                    <div className="metric-value">
                      {formatPrice(anchor.tradePrice ?? anchor.price)}
                    </div>
                  </div>
                  <div>
                    <div className="metric-label">Size</div>
                    <div className="metric-value">{formatNumber(anchor.size)}</div>
                  </div>
                  <div>
                    <div className="metric-label">Notional</div>
                    <div className="metric-value">
                      ${formatNumber(anchor.notional)}
                    </div>
                  </div>
                  <div>
                    <div className="metric-label">
                      Volume share{" "}
                      {anchor.finalMarketVolume != null
                        ? "[FINAL]"
                        : "[live-to-date]"}
                    </div>
                    <div className="metric-value">
                      {formatPercent(anchor.volumeShare)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="board-alert-reason">
                  No persisted trade lines up exactly with the anchor timestamp;
                  see the timeline below for the nearest trades.
                </p>
              )}
            </section>

            <section
              aria-label="Trade timeline"
              className="board-alert-card"
            >
              <header className="board-alert-card-header">
                <div>
                  <div className="board-alert-game">Trades in window</div>
                  <div className="board-alert-kind">
                    {trades.length} polymarket/kalshi trades · sorted by volume
                    share desc
                  </div>
                </div>
              </header>
              {sortedTrades.length === 0 ? (
                <p className="board-alert-reason">
                  No persisted trades in this window.
                </p>
              ) : (
                <ol className="board-alerts-timeline">
                  {sortedTrades.slice(0, 30).map((trade) => (
                    <li key={`${trade.source}-${trade.eventTimestamp}-${trade.sourceMarketKey}`}>
                      <span className="board-alerts-timeline-time">
                        {formatOffset(trade.offsetSeconds)}
                      </span>
                      <span className="board-alerts-timeline-kind">
                        {trade.source}
                      </span>
                      <span className="board-alerts-timeline-reason">
                        {trade.displayLabel ?? trade.sourceMarketKey} · px{" "}
                        {formatPrice(trade.tradePrice ?? trade.price)} · sz{" "}
                        {formatNumber(trade.size)} · ${formatNumber(
                          trade.notional
                        )} · {formatPercent(trade.volumeShare)}{" "}
                        {trade.finalMarketVolume != null
                          ? "[FINAL]"
                          : "[live]"}
                      </span>
                      <span className="board-alerts-timeline-score">
                        {trade.offsetSeconds >= 0 ? "after" : "before"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section
              aria-label="Play-by-play in window"
              className="board-alert-card"
            >
              <header className="board-alert-card-header">
                <div>
                  <div className="board-alert-game">Play-by-play in window</div>
                  <div className="board-alert-kind">
                    {pbp.length} actions in ±30m{" "}
                    {pbp.length === 0
                      ? "(no PBP captured for this game)"
                      : "(NBA stat feed)"}
                  </div>
                </div>
              </header>
              {pbp.length === 0 ? (
                <p className="board-alert-reason">
                  No play-by-play rows are persisted for this game inside the
                  window — the trader has no in-game anchor to confirm or
                  refute the stat dispute.
                </p>
              ) : (
                <ol className="board-alerts-timeline">
                  {pbp.slice(0, 40).map((row) => (
                    <li key={row.actionNumber}>
                      <span className="board-alerts-timeline-time">
                        {formatOffset(row.offsetSeconds)}
                      </span>
                      <span className="board-alerts-timeline-kind">
                        {row.period ? `${row.clock ?? ""} ${row.period}Q` : row.clock ?? ""}
                      </span>
                      <span className="board-alerts-timeline-reason">
                        {row.description ?? "(no description)"}{" "}
                        {row.teamTricode ? `· ${row.teamTricode}` : ""}
                      </span>
                      <span className="board-alerts-timeline-score">
                        {row.offsetSeconds != null && row.offsetSeconds >= 0
                          ? "after"
                          : "before"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <footer className="board-alert-card-footer">
              <div className="board-alert-actions">
                <Link
                  className="board-alert-action board-alert-action-secondary"
                  to="/board-alerts"
                >
                  Back to desk
                </Link>
              </div>
            </footer>
          </>
        )}
      </Panel>
    </PageFrame>
  );
}
