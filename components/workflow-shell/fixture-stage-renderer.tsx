import type * as React from 'react';

import { AlertTriangle, CheckCircle2, ClipboardCheck, FileText, Info, PackageCheck, Send, Sparkles } from 'lucide-react';

import { WorkflowStepper } from '@/components/app-shell/workflow-stepper';
import { WorkspaceGrid } from '@/components/app-shell/workspace-grid';
import { ActivityTimeline } from '@/components/workflow-shell/activity-timeline';
import { DisabledAction } from '@/components/workflow-shell/disabled-action';
import { ErrorBanner } from '@/components/workflow-shell/error-banner';
import { QuoteReadinessPanel, type QuoteReadinessItem } from '@/components/workflow-shell/quote-readiness-panel';
import { SectionHeader } from '@/components/workflow-shell/section-header';
import { ShellCard } from '@/components/workflow-shell/shell-card';
import { SlaTimer, type SlaTimerState } from '@/components/workflow-shell/sla-timer';
import { SourceIndicator } from '@/components/workflow-shell/source-indicator';
import { StatusBadge } from '@/components/workflow-shell/status-badge';
import { Button } from '@/components/ui/button';
import type { WorkflowShellAction, WorkflowShellFixture, WorkflowShellStageId, WorkflowShellVisualTone } from '@/lib/fixtures/workflow-shell';

interface FixtureStageRendererProps {
  fixture: WorkflowShellFixture;
}

type Panel = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  surface?: React.ComponentProps<typeof ShellCard>['surface'];
  items?: readonly string[];
  children?: React.ReactNode;
};

const sourceLabels: Record<string, string> = {
  'customer-email': 'Customer email',
  crm: 'CRM',
  catalog: 'Catalog',
  contract: 'Contract policy',
  'manual-entry': 'Manual entry',
};

const toneToBadge: Record<WorkflowShellVisualTone, React.ComponentProps<typeof StatusBadge>['variant']> = {
  neutral: 'neutral',
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  primary: 'info',
};

function toSlaState(tone: WorkflowShellVisualTone): SlaTimerState {
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  return 'info';
}

function toReadinessItems(fixture: WorkflowShellFixture): QuoteReadinessItem[] {
  return fixture.checklist.map((item) => ({
    id: item.id,
    label: item.label,
    description: item.description,
    state: item.state === 'blocked' ? 'blocked' : item.state === 'complete' ? 'complete' : item.tone === 'warning' ? 'warning' : 'pending',
  }));
}

function ShellPanel({ panel }: { panel: Panel }) {
  return (
    <ShellCard surface={panel.surface}>
      <SectionHeader title={panel.title} description={panel.description} icon={panel.icon} />
      {panel.children ? <div className="mt-5">{panel.children}</div> : null}
      {panel.items ? (
        <ul className="mt-5 space-y-3">
          {panel.items.map((item) => (
            <li key={item} className="rounded-lg border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </ShellCard>
  );
}

function ActionStrip({ actions }: { actions: readonly WorkflowShellAction[] }) {
  return (
    <ShellCard>
      <SectionHeader title="Actions" description="Visual-only fixture actions; transitions remain outside the renderer." icon={<Send className="h-5 w-5" />} />
      <div className="mt-5 flex flex-wrap gap-3">
        {actions.map((action) => action.disabled ? (
          <DisabledAction key={action.id} reason={action.helperText ?? 'This action is unavailable.'}>{action.label}</DisabledAction>
        ) : (
          <Button key={action.id} type="button" variant={action.variant === 'primary' ? 'default' : action.variant === 'danger' ? 'destructive' : action.variant}>
            {action.label}
          </Button>
        ))}
      </div>
    </ShellCard>
  );
}

function ChecklistPreview({ fixture, title = 'Checklist' }: { fixture: WorkflowShellFixture; title?: string }) {
  return (
    <ShellCard>
      <SectionHeader title={title} description="Fixture checklist records are shown for audit context only." icon={<ClipboardCheck className="h-5 w-5" />} />
      <div className="mt-4 space-y-3">
        {fixture.checklist.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-950">{item.label}</p>
              <StatusBadge variant={toneToBadge[item.tone ?? 'neutral']}>{item.state}</StatusBadge>
            </div>
            {item.description ? <p className="mt-1 text-sm text-slate-600">{item.description}</p> : null}
            {item.source ? <p className="mt-2 text-xs text-muted-foreground">Source: {sourceLabels[item.source]}</p> : null}
          </div>
        ))}
      </div>
    </ShellCard>
  );
}

function buildPanels(stageId: WorkflowShellStageId, fixture: WorkflowShellFixture): Panel[] {
  const commonCustomer = { id: 'customer-request', title: stageId === 'intake' ? 'Customer Request Intake' : 'Customer Request', description: 'Customer-provided request details remain separate from controlled commercial records.', icon: <FileText className="h-5 w-5" />, items: ['Original request text preview', 'Account and contact context', 'Attachments and source references'] };
  const requirements = { id: 'requirements', title: stageId === 'generate-quote' ? 'Approved Requirements' : 'Requirements', description: 'Human-reviewed requirements summarized from the fixture.', icon: <CheckCircle2 className="h-5 w-5" />, items: ['Requested products and quantities', 'Delivery constraints', 'Known exceptions and approvals'] };

  if (stageId === 'intake') return [
    commonCustomer,
    { id: 'ai-extraction', title: 'AI Extraction Preview', description: 'Extraction suggestions are previews only and do not set commercial truth.', icon: <Sparkles className="h-5 w-5" />, surface: 'blue', children: <ErrorBanner severity="warning" title="Extraction confidence info" description="Review suggested fields before moving them into controlled quote configuration." /> },
    { id: 'suggestions', title: 'Suggestions & Missing Information', description: 'Highlights fields that need user review or customer follow-up.', icon: <AlertTriangle className="h-5 w-5" />, items: ['Confirm CRM account match', 'Request delivery window', 'Validate attachment context'] },
    { id: 'intake-checklist', title: 'Intake Checklist', description: 'Checklist values come from the fixture.', icon: <ClipboardCheck className="h-5 w-5" />, children: <ChecklistPreview fixture={fixture} title="Intake Checklist" /> },
    { id: 'sla-information', title: 'SLA Information', description: 'Timer renders fixture SLA metadata only.', icon: <Info className="h-5 w-5" /> },
    { id: 'recent-activity', title: 'Recent Activity', description: 'Latest intake events from the fixture timeline.', icon: <Info className="h-5 w-5" /> },
  ];

  if (stageId === 'resolve-exceptions') return [commonCustomer, requirements, { id: 'inventory-snapshot', title: 'Inventory Snapshot', description: 'Adapter-sourced inventory context for review only.', icon: <PackageCheck className="h-5 w-5" /> }, { id: 'quote-configuration', title: 'Quote Configuration', description: 'Configuration pending exception resolution.', icon: <FileText className="h-5 w-5" /> }, { id: 'exceptions', title: 'Exceptions Requiring Resolution', description: 'Open blockers must be resolved before generation; includes the disabled Generate Customer Quote control.', icon: <AlertTriangle className="h-5 w-5" />, children: <ChecklistPreview fixture={fixture} title="Exceptions Requiring Resolution" /> }, { id: 'waiting-approval-sla', title: 'Waiting for approval SLA', description: 'Approval SLA is paused while the workspace waits for a controlled approver response.', icon: <Info className="h-5 w-5" /> }, { id: 'quote-impact', title: 'Quote Impact', description: 'Impact narrative avoids calculating totals, discounts, or inventory truth.', icon: <Info className="h-5 w-5" />, items: ['Generation remains disabled', 'Approver response required', 'Customer follow-up may be needed'] }];

  if (stageId === 'generate-quote') return [requirements, { id: 'delivery-details', title: 'Delivery Details', description: 'Delivery and expiration details prepared for customer review.', icon: <PackageCheck className="h-5 w-5" /> }, { id: 'internal-notes', title: 'Notes to Internal Team', description: 'Internal notes are not included in the customer quote preview.', icon: <Info className="h-5 w-5" /> }, { id: 'quote-preview', title: 'Quote Preview document', description: 'Customer-facing quote document preview composed from fixture data.', icon: <FileText className="h-5 w-5" />, surface: 'blue' }, { id: 'quote-summary', title: 'Quote Summary', description: 'Final quote summary display without performing commercial calculations.', icon: <Info className="h-5 w-5" /> }];

  return [commonCustomer, requirements, { id: 'quote-configuration', title: 'Quote Configuration', description: 'User-reviewed configuration preview.', icon: <FileText className="h-5 w-5" /> }, { id: 'inventory-recommendation', title: 'Inventory Recommendation', description: 'Recommendation is displayed for human validation only.', icon: <PackageCheck className="h-5 w-5" /> }, { id: 'quote-summary', title: 'Quote Summary', description: 'Summary omits commercial calculations in this fixture renderer.', icon: <Info className="h-5 w-5" /> }];
}

export function FixtureStageRenderer({ fixture }: FixtureStageRendererProps) {
  const panels = buildPanels(fixture.currentStageId, fixture);
  const timelineTitle = fixture.currentStageId === 'intake' ? 'Recent Activity' : fixture.currentStageId === 'review' ? 'Activity Timeline' : 'Activity Timeline';

  return (
    <div className="space-y-6">
      <ShellCard>
        <div className="space-y-4">
          <div><p className="text-sm font-semibold uppercase tracking-wide text-primary">Fixture stage preview</p><h1 className="mt-1 text-2xl font-bold text-slate-950">{fixture.title}</h1>{fixture.subtitle ? <p className="mt-2 text-sm text-muted-foreground">{fixture.subtitle}</p> : null}</div>
          <WorkflowStepper currentStep={fixture.currentStageId} steps={fixture.stages} className="rounded-xl border" />
        </div>
      </ShellCard>

      <WorkspaceGrid
        main={<>{panels.map((panel) => <ShellPanel key={panel.id} panel={panel} />)}</>}
        right={<>{fixture.slaTimer ? <SlaTimer label={fixture.slaTimer.label} dueAt={fixture.slaTimer.dueAt} remainingLabel={fixture.slaTimer.remainingLabel} state={toSlaState(fixture.slaTimer.tone)} isPaused={fixture.slaTimer.isPaused} /> : null}<QuoteReadinessPanel items={toReadinessItems(fixture)} />{fixture.currentStageId !== 'resolve-exceptions' ? <SourceIndicator priceSource="Controlled pricing records" inventoryRefresh="Fixture snapshot" confidence="medium" /> : null}</>}
        bottom={<><ActivityTimeline title={timelineTitle} items={fixture.timeline.map((item) => ({ ...item, tone: item.tone === 'primary' ? 'info' : item.tone, sourceLabel: item.source ? sourceLabels[item.source] : undefined }))} />{fixture.currentStageId === 'resolve-exceptions' ? <ActionStrip actions={fixture.actions} /> : <ActionStrip actions={fixture.currentStageId === 'generate-quote' ? [{ id: 'generate-pdf', label: 'Generate PDF', variant: 'primary' }, { id: 'download-quote', label: 'Download Quote', variant: 'secondary' }, { id: 'send-customer', label: 'Send to Customer', variant: 'primary' }, { id: 'save-draft', label: 'Save Draft', variant: 'ghost' }] : fixture.actions} />}</>}
      />
    </div>
  );
}
