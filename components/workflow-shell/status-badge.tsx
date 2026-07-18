import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

export const statusBadgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none',
  {
    variants: {
      variant: {
        neutral: 'border-badge-muted-border bg-badge-muted text-badge-muted-foreground',
        info: 'border-badge-info-border bg-badge-info text-badge-info-foreground',
        success: 'border-badge-success-border bg-badge-success text-badge-success-foreground',
        warning: 'border-badge-warning-border bg-badge-warning text-badge-warning-foreground',
        danger: 'border-badge-destructive-border bg-badge-destructive text-badge-destructive-foreground',
        blocked: 'border-destructive bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  },
);

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusBadgeVariants> {}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(({ className, variant, children, ...props }, ref) => (
  <span ref={ref} className={cn(statusBadgeVariants({ variant }), className)} {...props}>
    {children}
  </span>
));
StatusBadge.displayName = 'StatusBadge';
