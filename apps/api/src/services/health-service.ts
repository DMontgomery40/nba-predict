import {
  getModeSnapshot,
  validateDemoStorylineSelection,
  validateReplaySelection,
} from "@signal-console/adapters";
import {
  operatingModes,
  type HealthStatus,
  type OperatingMode,
} from "@signal-console/domain";
import { checkDatabaseHealth, createAppLogger } from "@signal-console/shared";

export const appVersion = process.env.SIGNAL_CONSOLE_VERSION ?? "0.1.0";

type HealthLogger = {
  child: (bindings: Record<string, unknown>) => HealthLogger;
  debug: (bindings: Record<string, unknown>, message?: string) => void;
};

type HealthCheck = {
  details?: Record<string, unknown>;
  name: string;
  operatorHint?: string;
  status: "ok" | "error";
  summary: string;
};

function buildBaseHealthMetadata() {
  return {
    generatedAt: new Date().toISOString(),
    uptimeMs: Math.round(process.uptime() * 1000),
    version: appVersion,
  };
}

function countSourceStatuses(statuses: HealthStatus[]) {
  return statuses.reduce(
    (counts, status) => {
      counts[status] += 1;
      return counts;
    },
    {
      degraded: 0,
      healthy: 0,
      offline: 0,
    } satisfies Record<HealthStatus, number>
  );
}

function buildModeResolution(mode: OperatingMode) {
  const snapshot = getModeSnapshot(mode);
  const sourceCounts = countSourceStatuses(
    snapshot.frame.sourceHealth.map((source) => source.status)
  );

  return {
    degradedSourceCount: snapshot.frame.sourceHealth.filter(
      (source) => source.status !== "healthy"
    ).length,
    frameIndex: snapshot.frame.frameIndex,
    mode,
    sourceCounts,
    status: "ok" as const,
    storylineId: snapshot.storyline.id,
  };
}

export function buildLivenessPayload() {
  return {
    ...buildBaseHealthMetadata(),
    checks: [
      {
        name: "process",
        status: "ok" as const,
        summary: "Fastify process is accepting requests.",
      },
    ],
    status: "ok" as const,
  };
}

export function buildReadinessPayload(context?: { logger?: HealthLogger }) {
  const logger =
    context?.logger ?? createAppLogger({ component: "api-readiness" });
  const checks: HealthCheck[] = [];
  const dbHealth = checkDatabaseHealth();

  checks.push({
    details: {
      appStateKeys: dbHealth.appStateKeys,
      counts: dbHealth.counts,
      path: dbHealth.path,
      schemaVersion: dbHealth.schemaVersion,
    },
    name: "database",
    operatorHint: dbHealth.operatorHint,
    status: dbHealth.status,
    summary: dbHealth.message,
  });

  const storylineCheck =
    dbHealth.status === "ok" && dbHealth.counts.storylineCount > 0
      ? ({
          details: {
            storylineCount: dbHealth.counts.storylineCount,
          },
          name: "fixtures",
          status: "ok",
          summary: "Fixture storylines are present in SQLite.",
        } satisfies HealthCheck)
      : ({
          details: {
            storylineCount: dbHealth.counts.storylineCount,
          },
          name: "fixtures",
          operatorHint:
            "Seed the fixture catalog before relying on demo, replay, or live snapshot resolution.",
          status: "error",
          summary: "No fixture storylines were found.",
        } satisfies HealthCheck);

  checks.push(storylineCheck);

  const demoSelection = validateDemoStorylineSelection();
  checks.push({
    details: demoSelection,
    name: "demo-selection",
    operatorHint: demoSelection.valid
      ? undefined
      : "Repair the persisted demo storyline id or reseed fixtures before using demo mode.",
    status: demoSelection.valid ? "ok" : "error",
    summary: demoSelection.valid
      ? `Demo mode resolves storyline "${demoSelection.resolvedStorylineId}".`
      : "Demo mode selection is invalid.",
  });

  const replaySelection = validateReplaySelection();
  checks.push({
    details: replaySelection,
    name: "replay-selection",
    operatorHint: replaySelection.valid
      ? undefined
      : "Repair the persisted replay storyline or frame index before relying on replay mode.",
    status: replaySelection.valid ? "ok" : "error",
    summary: replaySelection.valid
      ? `Replay mode resolves storyline "${replaySelection.resolvedStorylineId}" at frame ${replaySelection.frameIndex}.`
      : "Replay mode selection is invalid.",
  });

  const modeResolution = operatingModes.map((mode) => {
    try {
      return buildModeResolution(mode);
    } catch (error) {
      return {
        degradedSourceCount: 0,
        error:
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
              }
            : { value: String(error) },
        frameIndex: null,
        mode,
        sourceCounts: {
          degraded: 0,
          healthy: 0,
          offline: 0,
        },
        status: "error" as const,
        storylineId: null,
      };
    }
  });

  checks.push({
    details: {
      modes: modeResolution,
    },
    name: "mode-resolution",
    operatorHint: modeResolution.some((item) => item.status === "error")
      ? "Inspect the failing mode snapshot path before serving operator traffic."
      : undefined,
    status: modeResolution.every((item) => item.status === "ok")
      ? "ok"
      : "error",
    summary: modeResolution.every((item) => item.status === "ok")
      ? "Demo, replay, and live mode snapshots all resolved."
      : "One or more mode snapshots failed to resolve.",
  });

  const liveResolution = modeResolution.find((item) => item.mode === "live");
  const payload = {
    ...buildBaseHealthMetadata(),
    checks,
    status: checks.every((check) => check.status === "ok")
      ? ("ok" as const)
      : ("error" as const),
    summary: {
      database: {
        appStateKeys: dbHealth.appStateKeys,
        counts: dbHealth.counts,
        path: dbHealth.path,
        schemaVersion: dbHealth.schemaVersion,
        status: dbHealth.status,
      },
      liveSources: liveResolution?.sourceCounts ?? {
        degraded: 0,
        healthy: 0,
        offline: 0,
      },
      modes: modeResolution,
      selections: {
        demo: demoSelection,
        replay: replaySelection,
      },
      storylineCount: dbHealth.counts.storylineCount,
    },
  };

  logger.debug({ readiness: payload }, "Computed readiness payload.");

  return payload;
}
