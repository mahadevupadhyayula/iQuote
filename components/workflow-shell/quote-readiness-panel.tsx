import * as React from 'react';
import { AlertCircle, Ban, CheckCircle2, CircleDashed } from 'lucide-react';

import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/workflow-shell/status-badge';

export type QuoteReadinessState = 'complete' | 'warning' | 'blocked' | 'pending';

export interface QuoteReadinessItem {
  id: string;
  label: string;
  description?: string;
  state: QuoteReadinessState;
}

export interface QuoteReadinessPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  items: readonly QuoteReadinessItem[];
}

const stateMeta: Record<QuoteReadinessState, { label: string; badge: React.ComponentProps<typeof StatusBadge>['variant']; icon: React.ReactNode; iconClassName: string }> = {
  complete: { label: 'Complete', badge: 'success', icon: <CheckCircle2 className="h-5 w-5" aria-hidden="true" />, iconClassName: 'text-emerald-600' },
  warning: { label: 'Warning', badge: 'warning', icon: <AlertCircle className="h-5 w-5" aria-hidden="true" />, iconClassName: 'text-amber-600' },
  blocked: { label: 'Blocked', badge: 'blocked', icon: <Ban className="h-5 w-5" aria-hidden="true" />, iconClassName: 'text-red-600' },
  pending: { label: 'Pending', badge: 'neutral', icon: <CircleDashed className="h-5 w-5" aria-hidden="true" />, iconClassName: 'text-slate-500' },
};

export function QuoteReadinessPanel({
  title = 'Quote readiness',
  description = 'Checklist of controlled requirements before quote generation.',
  items,
  className,
  ...props
}: QuoteReadinessPanelProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card', className)} {...props}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item) => {
          const meta = stateMeta[item.state];
          return (
            <li key={item.id} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <span className={cn('mt-0.5 shrink-0', meta.iconClassName)}>{meta.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-950">{item.label}</p>
                  <StatusBadge variant={meta.badge}>{meta.label}</StatusBadge>
                </div>
                {item.description ? <p className="mt-1 text-sm text-slate-600">{item.description}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
