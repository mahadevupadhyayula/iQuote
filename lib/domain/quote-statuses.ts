export const quoteStatuses = [
  "draft",
  "needs_information",
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
export const editableQuoteStatuses = ["draft", "needs_information", "pending_approval"] as const satisfies readonly QuoteStatus[];

export const quoteStatusLabels: Record<QuoteStatus, string> = {
  draft: "Draft",
  needs_information: "Needs information",
  pending_approval: "Pending approval",
  approved: "Approved",
  sent: "Sent",
  accepted: "Accepted",
  rejected: "Rejected",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const quoteStatusTransitions: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ["needs_information", "pending_approval", "approved", "sent", "cancelled"],
  needs_information: ["draft", "pending_approval", "cancelled"],
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
