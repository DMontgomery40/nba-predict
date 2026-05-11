import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAppStore } from "./store";
import { getGames } from "../data/api";

const navItems = [
  { label: "Desk", to: "/" },
  { label: "Prop Alerts", to: "/prop-alerts" },
  { label: "Slate", to: "/games" },
  { label: "Divergence", to: "/divergence" },
  { label: "Research", to: "/research" },
  { label: "History", to: "/history" },
  { label: "Exports", to: "/exports" },
  { label: "Settings", to: "/settings" },
];

function workspaceStatus(pathname: string, activeGameCount: number) {
  if (pathname === "/") {
    return "Ranked trader work queue";
  }
  if (pathname.startsWith("/prop-alerts")) {
    return "Player-prop alert monitor and replay tape";
  }
  if (pathname === "/games") {
    return `${activeGameCount} tracked game${activeGameCount === 1 ? "" : "s"}`;
  }
  if (pathname.startsWith("/divergence")) {
    return "Instrument-first disagreement";
  }
  if (pathname.startsWith("/research")) {
    return "Signal quality of prediction markets vs book";
  }
  if (pathname.startsWith("/history")) {
    return "Persisted market history";
  }
  if (pathname.startsWith("/exports")) {
    return "Data engineering exports";
  }
  if (pathname.startsWith("/settings")) {
    return "Operator controls and ingest state";
  }
  return "Game and instrument workspace";
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function ShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const commandOpen = useAppStore((state) => state.commandOpen);
  const openCommand = useAppStore((state) => state.openCommand);
  const games = useQuery({
    enabled: location.pathname === "/games",
    queryKey: ["games"],
    queryFn: () => getGames(),
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommand();
      }

      if (
        !commandOpen &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.repeat &&
        !isEditableTarget(event.target) &&
        event.key.toLowerCase() === "g"
      ) {
        const handler = (nextEvent: KeyboardEvent) => {
          if (
            nextEvent.defaultPrevented ||
            nextEvent.altKey ||
            nextEvent.ctrlKey ||
            nextEvent.metaKey ||
            nextEvent.shiftKey ||
            isEditableTarget(nextEvent.target)
          ) {
            window.removeEventListener("keydown", handler);
            return;
          }

          const map: Record<string, string> = {
            b: "/",
            d: "/divergence",
            e: "/exports",
            g: "/games",
            h: "/history",
            p: "/prop-alerts",
            r: "/research",
            s: "/settings",
          };
          const route = map[nextEvent.key.toLowerCase()];
          if (route) {
            nextEvent.preventDefault();
            navigate(route);
          }
          window.removeEventListener("keydown", handler);
        };
        window.addEventListener("keydown", handler, { once: true });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commandOpen, navigate, openCommand]);

  const activeGameCount = games.data?.data.length ?? 0;
  const showWorkspaceHeader = location.pathname !== "/";

  return (
    <div className="shell">
      <aside className="shell-nav">
        <Link className="brand" to="/">
          <div className="brand-badge">365</div>
          <div>
            <strong>Signal Console</strong>
            <span>Live market research</span>
          </div>
        </Link>
        <div className="nav-section">
          <div className="eyebrow">Navigation</div>
          {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
              key={item.to}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="command-box" onClick={openCommand}>
          <span>Cmd/Ctrl + K</span>
          <strong>Search routes, games, and instruments</strong>
        </div>
      </aside>

      <div className="shell-main">
        {showWorkspaceHeader ? (
          <header className="topbar">
            <div>
              <div className="eyebrow">Current workspace</div>
              <strong>Live research console</strong>
              <span className="muted">
                {workspaceStatus(location.pathname, activeGameCount)}
              </span>
            </div>
          </header>
        ) : null}

        <main className="workspace">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
