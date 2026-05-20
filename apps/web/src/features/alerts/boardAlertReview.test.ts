import { describe, expect, it } from "vitest";

import {
  buildFallbackReviewTargetsFromPredictionMarketContext,
  describePredictionSourceSummary,
  describePredictionMarketEvidenceSummary,
  describeReviewTargetReason,
  describeBoardAlertGameClock,
  formatBoardAlertCardTime,
  formatPbpGameClock,
  listRelatedPlayerIncidents,
} from "./boardAlertReview";

import type { BoardIncidentDto } from "../../data/api";

function makeIncident(overrides: Partial<BoardIncidentDto>): BoardIncidentDto {
  return {
    components: {
      coherence: 0.8,
      coverage: 0,
      microstructure: 0.7,
      residual: 0.8,
    },
    confidence: 0.9,
    detectedAt: "2026-05-16T17:18:26.000Z",
    evidence: [],
    firstPopAt: "2026-05-16T17:18:26.000Z",
    gameId: "nba-0042500206",
    gameLabel: "Pistons at Cavaliers",
    h0Adjustments: { appliedSuppression: 0, drivers: [] },
    id: "incident-test",
    inspect: {
      instrumentIds: [],
      payloadVersion: 1,
      relationFamilies: [],
      sourceMarketIds: [],
    },
    missingDataNotes: [],
    playByPlay: {
      available: true,
      firstActionAt: "2026-05-16T23:12:09.500Z",
      lastActionAt: "2026-05-17T01:58:38.500Z",
      nearestAfter: null,
      nearestBefore: null,
      totalActions: 200,
    },
    primaryEntityKey: null,
    primaryFamily: null,
    reason: "test incident",
    score: 80,
    severity: "high",
    shockKind: "pregame-availability",
    vigAdjusted: null,
    ...overrides,
  };
}

describe("board alert timing reads", () => {
  it("formats ISO duration clocks into trader-usable Qn mm:ss text", () => {
    expect(formatPbpGameClock({ clock: "PT12M00.00S", period: 1 })).toBe(
      "Q1 12:00"
    );
    expect(formatPbpGameClock({ clock: "PT04M16.00S", period: 3 })).toBe(
      "Q3 4:16"
    );
  });

  it("marks pregame incidents honestly even if the nearest NBA row is a later period start", () => {
    const alert = makeIncident({
      playByPlay: {
        available: true,
        firstActionAt: "2026-05-16T23:12:09.500Z",
        lastActionAt: "2026-05-17T01:58:38.500Z",
        nearestAfter: {
          actionNumber: 1,
          actionType: "period",
          clock: "PT12M00.00S",
          description: "Period Start",
          offsetSeconds: 27 * 60 + 59,
          period: 1,
          teamTricode: null,
          timeActual: "2026-05-16T23:12:09.500Z",
        },
        nearestBefore: null,
        totalActions: 200,
      },
    });

    expect(formatBoardAlertCardTime(alert)).toMatch(/Pregame .*before tip/i);
    expect(
      describeBoardAlertGameClock({
        alert,
        anchorAt: alert.firstPopAt,
        nearestPbp: alert.playByPlay.nearestAfter,
        pbpMissing: false,
      })
    ).toBe("Pregame / no game clock yet");
  });

  it("never leaks raw PT duration strings into the trader game-clock read", () => {
    const alert = makeIncident({
      firstPopAt: "2026-05-16T23:16:04.000Z",
      playByPlay: {
        available: true,
        firstActionAt: "2026-05-16T23:12:09.500Z",
        lastActionAt: "2026-05-17T01:58:38.500Z",
        nearestAfter: null,
        nearestBefore: {
          actionNumber: 39,
          actionType: "2pt",
          clock: "PT08M43.00S",
          description: "A. Thompson running Layup",
          offsetSeconds: 0,
          period: 1,
          teamTricode: "DET",
          timeActual: "2026-05-16T23:16:04.500Z",
        },
        totalActions: 200,
      },
      shockKind: "attribution-shaped",
    });

    const cardTime = formatBoardAlertCardTime(alert);
    const gameClock = describeBoardAlertGameClock({
      alert,
      anchorAt: alert.firstPopAt,
      nearestPbp: alert.playByPlay.nearestBefore,
      pbpMissing: false,
    });

    expect(cardTime).toContain("Q1 8:43");
    expect(cardTime).not.toContain("PT08M43.00S");
    expect(gameClock).toBe("Q1 8:43");
    expect(gameClock).not.toContain("PT");
  });

  it("keeps same-burst live peers tied to the fallback alert time instead of the stale requested anchor time", () => {
    const anchorAlert = makeIncident({
      firstPopAt: "2026-05-16T23:41:24.278Z",
      id: "fallback-anchor",
      primaryEntityKey: "evan-mobley",
      primaryFamily: "player-prop",
      shockKind: "attribution-shaped",
    });
    const peer = makeIncident({
      firstPopAt: "2026-05-16T23:41:24.278Z",
      id: "peer-josh-hart",
      primaryEntityKey: "josh-hart",
      primaryFamily: "player-prop",
      shockKind: "attribution-shaped",
    });

    const peers = listRelatedPlayerIncidents(
      anchorAlert,
      "2026-05-16T23:44:49.779Z",
      [anchorAlert, peer]
    );

    expect(peers.map((row) => row.id)).toEqual(["peer-josh-hart"]);
  });

  it("translates raw logit jargon into trader-readable target reasons", () => {
    const alert = makeIncident({
      evidence: [
        {
          contribution: 1,
          displayLabel: "Evan Mobley over 9.5 points",
          evidenceUnmapped: false,
          family: "player-prop",
          observationId: "obs-1",
          participantKey: "evan-mobley",
          reason: "logit 2.04 after H0; liquidity stress",
          source: "kalshi",
          sourceKind: "prediction-market",
        },
      ],
    });

    expect(
      describeReviewTargetReason({
        ...alert.evidence[0],
        sourceAlertId: alert.id,
      })
    ).toBe("extreme price shock vs baseline; thin liquidity");
  });

  it("labels canonical market context with the actual persisted sources", () => {
    expect(describePredictionMarketEvidenceSummary([])).toBe(
      "No persisted prediction-market observations in this window"
    );
    expect(
      describePredictionMarketEvidenceSummary([
        {
          bestAsk: null,
          bestBid: null,
          capturedAt: "2026-05-20T00:17:12.000Z",
          depthScore: null,
          displayLabel: "Dean Wade assists over 0.5",
          eventTimestamp: "2026-05-20T00:17:12.000Z",
          family: "player-prop",
          finalMarketVolume: null,
          impliedProbability: 0.78,
          kind: "trade",
          mappingStatus: "auto",
          notional: 25,
          observationId: "microstructure:1",
          offsetSeconds: -18,
          participantKey: "dean-wade",
          previousImpliedProbability: 0.57,
          signalStrength: 0.5,
          source: "polymarket",
          sourceMarketId: "sm-poly-dean-wade-assists-over",
          spread: null,
          tradePrice: 0.78,
          tradeSize: 32,
          volume: null,
          volumeShare: 0.21,
        },
      ])
    ).toBe("1 observation from polymarket · 1 trade");
  });

  it("summarizes canonical prediction-market context by source", () => {
    expect(
      describePredictionSourceSummary({
        families: ["points", "rebounds"],
        nearestOffsetSeconds: -18,
        nearestTimestamp: "2026-05-20T00:17:12.000Z",
        observationCount: 91,
        participantKeys: ["donovan-mitchell"],
        quoteCount: 91,
        source: "kalshi",
        topRows: [],
        tradeCount: 0,
      })
    ).toBe("91 observations · 91 quotes");
  });

  it("falls back to impacted canonical market context when persisted review targets are still unavailable", () => {
    const targets = buildFallbackReviewTargetsFromPredictionMarketContext([
      {
        bestAsk: null,
        bestBid: null,
        capturedAt: "2026-05-20T00:17:30.000Z",
        depthScore: null,
        displayLabel: "Dean Wade rebounds over 1.5",
        eventTimestamp: "2026-05-20T00:17:30.000Z",
        family: "player-prop",
        finalMarketVolume: null,
        impliedProbability: 0.99,
        kind: "trade",
        mappingStatus: "auto",
        notional: 118.79,
        observationId: "microstructure:2",
        offsetSeconds: 0,
        participantKey: "dean-wade",
        previousImpliedProbability: 0.31,
        signalStrength: 0.9,
        source: "polymarket",
        sourceMarketId: "sm-dean-wade-rebounds",
        spread: null,
        tradePrice: 0.99,
        tradeSize: 119.99,
        volume: null,
        volumeShare: 0.68,
      },
    ]);

    expect(targets).toEqual([
      expect.objectContaining({
        displayLabel: "Dean Wade rebounds over 1.5",
        source: "polymarket",
        sourceKind: "prediction-market",
      }),
    ]);
  });

  it("prefers the selected participant when fallback context includes a stronger unrelated market", () => {
    const targets = buildFallbackReviewTargetsFromPredictionMarketContext(
      [
        {
          bestAsk: null,
          bestBid: null,
          capturedAt: "2026-05-20T00:17:30.000Z",
          depthScore: null,
          displayLabel: "Other Player points over 10.5",
          eventTimestamp: "2026-05-20T00:17:30.000Z",
          family: "player-prop",
          finalMarketVolume: null,
          impliedProbability: 0.99,
          kind: "trade",
          mappingStatus: "auto",
          notional: 300,
          observationId: "microstructure:other",
          offsetSeconds: 0,
          participantKey: "other-player",
          previousImpliedProbability: 0.12,
          signalStrength: 1,
          source: "polymarket",
          sourceMarketId: "sm-other-player-points",
          spread: null,
          tradePrice: 0.99,
          tradeSize: 300,
          volume: null,
          volumeShare: 0.5,
        },
        {
          bestAsk: null,
          bestBid: null,
          capturedAt: "2026-05-20T00:17:31.000Z",
          depthScore: null,
          displayLabel: "Dean Wade rebounds over 1.5",
          eventTimestamp: "2026-05-20T00:17:31.000Z",
          family: "player-prop",
          finalMarketVolume: null,
          impliedProbability: 0.75,
          kind: "trade",
          mappingStatus: "auto",
          notional: 25,
          observationId: "microstructure:dean",
          offsetSeconds: 1,
          participantKey: "dean-wade",
          previousImpliedProbability: 0.4,
          signalStrength: 0.35,
          source: "polymarket",
          sourceMarketId: "sm-dean-wade-rebounds",
          spread: null,
          tradePrice: 0.75,
          tradeSize: 33,
          volume: null,
          volumeShare: 0.08,
        },
      ],
      "dean-wade"
    );

    expect(targets.map((target) => target.displayLabel)).toEqual([
      "Dean Wade rebounds over 1.5",
    ]);
  });
});
