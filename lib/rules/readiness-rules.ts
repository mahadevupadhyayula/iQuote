import type { ApprovalStatus } from "@/lib/domain/approvals";
import { terminalQuoteStatuses, type QuoteStatus } from "@/lib/domain/quote-statuses";
import type { ApprovalEvaluation } from "@/lib/rules/approval-rules";
import type { InventoryDecision } from "@/lib/rules/inventory-rules";
import type { MarginFloorResult } from "@/lib/rules/margin-rules";

export type QuoteReadinessBlockerCode =
  | "missing_required_information"
  | "invalid_product"
  | "missing_price"
  | "missing_price_source"
  | "stale_price"
  | "pricing_exception"
  | "missing_unit_cost"
  | "unresolved_inventory"
  | "stale_inventory"
  | "missing_commercial_calculation"
  | "discount_policy_not_evaluated"
  | "approval_outcome_missing"
  | "margin_policy_failed"
  | "approval_pending"
  | "approval_rejected"
  | "payment_terms_missing"
  | "sla_due_time_missing"
  | "completion_time_missing"
  | "blocking_exception";

export type QuoteReadinessBlocker = {
  code: QuoteReadinessBlockerCode;
  message: string;
  productId?: string;
  field?: string;
};

export type ReadinessProduct = {
  id: string;
  sku: string;
  name: string;
  status: "active" | "inactive" | "discontinued";
};

export type ReadinessQuoteLine = {
  productId?: string | null;
  sku?: string | null;
  description?: string | null;
  quantity?: number | null;
};

export type ReadinessPrice = {
  productId: string;
  unitPrice: number | null;
  unitCost?: number | null;
  currencyCode: string;
  sourceName?: string | null;
  sourceVersion?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  blocked?: boolean;
  reason?: string | null;
};

export type ReadinessApproval = {
  requiredRole: string;
  status: ApprovalStatus;
};

export type ReadinessPaymentTerms = {
  accepted: boolean;
  termsCode?: string | null;
};

export type ReadinessException = {
  code: string;
  message: string;
  blocking: boolean;
  resolved?: boolean;
  productId?: string;
};

export type ReadinessCommercialCalculation = {
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  grossMarginBps: number;
};

export type EvaluateQuoteReadinessInput = {
  customerId?: string | null;
  currencyCode?: string | null;
  lines: ReadinessQuoteLine[];
  products: ReadinessProduct[];
  prices: ReadinessPrice[];
  inventoryDecisions: InventoryDecision[];
  marginPolicy?: MarginFloorResult | null;
  commercialCalculation?: ReadinessCommercialCalculation | null;
  discountPolicyEvaluation?: ApprovalEvaluation | null;
  approvals?: ReadinessApproval[];
  paymentTerms?: ReadinessPaymentTerms | null;
  blockingExceptions?: ReadinessException[];
  onDate?: string;
  quoteStatus?: QuoteStatus | null;
  slaDueAt?: string | null;
  completedAt?: string | null;
};

export type QuoteReadinessStatus = "ready" | "needs_information" | "requires_approval" | "blocked";

export type QuoteReadinessEvaluation = {
  ready: boolean;
  status: QuoteReadinessStatus;
  blockers: QuoteReadinessBlocker[];
};

const isCurrent = (price: ReadinessPrice, onDate: string, currencyCode?: string | null) =>
  price.effectiveFrom <= onDate && (price.effectiveTo == null || price.effectiveTo >= onDate) && (!currencyCode || price.currencyCode === currencyCode);

const addBlocker = (blockers: QuoteReadinessBlocker[], blocker: QuoteReadinessBlocker) => {
  blockers.push(blocker);
};

const needsInformationCodes = new Set<QuoteReadinessBlockerCode>([
  "missing_required_information",
  "missing_price",
  "missing_price_source",
  "missing_unit_cost",
  "unresolved_inventory",
  "missing_commercial_calculation",
  "discount_policy_not_evaluated",
  "approval_outcome_missing",
  "payment_terms_missing",
  "sla_due_time_missing",
  "completion_time_missing",
]);

const approvalCodes = new Set<QuoteReadinessBlockerCode>(["approval_pending"]);

const statusFor = (blockers: QuoteReadinessBlocker[]): QuoteReadinessStatus => {
  if (blockers.length === 0) return "ready";
  if (blockers.some((blocker) => !needsInformationCodes.has(blocker.code) && !approvalCodes.has(blocker.code))) return "blocked";
  if (blockers.some((blocker) => approvalCodes.has(blocker.code))) return "requires_approval";
  return "needs_information";
};

const lineLabel = (line: ReadinessQuoteLine, index: number) => line.sku ?? line.productId ?? `line ${index + 1}`;

export const evaluateQuoteReadiness = (input: EvaluateQuoteReadinessInput): QuoteReadinessEvaluation => {
  const onDate = input.onDate ?? new Date().toISOString().slice(0, 10);
  const blockers: QuoteReadinessBlocker[] = [];
  const productsById = new Map(input.products.map((product) => [product.id, product]));
  const currentPricesByProduct = new Map<string, ReadinessPrice>();

  if (!input.customerId) {
    addBlocker(blockers, {
      code: "missing_required_information",
      field: "customerId",
      message: "Customer is required before a quote can be generated.",
    });
  }

  if (!input.currencyCode) {
    addBlocker(blockers, {
      code: "missing_required_information",
      field: "currencyCode",
      message: "Currency is required before a quote can be generated.",
    });
  }

  if (input.lines.length === 0) {
    addBlocker(blockers, {
      code: "missing_required_information",
      field: "lines",
      message: "At least one quote line is required before a quote can be generated.",
    });
  }

  for (const price of input.prices) {
    if (isCurrent(price, onDate, input.currencyCode)) currentPricesByProduct.set(price.productId, price);
  }

  input.lines.forEach((line, index) => {
    const label = lineLabel(line, index);

    if (!line.productId) {
      addBlocker(blockers, {
        code: "missing_required_information",
        field: "productId",
        message: `Product is required for ${label} before a quote can be generated.`,
      });
      return;
    }

    if (!line.description) {
      addBlocker(blockers, {
        code: "missing_required_information",
        productId: line.productId,
        field: "description",
        message: `Description is required for ${label}.`,
      });
    }

    if (line.quantity == null || line.quantity <= 0) {
      addBlocker(blockers, {
        code: "missing_required_information",
        productId: line.productId,
        field: "quantity",
        message: `Positive quantity is required for ${label}.`,
      });
    }

    const product = productsById.get(line.productId);
    if (!product || product.status !== "active") {
      addBlocker(blockers, {
        code: "invalid_product",
        productId: line.productId,
        message: `Product ${label} must be active and valid before a quote can be generated.`,
      });
    }

    const hasAnyPrice = input.prices.some((price) => price.productId === line.productId);
    const currentPrice = currentPricesByProduct.get(line.productId);
    if (!currentPrice) {
      addBlocker(blockers, {
        code: hasAnyPrice ? "stale_price" : "missing_price",
        productId: line.productId,
        message: hasAnyPrice ? `Current pricing is required for ${label}.` : `A price is required for ${label}.`,
      });
    } else if (currentPrice.blocked || currentPrice.unitPrice == null) {
      addBlocker(blockers, {
        code: currentPrice.blocked ? "pricing_exception" : "missing_price",
        productId: line.productId,
        message: currentPrice.reason ?? `A sellable price is required for ${label}.`,
      });
    } else if (!currentPrice.sourceName || !currentPrice.sourceVersion) {
      addBlocker(blockers, {
        code: "missing_price_source",
        productId: line.productId,
        message: `Sourced price metadata is required for ${label}.`,
      });
    } else if (currentPrice.unitCost == null) {
      addBlocker(blockers, {
        code: "missing_unit_cost",
        productId: line.productId,
        message: `Unit cost is required for ${label} before commercial readiness can be confirmed.`,
      });
    }

    const inventoryDecision = input.inventoryDecisions.find((decision) => decision.productId === line.productId);
    if (!inventoryDecision) {
      addBlocker(blockers, {
        code: "unresolved_inventory",
        productId: line.productId,
        message: `Inventory must be resolved for ${label}.`,
      });
    } else if (inventoryDecision.status === "stale_inventory") {
      addBlocker(blockers, {
        code: "stale_inventory",
        productId: line.productId,
        message: inventoryDecision.reason ?? `Inventory must be refreshed for ${label}.`,
      });
    } else if (inventoryDecision.blocked) {
      addBlocker(blockers, {
        code: "unresolved_inventory",
        productId: line.productId,
        message: inventoryDecision.reason ?? `Inventory must be resolved for ${label}.`,
      });
    }
  });

  if (!input.commercialCalculation) {
    addBlocker(blockers, {
      code: "missing_commercial_calculation",
      message: "Commercial calculation must be completed before quote readiness can be confirmed.",
    });
  }

  if (!input.marginPolicy) {
    addBlocker(blockers, {
      code: "discount_policy_not_evaluated",
      message: "Discount and margin policy evaluation must be completed before quote readiness can be confirmed.",
    });
  } else if (!input.marginPolicy.passes) {
    addBlocker(blockers, {
      code: "margin_policy_failed",
      message: `Projected margin of ${input.marginPolicy.grossMarginBps} bps is below the ${input.marginPolicy.floorBps} bps floor.`,
    });
  }

  if (!input.discountPolicyEvaluation) {
    addBlocker(blockers, {
      code: "approval_outcome_missing",
      message: "Required approval outcome must be evaluated before quote readiness can be confirmed.",
    });
  } else if (input.discountPolicyEvaluation.blocked) {
    addBlocker(blockers, {
      code: "blocking_exception",
      message: input.discountPolicyEvaluation.reason ?? "Approval policy blocks this quote.",
    });
  } else if (input.discountPolicyEvaluation.requiredRole) {
    const matchingApproval = (input.approvals ?? []).find((approval) => approval.requiredRole === input.discountPolicyEvaluation?.requiredRole);
    if (!matchingApproval) {
      addBlocker(blockers, {
        code: "approval_pending",
        message: `${input.discountPolicyEvaluation.requiredRole} approval must be completed before a quote can be generated.`,
      });
    }
  }

  for (const approval of input.approvals ?? []) {
    if (approval.status === "pending") {
      addBlocker(blockers, {
        code: "approval_pending",
        message: `${approval.requiredRole} approval must be completed before a quote can be generated.`,
      });
    } else if (approval.status === "rejected" || approval.status === "cancelled") {
      addBlocker(blockers, {
        code: "approval_rejected",
        message: `${approval.requiredRole} approval is ${approval.status}; request a new approval before generating the quote.`,
      });
    }
  }

  if (!input.paymentTerms?.accepted || !input.paymentTerms.termsCode) {
    addBlocker(blockers, {
      code: "payment_terms_missing",
      message: "Payment terms must be selected and accepted before a quote can be generated.",
    });
  }

  if (!input.slaDueAt) {
    addBlocker(blockers, {
      code: "sla_due_time_missing",
      field: "slaDueAt",
      message: "SLA due time must be populated before quote readiness can be confirmed.",
    });
  }

  if (input.quoteStatus && terminalQuoteStatuses.includes(input.quoteStatus as (typeof terminalQuoteStatuses)[number]) && !input.completedAt) {
    addBlocker(blockers, {
      code: "completion_time_missing",
      field: "completedAt",
      message: `Completion time must be populated when quote reaches ${input.quoteStatus}.`,
    });
  }

  for (const exception of input.blockingExceptions ?? []) {
    if (exception.blocking && !exception.resolved) {
      addBlocker(blockers, {
        code: "blocking_exception",
        productId: exception.productId,
        message: exception.message,
      });
    }
  }

  const status = statusFor(blockers);

  return {
    ready: status === "ready",
    status,
    blockers,
  };
};
