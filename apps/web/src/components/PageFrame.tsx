import type { PropsWithChildren, ReactNode } from "react";

export function PageFrame({
  children,
  aside,
}: PropsWithChildren<{ aside: ReactNode }>) {
  return (
    <div className="page-frame">
      <div className="page-main">{children}</div>
      <aside className="page-aside">{aside}</aside>
    </div>
  );
}
