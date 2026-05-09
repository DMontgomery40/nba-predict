import { z } from "zod";

import { severityBandSchema } from "./core";
import {
  canonicalGameSchema,
  canonicalGameStateSchema,
  gameOutcomeSchema,
  marketFamilySchema,
  marketInstrumentSchema,
  mappingStatusSchema,
  quoteTickSchema,
  rawPayloadAttachmentSchema,
  researchGameStatusSchema,
  researchSourceIdSchema,
  sourceMarketSchema,
} from "./live";

const booleanQueryParamSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return value;
}, z.boolean());

export const coverageSummarySchema = z.object({
  activeSourceCount: z.number().int().nonnegative(),
  availableSources: z.array(researchSourceIdSchema),
  missingSources: z.array(researchSourceIdSchema),
  unmappedSourceMarketCount: z.number().int().nonnegative(),
});

export const divergenceSummarySchema = z.object({
  instrumentId: z.string(),
  displayLabel: z.string(),
  family: marketFamilySchema,
  impliedProbabilityGap: z.number().nonnegative(),
  lineMismatch: z.boolean(),
  severity: severityBandSchema,
});

export const latestSourceViewSchema = z.object({
  source: researchSourceIdSchema,
  sourceMarketId: z.string(),
  mappingStatus: mappingStatusSchema,
  raw: z.object({
    label: z.string().nullable().optional(),
    line: z.number().nullable().optional(),
    odds: z.string().nullable().optional(),
    price: z.number().nullable().optional(),
    bestBid: z.number().nullable().optional(),
    bestAsk: z.number().nullable().optional(),
    volume: z.number().nullable().optional(),
    depthScore: z.number().nullable().optional(),
  }),
  impliedProbability: z.number().min(0).max(1).nullable().optional(),
  capturedAt: z.string().nullable().optional(),
  freshnessMs: z.number().nullable().optional(),
  lastPayloadId: z.number().int().nullable().optional(),
});

export const marketInstrumentViewSchema = z.object({
  instrument: marketInstrumentSchema,
  mappingStatus: mappingStatusSchema,
  comparableState: z.enum(["comparable", "line-mismatch", "unmapped"]),
  lineMismatch: z.boolean(),
  signalPriority: z.number().min(0),
  impliedProbabilityGap: z.number().nonnegative().nullable().optional(),
  sources: z.array(latestSourceViewSchema),
});

export const researchGameCardSchema = z.object({
  game: canonicalGameSchema,
  gameState: canonicalGameStateSchema.nullable().optional(),
  outcome: gameOutcomeSchema.nullable().optional(),
  activeInstrumentCount: z.number().int().nonnegative(),
  coverage: coverageSummarySchema,
  topDivergences: z.array(divergenceSummarySchema),
  hasUnmappedMarkets: z.boolean(),
});

export const researchGameDetailSchema = z.object({
  game: canonicalGameSchema,
  gameState: canonicalGameStateSchema.nullable().optional(),
  outcome: gameOutcomeSchema.nullable().optional(),
  coverageSummary: coverageSummarySchema,
  marketFamilyCounts: z.array(
    z.object({
      family: marketFamilySchema,
      count: z.number().int().nonnegative(),
    })
  ),
});

export const instrumentComparisonViewSchema = z.object({
  instrument: marketInstrumentSchema,
  gameState: canonicalGameStateSchema.nullable().optional(),
  latestQuotesBySource: z.array(latestSourceViewSchema),
  derivedComparison: z.object({
    comparableState: z.enum(["comparable", "line-mismatch", "unmapped"]),
    lineMismatch: z.boolean(),
    impliedProbabilityGap: z.number().nonnegative().nullable().optional(),
    sourceCount: z.number().int().nonnegative(),
  }),
  latestRawReferences: z.array(
    z.object({
      source: researchSourceIdSchema,
      payloadId: z.number().int().nonnegative(),
      capturedAt: z.string(),
    })
  ),
});

export const instrumentTimelinePointSchema = z.object({
  source: researchSourceIdSchema,
  capturedAt: z.string(),
  impliedProbability: z.number().min(0).max(1).nullable().optional(),
  line: z.number().nullable().optional(),
  isHeartbeat: z.boolean(),
  bestBid: z.number().nullable().optional(),
  bestAsk: z.number().nullable().optional(),
  depthScore: z.number().nullable().optional(),
  volume: z.number().nullable().optional(),
});

export const instrumentTimelineSchema = z.object({
  quoteSeriesBySource: z.object({
    bet365: z.array(instrumentTimelinePointSchema),
    kalshi: z.array(instrumentTimelinePointSchema),
    polymarket: z.array(instrumentTimelinePointSchema),
    nba: z.array(instrumentTimelinePointSchema),
  }),
  gameStateSeries: z.array(canonicalGameStateSchema),
  annotations: z.array(
    z.object({
      capturedAt: z.string(),
      label: z.string(),
      detail: z.string(),
      source: z
        .enum(["bet365", "kalshi", "polymarket", "nba", "system"])
        .optional(),
    })
  ),
  lineMismatchWindows: z.array(
    z.object({
      start: z.string(),
      end: z.string().nullable().optional(),
      sources: z.array(researchSourceIdSchema),
    })
  ),
});

export const instrumentSourceDiagnosticsSchema = z.object({
  source: researchSourceIdSchema,
  sourceMarket: sourceMarketSchema,
  latestQuote: quoteTickSchema.nullable().optional(),
  latestRawPayload: rawPayloadAttachmentSchema.nullable().optional(),
  freshnessMs: z.number().nullable().optional(),
  diagnostics: z.object({
    mappingStatus: mappingStatusSchema,
    lineMismatch: z.boolean(),
    captureLagMs: z.number().nullable().optional(),
  }),
});

export const divergenceRowSchema = z.object({
  gameId: z.string(),
  instrumentId: z.string(),
  displayLabel: z.string(),
  sport: z.string(),
  league: z.string(),
  family: marketFamilySchema,
  inPlay: z.boolean(),
  comparableState: z.enum(["comparable", "line-mismatch", "unmapped"]),
  mappingStatus: mappingStatusSchema,
  lineMismatch: z.boolean(),
  impliedProbabilityGap: z.number().nonnegative().nullable().optional(),
  signalPriority: z.number().min(0),
  captureRecencyMs: z.number().nullable().optional(),
  severity: severityBandSchema,
});

export const signalMismatchRowSchema = divergenceRowSchema.extend({
  gameLabel: z.string(),
  scheduledStart: z.string(),
  gameStatus: researchGameStatusSchema,
  finalAwayScore: z.number().int().nullable().optional(),
  finalHomeScore: z.number().int().nullable().optional(),
  bet365ImpliedProbability: z.number().min(0).max(1).nullable().optional(),
  kalshiImpliedProbability: z.number().min(0).max(1).nullable().optional(),
  polymarketImpliedProbability: z.number().min(0).max(1).nullable().optional(),
  directionalDisagreement: z.boolean(),
});

export const coverageRowSchema = z.object({
  gameId: z.string(),
  instrumentId: z.string().nullable().optional(),
  sport: z.string(),
  league: z.string(),
  family: marketFamilySchema.nullable().optional(),
  availableSources: z.array(researchSourceIdSchema),
  missingSources: z.array(researchSourceIdSchema),
  unmappedSources: z.array(researchSourceIdSchema),
});

export const adminSourceHealthSchema = z.object({
  source: z.string(),
  configured: z.boolean(),
  authState: z.enum(["configured", "missing", "invalid"]),
  bootstrapState: z.enum(["ready", "missing", "invalid"]).optional(),
  lastSuccessAt: z.string().nullable().optional(),
  lagMs: z.number().nullable().optional(),
  currentBackoffMs: z.number().nullable().optional(),
  subscriptionState: z.enum(["active", "inactive", "unknown"]).optional(),
  status: z.enum(["ok", "error"]),
});

export const adminUnmappedMarketSchema = z.object({
  sourceMarket: sourceMarketSchema,
  game: canonicalGameSchema.nullable().optional(),
  latestQuote: quoteTickSchema.nullable().optional(),
});

export const storageCoverageRowSchema = z.object({
  source: z.string(),
  sport: z.string(),
  league: z.string(),
  gameId: z.string(),
  family: marketFamilySchema.nullable().optional(),
  sourceMarketCount: z.number().int().nonnegative(),
  quoteTickCount: z.number().int().nonnegative(),
  rawPayloadCount: z.number().int().nonnegative(),
});

export const gamesQuerySchema = z.object({
  sport: z.string().optional(),
  league: z.string().optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  sourceCoverage: z.string().optional(),
  hasUnmappedMarkets: booleanQueryParamSchema.optional(),
});

export const gameMarketsQuerySchema = z.object({
  family: marketFamilySchema.optional(),
  inPlay: booleanQueryParamSchema.optional(),
  mappedOnly: booleanQueryParamSchema.optional(),
  source: researchSourceIdSchema.optional(),
});

export const instrumentTimelineQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  resolution: z.string().optional(),
  source: z.array(researchSourceIdSchema).optional(),
});

export const researchDivergenceQuerySchema = z.object({
  sport: z.string().optional(),
  league: z.string().optional(),
  family: marketFamilySchema.optional(),
  inPlay: booleanQueryParamSchema.optional(),
  sourceSet: z.string().optional(),
  severity: severityBandSchema.optional(),
  freshness: z.string().optional(),
  mappedState: z.enum(["comparable", "line-mismatch", "unmapped"]).optional(),
  sort: z
    .enum([
      "divergence",
      "freshness",
      "captureRecency",
      "lineMismatch",
      "signalPriority",
    ])
    .optional(),
});

export const mappingResolveBodySchema = z.object({
  sourceMarketId: z.string().min(1),
  instrumentId: z.string().min(1),
  reason: z.string().min(1),
  resolvedBy: z.string().default("operator"),
});

export const backfillGamesBodySchema = z.object({
  sport: z.string().default("basketball"),
  league: z.string().default("NBA"),
  dateFrom: z.string(),
  dateTo: z.string(),
});

export const backfillMarketsBodySchema = z.object({
  source: z.string().optional(),
  gameId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export const captureRestartBodySchema = z.object({
  source: z.string().optional(),
});
