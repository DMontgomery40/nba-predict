import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
import { getGame, getGameMarkets } from "../../data/api";
import {
  chartAxisColor,
  chartGridColor,
  chartTooltipStyle,
  marketChartPalette,
} from "../../lib/chart-theme";
import {
  formatGapPoints,
  formatMarketMatchLabel,
  formatProbabilityPercent,
} from "../../lib/market-format";
import {
  formatMarketSourceList,
  formatMarketSourceSummary,
  hasNbaStateSource,
} from "../../lib/source-coverage";
import { formatOperatorDateTime } from "../../lib/time-format";

function toneForComparableState(state: string) {
  if (state === "comparable") {
    return "positive" as const;
  }
  if (state === "line-mismatch") {
    return "warning" as const;
  }
  return "critical" as const;
}

function toneForMappingStatus(status: string) {
  if (status === "auto") {
    return "positive" as const;
  }
  if (status === "manual") {
    return "warning" as const;
  }
  return "critical" as const;
}

function formatScoreline(
  gameState?: {
    awayScore?: number | null;
    clock?: string | null;
    homeScore?: number | null;
    period?: number | null;
    status: string;
  } | null
) {
  if (!gameState) {
    return "No NBA state captured yet.";
  }

  return `${gameState.awayScore ?? "-"} - ${gameState.homeScore ?? "-"} · ${gameState.status}${
    gameState.period ? ` · P${gameState.period}` : ""
  }${gameState.clock ? ` · ${gameState.clock}` : ""}`;
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "No quote";
  }

  return formatOperatorDateTime(value);
}

function formatLine(value?: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return "line n/a";
  }

  return `line ${value > 0 ? `+${value}` : value}`;
}

export function GameWorkspacePage() {
  const { gameId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const game = useQuery({
    enabled: Boolean(gameId),
    queryKey: ["game", gameId],
    queryFn: () => getGame(gameId),
  });
  const markets = useQuery({
    enabled: Boolean(gameId),
    queryKey: ["game-markets", gameId],
    queryFn: () => getGameMarkets(gameId),
  });

  const selectedFamily = searchParams.get("family") ?? "all";

  const visibleItems = useMemo(() => {
    const items = markets.data?.data.items ?? [];
    if (selectedFamily === "all") {
      return items;
    }

    return items.filter((item) => item.instrument.family === selectedFamily);
  }, [markets.data?.data.items, selectedFamily]);

  if (!gameId) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Route Guard" title="Missing game id" />
          </Panel>
        }
      >
        <ErrorState
          actionLabel="Back to games"
          description="Game workspace needs a valid game id in the route."
          onAction={() => {
            window.location.assign("/");
          }}
          title="No game selected"
        />
      </PageFrame>
    );
  }

  if (
    game.isLoading ||
    markets.isLoading ||
    (!game.data && !game.isError) ||
    (!markets.data && !markets.isError)
  ) {
    return <LoadingState message="Loading game workspace…" />;
  }

  if (game.isError || markets.isError || !game.data || !markets.data) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle
              eyebrow="Failure State"
              title="Game workspace unavailable"
            />
          </Panel>
        }
      >
        <ErrorState
          description="The game workspace query failed."
          error={game.error ?? markets.error}
          onAction={() => {
            void game.refetch();
            void markets.refetch();
          }}
          title="Game detail failed to load"
        />
      </PageFrame>
    );
  }

  const gameData = game.data.data;
  const marketData = markets.data.data;
  const availableFamilies = [
    "all",
    ...Object.keys(marketData.groups).sort((left, right) =>
      left.localeCompare(right)
    ),
  ];
  const topInstrument =
    [...marketData.items].sort(
      (left, right) => right.signalPriority - left.signalPriority
    )[0] ?? null;
  const familyChartData = gameData.marketFamilyCounts.map((entry) => ({
    count: entry.count,
    family: entry.family,
  }));
  const hasNbaState = hasNbaStateSource(
    gameData.coverageSummary.availableSources
  );

  return (
    <PageFrame
      aside={
        <>
          <Panel>
            <SectionTitle
              eyebrow="Game State"
              title={`${gameData.game.awayParticipant.shortName} at ${gameData.game.homeParticipant.shortName}`}
              body={formatScoreline(gameData.gameState)}
            />
            <div className="tag-row">
              <Badge tone="neutral">
                {marketData.items.length} tracked instruments
              </Badge>
              <Badge
                tone={
                  gameData.coverageSummary.availableSources.length > 0
                    ? "positive"
                    : "warning"
                }
              >
                {formatMarketSourceSummary(
                  gameData.coverageSummary.availableSources
                )}
              </Badge>
              {hasNbaState ? <Badge tone="neutral">NBA state</Badge> : null}
            </div>
          </Panel>

          <Panel>
            <SectionTitle
              eyebrow="Coverage"
              title="Market feeds, NBA state, and unmapped signals"
            />
            <div className="stack">
              <div className="note-card compact">
                <h3>Available market feeds</h3>
                <p>
                  {formatMarketSourceList(
                    gameData.coverageSummary.availableSources
                  )}
                </p>
              </div>
              <div className="note-card compact">
                <h3>NBA game state</h3>
                <p>{hasNbaState ? "Available" : "Missing"}</p>
              </div>
              <div className="note-card compact">
                <h3>Missing market feeds</h3>
                <p>
                  {gameData.coverageSummary.missingSources.length === 0
                    ? "No market-feed gaps on this game."
                    : gameData.coverageSummary.missingSources.join(", ")}
                </p>
              </div>
              <div className="note-card compact">
                <h3>Unmapped markets</h3>
                <p>
                  {gameData.coverageSummary.unmappedSourceMarketCount} source
                  market
                  {gameData.coverageSummary.unmappedSourceMarketCount === 1
                    ? ""
                    : "s"}{" "}
                  still require manual review.
                </p>
              </div>
            </div>
          </Panel>
        </>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Game Workspace</div>
          <h1>
            {gameData.game.awayParticipant.shortName} at{" "}
            {gameData.game.homeParticipant.shortName}
          </h1>
          <p>
            Compare grouped active instruments for one game, keep source mapping
            state visible, and jump straight into the detailed instrument
            timeline when a market needs deeper inspection.
          </p>
        </div>
        <div className="hero-actions">
          {topInstrument ? (
            <Link
              className="primary-button"
              to={`/games/${gameId}/markets/${topInstrument.instrument.id}`}
            >
              Open top instrument
            </Link>
          ) : null}
        </div>
      </section>

      <Panel>
        <SectionTitle
          eyebrow="Market Mix"
          title="Tracked market families"
          body="This game-level view is driven by canonical instruments already mapped into the live research store."
        />
        <div className="chart-shell compact-chart">
          <ResponsiveContainer height={220} width="100%">
            <BarChart data={familyChartData}>
              <CartesianGrid stroke={chartGridColor} vertical={false} />
              <XAxis dataKey="family" stroke={chartAxisColor} />
              <YAxis allowDecimals={false} stroke={chartAxisColor} />
              <Tooltip {...chartTooltipStyle} />
              <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                {familyChartData.map((entry, index) => (
                  <Cell
                    fill={marketChartPalette[index % marketChartPalette.length]}
                    key={entry.family}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Market Families"
          title="Switch the comparison surface"
          body="The grouped table below stays instrument-first, but this selector keeps the operator in one game while moving across moneyline, spread, total, and prop families."
        />
        <div className="family-tabs">
          {availableFamilies.map((family) => (
            <button
              className={`family-tab ${selectedFamily === family ? "family-tab-active" : ""}`}
              key={family}
              onClick={() => {
                const nextParams = new URLSearchParams(searchParams);
                if (family === "all") {
                  nextParams.delete("family");
                } else {
                  nextParams.set("family", family);
                }
                setSearchParams(nextParams, { replace: true });
              }}
              type="button"
            >
              {family === "all" ? "All" : family}
            </button>
          ))}
        </div>
      </Panel>

      <div className="stack">
        {visibleItems.length === 0 ? (
          <Panel>
            <SectionTitle
              eyebrow="No Instruments"
              title="Nothing matches the current family filter"
            />
          </Panel>
        ) : null}

        {visibleItems.map((item) => (
          <Panel className="instrument-card" key={item.instrument.id}>
            <div className="instrument-card-header">
              <div>
                <div className="eyebrow">{item.instrument.family}</div>
                <h3>{item.instrument.displayLabel}</h3>
                <p className="muted">
                  Review priority {item.signalPriority}
                  {item.impliedProbabilityGap != null
                    ? ` · ${formatGapPoints(item.impliedProbabilityGap)} divergence`
                    : ""}
                </p>
              </div>
              <div className="tag-row">
                <Badge tone={toneForComparableState(item.comparableState)}>
                  {formatMarketMatchLabel(item.comparableState)}
                </Badge>
                <Badge tone={toneForMappingStatus(item.mappingStatus)}>
                  {item.mappingStatus}
                </Badge>
                {item.lineMismatch ? (
                  <Badge tone="warning">Line mismatch</Badge>
                ) : null}
              </div>
            </div>

            <div className="source-compare-grid">
              {item.sources.map((source) => (
                <div
                  className="source-compare-card"
                  key={source.sourceMarketId}
                >
                  <div className="source-compare-head">
                    <strong>{source.source}</strong>
                    <span className="muted">
                      {formatTimestamp(source.capturedAt)}
                    </span>
                  </div>
                  <div className="source-compare-body">
                    <span>
                      {source.impliedProbability == null
                        ? "n/a"
                        : formatProbabilityPercent(source.impliedProbability)}
                    </span>
                    <span>
                      {formatLine(source.raw.line ?? item.instrument.line)}
                    </span>
                    <span>{formatTimestamp(source.capturedAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="instrument-card-actions">
              <Link
                className="primary-button"
                to={`/games/${gameId}/markets/${item.instrument.id}`}
              >
                Open instrument detail
              </Link>
            </div>
          </Panel>
        ))}
      </div>
    </PageFrame>
  );
}
