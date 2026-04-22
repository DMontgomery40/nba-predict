import type { SourceId } from "../modes";
import type {
  EventFrame,
  SourceHealth,
  Storyline,
  StorylineFrame,
  Team,
} from "../types";

const baseDay = "2026-04-21";

function iso(time: string) {
  return `${baseDay}T${time}:00Z`;
}

function team(
  id: string,
  city: string,
  name: string,
  abbreviation: string,
  shortName: string
): Team {
  return { id, city, name, abbreviation, shortName };
}

const teams = {
  celtics: team("bos", "Boston", "Celtics", "BOS", "Boston"),
  knicks: team("nyk", "New York", "Knicks", "NYK", "New York"),
  nuggets: team("den", "Denver", "Nuggets", "DEN", "Denver"),
  suns: team("phx", "Phoenix", "Suns", "PHX", "Phoenix"),
  bucks: team("mil", "Milwaukee", "Bucks", "MIL", "Milwaukee"),
  heat: team("mia", "Miami", "Heat", "MIA", "Miami"),
  thunder: team("okc", "Oklahoma City", "Thunder", "OKC", "Oklahoma City"),
  mavs: team("dal", "Dallas", "Mavericks", "DAL", "Dallas"),
} as const;

function health(
  sourceId: SourceId,
  capturedAt: string,
  lagMs: number,
  message: string,
  status: "healthy" | "degraded" | "offline" = "healthy"
): SourceHealth {
  return {
    sourceId,
    status,
    lastSuccessAt: capturedAt,
    lagMs,
    message,
  };
}

function quote(
  sourceId: SourceId,
  capturedAt: string,
  probability: number,
  depthScore: number,
  volume: number,
  spread: number,
  freshnessStatus: "fresh" | "aging" | "stale" | "offline" = "fresh",
  note?: string
) {
  const reliabilityWeight =
    sourceId === "kalshi"
      ? 0.92
      : sourceId === "polymarket"
        ? 0.84
        : sourceId === "model"
          ? 0.8
          : 1;

  return {
    sourceId,
    probability,
    depthScore,
    volume,
    spread,
    sourceTimestamp: capturedAt,
    ingestedAt: capturedAt,
    freshnessStatus,
    reliabilityWeight,
    note,
  } as const;
}

function frameEvent(
  capturedAt: string,
  eventId: string,
  homeTeam: Team,
  awayTeam: Team,
  tipoffAt: string,
  venue: string,
  probabilities: Record<SourceId, number>,
  context: {
    exposureScore: number;
    volatilityScore: number;
    liquidityRisk: number;
    restEdge: number;
    formEdge: number;
    paceEdge: number;
    noteTags: string[];
  },
  narrativeHints: string[],
  audit: Array<{
    label: string;
    message: string;
    tone: "info" | "positive" | "caution";
  }>,
  suggestedActions: EventFrame["suggestedActions"],
  depth: Record<
    SourceId,
    { depthScore: number; volume: number; spread: number }
  >
): EventFrame {
  return {
    event: {
      id: eventId,
      league: "NBA",
      status: "pre-tip",
      tipoffAt,
      homeTeam,
      awayTeam,
      marketType: "winner",
      venue,
    },
    quotes: {
      bet365: quote(
        "bet365",
        capturedAt,
        probabilities.bet365,
        depth.bet365.depthScore,
        depth.bet365.volume,
        depth.bet365.spread
      ),
      kalshi: quote(
        "kalshi",
        capturedAt,
        probabilities.kalshi,
        depth.kalshi.depthScore,
        depth.kalshi.volume,
        depth.kalshi.spread
      ),
      polymarket: quote(
        "polymarket",
        capturedAt,
        probabilities.polymarket,
        depth.polymarket.depthScore,
        depth.polymarket.volume,
        depth.polymarket.spread
      ),
      model: quote(
        "model",
        capturedAt,
        probabilities.model,
        depth.model.depthScore,
        depth.model.volume,
        depth.model.spread,
        "fresh",
        "internal baseline"
      ),
    },
    context: {
      modelProbability: probabilities.model,
      exposureScore: context.exposureScore,
      volatilityScore: context.volatilityScore,
      liquidityRisk: context.liquidityRisk,
      restEdge: context.restEdge,
      formEdge: context.formEdge,
      paceEdge: context.paceEdge,
      noteTags: context.noteTags,
    },
    narrativeHints,
    audit: audit.map((item, index) => ({
      id: `${eventId}-${index}-${capturedAt}`,
      capturedAt,
      ...item,
    })),
    suggestedActions,
  };
}

function makeFrame(
  storylineId: string,
  frameIndex: number,
  capturedAt: string,
  summary: string,
  events: EventFrame[],
  sourceHealth: SourceHealth[]
): StorylineFrame {
  return {
    storylineId,
    frameIndex,
    capturedAt,
    summary,
    events,
    sourceHealth,
  };
}

const commonDepth = {
  bet365: { depthScore: 100, volume: 100, spread: 0.01 },
  kalshi: { depthScore: 82, volume: 79, spread: 0.02 },
  polymarket: { depthScore: 74, volume: 71, spread: 0.03 },
  model: { depthScore: 100, volume: 100, spread: 0 },
};

const lowerDepth = {
  bet365: { depthScore: 100, volume: 100, spread: 0.01 },
  kalshi: { depthScore: 61, volume: 56, spread: 0.05 },
  polymarket: { depthScore: 44, volume: 36, spread: 0.08 },
  model: { depthScore: 100, volume: 100, spread: 0 },
};

export const storylines: Storyline[] = [
  {
    id: "boston-steam",
    name: "Boston Steam Into Tip",
    description:
      "Kalshi and Polymarket both lean harder toward Boston while the internal book stays light until late.",
    fixturePack: "operator-review-pack",
    defaultFrameIndex: 4,
    frames: [
      makeFrame(
        "boston-steam",
        0,
        iso("15:10"),
        "External markets are starting to lean Boston, but nothing looks urgent yet.",
        [
          frameEvent(
            iso("15:10"),
            "knicks-celtics",
            teams.celtics,
            teams.knicks,
            iso("16:12"),
            "TD Garden",
            { bet365: 0.581, kalshi: 0.584, polymarket: 0.592, model: 0.615 },
            {
              exposureScore: 68,
              volatilityScore: 44,
              liquidityRisk: 18,
              restEdge: 0.45,
              formEdge: 0.31,
              paceEdge: 0.12,
              noteTags: ["rest-edge", "late-game-efficiency"],
            },
            [
              "Model already likes Boston more than the book.",
              "External venues are drifting in the same direction.",
            ],
            [
              {
                label: "External drift opens",
                message: "Polymarket posts the first meaningful Boston uptick.",
                tone: "info",
              },
            ],
            [
              {
                label: "Monitor main line",
                detail: "No action yet, but keep this matchup pinned.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:10"),
            "suns-nuggets",
            teams.nuggets,
            teams.suns,
            iso("17:05"),
            "Ball Arena",
            { bet365: 0.478, kalshi: 0.455, polymarket: 0.449, model: 0.461 },
            {
              exposureScore: 47,
              volatilityScore: 36,
              liquidityRisk: 26,
              restEdge: 0.18,
              formEdge: 0.08,
              paceEdge: -0.1,
              noteTags: ["modest-disagreement"],
            },
            ["Mild disagreement, but not enough evidence to escalate."],
            [],
            [
              {
                label: "Keep in scan table",
                detail: "Interesting, but lower urgency than Boston.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:10"),
            "heat-bucks",
            teams.bucks,
            teams.heat,
            iso("18:04"),
            "Fiserv Forum",
            { bet365: 0.412, kalshi: 0.431, polymarket: 0.427, model: 0.44 },
            {
              exposureScore: 26,
              volatilityScore: 21,
              liquidityRisk: 22,
              restEdge: 0.14,
              formEdge: 0.12,
              paceEdge: -0.08,
              noteTags: ["low-urgency"],
            },
            ["Low urgency baseline watch item."],
            [],
            [
              {
                label: "Leave off active queue",
                detail: "Useful reference market only.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:10"),
            "mavs-thunder",
            teams.thunder,
            teams.mavs,
            iso("18:35"),
            "Paycom Center",
            { bet365: 0.493, kalshi: 0.508, polymarket: 0.512, model: 0.522 },
            {
              exposureScore: 62,
              volatilityScore: 41,
              liquidityRisk: 20,
              restEdge: 0.09,
              formEdge: 0.22,
              paceEdge: 0.16,
              noteTags: ["high-handle"],
            },
            ["Thunder are drawing steady external support."],
            [],
            [
              {
                label: "Track supporting evidence",
                detail: "Needs another interval before repricing.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
        ],
        [
          health("bet365", iso("15:10"), 2500, "Internal book feed current"),
          health("kalshi", iso("15:10"), 5800, "Market snapshots healthy"),
          health("polymarket", iso("15:10"), 8300, "Crowd feed healthy"),
          health("model", iso("15:10"), 1500, "Baseline refreshed"),
        ]
      ),
      makeFrame(
        "boston-steam",
        1,
        iso("15:18"),
        "Polymarket leads Boston again; Kalshi starts to confirm.",
        [
          frameEvent(
            iso("15:18"),
            "knicks-celtics",
            teams.celtics,
            teams.knicks,
            iso("16:12"),
            "TD Garden",
            { bet365: 0.581, kalshi: 0.598, polymarket: 0.613, model: 0.615 },
            {
              exposureScore: 71,
              volatilityScore: 52,
              liquidityRisk: 20,
              restEdge: 0.45,
              formEdge: 0.31,
              paceEdge: 0.12,
              noteTags: ["consensus-forming", "rest-edge"],
            },
            [
              "External markets are now converging on Boston.",
              "bet365 has not moved yet.",
            ],
            [
              {
                label: "Polymarket moved first",
                message:
                  "Crowd market pushed Boston twice before Kalshi confirmed.",
                tone: "info",
              },
            ],
            [
              {
                label: "Queue deeper review",
                detail:
                  "Watch if Kalshi holds this move through another interval.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:18"),
            "suns-nuggets",
            teams.nuggets,
            teams.suns,
            iso("17:05"),
            "Ball Arena",
            { bet365: 0.478, kalshi: 0.457, polymarket: 0.451, model: 0.462 },
            {
              exposureScore: 46,
              volatilityScore: 34,
              liquidityRisk: 28,
              restEdge: 0.18,
              formEdge: 0.08,
              paceEdge: -0.1,
              noteTags: ["stable"],
            },
            ["Still a secondary disagreement."],
            [],
            [
              {
                label: "Keep in background",
                detail: "No change in urgency.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:18"),
            "heat-bucks",
            teams.bucks,
            teams.heat,
            iso("18:04"),
            "Fiserv Forum",
            { bet365: 0.412, kalshi: 0.429, polymarket: 0.423, model: 0.438 },
            {
              exposureScore: 27,
              volatilityScore: 22,
              liquidityRisk: 25,
              restEdge: 0.14,
              formEdge: 0.12,
              paceEdge: -0.08,
              noteTags: ["low-urgency"],
            },
            ["Still low urgency."],
            [],
            [
              {
                label: "Hold",
                detail: "No action.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:18"),
            "mavs-thunder",
            teams.thunder,
            teams.mavs,
            iso("18:35"),
            "Paycom Center",
            { bet365: 0.493, kalshi: 0.519, polymarket: 0.521, model: 0.529 },
            {
              exposureScore: 64,
              volatilityScore: 49,
              liquidityRisk: 22,
              restEdge: 0.09,
              formEdge: 0.22,
              paceEdge: 0.16,
              noteTags: ["building-consensus"],
            },
            ["Thunder support is firming."],
            [],
            [
              {
                label: "Queue review",
                detail: "Could become a second actionable market.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
        ],
        [
          health("bet365", iso("15:18"), 2200, "Internal book feed current"),
          health("kalshi", iso("15:18"), 4200, "Market snapshots healthy"),
          health("polymarket", iso("15:18"), 7100, "Crowd feed healthy"),
          health("model", iso("15:18"), 1800, "Baseline refreshed"),
        ]
      ),
      makeFrame(
        "boston-steam",
        2,
        iso("15:27"),
        "Kalshi now confirms Boston on stronger market structure.",
        [
          frameEvent(
            iso("15:27"),
            "knicks-celtics",
            teams.celtics,
            teams.knicks,
            iso("16:12"),
            "TD Garden",
            { bet365: 0.581, kalshi: 0.612, polymarket: 0.63, model: 0.615 },
            {
              exposureScore: 74,
              volatilityScore: 64,
              liquidityRisk: 18,
              restEdge: 0.45,
              formEdge: 0.31,
              paceEdge: 0.12,
              noteTags: ["consensus-drift", "book-lag"],
            },
            [
              "Kalshi is now confirming the earlier crowd move.",
              "The book is still static.",
            ],
            [
              {
                label: "Kalshi confirms",
                message:
                  "Higher quality liquidity is holding Boston above 61%.",
                tone: "positive",
              },
            ],
            [
              {
                label: "Prepare main-line move",
                detail: "Consensus drift is now too large to ignore.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:27"),
            "suns-nuggets",
            teams.nuggets,
            teams.suns,
            iso("17:05"),
            "Ball Arena",
            { bet365: 0.478, kalshi: 0.456, polymarket: 0.452, model: 0.461 },
            {
              exposureScore: 45,
              volatilityScore: 30,
              liquidityRisk: 29,
              restEdge: 0.18,
              formEdge: 0.08,
              paceEdge: -0.1,
              noteTags: ["steady-secondary"],
            },
            ["Secondary disagreement remains stable."],
            [],
            [
              {
                label: "No action",
                detail: "Still secondary.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:27"),
            "heat-bucks",
            teams.bucks,
            teams.heat,
            iso("18:04"),
            "Fiserv Forum",
            { bet365: 0.412, kalshi: 0.428, polymarket: 0.424, model: 0.439 },
            {
              exposureScore: 29,
              volatilityScore: 24,
              liquidityRisk: 25,
              restEdge: 0.14,
              formEdge: 0.12,
              paceEdge: -0.08,
              noteTags: ["steady"],
            },
            ["Low urgency."],
            [],
            [
              {
                label: "Hold",
                detail: "No action.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:27"),
            "mavs-thunder",
            teams.thunder,
            teams.mavs,
            iso("18:35"),
            "Paycom Center",
            { bet365: 0.493, kalshi: 0.527, polymarket: 0.53, model: 0.536 },
            {
              exposureScore: 66,
              volatilityScore: 55,
              liquidityRisk: 18,
              restEdge: 0.09,
              formEdge: 0.22,
              paceEdge: 0.16,
              noteTags: ["second-tier-opportunity"],
            },
            ["Thunder is becoming the second highest-priority market."],
            [],
            [
              {
                label: "Watch for exposure overlap",
                detail: "Could justify a smaller line adjustment.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
        ],
        [
          health("bet365", iso("15:27"), 2600, "Internal book feed current"),
          health("kalshi", iso("15:27"), 3200, "Market snapshots healthy"),
          health("polymarket", iso("15:27"), 6700, "Crowd feed healthy"),
          health("model", iso("15:27"), 1600, "Baseline refreshed"),
        ]
      ),
      makeFrame(
        "boston-steam",
        3,
        iso("15:34"),
        "Boston is now the clearest divergence on the board.",
        [
          frameEvent(
            iso("15:34"),
            "knicks-celtics",
            teams.celtics,
            teams.knicks,
            iso("16:12"),
            "TD Garden",
            { bet365: 0.581, kalshi: 0.624, polymarket: 0.641, model: 0.615 },
            {
              exposureScore: 79,
              volatilityScore: 73,
              liquidityRisk: 14,
              restEdge: 0.45,
              formEdge: 0.31,
              paceEdge: 0.12,
              noteTags: ["actionable", "book-lag", "consensus-strong"],
            },
            [
              "Both external venues are now materially above the book.",
              "Internal exposure makes the delay more expensive.",
            ],
            [
              {
                label: "Consensus drift",
                message:
                  "Kalshi and Polymarket both moved toward Boston while the book remained static for 11 minutes.",
                tone: "caution",
              },
              {
                label: "Liquidity confirmation",
                message:
                  "Kalshi held the move with better structure than the first crowd spike.",
                tone: "positive",
              },
            ],
            [
              {
                label: "Reprice main line",
                detail: "Move toward external consensus before tip.",
                priority: "act-now",
              },
              {
                label: "Tighten selected props",
                detail: "Exposure suggests derivatives may still be stale.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:34"),
            "suns-nuggets",
            teams.nuggets,
            teams.suns,
            iso("17:05"),
            "Ball Arena",
            { bet365: 0.478, kalshi: 0.455, polymarket: 0.449, model: 0.461 },
            {
              exposureScore: 45,
              volatilityScore: 31,
              liquidityRisk: 31,
              restEdge: 0.18,
              formEdge: 0.08,
              paceEdge: -0.1,
              noteTags: ["secondary"],
            },
            ["Secondary disagreement holds."],
            [],
            [
              {
                label: "No action",
                detail: "Keep scanning only.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:34"),
            "heat-bucks",
            teams.bucks,
            teams.heat,
            iso("18:04"),
            "Fiserv Forum",
            { bet365: 0.412, kalshi: 0.431, polymarket: 0.427, model: 0.44 },
            {
              exposureScore: 30,
              volatilityScore: 25,
              liquidityRisk: 25,
              restEdge: 0.14,
              formEdge: 0.12,
              paceEdge: -0.08,
              noteTags: ["background"],
            },
            ["Quiet reference market."],
            [],
            [
              {
                label: "Ignore for now",
                detail: "Not a top-book issue.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:34"),
            "mavs-thunder",
            teams.thunder,
            teams.mavs,
            iso("18:35"),
            "Paycom Center",
            { bet365: 0.493, kalshi: 0.534, polymarket: 0.521, model: 0.542 },
            {
              exposureScore: 71,
              volatilityScore: 58,
              liquidityRisk: 16,
              restEdge: 0.09,
              formEdge: 0.22,
              paceEdge: 0.16,
              noteTags: ["rising-priority"],
            },
            ["Thunder has a real but smaller drift than Boston."],
            [],
            [
              {
                label: "Queue review",
                detail: "Watch this after the Boston action.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
        ],
        [
          health("bet365", iso("15:34"), 2800, "Internal book feed current"),
          health("kalshi", iso("15:34"), 2700, "Market snapshots healthy"),
          health("polymarket", iso("15:34"), 6400, "Crowd feed healthy"),
          health("model", iso("15:34"), 1700, "Baseline refreshed"),
        ]
      ),
      makeFrame(
        "boston-steam",
        4,
        iso("15:41"),
        "The Boston market is now the desk's clearest act-now candidate before tip.",
        [
          frameEvent(
            iso("15:41"),
            "knicks-celtics",
            teams.celtics,
            teams.knicks,
            iso("16:12"),
            "TD Garden",
            { bet365: 0.596, kalshi: 0.629, polymarket: 0.643, model: 0.617 },
            {
              exposureScore: 83,
              volatilityScore: 76,
              liquidityRisk: 12,
              restEdge: 0.45,
              formEdge: 0.31,
              paceEdge: 0.12,
              noteTags: ["desk-priority-one", "high-exposure"],
            },
            [
              "bet365 has partially moved but still trails consensus.",
              "Exposure keeps this in the act-now band.",
            ],
            [
              {
                label: "Book moved late",
                message:
                  "Internal price finally improved, but still trails the external stack.",
                tone: "caution",
              },
            ],
            [
              {
                label: "Reprice main line",
                detail: "Tighten the gap further before tip.",
                priority: "act-now",
              },
              {
                label: "Tighten high-liability props",
                detail: "Props still look lighter than the winner market.",
                priority: "act-now",
              },
              {
                label: "Monitor lineup confirmation",
                detail: "Keep the signal pinned into final status.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:41"),
            "suns-nuggets",
            teams.nuggets,
            teams.suns,
            iso("17:05"),
            "Ball Arena",
            { bet365: 0.478, kalshi: 0.455, polymarket: 0.449, model: 0.461 },
            {
              exposureScore: 46,
              volatilityScore: 30,
              liquidityRisk: 31,
              restEdge: 0.18,
              formEdge: 0.08,
              paceEdge: -0.1,
              noteTags: ["secondary"],
            },
            ["Still a lower-priority disagreement."],
            [],
            [
              {
                label: "Keep in explorer",
                detail: "Useful comparison market.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:41"),
            "heat-bucks",
            teams.bucks,
            teams.heat,
            iso("18:04"),
            "Fiserv Forum",
            { bet365: 0.412, kalshi: 0.43, polymarket: 0.425, model: 0.439 },
            {
              exposureScore: 31,
              volatilityScore: 24,
              liquidityRisk: 25,
              restEdge: 0.14,
              formEdge: 0.12,
              paceEdge: -0.08,
              noteTags: ["low-urgency"],
            },
            ["Still low urgency."],
            [],
            [
              {
                label: "Ignore for now",
                detail: "Not worth trader attention.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("15:41"),
            "mavs-thunder",
            teams.thunder,
            teams.mavs,
            iso("18:35"),
            "Paycom Center",
            { bet365: 0.505, kalshi: 0.537, polymarket: 0.528, model: 0.543 },
            {
              exposureScore: 74,
              volatilityScore: 60,
              liquidityRisk: 15,
              restEdge: 0.09,
              formEdge: 0.22,
              paceEdge: 0.16,
              noteTags: ["runner-up"],
            },
            ["Thunder remains the second cleanest divergence."],
            [],
            [
              {
                label: "Queue review",
                detail: "Actionable after the Celtics market.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
        ],
        [
          health("bet365", iso("15:41"), 2100, "Internal book feed current"),
          health("kalshi", iso("15:41"), 2400, "Market snapshots healthy"),
          health("polymarket", iso("15:41"), 6100, "Crowd feed healthy"),
          health("model", iso("15:41"), 1300, "Baseline refreshed"),
        ]
      ),
    ],
  },
  {
    id: "thunder-late-flip",
    name: "Thunder Late Flip",
    description:
      "A noisier storyline where Polymarket jumps first, Kalshi confirms later, and one source briefly degrades.",
    fixturePack: "operator-review-pack",
    defaultFrameIndex: 3,
    frames: [
      makeFrame(
        "thunder-late-flip",
        0,
        iso("18:02"),
        "Thunder begins as a moderate disagreement with thin crowd enthusiasm.",
        [
          frameEvent(
            iso("18:02"),
            "mavs-thunder",
            teams.thunder,
            teams.mavs,
            iso("18:35"),
            "Paycom Center",
            { bet365: 0.498, kalshi: 0.505, polymarket: 0.518, model: 0.528 },
            {
              exposureScore: 58,
              volatilityScore: 48,
              liquidityRisk: 39,
              restEdge: 0.09,
              formEdge: 0.22,
              paceEdge: 0.16,
              noteTags: ["crowd-led", "thin-market"],
            },
            ["Polymarket moves first, but quality is still mixed."],
            [
              {
                label: "Early crowd spike",
                message: "Crowd venue shows the first material Thunder jump.",
                tone: "info",
              },
            ],
            [
              {
                label: "Monitor",
                detail: "Needs confirmation before repricing.",
                priority: "monitor",
              },
            ],
            lowerDepth
          ),
          frameEvent(
            iso("18:02"),
            "knicks-celtics",
            teams.celtics,
            teams.knicks,
            iso("16:12"),
            "TD Garden",
            { bet365: 0.61, kalshi: 0.616, polymarket: 0.62, model: 0.617 },
            {
              exposureScore: 44,
              volatilityScore: 18,
              liquidityRisk: 8,
              restEdge: 0.45,
              formEdge: 0.31,
              paceEdge: 0.12,
              noteTags: ["settled"],
            },
            ["Boston is no longer the active issue in this replay."],
            [],
            [
              {
                label: "Settled",
                detail: "Use as contrast against the Thunder storyline.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
        ],
        [
          health("bet365", iso("18:02"), 2200, "Internal book feed current"),
          health("kalshi", iso("18:02"), 4500, "Market snapshots healthy"),
          health("polymarket", iso("18:02"), 9200, "Crowd feed healthy"),
          health("model", iso("18:02"), 1700, "Baseline refreshed"),
        ]
      ),
      makeFrame(
        "thunder-late-flip",
        1,
        iso("18:09"),
        "Polymarket runs ahead again while Kalshi lags.",
        [
          frameEvent(
            iso("18:09"),
            "mavs-thunder",
            teams.thunder,
            teams.mavs,
            iso("18:35"),
            "Paycom Center",
            { bet365: 0.498, kalshi: 0.507, polymarket: 0.539, model: 0.53 },
            {
              exposureScore: 59,
              volatilityScore: 67,
              liquidityRisk: 46,
              restEdge: 0.09,
              formEdge: 0.22,
              paceEdge: 0.16,
              noteTags: ["possible-false-spike", "thin-market"],
            },
            ["This looks loud, but not trustworthy yet."],
            [
              {
                label: "Noisy spike",
                message:
                  "Polymarket runs far ahead without matching Kalshi support.",
                tone: "caution",
              },
            ],
            [
              {
                label: "Do not chase",
                detail: "Wait for confirmation from cleaner liquidity.",
                priority: "monitor",
              },
            ],
            lowerDepth
          ),
          frameEvent(
            iso("18:09"),
            "knicks-celtics",
            teams.celtics,
            teams.knicks,
            iso("16:12"),
            "TD Garden",
            { bet365: 0.61, kalshi: 0.616, polymarket: 0.619, model: 0.617 },
            {
              exposureScore: 43,
              volatilityScore: 16,
              liquidityRisk: 8,
              restEdge: 0.45,
              formEdge: 0.31,
              paceEdge: 0.12,
              noteTags: ["settled"],
            },
            ["Stable reference market."],
            [],
            [
              {
                label: "Settled",
                detail: "No issue.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
        ],
        [
          health("bet365", iso("18:09"), 2300, "Internal book feed current"),
          health("kalshi", iso("18:09"), 4700, "Market snapshots healthy"),
          health(
            "polymarket",
            iso("18:09"),
            12600,
            "Crowd feed drifting",
            "degraded"
          ),
          health("model", iso("18:09"), 1600, "Baseline refreshed"),
        ]
      ),
      makeFrame(
        "thunder-late-flip",
        2,
        iso("18:16"),
        "Kalshi confirms enough of the move to make Thunder interesting for the desk.",
        [
          frameEvent(
            iso("18:16"),
            "mavs-thunder",
            teams.thunder,
            teams.mavs,
            iso("18:35"),
            "Paycom Center",
            { bet365: 0.498, kalshi: 0.528, polymarket: 0.536, model: 0.532 },
            {
              exposureScore: 64,
              volatilityScore: 58,
              liquidityRisk: 24,
              restEdge: 0.09,
              formEdge: 0.22,
              paceEdge: 0.16,
              noteTags: ["confirmed", "desk-actionable"],
            },
            ["Cleaner venue support now makes Thunder actionable."],
            [
              {
                label: "Kalshi confirms",
                message: "The clean venue now agrees with the crowd move.",
                tone: "positive",
              },
            ],
            [
              {
                label: "Queue review",
                detail: "This becomes a real repricing candidate.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("18:16"),
            "knicks-celtics",
            teams.celtics,
            teams.knicks,
            iso("16:12"),
            "TD Garden",
            { bet365: 0.61, kalshi: 0.616, polymarket: 0.619, model: 0.617 },
            {
              exposureScore: 42,
              volatilityScore: 15,
              liquidityRisk: 8,
              restEdge: 0.45,
              formEdge: 0.31,
              paceEdge: 0.12,
              noteTags: ["settled"],
            },
            ["Stable reference market."],
            [],
            [
              {
                label: "Settled",
                detail: "No issue.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
        ],
        [
          health("bet365", iso("18:16"), 2200, "Internal book feed current"),
          health("kalshi", iso("18:16"), 3400, "Market snapshots healthy"),
          health("polymarket", iso("18:16"), 9800, "Crowd feed recovering"),
          health("model", iso("18:16"), 1800, "Baseline refreshed"),
        ]
      ),
      makeFrame(
        "thunder-late-flip",
        3,
        iso("18:24"),
        "Thunder becomes the lead watch item, but the prior noise remains visible in the confidence breakdown.",
        [
          frameEvent(
            iso("18:24"),
            "mavs-thunder",
            teams.thunder,
            teams.mavs,
            iso("18:35"),
            "Paycom Center",
            { bet365: 0.507, kalshi: 0.534, polymarket: 0.531, model: 0.538 },
            {
              exposureScore: 73,
              volatilityScore: 61,
              liquidityRisk: 19,
              restEdge: 0.09,
              formEdge: 0.22,
              paceEdge: 0.16,
              noteTags: ["confirmed", "watch-item-one"],
            },
            [
              "Now actionable, but with remembered noise risk in the crowd feed.",
            ],
            [
              {
                label: "Book catches up late",
                message:
                  "Internal price improved, but still trails the confirmed consensus.",
                tone: "caution",
              },
            ],
            [
              {
                label: "Reprice main line",
                detail: "Thunder remains light against consensus.",
                priority: "act-now",
              },
              {
                label: "Keep confidence qualified",
                detail: "Prior crowd noise should stay visible in the note.",
                priority: "queue",
              },
            ],
            commonDepth
          ),
          frameEvent(
            iso("18:24"),
            "knicks-celtics",
            teams.celtics,
            teams.knicks,
            iso("16:12"),
            "TD Garden",
            { bet365: 0.61, kalshi: 0.616, polymarket: 0.619, model: 0.617 },
            {
              exposureScore: 42,
              volatilityScore: 15,
              liquidityRisk: 8,
              restEdge: 0.45,
              formEdge: 0.31,
              paceEdge: 0.12,
              noteTags: ["settled"],
            },
            ["Stable reference market."],
            [],
            [
              {
                label: "Settled",
                detail: "No issue.",
                priority: "monitor",
              },
            ],
            commonDepth
          ),
        ],
        [
          health("bet365", iso("18:24"), 2100, "Internal book feed current"),
          health("kalshi", iso("18:24"), 2800, "Market snapshots healthy"),
          health("polymarket", iso("18:24"), 7400, "Crowd feed healthy"),
          health("model", iso("18:24"), 1400, "Baseline refreshed"),
        ]
      ),
    ],
  },
];

export const defaultStorylineId = storylines[0].id;

export function getStoryline(storylineId: string) {
  return storylines.find((storyline) => storyline.id === storylineId) ?? null;
}

export function getLatestFrame(storyline: Storyline) {
  return (
    storyline.frames[storyline.defaultFrameIndex] ?? storyline.frames.at(-1)!
  );
}
