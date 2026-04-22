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
import { getModes, getOverview } from "../data/api";
import { CommandPalette } from "../features/command/CommandPalette";

const navItems = [
  { label: "Overview", to: "/" },
  { label: "Event", to: "/events/knicks-celtics" },
  { label: "Divergence", to: "/divergence" },
  { label: "Timeline", to: "/timeline/knicks-celtics" },
  { label: "Watchlist", to: "/watchlist" },
  { label: "Settings", to: "/settings" },
];

export function ShellLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, setMode, openCommand } = useAppStore();
  const modes = useQuery({
    queryKey: ["modes"],
    queryFn: getModes,
  });
  const overview = useQuery({
    queryKey: ["overview", mode],
    queryFn: () => getOverview(mode),
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openCommand();
      }

      if (event.key.toLowerCase() === "g") {
        const handler = (nextEvent: KeyboardEvent) => {
          const map: Record<string, string> = {
            o: "/",
            e: "/events/knicks-celtics",
            d: "/divergence",
            t: "/timeline/knicks-celtics",
            w: "/watchlist",
            s: "/settings",
          };
          const route = map[nextEvent.key.toLowerCase()];
          if (route) {
            navigate(route);
          }
          window.removeEventListener("keydown", handler);
        };
        window.addEventListener("keydown", handler, { once: true });
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate, openCommand]);

  return (
    <div className="shell">
      <CommandPalette />
      <aside className="shell-nav">
        <Link className="brand" to="/">
          <div className="brand-badge">365</div>
          <div>
            <strong>Signal Console</strong>
            <span>NBA market intelligence</span>
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
          <strong>Search routes, matchups, actions</strong>
        </div>
      </aside>

      <div className="shell-main">
        <header className="topbar">
          <div>
            <div className="eyebrow">Current workspace</div>
            <strong>
              {overview.data?.data.storyline.name ??
                (overview.isError ? "Overview unavailable" : "Loading…")}
            </strong>
            <span className="muted">
              {location.pathname === "/"
                ? "Immediate desk scan"
                : "Deep operator workflow"}
            </span>
          </div>
          <div className="topbar-actions">
            {modes.data?.data.supportedModes.map((item) => (
              <button
                className={`mode-chip ${mode === item ? "mode-chip-active" : ""}`}
                key={item}
                onClick={() => setMode(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </header>

        <main className="workspace">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
