import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useAppStore } from "../../app/store";
import {
  ErrorState,
  InlineAlert,
  LoadingState,
} from "../../components/ErrorState";
import { PageFrame } from "../../components/PageFrame";
import { Badge, Panel, SectionTitle } from "../../components/Primitives";
import {
  getDiagnostics,
  getLiveHealth,
  getModes,
  getReadyHealth,
  setDemoStoryline,
  setReplaySelection,
} from "../../data/api";

export function SettingsPage() {
  const { mode, setMode } = useAppStore();
  const queryClient = useQueryClient();
  const [actionMessage, setActionMessage] = useState<{
    message: string;
    tone: "critical" | "positive";
  } | null>(null);

  const modes = useQuery({
    queryKey: ["modes"],
    queryFn: getModes,
  });
  const diagnostics = useQuery({
    queryKey: ["diagnostics", mode],
    queryFn: () => getDiagnostics(mode),
  });
  const liveHealth = useQuery({
    queryKey: ["health-live"],
    queryFn: getLiveHealth,
  });
  const readyHealth = useQuery({
    queryKey: ["health-ready"],
    queryFn: getReadyHealth,
  });

  const demoMutation = useMutation({
    mutationFn: (storylineId: string) => setDemoStoryline(storylineId),
    onError: (error) => {
      setActionMessage({
        message:
          error instanceof Error
            ? error.message
            : "Demo storyline update failed.",
        tone: "critical",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["modes"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      await queryClient.invalidateQueries({ queryKey: ["diagnostics"] });
      await queryClient.invalidateQueries({ queryKey: ["health-ready"] });
      setActionMessage({
        message: "Demo storyline updated.",
        tone: "positive",
      });
    },
  });

  const replayMutation = useMutation({
    mutationFn: (payload: { storylineId: string; frameIndex: number }) =>
      setReplaySelection(payload.storylineId, payload.frameIndex),
    onError: (error) => {
      setActionMessage({
        message:
          error instanceof Error
            ? error.message
            : "Replay selection update failed.",
        tone: "critical",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["modes"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      await queryClient.invalidateQueries({ queryKey: ["diagnostics"] });
      await queryClient.invalidateQueries({ queryKey: ["event"] });
      await queryClient.invalidateQueries({ queryKey: ["health-ready"] });
      setActionMessage({
        message: "Replay selection updated.",
        tone: "positive",
      });
    },
  });

  if (
    modes.isLoading ||
    diagnostics.isLoading ||
    liveHealth.isLoading ||
    readyHealth.isLoading ||
    (!modes.data && !modes.isError) ||
    (!diagnostics.data && !diagnostics.isError) ||
    (!liveHealth.data && !liveHealth.isError) ||
    (!readyHealth.data && !readyHealth.isError)
  ) {
    return <LoadingState message="Loading settings…" />;
  }

  if (
    modes.isError ||
    diagnostics.isError ||
    !modes.data ||
    !diagnostics.data
  ) {
    return (
      <PageFrame
        aside={
          <Panel>
            <SectionTitle
              eyebrow="Fallback"
              title="Diagnostics unavailable"
              body="Mode and diagnostics data failed, but the shell is still intact."
            />
          </Panel>
        }
      >
        <ErrorState
          description="Mode, fixture, or diagnostics data could not be loaded."
          error={modes.error ?? diagnostics.error}
          onAction={() => {
            void modes.refetch();
            void diagnostics.refetch();
          }}
          title="Settings failed to load"
        />
      </PageFrame>
    );
  }

  return (
    <PageFrame
      aside={
        <Panel>
          <SectionTitle
            eyebrow="Environment"
            title="Current storage and warnings"
          />
          <p className="muted">{diagnostics.data.data.storage.path}</p>
          <div className="stack">
            <div className="note-card">
              <h3>SQLite health</h3>
              <p>
                Schema v
                {diagnostics.data.data.storage.schemaVersion ?? "unknown"} ·{" "}
                {diagnostics.data.data.storage.integrityStatus}
              </p>
            </div>
            {diagnostics.data.data.warnings.length === 0 ? (
              <Badge tone="positive">No active warnings</Badge>
            ) : (
              diagnostics.data.data.warnings.map((warning) => (
                <div className="note-card" key={warning.sourceId}>
                  <h3>{warning.sourceId}</h3>
                  <p>{warning.message}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      }
    >
      <section className="hero-strip">
        <div>
          <div className="eyebrow">Settings / Sources / Diagnostics</div>
          <h1>Mode and fixture control</h1>
          <p>Switch demo, replay, and live views without losing provenance.</p>
        </div>
      </section>

      {actionMessage ? (
        <InlineAlert
          message={actionMessage.message}
          tone={actionMessage.tone}
        />
      ) : null}

      <Panel>
        <SectionTitle
          eyebrow="Operating Mode"
          title="Pick the console posture"
        />
        <div className="mode-grid">
          {modes.data.data.supportedModes.map((item) => (
            <button
              className={`mode-card ${mode === item ? "mode-card-active" : ""}`}
              key={item}
              onClick={() => setMode(item)}
            >
              <strong>{item}</strong>
              <span>
                {item === "demo"
                  ? "Curated fixtures for presentation-safe flow."
                  : item === "replay"
                    ? "Step through the storyline frame by frame."
                    : "Latest normalized snapshot with degraded-source honesty."}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle eyebrow="Fixture Selection" title="Storylines" />
        <div className="stack">
          {diagnostics.data.data.fixtures.map((storyline) => (
            <div className="fixture-row" key={storyline.id}>
              <div>
                <strong>{storyline.name}</strong>
                <p>{storyline.description}</p>
              </div>
              <div className="fixture-actions">
                <button
                  className="ghost-button"
                  disabled={demoMutation.isPending}
                  onClick={() => demoMutation.mutate(storyline.id)}
                >
                  {demoMutation.isPending ? "Setting demo…" : "Set demo"}
                </button>
                <button
                  className="ghost-button"
                  disabled={replayMutation.isPending}
                  onClick={() =>
                    replayMutation.mutate({
                      storylineId: storyline.id,
                      frameIndex: storyline.defaultFrameIndex,
                    })
                  }
                >
                  {replayMutation.isPending ? "Setting replay…" : "Set replay"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <SectionTitle
          eyebrow="Operational Health"
          title="Liveness and readiness"
        />
        <div className="stack">
          {liveHealth.isError ? (
            <InlineAlert
              message={
                liveHealth.error instanceof Error
                  ? liveHealth.error.message
                  : "Liveness probe failed."
              }
            />
          ) : liveHealth.data ? (
            <div className="health-row">
              <div>
                <div className="health-name">Liveness</div>
                <div className="muted">
                  Uptime {Math.round(liveHealth.data.uptimeMs / 1000)}s
                </div>
              </div>
              <div className="health-meta">
                <Badge tone="positive">{liveHealth.data.status}</Badge>
              </div>
            </div>
          ) : null}

          {readyHealth.isError ? (
            <InlineAlert
              message={
                readyHealth.error instanceof Error
                  ? readyHealth.error.message
                  : "Readiness probe failed."
              }
            />
          ) : readyHealth.data ? (
            <>
              <div className="health-row">
                <div>
                  <div className="health-name">Readiness</div>
                  <div className="muted">
                    {readyHealth.data.status === "ok"
                      ? "All runtime checks are passing."
                      : "One or more runtime checks are failing."}
                  </div>
                </div>
                <div className="health-meta">
                  <Badge
                    tone={
                      readyHealth.data.status === "ok" ? "positive" : "critical"
                    }
                  >
                    {readyHealth.data.status}
                  </Badge>
                </div>
              </div>
              <div className="stack">
                {readyHealth.data.checks.map((check) => (
                  <div className="note-card" key={check.name}>
                    <div className="health-row">
                      <strong>{check.name}</strong>
                      <Badge
                        tone={check.status === "ok" ? "positive" : "critical"}
                      >
                        {check.status}
                      </Badge>
                    </div>
                    <p>{check.summary}</p>
                    {check.operatorHint ? (
                      <p className="muted">{check.operatorHint}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <SectionTitle eyebrow="Source Diagnostics" title="Adapter health" />
        <div className="stack">
          {diagnostics.data.data.sources.map((source) => (
            <div className="health-row" key={source.sourceId}>
              <div>
                <div className="health-name">{source.sourceId}</div>
                <div className="muted">{source.message}</div>
              </div>
              <div className="health-meta">
                <Badge
                  tone={
                    source.status === "healthy"
                      ? "positive"
                      : source.status === "degraded"
                        ? "warning"
                        : "critical"
                  }
                >
                  {source.status}
                </Badge>
                <span>{Math.round(source.lagMs / 1000)}s lag</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}
