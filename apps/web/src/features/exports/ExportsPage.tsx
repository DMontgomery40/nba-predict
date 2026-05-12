import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { InlineAlert } from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
import {
  getDatasetExportUrl,
  getExportCatalog,
  getFullPackageExportUrl,
  getSqliteExportUrl,
} from "../../data/api";
import { formatOperatorDateTime } from "../../lib/time-format";

import type { ExportCatalogPayload } from "../../data/api";

type Dataset = ExportCatalogPayload["data"]["datasets"][number];

const STATIC_DATASETS: Dataset[] = [
  {
    formats: ["csv", "jsonl"],
    id: "market-quotes",
    rowCount: null,
    title: "Market quote ticks",
  },
  {
    formats: ["csv", "jsonl"],
    id: "source-markets",
    rowCount: null,
    title: "Source markets",
  },
  {
    formats: ["csv", "jsonl"],
    id: "market-instruments",
    rowCount: null,
    title: "Market instruments",
  },
  {
    formats: ["csv", "jsonl"],
    id: "games",
    rowCount: null,
    title: "Games",
  },
  {
    formats: ["csv", "jsonl"],
    id: "game-states",
    rowCount: null,
    title: "Game states",
  },
  {
    formats: ["csv", "jsonl"],
    id: "game-outcomes",
    rowCount: null,
    title: "Game outcomes",
  },
  {
    formats: ["csv", "jsonl"],
    id: "raw-payloads",
    rowCount: null,
    title: "Raw payloads",
  },
  {
    formats: ["csv", "jsonl"],
    id: "adapter-runs",
    rowCount: null,
    title: "Adapter runs",
  },
];

const DATASET_ORDER = new Map(
  STATIC_DATASETS.map((dataset, index) => [dataset.id, index])
);

const DATASET_DESCRIPTIONS: Record<string, string> = {
  "adapter-runs":
    "Capture and backfill run ledger with status and write counts.",
  games: "Canonical NBA games, participants, league, sport, and schedule.",
  "game-outcomes": "Final scores and winners linked to canonical games.",
  "game-states": "Timestamped NBA sidecar state snapshots and scores.",
  "market-instruments":
    "Canonical moneyline, spread, total, team prop, and player prop instruments.",
  "market-quotes":
    "High-volume provider quote ticks with timestamps, prices, bid/ask, and volume.",
  "raw-payloads":
    "Persisted source payloads keyed by provider, entity, timestamp, and content hash.",
  "source-markets":
    "Provider market identifiers, raw labels, raw families, and mapping state.",
};

const SOURCE_OPTIONS = [
  { label: "All providers", value: "" },
  { label: "bet365", value: "bet365" },
  { label: "Kalshi", value: "kalshi" },
  { label: "Polymarket", value: "polymarket" },
];

const FAMILY_OPTIONS = [
  { label: "All families", value: "" },
  { label: "Moneyline", value: "moneyline" },
  { label: "Spread", value: "spread" },
  { label: "Total", value: "total" },
  { label: "Player props", value: "player-prop" },
  { label: "Team props", value: "team-prop" },
  { label: "Other", value: "other" },
];

const QUOTE_COLUMNS = [
  "captured_at",
  "scheduled_start",
  "source",
  "family",
  "display_label",
  "price_raw",
  "implied_probability",
  "best_bid",
  "best_ask",
  "volume",
  "raw_label",
];

function formatCount(value: number | null) {
  return value == null ? "row count loading" : `${value.toLocaleString()} rows`;
}

function sortDatasets(datasets: Dataset[]) {
  return [...datasets]
    .filter((dataset) => dataset.id !== "sqlite")
    .sort(
      (left, right) =>
        (DATASET_ORDER.get(left.id) ?? 999) -
          (DATASET_ORDER.get(right.id) ?? 999) ||
        left.title.localeCompare(right.title)
    );
}

function cleanFilters(filters: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, value.trim()])
  );
}

export function ExportsPage() {
  const [source, setSource] = useState("");
  const [family, setFamily] = useState("");
  const [gameId, setGameId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const catalog = useQuery({
    queryKey: ["export-catalog"],
    queryFn: getExportCatalog,
  });

  const datasets = useMemo(
    () => sortDatasets(catalog.data?.data.datasets ?? STATIC_DATASETS),
    [catalog.data]
  );

  const quoteFilters = cleanFilters({ family, from, gameId, source, to });
  const quoteCsvUrl = getDatasetExportUrl("market-quotes", "csv", quoteFilters);
  const quoteJsonlUrl = getDatasetExportUrl(
    "market-quotes",
    "jsonl",
    quoteFilters
  );

  const packageStatus = catalog.data
    ? `Catalog ready at ${formatOperatorDateTime(catalog.data.meta.generatedAt)}`
    : catalog.isError
      ? "Catalog counts unavailable"
      : "Catalog counts loading";

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Exports"
            title="Full package first"
            body="The primary download is the complete live SQLite store; CSV and JSONL are table or quote slices."
          />
          <div className="tag-row">
            <Badge tone="positive">captured_at</Badge>
            <Badge tone="positive">volume column</Badge>
            <Badge tone="positive">raw payloads</Badge>
          </div>
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Exports</div>
          <h1>Data engineering export package</h1>
          <p>
            Start with the full database snapshot, then use filtered CSV or
            JSONL pulls only when a downstream tool needs flat files.
          </p>
        </div>
      </section>

      <Panel className="export-package-panel">
        <SectionTitle
          eyebrow="Start Here"
          title="One file with every persisted table"
          body="This is the least lossy handoff for R, Python, DuckDB, dbt seeds, or warehouse staging."
        />
        <div className="export-package-grid">
          <div className="export-primary-card">
            <div>
              <h3>Full SQLite package</h3>
              <p>
                Includes games, game states, source markets, market instruments,
                quote ticks, raw payloads, adapter runs, mapping resolutions,
                and game outcomes.
              </p>
            </div>
            <div className="tag-row">
              <Badge tone="positive">all providers</Badge>
              <Badge tone="positive">all families</Badge>
              <Badge tone="positive">timestamps</Badge>
              <Badge tone="positive">volume when supplied</Badge>
            </div>
            <div className="hero-actions">
              <a className="primary-button" href={getFullPackageExportUrl()}>
                Download full package
              </a>
              <a className="ghost-button" href={getSqliteExportUrl()}>
                Download SQLite
              </a>
            </div>
          </div>

          <div className="export-code-card">
            <h3>R starter</h3>
            <pre>
              <code>{`library(DBI)
library(RSQLite)

con <- dbConnect(SQLite(), "signal-console.sqlite")
dbListTables(con)

quotes <- dbGetQuery(con, "
  SELECT qt.captured_at, qt.volume, qt.price_raw,
         qt.best_bid, qt.best_ask, sm.source,
         COALESCE(mi.family, sm.raw_family) AS family
  FROM quote_ticks qt
  JOIN source_markets sm ON sm.id = qt.source_market_id
  LEFT JOIN market_instruments mi ON mi.id = sm.instrument_id
")`}</code>
            </pre>
          </div>
        </div>
      </Panel>

      <Panel className="export-builder-panel">
        <SectionTitle
          eyebrow="Filtered Flat Files"
          title="Quote export builder"
          body="Use this for high-volume quote slices, including all player props across providers or a single provider family."
        />
        <div className="export-builder-grid">
          <label className="export-field">
            <span>Provider</span>
            <select
              aria-label="Provider"
              className="filter-select"
              onChange={(event) => setSource(event.target.value)}
              value={source}
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="export-field">
            <span>Market family</span>
            <select
              aria-label="Market family"
              className="filter-select"
              onChange={(event) => setFamily(event.target.value)}
              value={family}
            >
              {FAMILY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="export-field">
            <span>Game id</span>
            <input
              aria-label="Game id"
              className="search-input"
              onChange={(event) => setGameId(event.target.value)}
              placeholder="optional canonical game id"
              value={gameId}
            />
          </label>
          <label className="export-field">
            <span>From</span>
            <input
              aria-label="From timestamp"
              className="search-input"
              onChange={(event) => setFrom(event.target.value)}
              placeholder="2026-05-02T00:00:00.000Z"
              value={from}
            />
          </label>
          <label className="export-field">
            <span>To</span>
            <input
              aria-label="To timestamp"
              className="search-input"
              onChange={(event) => setTo(event.target.value)}
              placeholder="2026-05-03T00:00:00.000Z"
              value={to}
            />
          </label>
        </div>
        <div className="export-schema-strip">
          {QUOTE_COLUMNS.map((column) => (
            <Badge key={column}>{column}</Badge>
          ))}
        </div>
        <div className="hero-actions">
          <a className="primary-button" href={quoteCsvUrl}>
            Download filtered CSV
          </a>
          <a className="ghost-button" href={quoteJsonlUrl}>
            Download filtered JSONL
          </a>
          <a
            className="ghost-button"
            href={getDatasetExportUrl("market-quotes", "csv", {
              family: "player-prop",
            })}
          >
            All player props CSV
          </a>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Common Pulls"
          title="Ready-made quote slices"
          body="These stay flat-file friendly while preserving the market quote schema."
        />
        <div className="export-shortcut-grid">
          <a
            className="export-shortcut"
            href={getDatasetExportUrl("market-quotes", "csv")}
          >
            <strong>All quote ticks</strong>
            <span>CSV across every provider and market family</span>
          </a>
          <a
            className="export-shortcut"
            href={getDatasetExportUrl("market-quotes", "csv", {
              family: "player-prop",
            })}
          >
            <strong>All player props</strong>
            <span>CSV filtered to raw or mapped player-prop markets</span>
          </a>
          <a
            className="export-shortcut"
            href={getDatasetExportUrl("market-quotes", "csv", {
              family: "player-prop",
              source: "kalshi",
            })}
          >
            <strong>Kalshi player props</strong>
            <span>CSV for direct Kalshi prop snapshots</span>
          </a>
          <a
            className="export-shortcut"
            href={getDatasetExportUrl("raw-payloads", "jsonl")}
          >
            <strong>Raw payload ledger</strong>
            <span>JSONL for original source payload inspection</span>
          </a>
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Table Exports"
          title="Individual persisted tables"
          body="Use these only when the full SQLite package is too broad for the receiving workflow."
        />
        {catalog.isLoading ? (
          <div className="loading-panel export-loading">
            Loading live row counts; download links are already available.
          </div>
        ) : null}
        {catalog.isError ? (
          <InlineAlert
            message="Live row counts did not load, but deterministic export links are still available."
            tone="warning"
          />
        ) : null}
        <div className="card-grid export-table-grid">
          {datasets.map((dataset) => (
            <div className="note-card export-card" key={dataset.id}>
              <h3>{dataset.title}</h3>
              <p>{DATASET_DESCRIPTIONS[dataset.id] ?? dataset.id}</p>
              <div className="tag-row">
                <Badge
                  tone={(dataset.rowCount ?? 0) > 0 ? "positive" : "warning"}
                >
                  {formatCount(dataset.rowCount)}
                </Badge>
              </div>
              <div className="hero-actions">
                <a
                  className="primary-button"
                  href={getDatasetExportUrl(dataset.id, "csv")}
                >
                  CSV
                </a>
                <a
                  className="ghost-button"
                  href={getDatasetExportUrl(dataset.id, "jsonl")}
                >
                  JSONL
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="muted export-status">{packageStatus}</p>
      </Panel>
    </PageFrame>
  );
}
