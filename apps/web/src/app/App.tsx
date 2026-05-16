import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./ErrorBoundary";
import { ShellLayout } from "./ShellLayout";
import { queryClient } from "../data/api";
import { BoardAlertsPage } from "../features/alerts/BoardAlertsPage";
import { BoardAlertsReplayPage } from "../features/alerts/BoardAlertsReplayPage";
import { PlayerPropAlertsPage } from "../features/alerts/PlayerPropAlertsPage";
import { MarketAnomaliesPage } from "../features/anomalies/MarketAnomaliesPage";
import { CommandPalette } from "../features/command/CommandPalette";
import { TraderDeskPage } from "../features/desk/TraderDeskPage";
import { DivergenceExplorerPage } from "../features/divergence/DivergenceExplorerPage";
import { EventWorkspacePage } from "../features/event/EventWorkspacePage";
import { ExportsPage } from "../features/exports/ExportsPage";
import { GamesPage } from "../features/games/GamesPage";
import { GameWorkspacePage } from "../features/games/GameWorkspacePage";
import { HistoryPage } from "../features/history/HistoryPage";
import { ResearchPage } from "../features/research/ResearchPage";
import { SettingsPage } from "../features/settings/SettingsPage";

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CommandPalette />
          <Routes>
            <Route element={<ShellLayout />} path="/">
              <Route element={<BoardAlertsPage />} index />
              <Route element={<TraderDeskPage />} path="legacy-desk" />
              <Route element={<BoardAlertsPage />} path="board-alerts" />
              <Route
                element={<BoardAlertsReplayPage />}
                path="board-alerts/:gameId"
              />
              <Route
                element={<MarketAnomaliesPage />}
                path="market-anomalies"
              />
              <Route element={<PlayerPropAlertsPage />} path="prop-alerts" />
              <Route element={<GamesPage />} path="games" />
              <Route element={<DivergenceExplorerPage />} path="divergence" />
              <Route element={<ResearchPage />} path="research" />
              <Route element={<HistoryPage />} path="history" />
              <Route element={<ExportsPage />} path="exports" />
              <Route element={<GamesPage />} path="games" />
              <Route element={<GameWorkspacePage />} path="games/:gameId" />
              <Route
                element={<EventWorkspacePage />}
                path="games/:gameId/markets/:instrumentId"
              />
              <Route element={<SettingsPage />} path="settings" />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
