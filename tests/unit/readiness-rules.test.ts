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
      currencyCode: "USD",
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
  marginPolicy: { passes: true, grossMarginBps: 3500, floorBps: 3000 },
  approvals: [{ requiredRole: "sales_director", status: "approved" }],
  paymentTerms: { accepted: true, termsCode: "NET30" },
  blockingExceptions: [],
  onDate,
});

describe("quote readiness rules", () => {
  it("marks a quote ready when all gates pass", () => {
    expect(evaluateQuoteReadiness(baseInput())).toEqual({ ready: true, status: "ready", blockers: [] });
  });

  it("blocks a quote with a missing price", () => {
    const result = evaluateQuoteReadiness({ ...baseInput(), prices: [] });

    expect(result.ready).toBe(false);
    expect(result.blockers).toContainEqual({ code: "missing_price", productId: "prod-1", message: "A price is required for HX-500." });
  });

  it("blocks a quote with a pending approval", () => {
    const result = evaluateQuoteReadiness({ ...baseInput(), approvals: [{ requiredRole: "sales_director", status: "pending" }] });

    expect(result.ready).toBe(false);
    expect(result.blockers).toContainEqual({
      code: "approval_pending",
      message: "sales_director approval must be completed before a quote can be generated.",
    });
  });

  it("blocks a quote with stale inventory", () => {
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
    expect(result.blockers).toContainEqual({
      code: "stale_inventory",
      productId: "prod-1",
      message: "Inventory refresh timestamp is stale; refresh warehouse availability before promising delivery.",
    });
  });

  it("blocks a quote with missing required information", () => {
    const result = evaluateQuoteReadiness({
      ...baseInput(),
      customerId: null,
      lines: [{ productId: "prod-1", sku: "HX-500", description: null, quantity: 0 }],
    });

    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        { code: "missing_required_information", field: "customerId", message: "Customer is required before a quote can be generated." },
        { code: "missing_required_information", productId: "prod-1", field: "description", message: "Description is required for HX-500." },
        { code: "missing_required_information", productId: "prod-1", field: "quantity", message: "Positive quantity is required for HX-500." },
      ]),
    );
  });
});
