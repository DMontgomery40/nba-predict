import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getBoardAlerts, isApiRequestError } from "../../data/api";
import {
  BOARD_ALERT_KIND_LABELS,
  buildBoardAlertInspectPath,
  displayBoardAlertEntity,
  preferPrimaryBoardAlert,
} from "../alerts/boardAlertReview";

function isTransientBoardAlertError(error: Error) {
  return isApiRequestError(error)
    ? error.status >= 500 || error.status === 0
    : true;
}

export function BoardAlertsBanner() {
  const query = useQuery({
    queryFn: () => getBoardAlerts({ limit: 5 }),
    queryKey: ["board-alerts-banner"],
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    retry: (failureCount, error) =>
      isTransientBoardAlertError(error) && failureCount < 2,
    retryDelay: (attemptIndex) => Math.min(100 * 2 ** attemptIndex, 500),
    staleTime: 10_000,
  });
  const rows = query.data?.data ?? [];
  const top =
    rows.length > 0
      ? rows.reduce((best, row) =>
          preferPrimaryBoardAlert(row, best) ? row : best
        )
      : null;
  if (!top) return null;
  const time = new Date(top.firstPopAt).toLocaleString("en-US", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <section
      className="board-alerts-banner"
      aria-label="Top live trader incident"
    >
      <div className="board-alerts-banner-inner">
        <span className="board-alerts-banner-tag">
          Live tripwire · {BOARD_ALERT_KIND_LABELS[top.shockKind]}
        </span>
        <strong>
          {top.gameLabel}
          {top.primaryEntityKey
            ? ` · ${displayBoardAlertEntity(top.primaryEntityKey)}`
            : ""}
        </strong>
        <span className="board-alerts-banner-reason">{top.reason}</span>
        <span className="board-alerts-banner-time">first pop {time}</span>
      </div>
      <Link
        className="board-alerts-banner-link"
        to={buildBoardAlertInspectPath(top)}
      >
        Inspect →
      </Link>
    </section>
  );
}
