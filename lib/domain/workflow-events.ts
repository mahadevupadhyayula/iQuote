import type { QuoteStatus } from "./quote-statuses";

export const workflowEventTypes = [
  "created",
  "updated",
  "extraction_started",
  "extraction_completed",
  "extraction_failed",
  "submitted_for_approval",
  "approval_requested",
  "approved",
  "rejected",
  "sent",
  "accepted",
  "cancelled",
  "expired",
] as const;

export type WorkflowEventType = (typeof workflowEventTypes)[number];

export type WorkflowEvent = {
  id: string;
  quoteId: string;
  eventType: WorkflowEventType;
  actorId: string | null;
  fromStatus: QuoteStatus | null;
  toStatus: QuoteStatus | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
