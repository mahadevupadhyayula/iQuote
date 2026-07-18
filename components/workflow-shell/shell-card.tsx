import * as React from 'react';

import { cn } from '@/lib/utils';

export interface ShellCardProps extends React.HTMLAttributes<HTMLDivElement> {
  surface?: 'default' | 'muted' | 'blue';
}

const surfaceStyles: Record<NonNullable<ShellCardProps['surface']>, string> = {
  default: 'border-border bg-card',
  muted: 'border-slate-200 bg-slate-50/80',
  blue: 'border-blue-100 bg-blue-50/70',
};

export const ShellCard = React.forwardRef<HTMLDivElement, ShellCardProps>(({ className, surface = 'default', ...props }, ref) => (
  <section
    ref={ref}
    className={cn(
      'rounded-xl border p-5 text-card-foreground shadow-card sm:p-6',
      surfaceStyles[surface],
      className,
    )}
    {...props}
  />
));
ShellCard.displayName = 'ShellCard';
