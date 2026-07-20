import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, icon, trailing, className }: SectionHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-primary"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold leading-6 text-foreground">{title}</h2>
          {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {trailing ? <div className="shrink-0 sm:pt-1">{trailing}</div> : null}
    </header>
  );
}
