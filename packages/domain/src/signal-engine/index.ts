import type {
  ConfidenceBand,
  FreshnessStatus,
  SeverityBand,
  SourceId,
} from "../modes";
import type {
  EventFrame,
  ReasonCode,
  ScoredEvent,
  SourceQuote,
  Storyline,
  StorylineFrame,
  WatchlistRecord,
} from "../types";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const freshnessWeightByStatus: Record<FreshnessStatus, number> = {
  fresh: 1,
  aging: 0.74,
  stale: 0.42,
  offline: 0.05,
};

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPercent(probability: number) {
  return `${(probability * 100).toFixed(1)}%`;
}

function tipoffLabel(tipoffAt: string, referenceAt: string) {
  const diffMinutes = Math.max(
    1,
    Math.round(
      (new Date(tipoffAt).getTime() - new Date(referenceAt).getTime()) / 60000
    )
  );

  if (diffMinutes >= 60) {
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }

  return `${diffMinutes}m`;
}

function bandFromScore(score: number): SeverityBand {
  if (score >= 75) {
    return "critical";
  }
  if (score >= 50) {
    return "high";
  }
  if (score >= 35) {
    return "medium";
  }
  return "low";
}

function confidenceBandFromScore(score: number): ConfidenceBand {
  if (score >= 72) {
    return "high";
  }
  if (score >= 48) {
    return "moderate";
  }
  return "low";
}

function buildSourceTrust(quotes: Record<SourceId, SourceQuote>) {
  return (Object.values(quotes) as SourceQuote[]).map((quote) => {
    const freshness = freshnessWeightByStatus[quote.freshnessStatus];
    const score = Math.round(
      clamp(
        freshness * 35 + quote.depthScore * 0.45 + quote.reliabilityWeight * 20,
        10,
        100
      )
    );

    const note =
      quote.sourceId === "kalshi"
        ? "Cleanest structure right now"
        : quote.sourceId === "polymarket"
          ? "Fast signal, but more crowd noise"
          : quote.sourceId === "model"
            ? "Supports basketball context"
            : "Operational source of truth";

    return {
      sourceId: quote.sourceId,
      score,
      note,
    };
  });
}

export function scoreEventFrame(
  frame: EventFrame,
  capturedAt: string
): ScoredEvent {
  const bookProbability = frame.quotes.bet365.probability;
  const externalQuotes = [
    frame.quotes.kalshi,
    frame.quotes.polymarket,
    frame.quotes.model,
  ];
  const weightedQuotes = externalQuotes.map((quote) => ({
    probability: quote.probability,
    weight:
      freshnessWeightByStatus[quote.freshnessStatus] *
      quote.reliabilityWeight *
      (quote.depthScore / 100),
  }));

  const totalWeight =
    weightedQuotes.reduce((sum, item) => sum + item.weight, 0) || 1;
  const consensusProbability =
    weightedQuotes.reduce(
      (sum, item) => sum + item.probability * item.weight,
      0
    ) / totalWeight;

  const freshnessScore = Math.round(
    average(
      externalQuotes.map(
        (quote) => freshnessWeightByStatus[quote.freshnessStatus]
      )
    ) * 100
  );
  const liquidityScore = Math.round(
    average(externalQuotes.map((quote) => quote.depthScore))
  );
  const reliabilityScore = Math.round(
    average(externalQuotes.map((quote) => quote.reliabilityWeight)) * 100
  );
  const agreementScore = Math.round(
    clamp(
      100 -
        average(
          externalQuotes.map((quote) =>
            Math.abs(quote.probability - consensusProbability)
          )
        ) *
          500,
      0,
      100
    )
  );
  const completenessPenalty = externalQuotes.some(
    (quote) => quote.freshnessStatus === "offline"
  )
    ? 15
    : externalQuotes.some((quote) => quote.freshnessStatus === "stale")
      ? 8
      : 0;
  const reversalPenalty =
    frame.context.liquidityRisk > 35 && frame.context.volatilityScore > 60
      ? 18
      : frame.context.liquidityRisk > 30
        ? 8
        : 0;

  const divergenceScore = Math.round(
    clamp(
      Math.abs(bookProbability - consensusProbability) * 100 * 2.6 +
        average(
          externalQuotes.map((quote) =>
            Math.abs(quote.probability - consensusProbability)
          )
        ) *
          100 *
          0.8 +
        frame.context.volatilityScore * 0.15 +
        frame.context.exposureScore * 0.22 +
        Math.max(
          0,
          100 -
            Math.abs(frame.context.modelProbability - consensusProbability) *
              180
        ) *
          0.15,
      0,
      100
    )
  );

  const confidenceScore = Math.round(
    clamp(
      freshnessScore * 0.3 +
        liquidityScore * 0.25 +
        agreementScore * 0.2 +
        reliabilityScore * 0.15 +
        clamp(100 - frame.context.liquidityRisk, 0, 100) * 0.1 -
        frame.context.liquidityRisk * 0.08 -
        completenessPenalty -
        reversalPenalty,
      0,
      100
    )
  );

  const tipoffUrgency = clamp(
    100 -
      Math.round(
        (new Date(frame.event.tipoffAt).getTime() -
          new Date(capturedAt).getTime()) /
          60000
      ),
    10,
    95
  );

  const reasonCodes: ReasonCode[] = [];
  const leadingQuote = [...externalQuotes].sort(
    (left, right) =>
      Math.abs(right.probability - bookProbability) -
      Math.abs(left.probability - bookProbability)
  )[0];

  if (Math.abs(consensusProbability - bookProbability) >= 0.028) {
    reasonCodes.push("CONSENSUS_DRIFT");
  }
  if (leadingQuote?.sourceId === "kalshi") {
    reasonCodes.push("KALSHI_LEADS");
  }
  if (leadingQuote?.sourceId === "polymarket") {
    reasonCodes.push("POLYMARKET_LEADS");
  }
  if (frame.context.exposureScore >= 70) {
    reasonCodes.push("EXPOSURE_HEAT");
  }
  if (
    Math.abs(frame.context.modelProbability - consensusProbability) <= 0.022
  ) {
    reasonCodes.push("FUNDAMENTAL_SUPPORT");
  }
  if (liquidityScore <= 58 || frame.context.liquidityRisk >= 40) {
    reasonCodes.push("THIN_MARKET");
  }
  if (reversalPenalty > 0) {
    reasonCodes.push("REVERSAL_RISK");
  }
  if (completenessPenalty > 0) {
    reasonCodes.push("DATA_GAP");
  }
  if (
    Math.abs(bookProbability - consensusProbability) >= 0.04 &&
    frame.quotes.bet365.probability < consensusProbability
  ) {
    reasonCodes.push("STALE_BOOK");
  }

  const urgencyBonus =
    (divergenceScore >= 60 ? 7 : 0) +
    (frame.context.exposureScore >= 75 ? 4 : 0) +
    (reasonCodes.includes("STALE_BOOK") ? 4 : 0) +
    (tipoffUrgency >= 65 ? 2 : 0);

  const watchlistPriority = Math.round(
    clamp(
      divergenceScore * 0.45 +
        confidenceScore * 0.2 +
        frame.context.exposureScore * 0.2 +
        tipoffUrgency * 0.15 +
        urgencyBonus,
      0,
      100
    )
  );

  const riskFlags = [
    ...(frame.context.exposureScore >= 70 ? ["High liability"] : []),
    ...(liquidityScore <= 55 ? ["Thin external liquidity"] : []),
    ...(completenessPenalty > 0 ? ["Source degradation"] : []),
  ];

  const narrativeTitle =
    watchlistPriority >= 80
      ? "Act on this now"
      : watchlistPriority >= 62
        ? "Worth trader attention"
        : "Useful scan item";

  const narrative = (() => {
    const leader =
      leadingQuote?.sourceId === "kalshi"
        ? "Kalshi"
        : leadingQuote?.sourceId === "polymarket"
          ? "Polymarket"
          : "the internal baseline";

    const confidenceSentence =
      confidenceScore >= 72
        ? "Confidence is high because the cleaner sources agree and liquidity is holding."
        : confidenceScore >= 48
          ? "Confidence is moderate because the move is real, but quality factors still matter."
          : "Confidence is limited because the signal is noisy or incomplete.";

    return `${leader} leads a ${formatPercent(
      consensusProbability - bookProbability
    )} consensus gap versus the book. ${confidenceSentence}`;
  })();

  const evidence = [
    `${frame.event.awayTeam.shortName} @ ${frame.event.homeTeam.shortName}: bet365 ${formatPercent(
      bookProbability
    )}, consensus ${formatPercent(consensusProbability)}.`,
    `Model baseline is ${formatPercent(frame.context.modelProbability)} and ${
      Math.abs(frame.context.modelProbability - consensusProbability) <= 0.022
        ? "supports"
        : "does not fully support"
    } the move.`,
    `Exposure score ${frame.context.exposureScore} / 100 and liquidity score ${liquidityScore} / 100.`,
  ];

  return {
    eventId: frame.event.id,
    eventLabel: `${frame.event.awayTeam.shortName} @ ${frame.event.homeTeam.shortName}`,
    tipoffAt: frame.event.tipoffAt,
    tipoffLabel: tipoffLabel(frame.event.tipoffAt, capturedAt),
    quotes: frame.quotes,
    bookProbability,
    consensusProbability,
    divergenceScore,
    confidenceScore,
    watchlistPriority,
    severityBand: bandFromScore(divergenceScore),
    confidenceBand: confidenceBandFromScore(confidenceScore),
    freshnessScore,
    liquidityScore,
    agreementScore,
    reliabilityScore,
    reasonCodes,
    riskFlags,
    leadingSource: leadingQuote?.sourceId ?? null,
    narrative,
    narrativeTitle,
    evidence,
    sourceTrust: buildSourceTrust(frame.quotes),
    suggestedActions: frame.suggestedActions,
    audit: frame.audit,
    context: frame.context,
  };
}

export function scoreFrame(frame: StorylineFrame) {
  return frame.events
    .map((eventFrame) => scoreEventFrame(eventFrame, frame.capturedAt))
    .sort((left, right) => right.watchlistPriority - left.watchlistPriority);
}

export function buildOverviewData(
  storyline: Storyline,
  frame: StorylineFrame,
  mode: "demo" | "replay" | "live",
  watchlist: WatchlistRecord[]
) {
  const scoredEvents = scoreFrame(frame);
  const watched = new Set(watchlist.map((item) => item.eventId));
  const topCards = scoredEvents.slice(0, 4).map((event) => ({
    eventId: event.eventId,
    label: event.eventLabel,
    severityBand: event.severityBand,
    confidenceBand: event.confidenceBand,
    watchlistPriority: event.watchlistPriority,
    divergenceScore: event.divergenceScore,
    confidenceScore: event.confidenceScore,
    tipoffLabel: event.tipoffLabel,
    interestingNow: event.narrativeTitle,
    isWatched: watched.has(event.eventId),
  }));

  const unhealthyCount = frame.sourceHealth.filter(
    (source) => source.status !== "healthy"
  ).length;

  return {
    mode,
    generatedAt: frame.capturedAt,
    storyline: {
      id: storyline.id,
      name: storyline.name,
      description: storyline.description,
      fixturePack: storyline.fixturePack,
    },
    cards: topCards,
    quickStats: [
      {
        label: "Active games",
        value: String(frame.events.length),
        tone: "neutral" as const,
      },
      {
        label: "High-severity alerts",
        value: String(
          scoredEvents.filter(
            (event) =>
              event.severityBand === "high" || event.severityBand === "critical"
          ).length
        ),
        tone: "warning" as const,
      },
      {
        label: "Source health issues",
        value: String(unhealthyCount),
        tone: unhealthyCount > 0 ? ("warning" as const) : ("positive" as const),
      },
    ],
    watchlist: scoredEvents.filter((event) => watched.has(event.eventId)),
    interestingNow: scoredEvents.slice(0, 3).map((event) => ({
      title: event.eventLabel,
      body: event.narrative,
    })),
    sourceHealth: frame.sourceHealth,
  };
}

export function buildTimelineData(storyline: Storyline, eventId: string) {
  return storyline.frames
    .map((frame) => {
      const event = frame.events.find((item) => item.event.id === eventId);
      if (!event) {
        return null;
      }

      const scored = scoreEventFrame(event, frame.capturedAt);
      return {
        capturedAt: frame.capturedAt,
        summary: frame.summary,
        bet365: event.quotes.bet365.probability,
        kalshi: event.quotes.kalshi.probability,
        polymarket: event.quotes.polymarket.probability,
        model: event.quotes.model.probability,
        consensus: scored.consensusProbability,
        divergenceScore: scored.divergenceScore,
        confidenceScore: scored.confidenceScore,
        annotations: event.audit.map((item) => ({
          capturedAt: item.capturedAt,
          label: item.label,
          message: item.message,
        })),
      };
    })
    .filter(Boolean);
}

export function buildEventDetail(
  storyline: Storyline,
  frame: StorylineFrame,
  eventId: string
) {
  const eventFrame = frame.events.find((item) => item.event.id === eventId);
  if (!eventFrame) {
    return null;
  }

  const scored = scoreEventFrame(eventFrame, frame.capturedAt);

  return {
    event: eventFrame.event,
    signal: scored,
    storyline: {
      id: storyline.id,
      name: storyline.name,
      summary: frame.summary,
      frameIndex: frame.frameIndex,
    },
    sourceHealth: frame.sourceHealth,
    timeline: buildTimelineData(storyline, eventId),
  };
}

export function buildDivergenceRows(frame: StorylineFrame) {
  return scoreFrame(frame).map((event) => ({
    eventId: event.eventId,
    label: event.eventLabel,
    bet365: event.bookProbability,
    consensus: event.consensusProbability,
    divergenceScore: event.divergenceScore,
    confidenceScore: event.confidenceScore,
    severityBand: event.severityBand,
    confidenceBand: event.confidenceBand,
    tipoffLabel: event.tipoffLabel,
    leadingSource: event.leadingSource,
    reasonCodes: event.reasonCodes,
  }));
}

export function buildWatchlistRows(
  frame: StorylineFrame,
  watchlist: WatchlistRecord[]
) {
  const watchRecords = new Map(
    watchlist.map((item) => [item.eventId, item] as const)
  );

  return scoreFrame(frame)
    .filter((event) => watchRecords.has(event.eventId))
    .map((event) => ({
      ...event,
      watch: watchRecords.get(event.eventId)!,
    }));
}
