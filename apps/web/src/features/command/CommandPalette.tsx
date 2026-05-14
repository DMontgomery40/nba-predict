import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { useAppStore } from "../../app/store";
import { getGames } from "../../data/api";
import {
  buildGameTriage,
  hasNavigableMarketBoard,
} from "../../lib/game-triage";

export function CommandPalette() {
  const navigate = useNavigate();
  const { commandInput, setCommandInput, commandOpen, closeCommand } =
    useAppStore();
  const games = useQuery({
    enabled: commandOpen,
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
      { id: "go-desk", label: "Go to trading desk", path: "/" },
      {
        id: "go-anomalies",
        label: "Go to market anomalies",
        path: "/market-anomalies",
      },
      {
        id: "go-divergence",
        label: "Go to divergence board",
        path: "/divergence",
      },
      {
        id: "go-research",
        label: "Go to signal research",
        path: "/research",
      },
      {
        id: "go-history",
        label: "Go to saved comparisons",
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
      buildGameTriage(games.data?.data ?? [])
        .actionableRows.filter(hasNavigableMarketBoard)
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
          value={commandInput}
          onChange={(event) => setCommandInput(event.target.value)}
          placeholder="Search routes and market boards"
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
