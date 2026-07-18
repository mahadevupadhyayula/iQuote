import type { ReactNode } from 'react';
import { Bell, ChevronDown, HelpCircle, Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface AppHeaderProps {
  className?: string;
  title?: string;
  userName?: string;
  userRole?: string;
}

interface HeaderIconButtonProps {
  'aria-label': string;
  children: ReactNode;
}

export function QuoteLogo() {
  return (
    <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
      <div className="relative grid h-11 w-11 place-items-center rounded-[1.35rem] bg-gradient-to-br from-sky-500 via-cyan-400 to-emerald-300 shadow-sm shadow-sky-200/70 ring-1 ring-white/70">
        <div className="absolute inset-1 rounded-[1.05rem] bg-white/18" />
        <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black tracking-tight text-sky-700 shadow-sm">
          Q
        </div>
        <div className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-white/95 ring-2 ring-sky-300" />
      </div>
    </div>
  );
}

export function HeaderSearch() {
  return (
    <div className="hidden w-full min-w-[260px] max-w-[520px] md:block">
      <label className="sr-only" htmlFor="app-shell-search">
        Search quotes, customers, products
      </label>
      <p id="app-shell-search-description" className="sr-only">
        Visual-only search control for the workspace preview. It does not update quotes or other records.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <Input
          id="app-shell-search"
          type="search"
          readOnly
          aria-describedby="app-shell-search-description"
          placeholder="Search quotes, customers, products..."
          className="h-12 rounded-2xl border-slate-200 bg-slate-50/90 pl-12 pr-20 text-slate-900 shadow-inner shadow-slate-100 transition-colors placeholder:text-slate-400 focus-visible:bg-white"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 shadow-sm sm:inline-flex">
          Visual
        </span>
      </div>
    </div>
  );
}

export function HeaderIconButton({ children, 'aria-label': ariaLabel }: HeaderIconButtonProps) {
  return (
    <button
      type="button"
      className="grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export function UserIdentitySection({ userName, userRole }: Pick<AppHeaderProps, 'userName' | 'userRole'>) {
  const initials = userName
    ?.split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      type="button"
      className="flex min-w-0 items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-2 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="Open user menu"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-950 text-sm font-bold text-white ring-2 ring-slate-100">
        {initials || 'U'}
      </span>
      <span className="hidden min-w-0 text-left lg:block">
        <span className="block truncate text-sm font-semibold leading-5 text-slate-950">{userName}</span>
        <span className="block truncate text-xs leading-4 text-slate-500">{userRole}</span>
      </span>
      <ChevronDown className="hidden h-4 w-4 shrink-0 text-slate-500 lg:block" aria-hidden="true" />
    </button>
  );
}

export function AppHeader({
  className,
  title = 'Intelligent Quote Workspace',
  userName = 'Michael Anderson',
  userRole = 'Sales Representative',
}: AppHeaderProps) {
  return (
    <header className={cn('border-b border-slate-200 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85', className)}>
      <div className="mx-auto flex min-h-20 max-w-[1440px] flex-wrap items-center gap-4 px-4 py-3 sm:flex-nowrap sm:px-6 lg:gap-6 lg:px-7">
        <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none sm:gap-4">
          <QuoteLogo />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">iQuote</p>
            <h1 className="truncate text-lg font-bold tracking-tight text-slate-950 sm:text-xl lg:text-2xl">{title}</h1>
          </div>
        </div>

        <div className="order-3 w-full md:order-none md:mx-auto md:flex md:justify-center">
          <HeaderSearch />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <HeaderIconButton aria-label="View notifications">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </HeaderIconButton>
          <HeaderIconButton aria-label="Open help center">
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </HeaderIconButton>
          <UserIdentitySection userName={userName} userRole={userRole} />
        </div>
      </div>
    </header>
  );
}
