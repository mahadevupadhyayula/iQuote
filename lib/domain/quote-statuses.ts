export const quoteStatuses = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
] as const;

export type QuoteStatus = (typeof quoteStatuses)[number];

export const terminalQuoteStatuses = ["accepted", "rejected", "expired", "cancelled"] as const satisfies readonly QuoteStatus[];
export const editableQuoteStatuses = ["draft", "pending_approval"] as const satisfies readonly QuoteStatus[];

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const quoteStatusTransitions: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ["pending_approval", "approved", "sent", "cancelled"],
  pending_approval: ["approved", "rejected", "cancelled"],
  approved: ["sent", "cancelled"],
  sent: ["accepted", "rejected", "expired", "cancelled"],
  accepted: [],
  rejected: ["draft"],
  expired: ["draft"],
  cancelled: [],
};

export const isQuoteStatus = (value: string): value is QuoteStatus => quoteStatuses.includes(value as QuoteStatus);

export const canTransitionQuoteStatus = (from: QuoteStatus, to: QuoteStatus) => quoteStatusTransitions[from].includes(to);
