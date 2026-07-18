import type { WorkflowShellFixture } from './types';

export const intakeWorkflowShellFixture = {
  title: 'Intake customer request',
  subtitle: 'Capture the source request, supporting files, and extraction readiness before review.',
  currentStageId: 'intake',
  stages: [
    { id: 'intake', label: 'Intake', description: 'Request received', state: 'current', tone: 'primary' },
    { id: 'review', label: 'Review', description: 'Validate quote details', state: 'upcoming' },
    { id: 'resolve-exceptions', label: 'Resolve Exceptions', description: 'Clear blockers', state: 'upcoming' },
    { id: 'generate-quote', label: 'Generate Quote', description: 'Prepare customer-ready quote', state: 'upcoming' },
  ],
  checklist: [
    { id: 'request-text', label: 'Customer request captured', description: 'Original email text is available for extraction preview.', state: 'complete', source: 'customer-email', confidence: 'high', tone: 'success' },
    { id: 'attachment', label: 'Attachment queued', description: 'Pricing worksheet is attached for controlled review.', state: 'complete', source: 'customer-email', confidence: 'high', tone: 'success' },
    { id: 'account-match', label: 'Account match pending', description: 'Confirm CRM account before quote configuration.', state: 'current', source: 'crm', confidence: 'needs-review', tone: 'warning' },
    { id: 'missing-fields', label: 'Missing delivery window', description: 'Ask for requested delivery date if it is not found during extraction.', state: 'pending', source: 'manual-entry', confidence: 'low', tone: 'info' },
  ],
  slaTimer: {
    label: 'Draft intake SLA',
    dueAt: '2026-07-18T18:00:00.000Z',
    remainingLabel: '12 minutes remaining',
    tone: 'info',
  },
  timeline: [
    { id: 'received', title: 'Request received', description: 'Customer email and worksheet uploaded to the quote workspace.', timestamp: '2026-07-18T17:32:00.000Z', actorLabel: 'Sales Inbox', tone: 'info', source: 'customer-email' },
    { id: 'security-note', title: 'Security note displayed', description: 'User is reminded that extraction suggestions are not commercial truth.', timestamp: '2026-07-18T17:33:00.000Z', actorLabel: 'Workspace', tone: 'neutral', source: 'manual-entry' },
  ],
  actions: [
    { id: 'run-extraction', label: 'Run controlled extraction', variant: 'primary' },
    { id: 'save-draft', label: 'Save intake draft', variant: 'secondary' },
    { id: 'request-info', label: 'Request missing information', variant: 'ghost' },
  ],
} satisfies WorkflowShellFixture;
