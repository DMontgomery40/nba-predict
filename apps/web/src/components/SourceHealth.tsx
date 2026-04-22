import { Badge, Panel, SectionTitle } from "./Primitives";

export function SourceHealthPanel({
  title = "Source Health",
  sources,
}: {
  title?: string;
  sources: Array<{
    sourceId: string;
    status: string;
    lagMs: number;
    message: string;
  }>;
}) {
  return (
    <Panel>
      <SectionTitle eyebrow="Diagnostics" title={title} />
      <div className="stack">
        {sources.map((source) => (
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
  );
}
