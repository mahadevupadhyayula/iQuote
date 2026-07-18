import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({ title, description, action, className }: ErrorStateProps) {
  return (
    <div className={cn('rounded-xl border border-destructive/30 bg-destructive-soft px-6 py-8 text-center text-destructive', className)} role="alert">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-destructive/30 bg-background" aria-hidden="true">
          <CircleAlert className="h-5 w-5" />
        </span>
        <div className="space-y-2">
          <h3 className="text-base font-semibold">{title}</h3>
          {description ? <p className="text-sm leading-6 text-destructive/85">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
    </div>
  );
}
