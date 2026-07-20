import type { QuoteStatus } from "@/lib/domain/quote-statuses";

export type QuoteStageStatus = QuoteStatus;

export type QuoteStageRouteDecision =
  | { kind: "redirect"; href: string }
  | { kind: "render"; state: "extracting" | "cancelled" };

export const getQuoteStageRouteDecision = (
  quoteId: string,
  status: QuoteStageStatus,
): QuoteStageRouteDecision => {
  switch (status) {
    case "draft":
      return { kind: "redirect", href: `/quotes/${quoteId}/intake` };
    case "extracting":
      return { kind: "render", state: "extracting" };
    case "needs_information":
    case "reviewing":
      return { kind: "redirect", href: `/quotes/${quoteId}/review` };
    case "configuring":
      return { kind: "redirect", href: `/quotes/${quoteId}/configure` };
    case "pending_approval":
      return { kind: "redirect", href: `/quotes/${quoteId}/approval-pending` };
    case "approved":
      return { kind: "redirect", href: `/quotes/${quoteId}/generate` };
    case "sent":
    case "accepted":
      return { kind: "redirect", href: `/quotes/${quoteId}/sent` };
    case "rejected":
      return { kind: "redirect", href: `/quotes/${quoteId}/configure?rejected=true` };
    case "expired":
      return { kind: "redirect", href: `/quotes/${quoteId}/configure?expired=true` };
    case "cancelled":
      return { kind: "render", state: "cancelled" };
  }
};

export const getQuoteQueueActionLabel = (status: QuoteStageStatus) => {
  switch (status) {
    case "needs_information":
    case "reviewing":
      return "Review information";
    case "configuring":
    case "rejected":
    case "expired":
      return "Configure quote";
    case "pending_approval":
      return "View approval status";
    case "approved":
      return "Generate quote";
    case "sent":
    case "accepted":
      return "View sent quote";
    case "draft":
      return "Review intake";
    case "extracting":
      return "View processing";
    case "cancelled":
      return "View cancelled quote";
  }
};
