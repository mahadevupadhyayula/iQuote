import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { QuoteStatus } from '@/lib/domain/quote-statuses';

export const workflowSteps = [
  { id: 'intake', label: 'Intake' },
  { id: 'review', label: 'Review' },
  { id: 'resolve-exceptions', label: 'Resolve Exceptions' },
  { id: 'generate-quote', label: 'Generate Quote' },
] as const;

export type WorkflowStepId = (typeof workflowSteps)[number]['id'];

export const quoteStatusToWorkflowStep: Record<QuoteStatus, WorkflowStepId> = {
  draft: 'intake',
  needs_information: 'resolve-exceptions',
  pending_approval: 'review',
  approved: 'generate-quote',
  sent: 'generate-quote',
  accepted: 'generate-quote',
  rejected: 'resolve-exceptions',
  expired: 'resolve-exceptions',
  cancelled: 'resolve-exceptions',
};

export interface WorkflowStepperProps {
  currentStep?: WorkflowStepId;
  status?: QuoteStatus;
  className?: string;
}

export function getWorkflowStepForQuoteStatus(status: QuoteStatus): WorkflowStepId {
  return quoteStatusToWorkflowStep[status];
}

export function WorkflowStepper({ currentStep, status = 'draft', className }: WorkflowStepperProps) {
  const activeStep = currentStep ?? getWorkflowStepForQuoteStatus(status);
  const activeIndex = workflowSteps.findIndex((step) => step.id === activeStep);

  return (
    <nav aria-label="Quote workflow" className={cn('border-b bg-background', className)}>
      <ol className="mx-auto grid max-w-[1440px] grid-cols-1 gap-3 px-6 py-5 sm:grid-cols-4 lg:px-7">
        {workflowSteps.map((step, index) => {
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;

          return (
            <li key={step.id} className="flex items-center gap-4">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                  isActive && 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30',
                  isComplete && 'border-primary bg-primary/10 text-primary',
                  !isActive && !isComplete && 'border-border bg-background text-muted-foreground',
                )}
              >
                {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </div>
              <span className={cn('whitespace-nowrap text-sm font-semibold', isActive ? 'text-primary' : 'text-slate-700')}>
                {step.label}
              </span>
              {index < workflowSteps.length - 1 ? <div className="hidden h-px flex-1 bg-border xl:block" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
