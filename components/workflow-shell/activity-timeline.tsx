import * as React from 'react';

import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/workflow-shell/status-badge';

export type ActivityTimelineTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export interface ActivityTimelineItem {
  id: string;
  title: string;
  timestamp: string;
  description?: string;
  actorLabel?: string;
  sourceLabel?: string;
  tone?: ActivityTimelineTone;
}

export interface ActivityTimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  items: readonly ActivityTimelineItem[];
}

const toneMeta: Record<ActivityTimelineTone, { label: string; badge: React.ComponentProps<typeof StatusBadge>['variant']; marker: string }> = {
  neutral: { label: 'Recorded', badge: 'neutral', marker: 'border-slate-300 bg-slate-500' },
  info: { label: 'Info', badge: 'info', marker: 'border-blue-200 bg-blue-600' },
  success: { label: 'Complete', badge: 'success', marker: 'border-emerald-200 bg-emerald-600' },
  warning: { label: 'Warning', badge: 'warning', marker: 'border-amber-200 bg-amber-500' },
  danger: { label: 'Blocked', badge: 'danger', marker: 'border-red-200 bg-red-600' },
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
};

export function ActivityTimeline({ title = 'Activity timeline', items, className, ...props }: ActivityTimelineProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-5 text-card-foreground shadow-card', className)} {...props}>
      <h2 className="text-base font-semibold">{title}</h2>
      <ol className="mt-5 flex flex-col gap-4 md:flex-row md:gap-0">
        {items.map((item, index) => {
          const meta = toneMeta[item.tone ?? 'neutral'];
          return (
            <li key={item.id} className="relative flex gap-3 border-l border-slate-200 pl-4 md:flex-1 md:border-l-0 md:border-t md:pl-0 md:pt-5">
              <span className={cn('absolute -left-2 top-0 h-4 w-4 rounded-full border-2 md:-top-2 md:left-0', meta.marker)} aria-hidden="true" />
              <div className={cn('min-w-0 md:pr-4', index > 0 && 'md:pl-1')}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-950">{item.title}</p>
                  <StatusBadge variant={meta.badge}>{meta.label}</StatusBadge>
                </div>
                <time className="mt-1 block text-xs font-medium text-muted-foreground" dateTime={item.timestamp}>{formatTimestamp(item.timestamp)}</time>
                {item.description ? <p className="mt-2 text-sm text-slate-600">{item.description}</p> : null}
                {(item.actorLabel || item.sourceLabel) ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.actorLabel ? `Actor: ${item.actorLabel}` : null}{item.actorLabel && item.sourceLabel ? ' · ' : null}{item.sourceLabel ? `Source: ${item.sourceLabel}` : null}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
