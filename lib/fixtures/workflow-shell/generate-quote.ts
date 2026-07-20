import type { WorkflowShellFixture } from './types';

export const generateQuoteWorkflowShellFixture = {
  title: 'Generate customer quote',
  subtitle: 'Preview approved requirements, delivery details, policy confirmations, and final delivery actions.',
  currentStageId: 'generate-quote',
  stages: [
    { id: 'intake', label: 'Intake', description: 'Request captured', state: 'complete', tone: 'success' },
    { id: 'review', label: 'Review', description: 'Validated by seller', state: 'complete', tone: 'success' },
    { id: 'resolve-exceptions', label: 'Resolve Exceptions', description: 'No open blockers', state: 'complete', tone: 'success' },
    { id: 'generate-quote', label: 'Generate Quote', description: 'Prepare customer-ready quote', state: 'current', tone: 'primary' },
  ],
  checklist: [
    { id: 'approved-requirements', label: 'Approved requirements locked', description: 'Customer requirements are ready for quote preview.', state: 'complete', source: 'manual-entry', confidence: 'high', tone: 'success' },
    { id: 'policy-confirmation', label: 'Policy confirmation complete', description: 'Required approvals and controlled checks are satisfied.', state: 'complete', source: 'contract', confidence: 'high', tone: 'success' },
    { id: 'delivery-details', label: 'Delivery details ready', description: 'Shipment and expiration details are shown for final review.', state: 'complete', source: 'crm', confidence: 'high', tone: 'success' },
    { id: 'internal-notes', label: 'Internal notes visible', description: 'Non-customer notes remain separated from the quote preview.', state: 'current', source: 'manual-entry', tone: 'info' },
  ],
  slaTimer: {
    label: 'Send quote target',
    dueAt: '2026-07-18T21:00:00.000Z',
    remainingLabel: 'Ready to send today',
    tone: 'success',
  },
  timeline: [
    { id: 'approval-complete', title: 'Approval completed', description: 'Commercial policy checks cleared before quote preview.', timestamp: '2026-07-18T18:42:00.000Z', actorLabel: 'Morgan Patel', tone: 'success', source: 'contract' },
    { id: 'preview-created', title: 'Quote preview prepared', description: 'Customer-facing document preview is ready for final user review.', timestamp: '2026-07-18T18:45:00.000Z', actorLabel: 'Workspace', tone: 'info', source: 'manual-entry' },
  ],
  actions: [
    { id: 'download-pdf', label: 'Download PDF', variant: 'secondary' },
    { id: 'send-quote', label: 'Send quote', variant: 'primary' },
    { id: 'return-review', label: 'Return to review', variant: 'ghost' },
  ],
} satisfies WorkflowShellFixture;
