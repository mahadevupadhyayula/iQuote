import * as React from 'react';
import { Database, PackageCheck, ShieldCheck, Timer } from 'lucide-react';

import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/workflow-shell/status-badge';

export type SourceConfidence = 'high' | 'medium' | 'low' | 'needs-review';

export interface SourceIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  priceSource: string;
  inventoryRefresh: string;
  confidence: SourceConfidence;
  quotedAt?: string;
  updatedAt?: string;
  generatedAt?: string;
}

const confidenceMeta: Record<SourceConfidence, { label: string; variant: React.ComponentProps<typeof StatusBadge>['variant'] }> = {
  high: { label: 'High confidence', variant: 'success' },
  medium: { label: 'Medium confidence', variant: 'info' },
  low: { label: 'Low confidence', variant: 'warning' },
  'needs-review': { label: 'Needs review', variant: 'danger' },
};

const formatTimestamp = (value?: string) => {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export function SourceIndicator({
  priceSource,
  inventoryRefresh,
  confidence,
  quotedAt,
  updatedAt,
  generatedAt,
  className,
  ...props
}: SourceIndicatorProps) {
  const confidenceState = confidenceMeta[confidence];
  const timestamps = [
    { label: 'Quoted', value: quotedAt },
    { label: 'Updated', value: updatedAt },
    { label: 'Generated', value: generatedAt },
  ];

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 text-card-foreground shadow-card', className)} {...props}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Source metadata</p>
          <p className="text-xs text-muted-foreground">Commercial inputs are traceable to controlled systems.</p>
        </div>
        <StatusBadge variant={confidenceState.variant}>{confidenceState.label}</StatusBadge>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <dt className="flex items-center gap-2 font-medium text-slate-600"><Database className="h-4 w-4" aria-hidden="true" />Price source</dt>
          <dd className="mt-1 font-semibold text-slate-950">{priceSource}</dd>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <dt className="flex items-center gap-2 font-medium text-slate-600"><PackageCheck className="h-4 w-4" aria-hidden="true" />Inventory refresh</dt>
          <dd className="mt-1 font-semibold text-slate-950">{inventoryRefresh}</dd>
        </div>
      </dl>

      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        {timestamps.map((timestamp) => (
          <div key={timestamp.label} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
            {timestamp.label === 'Generated' ? <ShieldCheck className="h-4 w-4" aria-hidden="true" /> : <Timer className="h-4 w-4" aria-hidden="true" />}
            <span><span className="font-medium text-foreground">{timestamp.label}:</span> {formatTimestamp(timestamp.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
