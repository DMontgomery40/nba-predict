/**
 * Renders outputs/universal-source-trust-report/index.html from report-data.json.
 * Pure presentation: no DB access, no external assets, single self-contained
 * HTML file with inline CSS + inline SVG charts. Re-runnable.
 *
 * Run: node_modules/.bin/tsx scripts/render_universal_source_trust_report.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve(process.cwd(), "outputs/universal-source-trust-report");
const data = JSON.parse(readFileSync(resolve(OUT, "report-data.json"), "utf8"));

type Summary = {
  n: number;
  brier: number | null;
  logLoss: number | null;
  accuracy: number | null;
  calibrationSlope: number | null;
  calibrationIntercept: number | null;
  meanProb: number | null;
  meanActual: number | null;
  pushes: number;
  staleExcluded: number;
};

const SOURCES = ["bet365", "kalshi", "polymarket"] as const;
const SRC_LABEL: Record<string, string> = {
  bet365: "Bet365",
  kalshi: "Kalshi",
  polymarket: "Polymarket",
};

// ---- small helpers -------------------------------------------------------
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!
  );
const f3 = (x: number | null | undefined) => (x == null ? "—" : x.toFixed(3));
const f2 = (x: number | null | undefined) => (x == null ? "—" : x.toFixed(2));
const pct = (x: number | null | undefined) =>
  x == null ? "—" : (x * 100).toFixed(0) + "%";
const intc = (x: number | null | undefined) =>
  x == null ? "—" : Math.round(x).toLocaleString();

// Brier color scale: 0.05 (green) -> 0.18 (amber) -> 0.30+ (red). Lower better.
function brierColor(b: number | null): string {
  if (b == null) return "transparent";
  const lo = 0.05;
  const hi = 0.3;
  const t = Math.max(0, Math.min(1, (b - lo) / (hi - lo)));
  const hue = (1 - t) * 130; // 130=green -> 0=red
  return `hsl(${hue.toFixed(0)} 60% 28%)`;
}
function calColor(slope: number | null): string {
  if (slope == null) return "var(--muted)";
  const dist = Math.abs(slope - 1);
  if (dist < 0.2) return "var(--good)";
  if (dist < 0.5) return "var(--warn)";
  return "var(--bad)";
}

// inline sparkline of cross-source probability series
function sparkline(
  series: Array<{ source: string; at: string; p: number }>,
  width = 520,
  height = 90,
  markers: Array<{ at: string; label: string }> = []
): string {
  const colors: Record<string, string> = {
    bet365: "#e0b341",
    kalshi: "#48a9f8",
    polymarket: "#b07cf6",
  };
  // Domain is driven by the data itself so the live movement is legible; a
  // marker (tip/final) is only drawn when it falls inside the data window.
  const times = series.map((d) => Date.parse(d.at));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const x = (t: number) =>
    t1 === t0 ? 4 : 8 + ((t - t0) / (t1 - t0)) * (width - 16);
  const y = (p: number) => height - 12 - p * (height - 24);
  const bySource: Record<string, Array<{ at: number; p: number }>> = {};
  for (const d of series)
    (bySource[d.source] ??= []).push({ at: Date.parse(d.at), p: d.p });
  let paths = "";
  for (const [src, pts] of Object.entries(bySource)) {
    pts.sort((a, b) => a.at - b.at);
    const dstr = pts
      .map(
        (p, i) => `${i ? "L" : "M"}${x(p.at).toFixed(1)},${y(p.p).toFixed(1)}`
      )
      .join(" ");
    paths += `<path d="${dstr}" fill="none" stroke="${colors[src] ?? "#888"}" stroke-width="1.8"/>`;
    const last = pts[pts.length - 1];
    paths += `<circle cx="${x(last.at).toFixed(1)}" cy="${y(last.p).toFixed(1)}" r="2.6" fill="${colors[src] ?? "#888"}"/>`;
  }
  let mk = "";
  for (const m of markers) {
    const mt = Date.parse(m.at);
    if (mt < t0 || mt > t1) continue;
    const mx = x(mt);
    mk += `<line x1="${mx.toFixed(1)}" y1="6" x2="${mx.toFixed(1)}" y2="${height - 10}" stroke="#666" stroke-dasharray="3 3"/>`;
    mk += `<text x="${(mx + 3).toFixed(1)}" y="16" fill="#999" font-size="9">${esc(m.label)}</text>`;
  }
  const grid = [0.25, 0.5, 0.75]
    .map(
      (g) =>
        `<line x1="8" y1="${y(g).toFixed(1)}" x2="${width - 8}" y2="${y(g).toFixed(1)}" stroke="#222"/>`
    )
    .join("");
  return `<svg viewBox="0 0 ${width} ${height}" class="spark" preserveAspectRatio="none">${grid}${mk}${paths}</svg>`;
}

// horizontal bar
function bar(value: number, max: number, color: string, label: string): string {
  const w = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="barrow"><span class="barlabel">${esc(label)}</span><span class="bartrack"><span class="barfill" style="width:${w.toFixed(1)}%;background:${color}"></span></span><span class="barval">${esc(label === "" ? "" : "")}</span></div>`;
}

// ---- derived rankings for executive read --------------------------------
function bestAt(
  familyTable: Record<string, Record<string, Summary>>,
  checkpoint: string
) {
  const rows: Array<{ source: string; brier: number; n: number }> = [];
  for (const src of Object.keys(familyTable)) {
    const cell = familyTable[src]?.[checkpoint];
    if (cell && cell.brier != null && cell.n >= 20)
      rows.push({ source: src, brier: cell.brier, n: cell.n });
  }
  rows.sort((a, b) => a.brier - b.brier);
  return rows;
}

// ===========================================================================
// SECTION BUILDERS
// ===========================================================================
const sections: string[] = [];
const nav: Array<{ id: string; label: string }> = [];
function section(id: string, label: string, html: string) {
  nav.push({ id, label });
  sections.push(`<section id="${id}"><h2>${esc(label)}</h2>${html}</section>`);
}

// settled table: rows = source, cols = checkpoints, cell = brier heat + n
function settledTable(
  table: Record<string, Record<string, Summary>>,
  checkpoints: string[],
  checkpointLabels: Record<string, string>
): string {
  let head = `<tr><th>Source</th>`;
  for (const cp of checkpoints)
    head += `<th>${esc(checkpointLabels[cp] ?? cp)}</th>`;
  head += `<th>Calibration<br><span class="th-sub">slope / intercept @ pregame</span></th></tr>`;
  let body = "";
  for (const src of SOURCES) {
    if (!table[src]) continue;
    body += `<tr><td class="src">${esc(SRC_LABEL[src])}</td>`;
    for (const cp of checkpoints) {
      const c = table[src][cp];
      if (!c || c.brier == null) {
        body += `<td class="cell empty">—</td>`;
      } else {
        const stale =
          c.staleExcluded > 0
            ? `<span class="stale" title="quotes excluded as stale at this checkpoint">${intc(c.staleExcluded)} stale</span>`
            : "";
        const push =
          c.pushes > 0 ? `<span class="push">${c.pushes} push</span>` : "";
        body += `<td class="cell" style="background:${brierColor(c.brier)}"><b>${f3(c.brier)}</b><span class="cmeta">acc ${pct(c.accuracy)} · n ${intc(c.n)}</span>${push}${stale}</td>`;
      }
    }
    const pg = table[src]["pregame_close"];
    body += `<td class="cal" style="color:${calColor(pg?.calibrationSlope ?? null)}">${f2(pg?.calibrationSlope)} / ${f2(pg?.calibrationIntercept)}</td>`;
    body += `</tr>`;
  }
  return `<table class="grid">${head}${body}</table>`;
}

const GM_CP = ["pregame_close", "tipoff", "final_settle", "post_final_48h"];
const GM_CP_LABEL: Record<string, string> = {
  pregame_close: "Pregame close",
  tipoff: "Tipoff",
  final_settle: "Live / final",
  post_final_48h: "Post-final +48h",
};

// ---- 1. EXECUTIVE READ ----------------------------------------------------
{
  const mlBest = bestAt(
    data.settledGameMarkets.moneyline ?? {},
    "pregame_close"
  );
  const spBest = bestAt(data.settledGameMarkets.spread ?? {}, "pregame_close");
  const toBest = bestAt(data.settledGameMarkets.total ?? {}, "pregame_close");
  const recOk = data.reconciliation.every(
    (r: { matches: boolean }) => r.matches
  );
  const h2h = data.playerPropHeadToHead.overall;
  const html = `
  <div class="lede">Across <b>${intc(data.audit.settleableGames)}</b> settleable NBA games in the persisted live store, this brief separates two questions a trader conflates at their peril: <b>who is actually right</b> (settled accuracy, where deterministic truth exists) and <b>who is merely fast or merely present</b> (timing, leadership, coverage). Player props are treated as the primary subject.</div>

  <div class="callout warn">
    <h4>Read this before the tables</h4>
    <ul>
      <li><b>Accuracy ≠ timing ≠ coverage.</b> A low Brier means a source's probabilities were well-calibrated against realized outcomes. It does <i>not</i> mean that source moved first, nor that it even quoted the market. These are scored on different axes and never blended into one "trust score".</li>
      <li><b>Settled truth is partial.</b> Moneyline / spread / total are settled from real final scores. Player props are settled from reconstructed play-by-play box scores for the ${data.pbp.reconciledGames}/${data.pbp.totalPbpGames} games where reconstruction reconciled to the final score. Everything else is timing/leadership, explicitly labelled.</li>
      <li><b>Brier is confounded by line placement.</b> A perfectly efficient O/U line sits near 50/50 and yields Brier ≈ 0.25 by construction; an extreme milestone line yields a much lower Brier at the same skill. Compare <i>within</i> a family, prefer the like-for-like head-to-head, and read calibration slope (line-mix invariant).</li>
    </ul>
  </div>

  <div class="cards">
    <div class="card"><h4>Game winner (moneyline)</h4><p>Best pregame: <b>${mlBest[0] ? SRC_LABEL[mlBest[0].source] : "—"}</b> (Brier ${f3(mlBest[0]?.brier)}, n ${intc(mlBest[0]?.n)}). Bet365's moneyline book is thin (n ${intc(data.settledGameMarkets.moneyline?.bet365?.pregame_close?.n ?? 0)}) and should not be ranked as "weak" — it barely quotes the market.</p></div>
    <div class="card"><h4>Spread & total</h4><p>Bet365 is the coverage workhorse (spread n ${intc(data.settledGameMarkets.spread?.bet365?.pregame_close?.n)}, total n ${intc(data.settledGameMarkets.total?.bet365?.pregame_close?.n)}) and well-calibrated. Best pregame Brier: spread <b>${spBest[0] ? SRC_LABEL[spBest[0].source] : "—"}</b>, total <b>${toBest[0] ? SRC_LABEL[toBest[0].source] : "—"}</b> — but on small exchange samples.</p></div>
    <div class="card accent"><h4>Player props — the headline</h4><p>Bet365 owns coverage (only source for combos &amp; milestones) but its prop quotes <b>do not reprice live</b> — pregame value ≈ final value across n ${intc(data.settledPlayerPropsOverall.ALL?.bet365?.pregame_close?.n)} props. Kalshi &amp; Polymarket reprice through the game. On the <i>same</i> player+stat+line, the three sources are within Brier ~0.005 — no skill edge; the aggregate gaps are line-mix structure.</p></div>
    <div class="card"><h4>Who moves first</h4><p>Among prediction markets, <b>Kalshi tends to lead Polymarket</b> in repricing player props (${data.playerPropLeadLag.kalshi__polymarket?.aLeads ?? "—"} vs ${data.playerPropLeadLag.kalshi__polymarket?.bLeads ?? "—"} instruments). Bet365-vs-exchange lead is a toss-up and thin, because Bet365 props are pregame-only.</p></div>
  </div>

  <div class="reconbar ${recOk ? "ok" : "bad"}">Validation gate: custom moneyline-pregame settlement reconciles to the repo's own <code>getSignalQualityReport</code> ${recOk ? "exactly across all three sources" : "— MISMATCH"} (${data.reconciliation.map((r: { source: string; oursN: number }) => `${SRC_LABEL[r.source]} n${r.oursN}`).join(", ")}).</div>
  `;
  section("exec", "Executive read", html);
}

// ---- 2. SCOPE -------------------------------------------------------------
{
  const r = data.meta.quoteRange;
  const html = `
  <div class="scope">
    <div><span class="k">Scope</span><span class="v">${esc(data.meta.scope)}</span></div>
    <div><span class="k">Quote window</span><span class="v">${esc(r.lo)} → ${esc(r.hi)}</span></div>
    <div><span class="k">Quote ticks</span><span class="v">${intc(data.audit.tableCounts.quote_ticks)}</span></div>
    <div><span class="k">Settleable games</span><span class="v">${intc(data.audit.settleableGames)} (final scores persisted)</span></div>
    <div><span class="k">Play-by-play games</span><span class="v">${intc(data.audit.pbpGames)} (${data.pbp.reconciledGames} reconciled for prop settlement)</span></div>
    <div><span class="k">Sources</span><span class="v">Bet365 (book), Kalshi (exchange), Polymarket (CLOB)</span></div>
    <div><span class="k">Generated</span><span class="v">${esc(data.meta.generatedAt)}</span></div>
  </div>
  <p class="note">This is not a betting-picks product and contains no recommendations to wager. It is an internal instrument for deciding what a Bet365 trader should trust more, less, earlier, or only in certain contexts when reading market instability.</p>`;
  section("scope", "Scope & honesty boundary", html);
}

// ---- 3. UNIVERSAL SOURCE TABLE -------------------------------------------
{
  const matrix: Record<string, Record<string, number>> = {};
  for (const row of data.audit.sourceFamilyMatrix) {
    matrix[row.source] ??= {};
    matrix[row.source][row.family] = row.instruments;
  }
  const fams = [
    "moneyline",
    "spread",
    "total",
    "team-prop",
    "player-prop",
    "other",
  ];
  let head =
    `<tr><th>Source</th>` +
    fams.map((f) => `<th>${esc(f)}</th>`).join("") +
    `<th>Microstructure</th></tr>`;
  let body = "";
  const microTotal: Record<string, number> = {};
  for (const m of data.audit.microstructureBySource)
    microTotal[m.source] = (microTotal[m.source] ?? 0) + m.c;
  for (const src of SOURCES) {
    body += `<tr><td class="src">${esc(SRC_LABEL[src])}</td>`;
    for (const f of fams)
      body += `<td class="num">${matrix[src]?.[f] ? intc(matrix[src][f]) : "·"}</td>`;
    body += `<td class="num">${microTotal[src] ? intc(microTotal[src]) + " events" : "none"}</td></tr>`;
  }
  const html = `
  <p>Persisted canonical instruments per source per family. This is the <b>coverage</b> axis — before any accuracy question, a source can only help where it actually quotes.</p>
  <table class="grid">${head}${body}</table>
  <div class="callout"><b>Structural reads.</b> Bet365 dominates instrument count everywhere except moneyline, where it barely participates (it runs its own book and leans on the exchange feeds for game-winner context). Player props are overwhelmingly a Bet365 surface. Trade-level microstructure (size, notional, volume share) exists <b>only for Polymarket</b> in this store — Kalshi and Bet365 persist quotes but not trades — so any "off-price print / volume-share" signal is single-venue today.</div>`;
  section("universal", "Universal coverage", html);
}

// ---- 4. BY FAMILY (game markets) -----------------------------------------
{
  let html = `<p>Settled accuracy for full-game game markets (period/half/OT markets excluded). Cell = Brier (lower is better, colour-scaled) with accuracy and sample count; pushes and stale-excluded quotes are surfaced, never hidden. Calibration slope ≈ 1 / intercept ≈ 0 indicates well-calibrated probabilities independent of line mix.</p>`;
  for (const fam of ["moneyline", "spread", "total"]) {
    if (!data.settledGameMarkets[fam]) continue;
    html += `<h3>${fam}</h3>${settledTable(data.settledGameMarkets[fam], GM_CP, GM_CP_LABEL)}`;
  }
  html += `<details><summary>Why "Live / final" and "Post-final +48h" Briers are near zero (and not predictive)</summary>
  <p>A quote captured during or after a game increasingly knows the outcome, so its Brier collapses toward zero. That is convergence, not foresight. The predictive checkpoint is <b>Pregame close</b>; the later columns are shown only to demonstrate that every source eventually agrees with reality, and that most game-market books stop quoting well before <code>final_at</code> (hence the large stale-excluded counts at the later checkpoints).</p></details>`;
  section("families", "Game markets by family", html);
}

// ---- 5. PLAYER-PROP DEEP DIVE (centerpiece) ------------------------------
{
  const ov = data.settledPlayerPropsOverall.ALL ?? {};
  const ppFams = Object.keys(data.settledPlayerPropsByFamily).sort();
  // overall settled accuracy table
  const overallTable = settledTable(
    Object.fromEntries(
      SOURCES.filter((s) => ov[s]).map((s) => [s, ov[s]])
    ) as Record<string, Record<string, Summary>>,
    ["pregame_close", "final_settle"],
    { pregame_close: "Pregame close", final_settle: "Live / final" }
  );

  // by-family table: rows = stat family, cols = sources (pregame brier)
  let famHead =
    `<tr><th>Stat family</th>` +
    SOURCES.map(
      (s) =>
        `<th>${esc(SRC_LABEL[s])}<br><span class="th-sub">pregame Brier · acc · n</span></th>`
    ).join("") +
    `<th>Instruments</th></tr>`;
  let famBody = "";
  for (const fam of ppFams) {
    famBody += `<tr><td class="src">${esc(fam)}</td>`;
    for (const s of SOURCES) {
      const c = data.settledPlayerPropsByFamily[fam][s]?.pregame_close;
      if (!c || c.brier == null) famBody += `<td class="cell empty">·</td>`;
      else
        famBody += `<td class="cell" style="background:${brierColor(c.brier)}"><b>${f3(c.brier)}</b><span class="cmeta">${pct(c.accuracy)} · n ${intc(c.n)}</span></td>`;
    }
    famBody += `<td class="num">${intc(data.pbp.familyCoverage[fam] ?? 0)}</td></tr>`;
  }

  // head-to-head
  function h2hTable(
    obj: Record<string, { aBrier: number; bBrier: number; n: number }>
  ) {
    if (!obj || Object.keys(obj).length === 0)
      return `<p class="note">No shared-instrument pairs with sufficient sample.</p>`;
    let rows = `<tr><th>Source pair (same player+stat+line)</th><th>Brier A</th><th>Brier B</th><th>Δ</th><th>n shared</th><th>Edge</th></tr>`;
    for (const [key, v] of Object.entries(obj)) {
      const [a, b] = key.split("__");
      const d = v.aBrier - v.bBrier;
      const edge =
        Math.abs(d) < 0.01 ? "≈ tie" : d < 0 ? SRC_LABEL[a] : SRC_LABEL[b];
      rows += `<tr><td>${SRC_LABEL[a]} vs ${SRC_LABEL[b]}</td><td class="num">${f3(v.aBrier)}</td><td class="num">${f3(v.bBrier)}</td><td class="num">${(d >= 0 ? "+" : "") + d.toFixed(3)}</td><td class="num">${intc(v.n)}</td><td>${esc(edge)}</td></tr>`;
    }
    return `<table class="grid">${rows}</table>`;
  }

  // lead-lag direction
  let llRows = `<tr><th>Pair</th><th>Leader (moved first)</th><th>Win count</th><th>Instruments</th></tr>`;
  for (const [key, v] of Object.entries<{
    aLeads: number;
    bLeads: number;
    n: number;
    leader: string;
  }>(data.playerPropLeadLag)) {
    const [a, b] = key.split("__");
    const winrate = `${SRC_LABEL[a]} ${v.aLeads} : ${v.bLeads} ${SRC_LABEL[b]}`;
    llRows += `<tr><td>${SRC_LABEL[a]} vs ${SRC_LABEL[b]}</td><td><b>${v.leader === "tie" ? "toss-up" : SRC_LABEL[v.leader]}</b></td><td class="num">${esc(winrate)}</td><td class="num">${intc(v.n)}</td></tr>`;
  }

  // microstructure
  let microRows = `<tr><th>Stat family</th><th>Venue</th><th>Trades</th><th>Notional</th><th>Concentrated prints (≥10% vol share)</th></tr>`;
  for (const fam of Object.keys(data.playerPropMicrostructure)) {
    for (const [src, m] of Object.entries<{
      trades: number;
      notional: number;
      concentratedPrints: number;
    }>(data.playerPropMicrostructure[fam])) {
      microRows += `<tr><td>${esc(fam)}</td><td>${SRC_LABEL[src]}</td><td class="num">${intc(m.trades)}</td><td class="num">$${intc(m.notional)}</td><td class="num">${intc(m.concentratedPrints)}</td></tr>`;
    }
  }

  const html = `
  <div class="callout bad">
    <h4>The single most operationally important finding</h4>
    <p>Bet365's player-prop quotes in this store <b>do not reprice live</b>: the last quote before tip is identical to the last quote before the final whistle across <b>${intc(ov.bet365?.pregame_close?.n)}</b> settled props (pregame Brier ${f3(ov.bet365?.pregame_close?.brier)} = live Brier ${f3(ov.bet365?.final_settle?.brier)}). Kalshi and Polymarket repriced through the game — their live Brier collapses to ${f3(ov.kalshi?.final_settle?.brier)} / ${f3(ov.polymarket?.final_settle?.brier)}. For a Bet365 desk, this means the exchanges are your live early-warning radar on player stat instability; your own prop feed (via the Odds-API backup path) is effectively a pregame snapshot.</p>
  </div>

  <h3>Settled accuracy, all settleable player props</h3>
  ${overallTable}
  <p class="note">Pregame is the predictive checkpoint. The live/final column reflects each source's in-game convergence — the gap between a source's pregame and live Brier is precisely "how much this source learns as the game unfolds."</p>

  <h3>By stat family (pregame settled accuracy)</h3>
  <table class="grid">${famHead}${famBody}</table>
  <details><summary>How to read this without being fooled by line placement</summary>
  <p>Bet365's combination props (PRA, PR, PA, RA) sit near Brier 0.25 / accuracy 0.50 — that is what a <b>well-centered O/U line</b> looks like, not poor skill. Single-stat families show higher accuracy because the lines are more extreme (a starter "over 9.5 points" is ~90% yes). Polymarket's higher aggregate Brier on points/rebounds/assists is likewise a line-mix effect; see the like-for-like comparison below, where the gap nearly vanishes.</p></details>

  <h3>Like-for-like head-to-head — same player, same stat, same line</h3>
  <p>The only confound-free comparison: restrict to canonical instruments where two sources quoted the identical market before tip, and score both against the same realized outcome.</p>
  ${h2hTable(data.playerPropHeadToHead.overall)}
  <details><summary>By stat family (smaller samples)</summary>
  <h4>Points</h4>${h2hTable(data.playerPropHeadToHead.points)}
  <h4>Rebounds</h4>${h2hTable(data.playerPropHeadToHead.rebounds)}
  <h4>Assists</h4>${h2hTable(data.playerPropHeadToHead.assists)}</details>
  <div class="callout"><b>Verdict.</b> On shared player props the three sources are within Brier ~0.005 of one another. There is <b>no meaningful settled-accuracy edge</b> between venues on the same prop. Differences a naive aggregate would show are market-structure (which lines each venue chooses to offer), not predictive skill.</div>

  <h3>Market leadership — who repriced first</h3>
  <p>Directional cross-correlation on 60-second buckets over shared, live-quoted props. We report <b>direction and win-count only</b>: the absolute lag magnitude is not reliable at this bucket resolution and is deliberately omitted.</p>
  <table class="grid">${llRows}</table>
  <div class="callout"><b>Read.</b> Kalshi is the clearest first-mover, leading Polymarket on the large majority of shared player props. Bet365 vs the exchanges is a genuine toss-up and rests on a thin sample, consistent with Bet365 props being pregame-only (little live series to lead with).</div>

  <h3>Microstructure depth (Polymarket-only today)</h3>
  ${data.playerPropMicrostructure && Object.keys(data.playerPropMicrostructure).length ? `<table class="grid">${microRows}</table>` : `<p class="note">No persisted player-prop microstructure.</p>`}
  <p class="note">Only Polymarket persists trade-level events (size, notional, volume share). Concentrated prints — a single trade taking ≥10% of a market's volume, often well off the sampled price — are the high-priority structural alert called out in the desk playbook. They are observable today only on Polymarket; Kalshi and Bet365 would need trade ingestion to match.</p>`;
  section("playerprops", "Player-prop deep dive", html);
}

// ---- 6. TIMING MATRIX -----------------------------------------------------
{
  // who is best at each checkpoint, per family
  let rows =
    `<tr><th>Family</th>` +
    GM_CP.map((c) => `<th>${esc(GM_CP_LABEL[c])}</th>`).join("") +
    `</tr>`;
  const fams: Array<[string, Record<string, Record<string, Summary>>]> = [
    ["moneyline", data.settledGameMarkets.moneyline],
    ["spread", data.settledGameMarkets.spread],
    ["total", data.settledGameMarkets.total],
    ["player-prop (all)", data.settledPlayerPropsOverall.ALL ?? {}],
  ];
  for (const [fam, table] of fams) {
    if (!table) continue;
    rows += `<tr><td class="src">${esc(fam)}</td>`;
    for (const cp of GM_CP) {
      const ranked = bestAt(
        table as Record<string, Record<string, Summary>>,
        cp
      );
      if (ranked.length === 0) rows += `<td class="cell empty">—</td>`;
      else
        rows += `<td class="cell"><b>${SRC_LABEL[ranked[0].source]}</b><span class="cmeta">${f3(ranked[0].brier)} · n ${intc(ranked[0].n)}</span></td>`;
    }
    rows += `</tr>`;
  }
  const html = `
  <p>Best-calibrated source (lowest Brier, n ≥ 20) at each checkpoint. The universal matrix uses game-phase anchors that exist for all settleable games. True per-event anchors (the <code>pre_event</code> / <code>post_event_5m</code> / <code>quarter_end</code> slices in the spec) require play-by-play, which covers only ${data.audit.pbpGames}/${data.audit.settleableGames} games — see the methodology note and the gap section.</p>
  <table class="grid">${rows}</table>
  <div class="callout">The pregame-close column is the only one measuring foresight. Reading left-to-right shows convergence: by the live/final column every source is near-perfect because the outcome is largely known. A source that only looks good in the right-hand columns "looks good only after the fact."</div>`;
  section("timing", "Timing-slice matrix", html);
}

// ---- 7. COVERAGE / BLIND SPOTS -------------------------------------------
{
  const teamProp = data.audit.sourceFamilyMatrix
    .filter((r: { family: string }) => r.family === "team-prop")
    .reduce((s: number, r: { instruments: number }) => s + r.instruments, 0);
  const unmapped = data.audit.mappingStatus.find(
    (m: { status: string }) => m.status === "unmapped"
  );
  const html = `
  <table class="grid blind">
    <tr><th>Blind spot</th><th>Impact</th><th>What would close it</th></tr>
    <tr><td>Team-prop family not settled</td><td>${intc(teamProp)} team-prop instruments exist but are <b>not</b> given settled accuracy here. Team totals/margins are settleable in principle from team-aggregated play-by-play, but that aggregation was not built in this pass.</td><td>Team-stat aggregation from PBP (the per-player reconstruction already exists; summing by team is the missing step).</td></tr>
    <tr><td>Player-prop settlement only on 64 PBP games</td><td>Settled prop accuracy is restricted to ${data.pbp.reconciledGames} reconciled games of ${data.audit.settleableGames} total. The other ${data.audit.settleableGames - data.audit.pbpGames} games have outcomes but no persisted play-by-play, so player stats can't be reconstructed.</td><td>Persisted box scores or full PBP for the remaining ${data.audit.settleableGames - data.audit.pbpGames} games.</td></tr>
    <tr><td>True event-anchored timing</td><td>The spec's <code>pre_event</code>/<code>post_event_5m</code>/<code>quarter_end</code> slices need per-event anchors; only ${data.audit.pbpGames} games have PBP. The universal matrix substitutes game-phase boundaries and says so.</td><td>PBP coverage across the full settleable set; then re-anchor timing on stat-moving actions.</td></tr>
    <tr><td>Microstructure is single-venue</td><td>Trade size/notional/volume-share exist only for Polymarket. Off-price-print and volume-share signals cannot be computed for Kalshi or Bet365 today.</td><td>Kalshi trade/candle ingestion and a Bet365 trade feed into <code>market_microstructure_events</code>.</td></tr>
    <tr><td>Bet365 props are pregame-only</td><td>The Odds-API backup path captures pregame prop snapshots; live reprice is largely absent, so Bet365 cannot be evaluated as a live prop signal.</td><td>Live Bet365 prop capture (direct feed) rather than the backup discovery path.</td></tr>
    <tr><td>Shared-instrument samples are small</td><td>Like-for-like head-to-head and lead-lag rest on the ${intc(data.playerPropHeadToHead.overall.bet365__polymarket?.n ?? 0)}-ish instruments where venues quote identical lines; per-stat-family samples are smaller still. Directional, not precise.</td><td>More overlapping line coverage, or line-agnostic comparison via implied distributions.</td></tr>
    <tr><td>Mapping is unaudited auto-mapping</td><td>${intc(unmapped?.c ?? 0)} source markets remain unmapped and <code>mapping_resolutions</code> is empty — all mapping is automatic and never human-reviewed. A mis-map silently corrupts a cross-source comparison.</td><td>Manual mapping review; spot-audit of high-traffic instruments.</td></tr>
  </table>`;
  section("blindspots", "Coverage, confidence & blind spots", html);
}

// ---- 8. CASE STUDIES ------------------------------------------------------
{
  let html = "";
  for (const cs of data.caseStudies) {
    const markers = [
      { at: cs.scheduledStart, label: "tip" },
      ...(cs.finalAt ? [{ at: cs.finalAt, label: "final" }] : []),
    ];
    const outcome =
      cs.settledOutcome === 1
        ? "YES (hit)"
        : cs.settledOutcome === 0
          ? "NO (miss)"
          : "—";
    let detail = "";
    if (cs.kind === "kalshi-leads-polymarket") {
      detail = `<p>Cross-correlation places Kalshi <b>${cs.leadBuckets} bucket(s) ahead</b> of Polymarket (corr ${f2(cs.crossCorrelation)}). Kalshi's curve turns before Polymarket's — the exchange repriced this player's market first.</p>`;
    } else if (cs.kind === "bet365-pregame-only") {
      detail = `<p>Bet365 held <b>${f2(cs.bet365Pregame)} → ${f2(cs.bet365Final)}</b> (flat) while the exchange moved <b>${f2(cs.exchangePregame)} → ${f2(cs.exchangeFinal)}</b> across the game. A desk watching only the Bet365 line would have seen nothing; the exchange line was the live signal.</p>`;
    }
    html += `<div class="case">
      <div class="case-head"><span class="case-kind">${esc(cs.kind)}</span><h3>${esc(cs.headline)}</h3></div>
      <div class="case-meta"><span>${esc(cs.label)}</span><span>${esc(cs.matchup)}</span><span>settled: <b>${outcome}</b></span></div>
      ${sparkline(cs.series, 640, 110, markers)}
      <div class="legend"><span class="lg bet365">Bet365</span><span class="lg kalshi">Kalshi</span><span class="lg polymarket">Polymarket</span></div>
      ${detail}
    </div>`;
  }
  if (!html) html = `<p class="note">No case studies selected.</p>`;
  section("cases", "Case studies", html);
}

// ---- 9. ANALYTICAL APPENDIX ----------------------------------------------
{
  const html = `
  <p class="note">Measured, repo-backed facts above are kept separate from the venue-structure interpretation below. The following is informed reasoning about <i>why</i> the measured patterns appear, drawing on the public structure of each venue. It is editorial context, not additional measurement.</p>

  <h3>Why Kalshi tends to lead Polymarket on player props</h3>
  <p>Kalshi is a CFTC-regulated exchange with a centralized order book, market-maker obligations, and contracts that resolve on official statistics. That structure rewards fast, disciplined repricing on new information and tends to produce tight, frequently-updated quotes. Polymarket is a crypto-settled CLOB whose flow skews more retail and whose liquidity in thin NBA player-prop markets is patchier; its price often follows once a move is established. The measured asymmetry (Kalshi leading on the large majority of shared props) is consistent with the exchange being the price-discovery venue and the CLOB being the confirmation venue — exactly the role the desk memo assigns them ("Kalshi for intraday velocity, Polymarket for cross-market confirmation").</p>

  <h3>Why Bet365 owns prop coverage but reprices pregame-only here</h3>
  <p>Bet365's strength is breadth: as a full-service book it prices combination props (PRA, PR, PA, RA), milestones, and double/triple-double markets that the exchanges simply do not list. That is why it is the only source with settled accuracy across the combo families. The pregame-only behaviour is an <b>ingestion artifact, not a book limitation</b>: the persisted Bet365 prop quotes arrive through the Odds-API backup discovery path, which captures pregame snapshots and does not stream live prop reprices. The real Bet365 trading book certainly moves live; this store just doesn't see it. The operational implication stands regardless: on <i>this</i> console, the exchanges are the live radar.</p>

  <h3>Why like-for-like accuracy is near-identical across venues</h3>
  <p>Efficient markets on the same contract converge to similar probabilities; the residual differences are vig, line selection, and microstructure noise rather than forecasting skill. The ~0.005 Brier spread on shared instruments is well within sampling noise for these sample sizes. The practical lesson for a trader: do not chase a venue because its <i>aggregate</i> prop accuracy looks better — that is a function of which lines it chooses to offer. Trust the venue that (a) covers the market you need, (b) reprices live when you need a live signal, and (c) leads rather than follows. Those are coverage, liveness, and leadership — not settled accuracy.</p>

  <h3>What a Bet365 trader should actually do with this</h3>
  <ul>
    <li><b>Game winner / spread / total:</b> trust the exchange consensus for the winner; trust your own well-calibrated spread/total book for those, using the exchanges as a divergence tripwire.</li>
    <li><b>Player props, pregame:</b> any of the three is fine on a shared line; prefer the one that actually lists the prop (usually Bet365 for combos/milestones).</li>
    <li><b>Player props, live:</b> watch Kalshi first, Polymarket second. Treat a Kalshi move with no corresponding move in your own line as a suspend-and-inspect trigger — your line may be stale.</li>
    <li><b>Structural alerts:</b> Polymarket concentrated off-price prints are the only persisted trade-level weirdness signal today; weight them, but know they are single-venue.</li>
  </ul>`;
  section("appendix", "Analytical appendix", html);
}

// ===========================================================================
// ASSEMBLE
// ===========================================================================
const navHtml = nav
  .map((n) => `<a href="#${n.id}">${esc(n.label)}</a>`)
  .join("");
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Universal Source Trust — NBA Signal Console</title>
<style>
:root{--bg:#0d1014;--panel:#13181f;--panel2:#171d26;--ink:#dfe6ee;--muted:#8893a3;--line:#222b36;--accent:#48a9f8;--good:#43c08a;--warn:#e0b341;--bad:#e8645a;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;}
.wrap{display:grid;grid-template-columns:212px 1fr;max-width:1280px;margin:0 auto;}
nav{position:sticky;top:0;align-self:start;height:100vh;overflow:auto;padding:22px 14px;border-right:1px solid var(--line);}
nav .brand{font-weight:700;font-size:13px;letter-spacing:.5px;color:var(--accent);text-transform:uppercase;margin-bottom:4px}
nav .sub{color:var(--muted);font-size:11px;margin-bottom:18px}
nav a{display:block;color:var(--muted);text-decoration:none;padding:5px 8px;border-radius:5px;font-size:12.5px}
nav a:hover{background:var(--panel2);color:var(--ink)}
main{padding:34px 40px 80px;min-width:0}
header.title h1{font-size:26px;margin:0 0 6px;letter-spacing:-.2px}
header.title p{color:var(--muted);margin:0 0 4px;max-width:70ch}
section{margin:38px 0;scroll-margin-top:18px}
h2{font-size:19px;border-bottom:1px solid var(--line);padding-bottom:8px;margin:0 0 16px}
h3{font-size:15px;margin:22px 0 8px;color:var(--ink)}
h4{margin:0 0 6px}
p{max-width:78ch}
.lede{font-size:15.5px;color:#cdd6e0;max-width:80ch;margin:0 0 18px}
.note{color:var(--muted);font-size:12.5px}
.callout{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:6px;padding:13px 16px;margin:14px 0;font-size:13px}
.callout.warn{border-left-color:var(--warn)}
.callout.bad{border-left-color:var(--bad)}
.callout ul{margin:6px 0 0;padding-left:18px}.callout li{margin:4px 0}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:16px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:7px;padding:13px 15px}
.card.accent{border-color:var(--accent);box-shadow:0 0 0 1px rgba(72,169,248,.15) inset}
.card h4{font-size:12px;text-transform:uppercase;letter-spacing:.4px;color:var(--accent);margin-bottom:7px}
.card.accent h4{color:var(--accent)}
.card p{font-size:12.5px;color:#c2cbd6;margin:0}
.reconbar{margin:16px 0;padding:9px 13px;border-radius:6px;font-size:12px;font-family:ui-monospace,Menlo,monospace}
.reconbar.ok{background:rgba(67,192,138,.1);border:1px solid rgba(67,192,138,.35);color:#9be3c2}
.reconbar.bad{background:rgba(232,100,90,.12);border:1px solid var(--bad)}
.scope{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px 22px;background:var(--panel);border:1px solid var(--line);border-radius:7px;padding:14px 18px;margin-bottom:10px}
.scope .k{display:block;font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}
.scope .v{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
table.grid{border-collapse:collapse;width:100%;margin:8px 0 6px;font-size:12.5px}
table.grid th{text-align:left;font-weight:600;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.4px;padding:7px 9px;border-bottom:1px solid var(--line);vertical-align:bottom}
.th-sub{font-weight:400;text-transform:none;letter-spacing:0;font-size:10px}
table.grid td{padding:7px 9px;border-bottom:1px solid #1a212b;vertical-align:top}
td.src{font-weight:600}
td.num{font-family:ui-monospace,Menlo,monospace;text-align:right}
td.cell{font-family:ui-monospace,Menlo,monospace;border-radius:3px}
td.cell b{font-size:13px}
td.cell .cmeta{display:block;font-size:10.5px;color:#cdd6e0;opacity:.85}
td.cell.empty{color:#444;background:transparent}
td.cell .push,td.cell .stale{display:inline-block;font-size:9.5px;color:#d7cda0;margin-top:2px;margin-right:5px}
td.cal{font-family:ui-monospace,Menlo,monospace;font-weight:600}
table.blind td{font-size:12px;max-width:38ch}
details{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:0 14px;margin:12px 0}
details[open]{padding-bottom:12px}
summary{cursor:pointer;padding:11px 0;font-size:12.5px;color:var(--accent)}
.spark{width:100%;height:auto;background:var(--panel2);border:1px solid var(--line);border-radius:6px;display:block;margin:10px 0 6px}
.case{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin:14px 0}
.case-head{display:flex;align-items:baseline;gap:12px}
.case-kind{font-family:ui-monospace,Menlo,monospace;font-size:10px;color:var(--bg);background:var(--accent);padding:2px 7px;border-radius:10px;white-space:nowrap}
.case-head h3{margin:0}
.case-meta{display:flex;gap:18px;color:var(--muted);font-size:12px;font-family:ui-monospace,Menlo,monospace;margin:6px 0}
.legend{display:flex;gap:16px;font-size:11px;color:var(--muted)}
.legend .lg::before{content:"";display:inline-block;width:10px;height:3px;margin-right:5px;vertical-align:middle}
.legend .bet365::before{background:#e0b341}.legend .kalshi::before{background:#48a9f8}.legend .polymarket::before{background:#b07cf6}
code{font-family:ui-monospace,Menlo,monospace;font-size:12px;background:var(--panel2);padding:1px 5px;border-radius:4px}
@media(max-width:880px){.wrap{grid-template-columns:1fr}nav{position:static;height:auto;border-right:none;border-bottom:1px solid var(--line)}}
</style></head>
<body><div class="wrap">
<nav><div class="brand">Source Trust</div><div class="sub">NBA Signal Console · internal brief</div>${navHtml}</nav>
<main>
<header class="title"><h1>Universal Source Trust</h1>
<p>Which sources are right earlier, which are right later, and which are merely fast — across game markets, broad props, and player props.</p>
<p class="note">Internal Bet365 trader-inspection brief · persisted live data only · ${esc(data.meta.scope)}</p></header>
${sections.join("\n")}
<footer style="margin-top:50px;color:var(--muted);font-size:11px;border-top:1px solid var(--line);padding-top:14px">
Generated ${esc(data.meta.generatedAt)} from ${intc(data.audit.tableCounts.quote_ticks)} persisted quote ticks. Settled accuracy reconciles to the repo <code>getSignalQualityReport</code> read model. Not gambling advice.
</footer>
</main></div></body></html>`;

writeFileSync(resolve(OUT, "index.html"), html);
console.log(
  `wrote ${resolve(OUT, "index.html")} (${(html.length / 1024).toFixed(0)} KB)`
);
