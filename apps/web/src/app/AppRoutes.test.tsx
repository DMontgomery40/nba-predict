import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppStore } from "./store";
import {
  ApiRequestError,
  createAppQueryClient,
  getEvent,
  getOverview,
} from "../data/api";
import { EventWorkspacePage } from "../features/event/EventWorkspacePage";
import { OverviewPage } from "../features/overview/OverviewPage";

import type { ReactNode } from "react";

vi.mock("../data/api", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../data/api");

  return {
    ...actual,
    getEvent: vi.fn(),
    getOverview: vi.fn(),
  };
});

function renderRoute(options: { path: string; route: ReactNode; url: string }) {
  const queryClient = createAppQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[options.url]}>
        <Routes>
          <Route element={options.route} path={options.path} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("app routes", () => {
  beforeEach(() => {
    useAppStore.setState({
      commandInput: "",
      commandOpen: false,
      mode: "demo",
    });
    vi.mocked(getOverview).mockReset();
    vi.mocked(getEvent).mockReset();
  });

  it("renders the overview route from API data", async () => {
    vi.mocked(getOverview).mockResolvedValue({
      data: {
        cards: [
          {
            confidenceBand: "high",
            confidenceScore: 88,
            divergenceScore: 84,
            eventId: "knicks-celtics",
            interestingNow: "External drift and exposure overlap.",
            isWatched: false,
            label: "New York @ Boston",
            severityBand: "critical",
            tipoffLabel: "7:00 PM ET",
            watchlistPriority: 92,
          },
        ],
        generatedAt: "2026-04-21T19:00:00.000Z",
        interestingNow: [
          {
            body: "Boston is still the cleanest actionable signal.",
            title: "Boston Steam",
          },
        ],
        mode: "demo",
        quickStats: [
          {
            label: "Active games",
            tone: "neutral",
            value: "2",
          },
        ],
        sourceHealth: [
          {
            lagMs: 12_000,
            message: "Healthy.",
            sourceId: "kalshi",
            status: "healthy",
          },
        ],
        storyline: {
          description: "Boston steam into tip.",
          fixturePack: "demo-pack",
          id: "boston-steam",
          name: "Boston Steam Into Tip",
        },
        watchlist: [],
      },
      meta: {
        generatedAt: "2026-04-21T19:00:00.000Z",
      },
    });

    renderRoute({ path: "/", route: <OverviewPage />, url: "/" });

    expect(
      await screen.findByRole("heading", { name: "Signal Console" })
    ).toBeInTheDocument();
    expect(await screen.findByText("New York @ Boston")).toBeInTheDocument();
  });

  it("renders the event route failure state with operator-facing detail", async () => {
    vi.mocked(getEvent).mockRejectedValue(
      new ApiRequestError({
        code: "EVENT_NOT_FOUND",
        message: 'Event "missing-event" was not found.',
        operatorHint:
          "Confirm the event exists in the active storyline and the route param uses the canonical event id.",
        requestId: "req-test-123",
        status: 404,
      })
    );

    renderRoute({
      path: "/events/:eventId",
      route: <EventWorkspacePage />,
      url: "/events/missing-event",
    });

    expect(
      await screen.findByRole("heading", {
        name: "Event detail failed to load",
      })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Request ID: req-test-123")
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Confirm the event exists/)
    ).toBeInTheDocument();
  });
});
