import type { ReactNode } from 'react';
import { AlertTriangle, CircleAlert } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface ErrorBannerProps {
  title: string;
  description?: ReactNode;
  severity?: 'warning' | 'error';
  action?: ReactNode;
}

export function ErrorBanner({ title, description, severity = 'error', action }: ErrorBannerProps) {
  const Icon = severity === 'warning' ? AlertTriangle : CircleAlert;

  return (
    <Alert variant={severity === 'warning' ? 'warning' : 'destructive'}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <AlertTitle>{title}</AlertTitle>
          {description ? <AlertDescription>{description}</AlertDescription> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </Alert>
  );
}
