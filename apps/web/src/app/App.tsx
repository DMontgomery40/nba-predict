import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./ErrorBoundary";
import { ShellLayout } from "./ShellLayout";
import { queryClient } from "../data/api";
import { DivergenceExplorerPage } from "../features/divergence/DivergenceExplorerPage";
import { EventWorkspacePage } from "../features/event/EventWorkspacePage";
import { OverviewPage } from "../features/overview/OverviewPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TimelinePage } from "../features/timeline/TimelinePage";
import { WatchlistPage } from "../features/watchlist/WatchlistPage";

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route element={<ShellLayout />} path="/">
              <Route element={<OverviewPage />} index />
              <Route element={<EventWorkspacePage />} path="events/:eventId" />
              <Route element={<DivergenceExplorerPage />} path="divergence" />
              <Route element={<TimelinePage />} path="timeline/:eventId?" />
              <Route element={<WatchlistPage />} path="watchlist" />
              <Route element={<SettingsPage />} path="settings" />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
