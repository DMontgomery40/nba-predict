import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getBoardAlerts } from "../../data/api";

export function BoardAlertsBanner() {
  const query = useQuery({
    queryFn: () => getBoardAlerts({ limit: 1 }),
    queryKey: ["board-alerts-banner"],
    refetchInterval: 15_000,
    retry: false,
  });
  const top = query.data?.data?.[0];
  if (!top) return null;
  const time = new Date(top.firstPopAt).toLocaleString("en-US", {
    hour: "numeric",
    hour12: true,
    minute: "2-digit",
    second: "2-digit",
  });
  return (
    <section className="board-alerts-banner" aria-label="Top live board shock">
      <div className="board-alerts-banner-inner">
        <span className="board-alerts-banner-tag">
          Live board shock · {top.shockKind.replace(/-/g, " ")}
        </span>
        <strong>
          {top.gameLabel}
          {top.primaryEntityKey
            ? ` · ${top.primaryEntityKey
                .split(/[\s-]/)
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}`
            : ""}
        </strong>
        <span className="board-alerts-banner-reason">{top.reason}</span>
        <span className="board-alerts-banner-time">{time}</span>
      </div>
      <Link
        className="board-alerts-banner-link"
        to={`/board-alerts/${encodeURIComponent(top.gameId)}?at=${encodeURIComponent(top.firstPopAt)}&label=${encodeURIComponent(top.gameLabel)}`}
      >
        Inspect →
      </Link>
    </section>
  );
}
