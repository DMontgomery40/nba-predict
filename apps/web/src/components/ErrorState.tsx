import { Badge, Panel, SectionTitle } from "./Primitives";
import { isApiRequestError } from "../data/api";

function getErrorSummary(error: unknown, fallback: string) {
  if (isApiRequestError(error)) {
    return {
      message: error.message,
      operatorHint: error.operatorHint,
      requestId: error.requestId,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      operatorHint: undefined,
      requestId: undefined,
    };
  }

  return {
    message: fallback,
    operatorHint: undefined,
    requestId: undefined,
  };
}

export function LoadingState({ message }: { message: string }) {
  return <div className="loading-panel">{message}</div>;
}

export function InlineAlert({
  message,
  tone = "critical",
}: {
  message: string;
  tone?: "critical" | "positive" | "warning";
}) {
  return (
    <div className={`inline-alert inline-alert-${tone}`}>
      <Badge tone={tone}>{tone}</Badge>
      <span>{message}</span>
    </div>
  );
}

export function ErrorState({
  actionLabel = "Retry",
  description,
  error,
  onAction,
  title,
}: {
  actionLabel?: string;
  description: string;
  error?: unknown;
  onAction?: () => void;
  title: string;
}) {
  const summary = getErrorSummary(error, description);

  return (
    <Panel className="error-panel">
      <SectionTitle eyebrow="Failure State" title={title} body={description} />
      <div className="stack">
        <div className="note-card">
          <h3>What failed</h3>
          <p>{summary.message}</p>
        </div>
        {summary.operatorHint ? (
          <div className="note-card">
            <h3>Operator hint</h3>
            <p>{summary.operatorHint}</p>
          </div>
        ) : null}
        {summary.requestId ? (
          <div className="muted">Request ID: {summary.requestId}</div>
        ) : null}
      </div>
      {onAction ? (
        <button className="primary-button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </Panel>
  );
}
