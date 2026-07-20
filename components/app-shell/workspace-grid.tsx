import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface WorkspaceGridProps {
  left?: ReactNode;
  main: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
  className?: string;
}

export function WorkspaceGrid({
  left,
  main,
  right,
  bottom,
  className,
}: WorkspaceGridProps) {
  return (
    <div
      className={cn(
        "grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)_350px]",
        className,
      )}
    >
      {left ? <aside className="space-y-5 lg:col-start-1">{left}</aside> : null}
      <section
        className={cn(
          "min-w-0 space-y-5",
          left ? "lg:col-start-2" : "lg:col-start-1 lg:col-span-2",
          !right ? "lg:col-span-2" : null,
          !left && !right ? "lg:col-span-3" : null,
        )}
      >
        {main}
      </section>
      {right ? (
        <aside className="space-y-5 lg:col-start-3">{right}</aside>
      ) : null}
      {bottom ? (
        <section className="min-w-0 space-y-5 lg:col-span-3">{bottom}</section>
      ) : null}
    </div>
  );
}
