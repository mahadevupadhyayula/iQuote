import * as React from 'react';
import { AlertTriangle, Clock3, ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/workflow-shell/status-badge';

export type SlaTimerState = 'info' | 'warning' | 'danger';

export interface SlaTimerProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  dueAt: string;
  remainingLabel: string;
  state: SlaTimerState;
  isPaused?: boolean;
}

const stateMeta: Record<SlaTimerState, { label: string; badge: React.ComponentProps<typeof StatusBadge>['variant']; className: string; icon: React.ReactNode }> = {
  info: { label: 'On track', badge: 'info', className: 'border-blue-100 bg-blue-50 text-blue-900', icon: <Clock3 className="h-5 w-5" aria-hidden="true" /> },
  warning: { label: 'Approaching SLA', badge: 'warning', className: 'border-amber-200 bg-amber-50 text-amber-950', icon: <AlertTriangle className="h-5 w-5" aria-hidden="true" /> },
  danger: { label: 'SLA at risk', badge: 'danger', className: 'border-red-200 bg-red-50 text-red-950', icon: <ShieldAlert className="h-5 w-5" aria-hidden="true" /> },
};

const formatDueAt = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
};

export function SlaTimer({ label, dueAt, remainingLabel, state, isPaused = false, className, ...props }: SlaTimerProps) {
  const meta = stateMeta[state];

  return (
    <div className={cn('rounded-xl border p-4 shadow-card', meta.className, className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70">{meta.icon}</span>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-2xl font-bold leading-tight">{remainingLabel}</p>
          </div>
        </div>
        <StatusBadge variant={isPaused ? 'neutral' : meta.badge}>{isPaused ? 'Paused' : meta.label}</StatusBadge>
      </div>
      <p className="mt-3 text-sm">Due {formatDueAt(dueAt)}</p>
    </div>
  );
}
