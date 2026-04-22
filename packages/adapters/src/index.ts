import {
  storylines,
  type OperatingMode,
  type SourceHealth,
  type Storyline,
  type StorylineFrame,
} from "@signal-console/domain";
import {
  getDemoStorylineId,
  getReplaySelection,
  getStoryline,
  listStorylines,
  seedStorylines,
} from "@signal-console/shared";

export type ModeSnapshot = {
  mode: OperatingMode;
  storyline: Storyline;
  frame: StorylineFrame;
  availableStorylines: Array<{
    id: string;
    name: string;
    description: string;
    defaultFrameIndex: number;
  }>;
};

export type SelectionValidation = {
  frameIndex: number | null;
  maxFrameIndex: number | null;
  requestedStorylineId: string | null;
  resolvedStorylineId: string | null;
  valid: boolean;
};

export function ensureFixturesLoaded() {
  if (listStorylines().length === 0) {
    seedStorylines(storylines);
  }
}

function getAvailableStorylines() {
  ensureFixturesLoaded();
  return listStorylines();
}

function cloneFrame(frame: StorylineFrame): StorylineFrame {
  return JSON.parse(JSON.stringify(frame)) as StorylineFrame;
}

function degradeForLive(frame: StorylineFrame) {
  const liveFrame = cloneFrame(frame);

  liveFrame.summary =
    "Live mode is using the latest normalized snapshot with one degraded crowd source to demonstrate honest freshness handling.";

  liveFrame.sourceHealth = liveFrame.sourceHealth.map((source) => {
    if (source.sourceId === "polymarket") {
      return {
        ...source,
        status: "degraded",
        lagMs: source.lagMs + 15000,
        message: "Crowd feed lagging; values remain visible but are aging.",
      } satisfies SourceHealth;
    }
    return source;
  });

  for (const event of liveFrame.events) {
    if (event.quotes.polymarket) {
      event.quotes.polymarket.freshnessStatus = "aging";
      event.quotes.polymarket.note = "live mode degradation demo";
    }
  }

  return liveFrame;
}

export function getModeSnapshot(mode: OperatingMode): ModeSnapshot {
  ensureFixturesLoaded();

  const availableStorylines = getAvailableStorylines();
  const availableStorylineSummaries = availableStorylines.map((storyline) => ({
    id: storyline.id,
    name: storyline.name,
    description: storyline.description,
    defaultFrameIndex: storyline.defaultFrameIndex,
  }));

  if (mode === "replay") {
    const selection = getReplaySelection();
    const storyline =
      getStoryline(selection.storylineId ?? availableStorylines[0]!.id) ??
      getStoryline(availableStorylines[0]!.id) ??
      storylines[0]!;
    const frame =
      storyline.frames[selection.frameIndex] ??
      storyline.frames[storyline.defaultFrameIndex] ??
      storyline.frames.at(-1)!;

    return {
      mode,
      storyline,
      frame,
      availableStorylines: availableStorylineSummaries,
    };
  }

  const demoStoryline =
    getStoryline(getDemoStorylineId() ?? availableStorylines[0]!.id) ??
    getStoryline(availableStorylines[0]!.id) ??
    storylines[0]!;
  const latestFrame =
    demoStoryline.frames[demoStoryline.defaultFrameIndex] ??
    demoStoryline.frames.at(-1)!;

  return {
    mode,
    storyline: demoStoryline,
    frame: mode === "live" ? degradeForLive(latestFrame) : latestFrame,
    availableStorylines: availableStorylineSummaries,
  };
}

export function validateReplaySelection(): SelectionValidation {
  ensureFixturesLoaded();

  const selection = getReplaySelection();
  const requestedStorylineId = selection.storylineId;
  if (!requestedStorylineId) {
    return {
      frameIndex: null,
      maxFrameIndex: null,
      requestedStorylineId: null,
      resolvedStorylineId: null,
      valid: false,
    };
  }

  const storyline = getStoryline(requestedStorylineId);
  if (!storyline) {
    return {
      frameIndex: selection.frameIndex,
      maxFrameIndex: null,
      requestedStorylineId,
      resolvedStorylineId: null,
      valid: false,
    };
  }

  const maxFrameIndex = Math.max(storyline.frames.length - 1, 0);
  const valid =
    selection.frameIndex >= 0 && selection.frameIndex <= maxFrameIndex;

  return {
    frameIndex: selection.frameIndex,
    maxFrameIndex,
    requestedStorylineId,
    resolvedStorylineId: storyline.id,
    valid,
  };
}

export function validateDemoStorylineSelection() {
  ensureFixturesLoaded();

  const requestedStorylineId = getDemoStorylineId();
  if (!requestedStorylineId) {
    return {
      frameIndex: null,
      maxFrameIndex: null,
      requestedStorylineId: null,
      resolvedStorylineId: null,
      valid: false,
    } satisfies SelectionValidation;
  }

  const storyline = getStoryline(requestedStorylineId);
  return {
    frameIndex: storyline?.defaultFrameIndex ?? null,
    maxFrameIndex:
      storyline && storyline.frames.length > 0
        ? storyline.frames.length - 1
        : null,
    requestedStorylineId,
    resolvedStorylineId: storyline?.id ?? null,
    valid: Boolean(storyline),
  } satisfies SelectionValidation;
}
