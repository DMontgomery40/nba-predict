import { cx } from "@signal-console/ui";

import type { HTMLAttributes, PropsWithChildren } from "react";

export function Panel({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <section className={cx("panel", className)} {...props}>
      {children}
    </section>
  );
}

export function Badge({
  tone,
  children,
}: PropsWithChildren<{
  tone?: "neutral" | "positive" | "warning" | "critical";
}>) {
  return (
    <span className={cx("badge", tone ? `badge-${tone}` : undefined)}>
      {children}
    </span>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) {
  return (
    <header className="section-title">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
    </header>
  );
}

export function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "warning";
}) {
  return (
    <div
      className={cx(
        "metric-tile",
        tone !== "neutral" ? `metric-${tone}` : undefined
      )}
    >
      <div className="eyebrow">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

export function ProbabilityPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: number | null;
  highlight?: boolean;
}) {
  return (
    <div
      className={cx(
        "probability-pill",
        highlight && "probability-pill-highlight"
      )}
    >
      <span>{label}</span>
      <strong>{value == null ? "n/a" : `${(value * 100).toFixed(1)}%`}</strong>
    </div>
  );
}
