import React from "react";

type ConsensusRow = {
  label: string;
  bet365: number;
  kalshi: number;
  polymarket: number;
  model: number;
  severity: "Low" | "Medium" | "High";
  tipoff: string;
  exposure: string;
};

type TimelinePoint = {
  time: string;
  bet365: number;
  kalshi: number;
  polymarket: number;
  model: number;
};

const slate: ConsensusRow[] = [
  {
    label: "Knicks @ Celtics",
    bet365: 58.1,
    kalshi: 62.4,
    polymarket: 64.1,
    model: 61.5,
    severity: "High",
    tipoff: "38m",
    exposure: "High",
  },
  {
    label: "Suns @ Nuggets",
    bet365: 47.8,
    kalshi: 45.5,
    polymarket: 44.9,
    model: 46.1,
    severity: "Medium",
    tipoff: "1h 12m",
    exposure: "Medium",
  },
  {
    label: "Heat @ Bucks",
    bet365: 41.2,
    kalshi: 43.1,
    polymarket: 42.7,
    model: 44.0,
    severity: "Low",
    tipoff: "2h 04m",
    exposure: "Low",
  },
  {
    label: "Mavs @ Thunder",
    bet365: 49.3,
    kalshi: 53.4,
    polymarket: 52.1,
    model: 54.2,
    severity: "High",
    tipoff: "2h 35m",
    exposure: "High",
  },
];

const timeline: TimelinePoint[] = [
  { time: "15:10", bet365: 58.1, kalshi: 58.4, polymarket: 59.2, model: 61.5 },
  { time: "15:18", bet365: 58.1, kalshi: 59.8, polymarket: 61.3, model: 61.5 },
  { time: "15:27", bet365: 58.1, kalshi: 61.2, polymarket: 63.0, model: 61.5 },
  { time: "15:34", bet365: 58.1, kalshi: 62.4, polymarket: 64.1, model: 61.5 },
];

const alerts = [
  {
    title: "Consensus drift",
    body: "Kalshi and Polymarket both moved toward Boston while bet365 remained static for 11 minutes.",
    tone: "high",
  },
  {
    title: "Liquidity confirmation",
    body: "Kalshi move held through multiple intervals with tighter structure than the earlier Polymarket spike.",
    tone: "medium",
  },
  {
    title: "Prop lag",
    body: "Selected player props still look lighter than the winner market shift suggests.",
    tone: "medium",
  },
];

const sourceTrust = [
  { source: "Kalshi", score: 84, note: "Best current market structure" },
  { source: "Polymarket", score: 76, note: "Moved first, slightly noisier" },
  { source: "Model", score: 72, note: "Supports the move" },
  { source: "bet365 book", score: 100, note: "Operational source of truth" },
];

const evidence = [
  "Boston has a rest edge and stronger rolling net rating.",
  "Polymarket led the move, Kalshi confirmed it on better liquidity.",
  "Internal away-side parlay exposure is climbing.",
  "Noisy one-venue spikes were filtered out earlier in the day.",
];

const actions = [
  { label: "Reprice main line", detail: "Move 2.5 to 3.0" },
  { label: "Tighten limits", detail: "High-liability props" },
  { label: "Monitor lineup", detail: "Watch confirmation channel" },
];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function severityTone(severity: ConsensusRow["severity"]) {
  if (severity === "High") {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }
  if (severity === "Medium") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
}

function barWidth(value: number) {
  return `${Math.max(6, Math.min(100, value))}%`;
}

function MiniConsensusBar({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-zinc-500">
        <span>{label}</span>
        <span className="font-mono text-zinc-300">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-900 ring-1 ring-white/5">
        <div
          className={cn("h-2 rounded-full", className)}
          style={{ width: barWidth(value) }}
        />
      </div>
    </div>
  );
}

function SparkColumn({
  values,
  colorClass,
}: {
  values: number[];
  colorClass: string;
}) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);

  return (
    <div className="flex h-20 items-end gap-1">
      {values.map((value, index) => {
        const height = 20 + ((value - min) / range) * 60;
        return (
          <div
            key={`${value}-${index}`}
            className={cn("w-6 rounded-t-md", colorClass)}
            style={{ height: `${height}%` }}
            title={`${value.toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
}

function SidebarSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; active?: boolean; badge?: string }>;
}) {
  return (
    <div className="space-y-2">
      <div className="px-3 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        {title}
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            key={item.label}
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition",
              item.active
                ? "bg-zinc-900 text-zinc-100 ring-1 ring-emerald-400/20"
                : "text-zinc-400 hover:bg-zinc-950 hover:text-zinc-200"
            )}
          >
            <span>{item.label}</span>
            {item.badge ? (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {item.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function SlateRow({ row }: { row: ConsensusRow }) {
  return (
    <button className="grid w-full grid-cols-[1.7fr_repeat(4,0.6fr)_0.7fr_0.6fr_0.7fr] items-center gap-3 rounded-2xl border border-white/5 bg-zinc-950/70 px-4 py-3 text-left transition hover:border-emerald-400/20 hover:bg-zinc-950">
      <div>
        <div className="text-sm font-medium text-zinc-100">{row.label}</div>
        <div className="mt-1 text-xs text-zinc-500">
          Winner market • Pregame • NBA
        </div>
      </div>
      <div className="font-mono text-sm text-zinc-300">
        {row.bet365.toFixed(1)}%
      </div>
      <div className="font-mono text-sm text-zinc-300">
        {row.kalshi.toFixed(1)}%
      </div>
      <div className="font-mono text-sm text-zinc-300">
        {row.polymarket.toFixed(1)}%
      </div>
      <div className="font-mono text-sm text-zinc-300">
        {row.model.toFixed(1)}%
      </div>
      <div>
        <span
          className={cn(
            "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em]",
            severityTone(row.severity)
          )}
        >
          {row.severity}
        </span>
      </div>
      <div className="font-mono text-sm text-zinc-400">{row.tipoff}</div>
      <div className="font-mono text-sm text-zinc-400">{row.exposure}</div>
    </button>
  );
}

export default function Bet365SignalConsole() {
  return (
    <div className="min-h-screen bg-[#0a0b0d] text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-[280px_minmax(0,1fr)_360px] gap-0 px-4 py-4">
        <aside className="rounded-3xl border border-white/6 bg-[#0d0f12] p-4 shadow-2xl shadow-black/30">
          <div className="mb-6 flex items-center gap-3 px-2">
            <div className="grid h-10 w-10 place-items-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
              365
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide text-zinc-100">
                Signal Console
              </div>
              <div className="text-xs text-zinc-500">
                NBA market intelligence
              </div>
            </div>
          </div>

          <div className="mb-5 rounded-2xl border border-white/6 bg-zinc-950 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              Workspace
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-100">
                  Tonight&apos;s Slate
                </div>
                <div className="text-xs text-zinc-500">
                  9 active games • 14 alerts
                </div>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                Live
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <SidebarSection
              title="Trading"
              items={[
                { label: "Slates", active: true },
                { label: "Alerts", badge: "14" },
                { label: "Markets" },
                { label: "Props" },
                { label: "Live" },
              ]}
            />
            <SidebarSection
              title="Analysis"
              items={[
                { label: "Backtests" },
                { label: "Source trust" },
                { label: "Exposure map" },
                { label: "Postmortems" },
              ]}
            />
            <SidebarSection
              title="System"
              items={[
                { label: "Sources" },
                { label: "Playbooks" },
                { label: "Saved filters" },
                { label: "Audit trail" },
              ]}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-white/6 bg-gradient-to-b from-zinc-950 to-zinc-900 p-4">
            <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              Command line
            </div>
            <div className="mt-2 rounded-xl border border-white/6 bg-black/30 px-3 py-2 font-mono text-xs text-zinc-300">
              ⌘K&nbsp;&nbsp;Show high-severity NBA alerts with external
              consensus drift
            </div>
          </div>
        </aside>

        <main className="px-4">
          <div className="rounded-3xl border border-white/6 bg-[#0d0f12] shadow-2xl shadow-black/20">
            <div className="border-b border-white/6 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                    Active thread
                  </div>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-100">
                    Knicks @ Celtics
                  </h1>
                  <p className="mt-1 max-w-3xl text-sm text-zinc-400">
                    Prediction-market intelligence layer for NBA trading. bet365
                    book state stays central. Kalshi and Polymarket act as
                    external sensor networks.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-xl border border-white/6 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                    Export trader note
                  </button>
                  <button className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-400/15">
                    Reprice suggestion
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-5">
              <section className="grid grid-cols-[1.2fr_0.8fr] gap-5">
                <div className="rounded-2xl border border-white/6 bg-zinc-950/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                        Consensus strip
                      </div>
                      <div className="mt-1 text-lg font-semibold text-zinc-100">
                        Home win probability
                      </div>
                    </div>
                    <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-rose-200">
                      High severity
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <MiniConsensusBar
                      label="bet365"
                      value={58.1}
                      className="bg-zinc-300/70"
                    />
                    <MiniConsensusBar
                      label="Kalshi"
                      value={62.4}
                      className="bg-emerald-400/80"
                    />
                    <MiniConsensusBar
                      label="Polymarket"
                      value={64.1}
                      className="bg-sky-400/80"
                    />
                    <MiniConsensusBar
                      label="Model"
                      value={61.5}
                      className="bg-violet-400/80"
                    />
                  </div>

                  <div className="mt-5 grid grid-cols-4 gap-3">
                    {[
                      {
                        label: "bet365",
                        values: timeline.map((item) => item.bet365),
                        color: "bg-zinc-500/80",
                      },
                      {
                        label: "Kalshi",
                        values: timeline.map((item) => item.kalshi),
                        color: "bg-emerald-400/80",
                      },
                      {
                        label: "Polymarket",
                        values: timeline.map((item) => item.polymarket),
                        color: "bg-sky-400/80",
                      },
                      {
                        label: "Model",
                        values: timeline.map((item) => item.model),
                        color: "bg-violet-400/80",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-white/5 bg-black/20 p-3"
                      >
                        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                          {item.label}
                        </div>
                        <SparkColumn
                          values={item.values}
                          colorClass={item.color}
                        />
                        <div className="mt-3 flex justify-between text-[10px] text-zinc-500">
                          {timeline.map((point) => (
                            <span
                              key={`${item.label}-${point.time}`}
                              className="font-mono"
                            >
                              {point.time}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/6 bg-zinc-950/70 p-4">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                    Trader note
                  </div>
                  <div className="mt-3 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
                    <div className="text-sm leading-6 text-zinc-200">
                      Kalshi and Polymarket both moved toward Boston over the
                      last 11 minutes, with Polymarket leading first and Kalshi
                      confirming on tighter market structure. NBA context
                      already supports the move through rest edge and stronger
                      rolling net rating. Internal away-side exposure is
                      climbing, so repricing the main line and tightening
                      selected props is justified.
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Signal score
                      </div>
                      <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
                        87
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Trust band
                      </div>
                      <div className="mt-2 font-mono text-2xl font-semibold text-emerald-300">
                        High
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/20 p-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        Tipoff
                      </div>
                      <div className="mt-2 font-mono text-2xl font-semibold text-zinc-100">
                        38m
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      Evidence
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-300">
                      {evidence.map((item) => (
                        <li key={item} className="flex gap-3">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/6 bg-zinc-950/70 p-4">
                <div className="mb-4 grid grid-cols-[1.7fr_repeat(4,0.6fr)_0.7fr_0.6fr_0.7fr] gap-3 px-4 text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                  <div>Slate</div>
                  <div>bet365</div>
                  <div>Kalshi</div>
                  <div>Polymarket</div>
                  <div>Model</div>
                  <div>Severity</div>
                  <div>Tip</div>
                  <div>Exposure</div>
                </div>
                <div className="space-y-2">
                  {slate.map((row) => (
                    <SlateRow key={row.label} row={row} />
                  ))}
                </div>
              </section>
            </div>
          </div>
        </main>

        <aside className="rounded-3xl border border-white/6 bg-[#0d0f12] p-4 shadow-2xl shadow-black/30">
          <div className="space-y-4">
            <section className="rounded-2xl border border-white/6 bg-zinc-950/70 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                Recommended action
              </div>
              <div className="mt-2 text-lg font-semibold text-zinc-100">
                Reprice now
              </div>
              <div className="mt-1 text-sm text-zinc-400">
                External consensus and internal context both lean toward Boston.
                Away-side exposure adds urgency.
              </div>

              <div className="mt-4 space-y-2">
                {actions.map((action) => (
                  <div
                    key={action.label}
                    className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2"
                  >
                    <div>
                      <div className="text-sm text-zinc-200">
                        {action.label}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {action.detail}
                      </div>
                    </div>
                    <button className="rounded-lg border border-white/6 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                      Queue
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/6 bg-zinc-950/70 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                Source trust
              </div>
              <div className="mt-3 space-y-3">
                {sourceTrust.map((item) => (
                  <div key={item.source}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-zinc-200">{item.source}</span>
                      <span className="font-mono text-zinc-400">
                        {item.score}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-black/30">
                      <div
                        className={cn(
                          "h-2 rounded-full",
                          item.source === "Kalshi"
                            ? "bg-emerald-400/80"
                            : item.source === "Polymarket"
                              ? "bg-sky-400/80"
                              : item.source === "Model"
                                ? "bg-violet-400/80"
                                : "bg-zinc-400/70"
                        )}
                        style={{ width: `${item.score}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {item.note}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/6 bg-zinc-950/70 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                Alert feed
              </div>
              <div className="mt-3 space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.title}
                    className={cn(
                      "rounded-2xl border px-3 py-3",
                      alert.tone === "high"
                        ? "border-rose-400/20 bg-rose-400/5"
                        : "border-amber-400/20 bg-amber-400/5"
                    )}
                  >
                    <div className="text-sm font-medium text-zinc-100">
                      {alert.title}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-zinc-400">
                      {alert.body}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/6 bg-zinc-950/70 p-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">
                Audit trail
              </div>
              <div className="mt-3 space-y-2 font-mono text-xs text-zinc-400">
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                  <span>15:18</span>
                  <span>Polymarket moved first</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                  <span>15:27</span>
                  <span>Kalshi confirmation</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                  <span>15:34</span>
                  <span>Signal escalated</span>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
