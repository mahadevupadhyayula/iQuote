import { describe, expect, it } from "vitest";

import { evaluateQuoteReadiness, type EvaluateQuoteReadinessInput } from "@/lib/rules/readiness-rules";

const onDate = "2026-07-18";
const baseInput = (): EvaluateQuoteReadinessInput => ({
  customerId: "cust-1",
  currencyCode: "USD",
  lines: [{ productId: "prod-1", sku: "HX-500", description: "HX-500 Hydraulic Pump", quantity: 2 }],
  products: [{ id: "prod-1", sku: "HX-500", name: "HX-500 Hydraulic Pump", status: "active" }],
  prices: [
    {
      productId: "prod-1",
      unitPrice: 100,
      unitCost: 60,
      currencyCode: "USD",
      sourceName: "erp",
      sourceVersion: "prices-2026-07-18",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
    },
  ],
  inventoryDecisions: [
    {
      status: "single_warehouse",
      blocked: false,
      productId: "prod-1",
      requestedQuantity: 2,
      availableQuantity: 5,
      staleRecords: [],
      fulfillment: [{ productId: "prod-1", locationCode: "DEN-01", quantity: 2, availableQuantity: 5 }],
      replacementProposal: null,
      laterDeliveryOptions: [],
      reason: null,
    },
  ],
  commercialCalculation: { subtotalAmount: 200, discountAmount: 0, totalAmount: 200, grossMarginBps: 4000 },
  marginPolicy: { passes: true, grossMarginBps: 3500, floorBps: 3000 },
  discountPolicyEvaluation: {
    requirement: "sales_director",
    requiredRole: "sales_director",
    blocked: false,
    reason: null,
    thresholds: {
      straightThroughDiscountBps: 800,
      productManagerDiscountBps: 1200,
      salesDirectorDiscountBps: 1500,
      straightThroughMarginBps: 3000,
      productManagerMarginBps: 2500,
      salesDirectorMarginBps: 2000,
    },
  },
  approvals: [{ requiredRole: "sales_director", status: "approved" }],
  paymentTerms: { accepted: true, termsCode: "NET30" },
  blockingExceptions: [],
  onDate,
  quoteStatus: "draft",
  slaDueAt: "2026-07-19T12:00:00.000Z",
});

describe("quote readiness rules", () => {
  it("marks a quote ready when all gates pass", () => {
    expect(evaluateQuoteReadiness(baseInput())).toEqual({ ready: true, status: "ready", blockers: [] });
  });

  it("returns needs_information with a missing price", () => {
    const result = evaluateQuoteReadiness({ ...baseInput(), prices: [] });

    expect(result.ready).toBe(false);
    expect(result.status).toBe("needs_information");
    expect(result.blockers).toContainEqual({ code: "missing_price", productId: "prod-1", message: "A price is required for HX-500." });
  });

  it("returns requires_approval with a pending approval", () => {
    const result = evaluateQuoteReadiness({ ...baseInput(), approvals: [{ requiredRole: "sales_director", status: "pending" }] });

    expect(result.ready).toBe(false);
    expect(result.status).toBe("requires_approval");
    expect(result.blockers).toContainEqual({
      code: "approval_pending",
      message: "sales_director approval must be completed before a quote can be generated.",
    });
  });

  it("returns blocked with stale inventory", () => {
    const staleInput = baseInput();
    staleInput.inventoryDecisions = [
      {
        ...staleInput.inventoryDecisions[0],
        status: "stale_inventory",
        blocked: true,
        staleRecords: [
          {
            productId: "prod-1",
            locationCode: "DEN-01",
            quantityOnHand: 5,
            quantityReserved: 0,
            reorderPoint: 1,
            updatedAt: "2026-07-16T11:59:59.000Z",
          },
        ],
        fulfillment: [],
        reason: "Inventory refresh timestamp is stale; refresh warehouse availability before promising delivery.",
      },
    ];

    const result = evaluateQuoteReadiness(staleInput);

    expect(result.ready).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.blockers).toContainEqual({
      code: "stale_inventory",
      productId: "prod-1",
      message: "Inventory refresh timestamp is stale; refresh warehouse availability before promising delivery.",
    });
  });

  it("returns blocked when margin policy fails the configured floor", () => {
    const result = evaluateQuoteReadiness({
      ...baseInput(),
      marginPolicy: { passes: false, grossMarginBps: 2400, floorBps: 2500 },
    });

    expect(result.ready).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.blockers).toContainEqual({
      code: "margin_policy_failed",
      message: "Projected margin of 2400 bps is below the 2500 bps floor.",
    });
  });

  it("returns blocked when approval policy rejects or blocks the quote", () => {
    const result = evaluateQuoteReadiness({
      ...baseInput(),
      discountPolicyEvaluation: {
        ...baseInput().discountPolicyEvaluation!,
        blocked: true,
        reason: "Requested discount exceeds delegated authority.",
      },
    });

    expect(result.ready).toBe(false);
    expect(result.status).toBe("blocked");
    expect(result.blockers).toContainEqual({
      code: "blocking_exception",
      message: "Requested discount exceeds delegated authority.",
    });
  });

  it("returns needs_information with missing required information", () => {
    const result = evaluateQuoteReadiness({
      ...baseInput(),
      customerId: null,
      lines: [{ productId: "prod-1", sku: "HX-500", description: null, quantity: 0 }],
    });

    expect(result.ready).toBe(false);
    expect(result.status).toBe("needs_information");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        { code: "missing_required_information", field: "customerId", message: "Customer is required before a quote can be generated." },
        { code: "missing_required_information", productId: "prod-1", field: "description", message: "Description is required for HX-500." },
        { code: "missing_required_information", productId: "prod-1", field: "quantity", message: "Positive quantity is required for HX-500." },
      ]),
    );
  });

  it("requires deterministic commercial readiness gates", () => {
    const result = evaluateQuoteReadiness({
      ...baseInput(),
      prices: [{ ...baseInput().prices[0], unitCost: null }],
      commercialCalculation: null,
      marginPolicy: null,
      discountPolicyEvaluation: null,
      slaDueAt: null,
    });

    expect(result.ready).toBe(false);
    expect(result.status).toBe("needs_information");
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        { code: "missing_unit_cost", productId: "prod-1", message: "Unit cost is required for HX-500 before commercial readiness can be confirmed." },
        { code: "missing_commercial_calculation", message: "Commercial calculation must be completed before quote readiness can be confirmed." },
        { code: "discount_policy_not_evaluated", message: "Discount and margin policy evaluation must be completed before quote readiness can be confirmed." },
        { code: "approval_outcome_missing", message: "Required approval outcome must be evaluated before quote readiness can be confirmed." },
        { code: "sla_due_time_missing", field: "slaDueAt", message: "SLA due time must be populated before quote readiness can be confirmed." },
      ]),
    );
  });

  it("requires completion time for terminal quote statuses", () => {
    const result = evaluateQuoteReadiness({ ...baseInput(), quoteStatus: "accepted", completedAt: null });

    expect(result.ready).toBe(false);
    expect(result.status).toBe("needs_information");
    expect(result.blockers).toContainEqual({
      code: "completion_time_missing",
      field: "completedAt",
      message: "Completion time must be populated when quote reaches accepted.",
    });
  });
});
