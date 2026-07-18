import { Bell, ChevronDown, HelpCircle, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface AppHeaderProps {
  className?: string;
  title?: string;
  userName?: string;
  userRole?: string;
}

function QuoteLogo() {
  return (
    <div className="relative h-11 w-11 shrink-0 rounded-2xl bg-primary/10 p-2" aria-hidden="true">
      <div className="h-full w-full rounded-full bg-gradient-to-br from-primary to-cyan-400" />
      <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
      <div className="absolute right-2 top-2 h-3 w-3 rounded-full bg-background" />
    </div>
  );
}

export function AppHeader({
  className,
  title = 'Intelligent Quote Workspace',
  userName = 'Michael Anderson',
  userRole = 'Sales Representative',
}: AppHeaderProps) {
  return (
    <header className={cn('border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80', className)}>
      <div className="mx-auto flex h-20 max-w-[1440px] items-center gap-6 px-6 lg:px-7">
        <div className="flex min-w-fit items-center gap-4">
          <QuoteLogo />
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
        </div>

        <div className="mx-auto hidden w-full max-w-[486px] md:block">
          <label className="sr-only" htmlFor="app-shell-search">
            Search quotes, customers, products
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <Input
              id="app-shell-search"
              type="search"
              placeholder="Search quotes, customers, products..."
              className="h-12 rounded-xl border-slate-200 bg-white pl-12 pr-16 shadow-sm"
            />
            <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 sm:inline-flex">
              ⌘ K
            </kbd>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button type="button" className="rounded-full p-2 text-slate-900 hover:bg-accent" aria-label="Notifications">
            <Bell className="h-5 w-5" />
          </button>
          <button type="button" className="rounded-full p-2 text-slate-900 hover:bg-accent" aria-label="Help">
            <HelpCircle className="h-5 w-5" />
          </button>
          <button type="button" className="flex items-center gap-3 rounded-full py-1 pl-1 pr-2 hover:bg-accent" aria-label="Open user menu">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-950 text-sm font-bold text-white ring-2 ring-slate-200">
              MA
            </div>
            <span className="hidden text-left lg:block">
              <span className="block text-sm font-semibold leading-5 text-slate-950">{userName}</span>
              <span className="block text-xs leading-4 text-slate-500">{userRole}</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-slate-900 lg:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
