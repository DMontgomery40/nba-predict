import { describe, expect, it } from "vitest";

import { getLatestFrame, getStoryline } from "../fixtures/storylines";
import { buildTimelineData, scoreEventFrame } from "../signal-engine";

describe("signal engine", () => {
  it("scores Boston as a high-priority act-now event in the default storyline", () => {
    const storyline = getStoryline("boston-steam");
    expect(storyline).not.toBeNull();

    const latestFrame = getLatestFrame(storyline!);
    const event = latestFrame.events.find(
      (item) => item.event.id === "knicks-celtics"
    );

    expect(event).toBeDefined();

    const scored = scoreEventFrame(event!, latestFrame.capturedAt);

    expect(scored.watchlistPriority).toBeGreaterThanOrEqual(75);
    expect(["high", "critical"]).toContain(scored.severityBand);
    expect(scored.reasonCodes).toContain("CONSENSUS_DRIFT");
    expect(scored.reasonCodes).toContain("EXPOSURE_HEAT");
  });

  it("keeps noisy crowd-led moves from looking fully trusted before confirmation", () => {
    const storyline = getStoryline("thunder-late-flip");
    expect(storyline).not.toBeNull();

    const noisyFrame = storyline!.frames[1];
    const event = noisyFrame.events.find(
      (item) => item.event.id === "mavs-thunder"
    );

    expect(event).toBeDefined();

    const scored = scoreEventFrame(event!, noisyFrame.capturedAt);

    expect(scored.confidenceScore).toBeLessThan(70);
    expect(scored.reasonCodes).toContain("THIN_MARKET");
    expect(scored.reasonCodes).toContain("REVERSAL_RISK");
  });

  it("builds a stable replay timeline across all frames for a storyline", () => {
    const storyline = getStoryline("boston-steam");
    expect(storyline).not.toBeNull();

    const timeline = buildTimelineData(storyline!, "knicks-celtics");

    expect(timeline).toHaveLength(storyline!.frames.length);
    expect(timeline[0]?.capturedAt).toBe(storyline!.frames[0]?.capturedAt);
    expect(timeline.at(-1)?.divergenceScore).toBeGreaterThan(
      timeline[0]?.divergenceScore ?? 0
    );
  });
});
