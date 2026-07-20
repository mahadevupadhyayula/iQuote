import type { QuoteReadinessBlocker } from "@/lib/rules/readiness-rules";

export type ConfigurationContinuation = {
  canContinue: boolean;
  blockers: Array<{
    code: string;
    message: string;
    lineNumber?: number | null;
    productId?: string | null;
  }>;
};

const downstreamBlockers = new Set([
  "approval_outcome_missing",
  "approval_pending",
  "payment_terms_missing",
  "sla_due_time_missing",
  "completion_time_missing",
  "discount_policy_not_evaluated",
]);

const friendlyMessage = (blocker: Pick<QuoteReadinessBlocker, "code" | "message">) => {
  if (blocker.code === "unresolved_inventory") return blocker.message.replace("Inventory must be resolved for", "Apply the remaining inventory recommendation for");
  if (blocker.code === "missing_price") return blocker.message.replace("A price is required for", "Resolve missing pricing for");
  if (blocker.code === "margin_policy_failed") return blocker.message.replace("Projected margin", "Projected margin");
  return blocker.message;
};

export const evaluateConfigurationContinuation = (input: {
  readinessBlockers: QuoteReadinessBlocker[];
  pricingResolved: boolean;
  pricingBlockers: Array<{ code: string; message: string; lineNumber?: number | null }>;
  allProductMatchesConfirmed: boolean;
  allInventorySelectionsApplied: boolean;
  commercialTotalsExist: boolean;
  lineLabels?: string[];
}): ConfigurationContinuation => {
  const blockers: ConfigurationContinuation["blockers"] = [];
  if (!input.allProductMatchesConfirmed) blockers.push({ code: "product_match_unconfirmed", message: "Confirm the product match for an unmatched line." });
  if (!input.allInventorySelectionsApplied) blockers.push({ code: "inventory_selection_missing", message: "Apply the remaining inventory recommendation." });
  for (const blocker of input.pricingBlockers) blockers.push({ code: blocker.code, message: blocker.message, lineNumber: blocker.lineNumber ?? null });
  if (!input.pricingResolved) blockers.push({ code: "pricing_unresolved", message: "Resolve pricing before continuing." });
  if (!input.commercialTotalsExist) blockers.push({ code: "missing_commercial_calculation", message: "Commercial totals must exist before continuing." });
  for (const blocker of input.readinessBlockers) {
    if (downstreamBlockers.has(blocker.code)) continue;
    if (blockers.some((existing) => existing.code === blocker.code && existing.message === blocker.message)) continue;
    blockers.push({ code: blocker.code, message: friendlyMessage(blocker), productId: blocker.productId ?? null });
  }
  return { canContinue: blockers.length === 0, blockers };
};
