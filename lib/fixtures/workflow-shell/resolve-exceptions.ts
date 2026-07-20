import type { WorkflowShellFixture } from './types';

export const resolveExceptionsWorkflowShellFixture = {
  title: 'Resolve quote exceptions',
  subtitle: 'Clear deterministic blockers before customer-facing quote generation is enabled.',
  currentStageId: 'resolve-exceptions',
  stages: [
    { id: 'intake', label: 'Intake', description: 'Request captured', state: 'complete', tone: 'success' },
    { id: 'review', label: 'Review', description: 'Validation found exceptions', state: 'complete', tone: 'warning' },
    { id: 'resolve-exceptions', label: 'Resolve Exceptions', description: 'Clear blockers', state: 'current', tone: 'warning' },
    { id: 'generate-quote', label: 'Generate Quote', description: 'Prepare customer-ready quote', state: 'blocked', tone: 'danger' },
  ],
  checklist: [
    { id: 'approval-exception', label: 'Approval exception open', description: 'Discount policy requires approval before final quote generation.', state: 'blocked', source: 'contract', confidence: 'needs-review', tone: 'danger' },
    { id: 'inventory-exception', label: 'Inventory exception open', description: 'One requested line requires availability resolution.', state: 'blocked', source: 'catalog', confidence: 'needs-review', tone: 'warning' },
    { id: 'customer-followup', label: 'Customer follow-up drafted', description: 'Prepared message asks for substitute preference and delivery flexibility.', state: 'current', source: 'manual-entry', tone: 'info' },
    { id: 'audit-trail', label: 'Audit trail preserved', description: 'Exception decisions will be recorded through workflow actions.', state: 'complete', source: 'manual-entry', tone: 'success' },
  ],
  slaTimer: {
    label: 'Approval SLA',
    dueAt: '2026-07-19T17:00:00.000Z',
    remainingLabel: 'Paused until approver response',
    tone: 'warning',
    isPaused: true,
  },
  timeline: [
    { id: 'exception-raised', title: 'Exception raised', description: 'Readiness checks blocked generation and identified approval requirements.', timestamp: '2026-07-18T18:05:00.000Z', actorLabel: 'Workspace', tone: 'warning', source: 'manual-entry' },
    { id: 'approver-notified', title: 'Approver notified', description: 'Approval request was prepared for deterministic policy review.', timestamp: '2026-07-18T18:08:00.000Z', actorLabel: 'Jordan Lee', tone: 'info', source: 'manual-entry' },
  ],
  actions: [
    { id: 'send-approval', label: 'Send approval request', variant: 'primary' },
    { id: 'revise-lines', label: 'Revise line items', variant: 'secondary' },
    { id: 'generate-quote', label: 'Generate quote', variant: 'primary', disabled: true, helperText: 'Resolve open exceptions before generation.' },
  ],
} satisfies WorkflowShellFixture;
