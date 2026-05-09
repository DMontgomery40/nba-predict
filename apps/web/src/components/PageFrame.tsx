import type { PropsWithChildren, ReactNode } from "react";

export function PageFrame({
  children,
  aside,
}: PropsWithChildren<{ aside?: ReactNode }>) {
  const hasAside = aside !== undefined && aside !== null;

  return (
    <div className={`page-frame ${hasAside ? "" : "page-frame-single"}`}>
      <div className="page-main">{children}</div>
      {hasAside ? <aside className="page-aside">{aside}</aside> : null}
    </div>
  );
}
