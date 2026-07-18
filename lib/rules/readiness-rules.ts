import type { ApprovalStatus } from "@/lib/domain/approvals";
import type { InventoryDecision } from "@/lib/rules/inventory-rules";
import type { MarginFloorResult } from "@/lib/rules/margin-rules";

export type QuoteReadinessBlockerCode =
  | "missing_required_information"
  | "invalid_product"
  | "missing_price"
  | "stale_price"
  | "pricing_exception"
  | "unresolved_inventory"
  | "stale_inventory"
  | "margin_policy_failed"
  | "approval_pending"
  | "approval_rejected"
  | "payment_terms_missing"
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
  currencyCode: string;
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

export type EvaluateQuoteReadinessInput = {
  customerId?: string | null;
  currencyCode?: string | null;
  lines: ReadinessQuoteLine[];
  products: ReadinessProduct[];
  prices: ReadinessPrice[];
  inventoryDecisions: InventoryDecision[];
  marginPolicy: MarginFloorResult;
  approvals?: ReadinessApproval[];
  paymentTerms?: ReadinessPaymentTerms | null;
  blockingExceptions?: ReadinessException[];
  onDate?: string;
};

export type QuoteReadinessEvaluation = {
  ready: boolean;
  status: "ready" | "blocked";
  blockers: QuoteReadinessBlocker[];
};

const isCurrent = (price: ReadinessPrice, onDate: string, currencyCode?: string | null) =>
  price.effectiveFrom <= onDate && (price.effectiveTo == null || price.effectiveTo >= onDate) && (!currencyCode || price.currencyCode === currencyCode);

const addBlocker = (blockers: QuoteReadinessBlocker[], blocker: QuoteReadinessBlocker) => {
  blockers.push(blocker);
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

  if (!input.marginPolicy.passes) {
    addBlocker(blockers, {
      code: "margin_policy_failed",
      message: `Projected margin of ${input.marginPolicy.grossMarginBps} bps is below the ${input.marginPolicy.floorBps} bps floor.`,
    });
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

  for (const exception of input.blockingExceptions ?? []) {
    if (exception.blocking && !exception.resolved) {
      addBlocker(blockers, {
        code: "blocking_exception",
        productId: exception.productId,
        message: exception.message,
      });
    }
  }

  return {
    ready: blockers.length === 0,
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
  };
};
