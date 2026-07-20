import type { WorkflowShellFixture } from './types';

export const reviewWorkflowShellFixture = {
  title: 'Review quote configuration',
  subtitle: 'Validate requirements, catalog matches, availability, and readiness before approval routing.',
  currentStageId: 'review',
  stages: [
    { id: 'intake', label: 'Intake', description: 'Request captured', state: 'complete', tone: 'success' },
    { id: 'review', label: 'Review', description: 'Validate quote details', state: 'current', tone: 'primary' },
    { id: 'resolve-exceptions', label: 'Resolve Exceptions', description: 'Clear blockers', state: 'upcoming' },
    { id: 'generate-quote', label: 'Generate Quote', description: 'Prepare customer-ready quote', state: 'upcoming' },
  ],
  checklist: [
    { id: 'requirements', label: 'Requirements summarized', description: 'Customer requested products and delivery constraints are visible.', state: 'complete', source: 'customer-email', confidence: 'high', tone: 'success' },
    { id: 'catalog-match', label: 'Catalog matches selected', description: 'Line items reference controlled catalog candidates.', state: 'current', source: 'catalog', confidence: 'medium', tone: 'info' },
    { id: 'inventory-review', label: 'Inventory recommendation reviewed', description: 'Availability is shown from the inventory adapter for user confirmation.', state: 'pending', source: 'catalog', confidence: 'medium', tone: 'warning' },
    { id: 'readiness', label: 'Readiness checks pending', description: 'Generate quote remains unavailable until deterministic checks pass.', state: 'pending', source: 'manual-entry', tone: 'neutral' },
  ],
  slaTimer: {
    label: 'Review SLA',
    dueAt: '2026-07-18T20:00:00.000Z',
    remainingLabel: '2 hours remaining',
    tone: 'info',
  },
  timeline: [
    { id: 'extraction-complete', title: 'Extraction preview accepted', description: 'User moved source details into review without changing commercial totals.', timestamp: '2026-07-18T17:46:00.000Z', actorLabel: 'Jordan Lee', tone: 'success', source: 'manual-entry' },
    { id: 'catalog-suggested', title: 'Catalog candidates shown', description: 'Suggested product matches require human validation.', timestamp: '2026-07-18T17:48:00.000Z', actorLabel: 'Workspace', tone: 'info', source: 'catalog' },
  ],
  actions: [
    { id: 'save-review', label: 'Save review', variant: 'secondary' },
    { id: 'send-approval', label: 'Send for approval', variant: 'primary', helperText: 'Available after readiness checks are confirmed.' },
    { id: 'flag-exception', label: 'Flag exception', variant: 'ghost' },
  ],
} satisfies WorkflowShellFixture;
