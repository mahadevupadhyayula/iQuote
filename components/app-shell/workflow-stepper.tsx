import { AlertTriangle, Ban, Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { QuoteStatus } from '@/lib/domain/quote-statuses';

export const workflowSteps = [
  { id: 'intake', label: 'Intake' },
  { id: 'review', label: 'Review' },
  { id: 'resolve-exceptions', label: 'Resolve Exceptions' },
  { id: 'generate-quote', label: 'Generate Quote' },
] as const;

export type WorkflowStepId = (typeof workflowSteps)[number]['id'];

export type WorkflowStepVisualState = 'upcoming' | 'active' | 'complete' | 'warning' | 'blocked';

type FixtureWorkflowStepState = WorkflowStepVisualState | 'current';

export interface WorkflowStepperStep {
  id: WorkflowStepId;
  label: string;
  description?: string;
  state?: FixtureWorkflowStepState;
}

export const quoteStatusToWorkflowStep: Record<QuoteStatus, WorkflowStepId> = {
  draft: 'intake',
  extracting: 'intake',
  needs_information: 'resolve-exceptions',
  configuring: 'generate-quote',
  pending_approval: 'review',
  approved: 'generate-quote',
  sent: 'generate-quote',
  accepted: 'generate-quote',
  rejected: 'resolve-exceptions',
  expired: 'resolve-exceptions',
  cancelled: 'resolve-exceptions',
};

const stateStyles: Record<WorkflowStepVisualState, { indicator: string; label: string; connector: string }> = {
  upcoming: {
    indicator: 'border-border bg-background text-muted-foreground',
    label: 'text-slate-700',
    connector: 'bg-border',
  },
  active: {
    indicator: 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30',
    label: 'text-primary',
    connector: 'bg-primary/30',
  },
  complete: {
    indicator: 'border-success bg-success-soft text-success',
    label: 'text-success',
    connector: 'bg-success/30',
  },
  warning: {
    indicator: 'border-warning bg-warning-soft text-warning',
    label: 'text-warning',
    connector: 'bg-warning/30',
  },
  blocked: {
    indicator: 'border-destructive bg-destructive-soft text-destructive',
    label: 'text-destructive',
    connector: 'bg-destructive/30',
  },
};

export interface WorkflowStepperProps {
  currentStep?: WorkflowStepId;
  status?: QuoteStatus;
  steps?: readonly WorkflowStepperStep[];
  className?: string;
}

export function getWorkflowStepForQuoteStatus(status: QuoteStatus): WorkflowStepId {
  return quoteStatusToWorkflowStep[status];
}

function normalizeStepState(state: FixtureWorkflowStepState | undefined): WorkflowStepVisualState | undefined {
  if (state === 'current') return 'active';

  return state;
}

function getDerivedStepState(index: number, activeIndex: number): WorkflowStepVisualState {
  if (index < activeIndex) return 'complete';
  if (index === activeIndex) return 'active';

  return 'upcoming';
}

function getStepContent(state: WorkflowStepVisualState, index: number) {
  if (state === 'complete') return <Check className="h-4 w-4" aria-hidden="true" />;
  if (state === 'warning') return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  if (state === 'blocked') return <Ban className="h-4 w-4" aria-hidden="true" />;

  return index + 1;
}

export function WorkflowStepper({ currentStep, status = 'draft', steps = workflowSteps, className }: WorkflowStepperProps) {
  const activeStep = currentStep ?? getWorkflowStepForQuoteStatus(status);
  const activeIndex = steps.findIndex((step) => step.id === activeStep);
  const safeActiveIndex = activeIndex === -1 ? 0 : activeIndex;

  return (
    <nav aria-label="Quote workflow" className={cn('border-b bg-background', className)}>
      <ol className="mx-auto grid max-w-[1440px] grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-4 lg:px-7">
        {steps.map((step, index) => {
          const state = normalizeStepState(step.state) ?? getDerivedStepState(index, safeActiveIndex);
          const styles = stateStyles[state];
          const isActive = state === 'active';

          return (
            <li key={step.id} className="flex items-center gap-4" aria-current={isActive ? 'step' : undefined}>
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                  styles.indicator,
                )}
              >
                {getStepContent(state, index)}
              </div>
              <span className="min-w-0">
                <span className={cn('block whitespace-nowrap text-sm font-semibold', styles.label)}>{step.label}</span>
                {step.description ? <span className="block truncate text-xs text-muted-foreground">{step.description}</span> : null}
              </span>
              {index < steps.length - 1 ? <div className={cn('hidden h-px flex-1 xl:block', styles.connector)} /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
