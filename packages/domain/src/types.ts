import type {
  ConfidenceBand,
  FreshnessStatus,
  HealthStatus,
  OperatingMode,
  SeverityBand,
  SourceId,
} from "./modes";

export type Team = {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
  shortName: string;
};

export type SportEvent = {
  id: string;
  league: "NBA";
  status: "scheduled" | "pre-tip" | "in-play" | "final";
  tipoffAt: string;
  homeTeam: Team;
  awayTeam: Team;
  marketType: "winner";
  venue: string;
};

export type SourceQuote = {
  sourceId: SourceId;
  probability: number;
  spread: number;
  volume: number;
  depthScore: number;
  sourceTimestamp: string;
  ingestedAt: string;
  freshnessStatus: FreshnessStatus;
  reliabilityWeight: number;
  note?: string;
};

export type SourceHealth = {
  sourceId: SourceId;
  status: HealthStatus;
  lastSuccessAt: string;
  lagMs: number;
  message: string;
};

export type EventContext = {
  modelProbability: number;
  restEdge: number;
  formEdge: number;
  paceEdge: number;
  exposureScore: number;
  volatilityScore: number;
  liquidityRisk: number;
  noteTags: string[];
};

export type AuditEntry = {
  id: string;
  capturedAt: string;
  label: string;
  message: string;
  tone: "info" | "positive" | "caution";
};

export type SuggestedAction = {
  label: string;
  detail: string;
  priority: "monitor" | "queue" | "act-now";
};

export type EventFrame = {
  event: SportEvent;
  quotes: Record<SourceId, SourceQuote>;
  context: EventContext;
  narrativeHints: string[];
  audit: AuditEntry[];
  suggestedActions: SuggestedAction[];
};

export type StorylineFrame = {
  storylineId: string;
  frameIndex: number;
  capturedAt: string;
  summary: string;
  sourceHealth: SourceHealth[];
  events: EventFrame[];
};

export type Storyline = {
  id: string;
  name: string;
  description: string;
  fixturePack: string;
  defaultFrameIndex: number;
  frames: StorylineFrame[];
};

export type WatchlistRecord = {
  eventId: string;
  priority: number | null;
  status: "queued" | "monitoring";
  note: string | null;
  updatedAt: string;
};

export type ReasonCode =
  | "CONSENSUS_DRIFT"
  | "KALSHI_LEADS"
  | "POLYMARKET_LEADS"
  | "STALE_BOOK"
  | "EXPOSURE_HEAT"
  | "THIN_MARKET"
  | "FUNDAMENTAL_SUPPORT"
  | "REVERSAL_RISK"
  | "DATA_GAP";

export type ScoredEvent = {
  eventId: string;
  eventLabel: string;
  tipoffAt: string;
  tipoffLabel: string;
  quotes: Record<SourceId, SourceQuote>;
  bookProbability: number;
  consensusProbability: number;
  divergenceScore: number;
  confidenceScore: number;
  watchlistPriority: number;
  severityBand: SeverityBand;
  confidenceBand: ConfidenceBand;
  freshnessScore: number;
  liquidityScore: number;
  agreementScore: number;
  reliabilityScore: number;
  reasonCodes: ReasonCode[];
  riskFlags: string[];
  leadingSource: SourceId | null;
  narrative: string;
  narrativeTitle: string;
  evidence: string[];
  sourceTrust: Array<{
    sourceId: SourceId;
    score: number;
    note: string;
  }>;
  suggestedActions: SuggestedAction[];
  audit: AuditEntry[];
  context: EventContext;
};

export type OverviewCard = {
  eventId: string;
  label: string;
  severityBand: SeverityBand;
  confidenceBand: ConfidenceBand;
  watchlistPriority: number;
  divergenceScore: number;
  confidenceScore: number;
  tipoffLabel: string;
  interestingNow: string;
  isWatched: boolean;
};

export type OverviewData = {
  mode: OperatingMode;
  generatedAt: string;
  storyline: Pick<Storyline, "id" | "name" | "description" | "fixturePack">;
  cards: OverviewCard[];
  quickStats: Array<{
    label: string;
    value: string;
    tone: "neutral" | "positive" | "warning";
  }>;
  watchlist: ScoredEvent[];
  interestingNow: Array<{
    title: string;
    body: string;
  }>;
  sourceHealth: SourceHealth[];
};
