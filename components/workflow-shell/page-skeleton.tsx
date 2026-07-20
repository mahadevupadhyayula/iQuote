import { cn } from '@/lib/utils';

interface SkeletonBlockProps {
  className?: string;
}

function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div
      className={cn('rounded-md bg-slate-200/80 motion-safe:animate-pulse motion-reduce:animate-none', className)}
      aria-hidden="true"
    />
  );
}

export interface PageSkeletonProps {
  title?: string;
  className?: string;
}

export function PageSkeleton({ title = 'Loading quote workspace', className }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)} role="status" aria-label={title} aria-busy="true">
      <div className="rounded-xl border border-slate-200 bg-card p-5 shadow-card sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-28" />
            <SkeletonBlock className="h-8 w-72 max-w-full" />
            <SkeletonBlock className="h-4 w-96 max-w-full" />
          </div>
          <div className="flex gap-2">
            <SkeletonBlock className="h-9 w-24" />
            <SkeletonBlock className="h-9 w-28" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          {[0, 1].map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 bg-card p-5 shadow-card sm:p-6">
              <div className="mb-5 flex items-start gap-3">
                <SkeletonBlock className="h-9 w-9 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-5 w-44" />
                  <SkeletonBlock className="h-4 w-64 max-w-full" />
                </div>
              </div>
              <div className="space-y-3">
                <SkeletonBlock className="h-12 w-full" />
                <SkeletonBlock className="h-12 w-full" />
                <SkeletonBlock className="h-12 w-5/6" />
              </div>
            </div>
          ))}
        </div>

        <aside className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-5 shadow-card sm:p-6">
            <SkeletonBlock className="mb-4 h-5 w-36" />
            <div className="space-y-3">
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-4/5" />
              <SkeletonBlock className="h-2 w-full rounded-full" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-card p-5 shadow-card sm:p-6">
            <SkeletonBlock className="mb-4 h-5 w-32" />
            <div className="space-y-4">
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-10 w-3/4" />
            </div>
          </div>
        </aside>
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}
