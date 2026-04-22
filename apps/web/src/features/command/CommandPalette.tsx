import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useAppStore } from "../../app/store";
import { getOverview } from "../../data/api";

export function CommandPalette() {
  const navigate = useNavigate();
  const { mode, commandInput, setCommandInput, commandOpen, closeCommand } =
    useAppStore();
  const overview = useQuery({
    queryKey: ["overview", mode],
    queryFn: () => getOverview(mode),
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (commandOpen) {
          closeCommand();
        } else {
          useAppStore.getState().openCommand();
        }
      }
      if (event.key === "Escape") {
        closeCommand();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeCommand, commandOpen]);

  const actions = useMemo(() => {
    const routeActions = [
      { id: "go-overview", label: "Go to overview", path: "/" },
      {
        id: "go-divergence",
        label: "Go to divergence explorer",
        path: "/divergence",
      },
      { id: "go-watchlist", label: "Go to watchlist", path: "/watchlist" },
      { id: "go-settings", label: "Go to settings", path: "/settings" },
    ];

    const eventActions =
      overview.data?.data.cards.map((card) => ({
        id: card.eventId,
        label: `Open ${card.label}`,
        path: `/events/${card.eventId}`,
      })) ?? [];

    return [...routeActions, ...eventActions].filter((item) =>
      item.label.toLowerCase().includes(commandInput.toLowerCase())
    );
  }, [commandInput, overview.data?.data.cards]);

  if (!commandOpen) {
    return null;
  }

  return (
    <div className="command-overlay" onClick={closeCommand}>
      <div
        className="command-dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          className="command-input"
          placeholder="Search screens, matchups, and actions"
          value={commandInput}
          onChange={(event) => setCommandInput(event.target.value)}
        />
        <div className="command-results">
          {actions.map((action) => (
            <button
              className="command-result"
              key={action.id}
              onClick={() => {
                navigate(action.path);
                closeCommand();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
