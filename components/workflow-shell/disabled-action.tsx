import * as React from 'react';

import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DisabledActionProps extends Omit<ButtonProps, 'disabled' | 'aria-describedby'> {
  reason: React.ReactNode;
  reasonId?: string;
  showReason?: boolean;
}

export const DisabledAction = React.forwardRef<HTMLButtonElement, DisabledActionProps>(
  ({ children, reason, reasonId, showReason = true, className, ...props }, ref) => {
    const generatedId = React.useId();
    const descriptionId = reasonId ?? `disabled-action-${generatedId}`;

    return (
      <span className="inline-flex flex-col items-start gap-1.5">
        <Button ref={ref} disabled aria-describedby={descriptionId} className={cn('cursor-not-allowed', className)} {...props}>
          {children}
        </Button>
        <span id={descriptionId} className={cn('max-w-xs text-xs leading-5 text-muted-foreground', !showReason && 'sr-only')}>
          {reason}
        </span>
      </span>
    );
  },
);
DisabledAction.displayName = 'DisabledAction';
