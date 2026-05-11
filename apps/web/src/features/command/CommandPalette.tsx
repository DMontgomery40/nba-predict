import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useAppStore } from "../../app/store";
import { getGames } from "../../data/api";

export function CommandPalette() {
  const navigate = useNavigate();
  const { commandInput, setCommandInput, commandOpen, closeCommand } =
    useAppStore();
  const games = useQuery({
    queryKey: ["games"],
    queryFn: () => getGames(),
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
      { id: "go-games", label: "Go to tracked games", path: "/" },
      {
        id: "go-divergence",
        label: "Go to divergence explorer",
        path: "/divergence",
      },
      {
        id: "go-history",
        label: "Go to persisted history",
        path: "/history",
      },
      {
        id: "go-exports",
        label: "Go to exports",
        path: "/exports",
      },
      { id: "go-settings", label: "Go to settings", path: "/settings" },
    ];

    const gameActions =
      games.data?.data
        .map((entry) => {
          return {
            id: entry.game.id,
            label: `Open ${entry.game.awayParticipant.shortName} at ${entry.game.homeParticipant.shortName}`,
            path: `/games/${entry.game.id}`,
          };
        })
        .filter(
          (action): action is NonNullable<typeof action> => action !== null
        ) ?? [];

    return [...routeActions, ...gameActions].filter((item) =>
      item.label.toLowerCase().includes(commandInput.toLowerCase())
    );
  }, [commandInput, games.data?.data]);

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
          placeholder="Search routes, games, and instruments"
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
