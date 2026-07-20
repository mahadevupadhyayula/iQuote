import type { ApprovalRequirementType } from "@/lib/rules/approval-rules";
import type { InventoryDecisionStatus } from "@/lib/rules/inventory-rules";
import type { QuoteStatus } from "@/lib/domain/quote-statuses";
import type { BasisPoints, Cents } from "@/lib/utils/money";

export type DemoScenarioContract = {
  id: "A" | "B" | "C" | "D" | "E";
  name: string;
  playwrightSpec: string;
  input: {
    customerId: string;
    customerName: string;
    customerExternalId: string;
    currencyCode: "USD";
    validUntil: string;
    line: {
      sku: string;
      description: string;
      quantity: number;
      requestedDiscountBps: BasisPoints;
      approvedDiscountBps?: BasisPoints;
      unitCostCents: Cents;
    };
  };
  expected: {
    productMatch: {
      productId: string;
      sku: string;
      method: "sku" | "alias";
      confidenceBps: BasisPoints;
    };
    price: {
      unitPriceCents: Cents;
      currencyCode: "USD";
      priceType: "list";
      effectiveFrom: string;
      effectiveTo: string | null;
    };
    inventoryDecision: {
      status: InventoryDecisionStatus;
      blocked: boolean;
      availableQuantity: number;
      fulfillment: { locationCode: string; quantity: number; availableQuantity: number }[];
    };
    discountDecision: {
      requestedDiscountBps: BasisPoints;
      approvedDiscountBps: BasisPoints;
      approvalRequirement: ApprovalRequirementType;
      requiredRole: "product_manager" | null;
    };
    approvalPath: string[];
    quoteStatusPath: QuoteStatus[];
    readinessResult: {
      ready: boolean;
      status: "ready" | "needs_information" | "blocked";
      blockerCodes: string[];
    };
    finalTotals: {
      subtotalCents: Cents;
      discountAmountCents: Cents;
      sellPriceCents: Cents;
      costCents: Cents;
      grossProfitCents: Cents;
      grossMarginBps: BasisPoints;
    };
  };
};

export const demoProducts = {
  ax200: {
    id: "20000000-0000-4000-8000-000000000200",
    sku: "AX-200",
    name: "AX-200 Industrial Actuator",
    description: "Heavy-duty linear actuator for automated production cells.",
    status: "active" as const,
    unitCostCents: 82_000,
  },
  ax200FilterKit: {
    id: "20000000-0000-4000-8000-000000000210",
    sku: "AX-200-FKIT",
    name: "AX-200 Compatible Filter Kit",
    description: "Matched spare filter kit for AX-200 compressor equipment.",
    status: "active" as const,
    unitCostCents: 7_500,
  },
  hx500: {
    id: "20000000-0000-4000-8000-000000000500",
    sku: "HX-500",
    name: "HX-500 Hydraulic Pump",
    description: "High-flow hydraulic pump for mining conveyors and crushers.",
    status: "active" as const,
    unitCostCents: 0,
  },
} as const;

export const seededDiscountPolicies: { active: boolean; policy_type: "percent_off" | "amount_off"; discount_bps: BasisPoints; max_discount_bps: BasisPoints }[] = [
  { active: true, policy_type: "percent_off", discount_bps: 800, max_discount_bps: 1500 },
  { active: true, policy_type: "amount_off", discount_bps: 0, max_discount_bps: 0 },
  { active: true, policy_type: "percent_off", discount_bps: 1500, max_discount_bps: 1500 },
];

export const demoScenarioContracts: DemoScenarioContract[] = [
  {
    id: "A",
    name: "Straight-through Atlas Manufacturing quote",
    playwrightSpec: "tests/e2e/scenario-a-straight-through.spec.ts",
    input: {
      customerId: "10000000-0000-4000-8000-000000000001",
      customerName: "Atlas Manufacturing",
      customerExternalId: "DEMO-CUST-ATLAS",
      currencyCode: "USD",
      validUntil: "2026-09-15",
      line: { sku: "AX-200", description: "AX-200 compressors", quantity: 4, requestedDiscountBps: 0, unitCostCents: 82_000 },
    },
    expected: {
      productMatch: { productId: demoProducts.ax200.id, sku: "AX-200", method: "sku", confidenceBps: 10_000 },
      price: { unitPriceCents: 128_000, currencyCode: "USD", priceType: "list", effectiveFrom: "2026-01-01", effectiveTo: null },
      inventoryDecision: { status: "single_warehouse", blocked: false, availableQuantity: 18, fulfillment: [{ locationCode: "CHI-01", quantity: 4, availableQuantity: 10 }] },
      discountDecision: { requestedDiscountBps: 0, approvedDiscountBps: 0, approvalRequirement: "straight_through", requiredRole: null },
      approvalPath: ["straight_through"],
      quoteStatusPath: ["draft", "approved", "sent"],
      readinessResult: { ready: true, status: "ready", blockerCodes: [] },
      finalTotals: { subtotalCents: 512_000, discountAmountCents: 0, sellPriceCents: 512_000, costCents: 328_000, grossProfitCents: 184_000, grossMarginBps: 3_594 },
    },
  },
  {
    id: "B",
    name: "Atlas Manufacturing discount exception approval",
    playwrightSpec: "tests/e2e/scenario-b-discount-exception.spec.ts",
    input: {
      customerId: "10000000-0000-4000-8000-000000000001",
      customerName: "Atlas Manufacturing",
      customerExternalId: "DEMO-CUST-ATLAS",
      currencyCode: "USD",
      validUntil: "2026-09-15",
      line: { sku: "AX-200", description: "AX-200 compressors", quantity: 4, requestedDiscountBps: 1200, approvedDiscountBps: 1200, unitCostCents: 82_000 },
    },
    expected: {
      productMatch: { productId: demoProducts.ax200.id, sku: "AX-200", method: "sku", confidenceBps: 10_000 },
      price: { unitPriceCents: 128_000, currencyCode: "USD", priceType: "list", effectiveFrom: "2026-01-01", effectiveTo: null },
      inventoryDecision: { status: "single_warehouse", blocked: false, availableQuantity: 18, fulfillment: [{ locationCode: "CHI-01", quantity: 4, availableQuantity: 10 }] },
      discountDecision: { requestedDiscountBps: 1200, approvedDiscountBps: 1200, approvalRequirement: "product_manager", requiredRole: "product_manager" },
      approvalPath: ["submit_for_product_manager_approval", "approve_modified_discount_1000_bps"],
      quoteStatusPath: ["draft", "pending_approval", "approved", "sent"],
      readinessResult: { ready: true, status: "ready", blockerCodes: [] },
      finalTotals: { subtotalCents: 512_000, discountAmountCents: 61_440, sellPriceCents: 450_560, costCents: 328_000, grossProfitCents: 122_560, grossMarginBps: 2_720 },
    },
  },
  {
    id: "C",
    name: "Northstar Mining inventory exception resolution",
    playwrightSpec: "tests/e2e/scenario-c-inventory-exception.spec.ts",
    input: {
      customerId: "10000000-0000-4000-8000-000000000002",
      customerName: "Northstar Mining",
      customerExternalId: "DEMO-CUST-NORTHSTAR",
      currencyCode: "USD",
      validUntil: "2026-09-30",
      line: { sku: "HX-500", description: "HX-500 hydraulic pumps", quantity: 6, requestedDiscountBps: 0, unitCostCents: 0 },
    },
    expected: {
      productMatch: { productId: demoProducts.hx500.id, sku: "HX-500", method: "sku", confidenceBps: 10_000 },
      price: { unitPriceCents: 342_500, currencyCode: "USD", priceType: "list", effectiveFrom: "2026-01-01", effectiveTo: "2026-09-30" },
      inventoryDecision: { status: "split_fulfillment", blocked: false, availableQuantity: 6, fulfillment: [{ locationCode: "SEA-01", quantity: 4, availableQuantity: 4 }, { locationCode: "DEN-01", quantity: 2, availableQuantity: 2 }] },
      discountDecision: { requestedDiscountBps: 0, approvedDiscountBps: 0, approvalRequirement: "straight_through", requiredRole: null },
      approvalPath: ["straight_through_after_inventory_resolution"],
      quoteStatusPath: ["draft", "needs_information", "configuring", "approved", "sent"],
      readinessResult: { ready: true, status: "ready", blockerCodes: [] },
      finalTotals: { subtotalCents: 2_055_000, discountAmountCents: 0, sellPriceCents: 2_055_000, costCents: 0, grossProfitCents: 2_055_000, grossMarginBps: 10_000 },
    },
  },
  {
    id: "D",
    name: "Insufficient stock — fulfillment review",
    playwrightSpec: "tests/e2e/scenario-d-inventory-shortage.spec.ts",
    input: {
      customerId: "10000000-0000-4000-8000-000000000001",
      customerName: "Atlas Manufacturing",
      customerExternalId: "DEMO-CUST-ATLAS",
      currencyCode: "USD",
      validUntil: "2026-09-15",
      line: { sku: "AX-200", description: "AX-200 compressors", quantity: 19, requestedDiscountBps: 0, unitCostCents: 82_000 },
    },
    expected: {
      productMatch: { productId: demoProducts.ax200.id, sku: "AX-200", method: "sku", confidenceBps: 10_000 },
      price: { unitPriceCents: 128_000, currencyCode: "USD", priceType: "list", effectiveFrom: "2026-01-01", effectiveTo: null },
      inventoryDecision: { status: "backordered", blocked: true, availableQuantity: 18, fulfillment: [] },
      discountDecision: { requestedDiscountBps: 0, approvedDiscountBps: 0, approvalRequirement: "straight_through", requiredRole: null },
      approvalPath: ["fulfillment_review_required"],
      quoteStatusPath: ["draft", "reviewing"],
      readinessResult: { ready: false, status: "needs_information", blockerCodes: ["unresolved_inventory"] },
      finalTotals: { subtotalCents: 2_432_000, discountAmountCents: 0, sellPriceCents: 2_432_000, costCents: 1_558_000, grossProfitCents: 874_000, grossMarginBps: 3_594 },
    },
  },
  {
    id: "E",
    name: "Unknown SKU — product review",
    playwrightSpec: "tests/e2e/scenario-e-product-not-found.spec.ts",
    input: {
      customerId: "10000000-0000-4000-8000-000000000001",
      customerName: "Atlas Manufacturing",
      customerExternalId: "DEMO-CUST-ATLAS",
      currencyCode: "USD",
      validUntil: "2026-09-15",
      line: { sku: "ZX-999-UNKNOWN", description: "ZX-999-UNKNOWN", quantity: 3, requestedDiscountBps: 0, unitCostCents: 0 },
    },
    expected: {
      productMatch: { productId: "", sku: "ZX-999-UNKNOWN", method: "sku", confidenceBps: 0 },
      price: { unitPriceCents: 0, currencyCode: "USD", priceType: "list", effectiveFrom: "", effectiveTo: null },
      inventoryDecision: { status: "backordered", blocked: true, availableQuantity: 0, fulfillment: [] },
      discountDecision: { requestedDiscountBps: 0, approvedDiscountBps: 0, approvalRequirement: "straight_through", requiredRole: null },
      approvalPath: ["product_review_required"],
      quoteStatusPath: ["draft", "reviewing"],
      readinessResult: { ready: false, status: "blocked", blockerCodes: ["unmatched_product"] },
      finalTotals: { subtotalCents: 0, discountAmountCents: 0, sellPriceCents: 0, costCents: 0, grossProfitCents: 0, grossMarginBps: 0 },
    },
  },
];
