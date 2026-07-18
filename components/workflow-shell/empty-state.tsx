import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div className={cn('rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-6 text-center', className)}>
      <div className="mx-auto flex max-w-md flex-col items-center gap-3">
        {icon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-background text-muted-foreground" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="pt-1">{action}</div> : null}
      </div>
    </div>
  );
}
