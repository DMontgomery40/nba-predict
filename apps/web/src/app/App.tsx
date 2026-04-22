import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./ErrorBoundary";
import { ShellLayout } from "./ShellLayout";
import { queryClient } from "../data/api";
import { CommandPalette } from "../features/command/CommandPalette";
import { DivergenceExplorerPage } from "../features/divergence/DivergenceExplorerPage";
import { EventWorkspacePage } from "../features/event/EventWorkspacePage";
import { ExportsPage } from "../features/exports/ExportsPage";
import { GamesPage } from "../features/games/GamesPage";
import { GameWorkspacePage } from "../features/games/GameWorkspacePage";
import { HistoryPage } from "../features/history/HistoryPage";
import { SettingsPage } from "../features/settings/SettingsPage";

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CommandPalette />
          <Routes>
            <Route element={<ShellLayout />} path="/">
              <Route element={<GamesPage />} index />
              <Route element={<DivergenceExplorerPage />} path="divergence" />
              <Route element={<HistoryPage />} path="history" />
              <Route element={<ExportsPage />} path="exports" />
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
