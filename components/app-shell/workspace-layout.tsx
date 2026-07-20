import type { ReactNode } from 'react';

import { AppHeader } from '@/components/app-shell/app-header';
import { WorkflowStepper, type WorkflowStepId } from '@/components/app-shell/workflow-stepper';
import type { QuoteStatus } from '@/lib/domain/quote-statuses';
import { cn } from '@/lib/utils';

export interface WorkspaceLayoutProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  currentStep?: WorkflowStepId;
  status?: QuoteStatus;
}

export function WorkspaceLayout({ children, className, contentClassName, currentStep, status }: WorkspaceLayoutProps) {
  return (
    <div className={cn('min-h-screen bg-slate-50 text-slate-950', className)}>
      <AppHeader />
      <WorkflowStepper currentStep={currentStep} status={status} />
      <main className={cn('mx-auto w-full max-w-[1440px] px-6 py-6 lg:px-7', contentClassName)}>{children}</main>
    </div>
  );
}
