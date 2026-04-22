import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
import {
  getAdminCaptureRuns,
  getAdminStorageCoverage,
  getGames,
  getInstrumentTimelineExportUrl,
  getResearchCoverage,
  getSignalMismatches,
} from "../../data/api";
import { downloadCsvFile, downloadJsonFile } from "../../lib/downloads";
import { formatMarketSourceSummary } from "../../lib/source-coverage";

type ExportCard = {
  filenameBase: string;
  rows: Array<Record<string, unknown>>;
  subtitle: string;
  title: string;
};

export function ExportsPage() {
  const games = useQuery({
    queryKey: ["games"],
    queryFn: getGames,
  });
  const captureRuns = useQuery({
    queryKey: ["admin-capture-runs"],
    queryFn: getAdminCaptureRuns,
  });
  const storageCoverage = useQuery({
    queryKey: ["admin-storage-coverage"],
    queryFn: getAdminStorageCoverage,
  });
  const researchCoverage = useQuery({
    queryKey: ["research-coverage"],
    queryFn: getResearchCoverage,
  });
  const signalMismatches = useQuery({
    queryKey: ["research-signal-mismatches"],
    queryFn: getSignalMismatches,
  });

  if (
    games.isLoading ||
    captureRuns.isLoading ||
    storageCoverage.isLoading ||
    researchCoverage.isLoading ||
    signalMismatches.isLoading ||
    (!games.data && !games.isError) ||
    (!captureRuns.data && !captureRuns.isError) ||
    (!storageCoverage.data && !storageCoverage.isError) ||
    (!researchCoverage.data && !researchCoverage.isError) ||
    (!signalMismatches.data && !signalMismatches.isError)
  ) {
    return <LoadingState message="Loading export surfaces…" />;
  }

  if (
    games.isError ||
    captureRuns.isError ||
    storageCoverage.isError ||
    researchCoverage.isError ||
    signalMismatches.isError ||
    !games.data ||
    !captureRuns.data ||
    !storageCoverage.data ||
    !researchCoverage.data ||
    !signalMismatches.data
  ) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle eyebrow="Fallback" title="Exports unavailable" />
          </Panel>
        }
      >
        <ErrorState
          description="The export surfaces could not be loaded."
          error={
            games.error ??
            captureRuns.error ??
            storageCoverage.error ??
            researchCoverage.error ??
            signalMismatches.error
          }
          onAction={() => {
            void games.refetch();
            void captureRuns.refetch();
            void storageCoverage.refetch();
            void researchCoverage.refetch();
            void signalMismatches.refetch();
          }}
          title="Exports failed to load"
        />
      </PageFrame>
    );
  }

  const datasetExports: ExportCard[] = [
    {
      filenameBase: "capture-runs",
      rows: captureRuns.data.data,
      subtitle: "Adapter run history across sources",
      title: "Capture runs",
    },
    {
      filenameBase: "storage-coverage",
      rows: storageCoverage.data.data,
      subtitle: "Persisted source-market, quote, and payload counts",
      title: "Storage coverage",
    },
    {
      filenameBase: "research-coverage",
      rows: researchCoverage.data.data,
      subtitle: "Missing and unmapped research visibility",
      title: "Research coverage",
    },
    {
      filenameBase: "signal-mismatches",
      rows: signalMismatches.data.data,
      subtitle: "Historical disagreement snapshot",
      title: "Signal mismatches",
    },
  ];

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Exports"
            title={`${datasetExports.length} dataset exports available`}
            body="This page keeps export access visible even when the current games list is empty."
          />
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Exports</div>
          <h1>Dataset and timeline exports</h1>
          <p>
            Download persisted research tables directly, then jump into
            instrument timeline CSV exports when canonical games are available.
          </p>
        </div>
      </section>

      <Panel>
        <SectionTitle
          eyebrow="Dataset Exports"
          title="Persisted cross-surface downloads"
          body="These exports are available without opening a game or instrument first."
        />
        <div className="card-grid">
          {datasetExports.map((dataset) => (
            <div className="note-card export-card" key={dataset.filenameBase}>
              <h3>{dataset.title}</h3>
              <p>{dataset.subtitle}</p>
              <div className="tag-row">
                <Badge tone={dataset.rows.length > 0 ? "positive" : "warning"}>
                  {dataset.rows.length} rows
                </Badge>
              </div>
              <div className="hero-actions">
                <button
                  className="primary-button"
                  onClick={() =>
                    downloadCsvFile(`${dataset.filenameBase}.csv`, dataset.rows)
                  }
                  type="button"
                >
                  Download CSV
                </button>
                <button
                  className="ghost-button"
                  onClick={() =>
                    downloadJsonFile(
                      `${dataset.filenameBase}.json`,
                      dataset.rows
                    )
                  }
                  type="button"
                >
                  Download JSON
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Instrument Exports"
          title="Timeline CSV shortcuts"
          body="These are the quickest per-instrument exports we can offer from the current persisted game surface."
        />
        <div className="stack">
          {games.data.data.length === 0 ? (
            <p className="muted">
              No canonical games are visible right now. The dataset exports
              above still work, and history/settings remain available while
              capture or backfill repopulates game-level views.
            </p>
          ) : (
            games.data.data.map((entry) => {
              const topInstrument = entry.topDivergences[0];

              return (
                <div className="action-row" key={entry.game.id}>
                  <div>
                    <strong>
                      {entry.game.awayParticipant.shortName} at{" "}
                      {entry.game.homeParticipant.shortName}
                    </strong>
                    <p>
                      {topInstrument
                        ? `${topInstrument.displayLabel} · ${formatMarketSourceSummary(entry.coverage.availableSources)} · ${entry.activeInstrumentCount} instruments`
                        : "No ranked instrument export shortcut yet for this game."}
                    </p>
                  </div>
                  <div className="hero-actions">
                    <Link
                      className="ghost-button"
                      to={`/games/${entry.game.id}`}
                    >
                      Open game
                    </Link>
                    {topInstrument ? (
                      <a
                        className="primary-button"
                        href={getInstrumentTimelineExportUrl(
                          entry.game.id,
                          topInstrument.instrumentId
                        )}
                      >
                        Export top timeline CSV
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </PageFrame>
  );
}
