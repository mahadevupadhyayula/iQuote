import { describe, expect, it } from "vitest";

import { evaluateDiscountPolicies } from "@/lib/rules/discount-policy-rules";
import { createDiscountPolicyService } from "@/lib/services/discount-policy-service";
import type { DiscountPolicyRecord } from "@/lib/schemas/shared-records";

const timestamp = "2026-07-18T00:00:00.000Z";

const policy = (overrides: Partial<DiscountPolicyRecord>): DiscountPolicyRecord => ({
  id: "30000000-0000-4000-8000-000000000001",
  name: "Policy",
  description: null,
  policy_type: "percent_off",
  discount_bps: 800,
  max_discount_bps: 1200,
  amount_off: 0,
  starts_on: "2026-01-01",
  ends_on: null,
  active: true,
  metadata: {},
  conditions: {},
  minimum_margin_bps: 2500,
  created_at: timestamp,
  updated_at: timestamp,
  ...overrides,
});

const baseRequest = {
  customerId: "customer-1",
  customerExternalId: "DEMO-CUST-ATLAS",
  customerTier: "manufacturing",
  productId: "product-1",
  productSku: "HX-500R",
  productFamily: "actuators",
  replacement: { fromSku: "HX-500", toSku: "HX-500R" },
  quantity: 12,
  lineSubtotalCents: 512_000,
  unitCostCents: 328_000,
  requestedDiscountBps: 800,
  metadata: { bundle_has_equipment: true, region: "west" },
};

describe("discount policy rules", () => {
  it("matches active policies by customer, product family, quantity, and flexible metadata conditions", () => {
    const evaluation = evaluateDiscountPolicies({
      ...baseRequest,
      policies: [
        policy({ id: "30000000-0000-4000-8000-000000000001", conditions: { customer_external_id: "DEMO-CUST-ATLAS", product_family: "actuators", minimum_quantity: 10 } }),
        policy({ id: "30000000-0000-4000-8000-000000000002", max_discount_bps: 1500, conditions: { metadata: { bundle_has_equipment: true } } }),
        policy({ id: "30000000-0000-4000-8000-000000000003", max_discount_bps: 2000, conditions: { customer_tier: "healthcare" } }),
      ],
    });

    expect(evaluation).toEqual({
      allowedDiscountBps: 1500,
      appliedDiscountBps: 800,
      requiredApprovalTypes: [],
      blockingReasons: [],
      policySourceIds: ["30000000-0000-4000-8000-000000000001", "30000000-0000-4000-8000-000000000002"],
    });
  });

  it("uses seeded metadata conditions for Phase 1 demo policies without overfitting schema columns", () => {
    const evaluation = evaluateDiscountPolicies({
      ...baseRequest,
      requestedDiscountBps: 1200,
      policies: [
        policy({
          id: "30000000-0000-4000-8000-000000000001",
          metadata: { customer_external_id: "DEMO-CUST-ATLAS", minimum_quantity: 10 },
        }),
      ],
    });

    expect(evaluation.allowedDiscountBps).toBe(1200);
    expect(evaluation.policySourceIds).toEqual(["30000000-0000-4000-8000-000000000001"]);
  });

  it("detects discount thresholds and margin-floor violations", () => {
    const evaluation = evaluateDiscountPolicies({
      ...baseRequest,
      requestedDiscountBps: 2000,
      unitCostCents: 430_000,
      policies: [policy({ id: "30000000-0000-4000-8000-000000000001", max_discount_bps: 1200, minimum_margin_bps: 2500, conditions: { product_id: "product-1" } })],
    });

    expect(evaluation.requiredApprovalTypes).toEqual(["discount_threshold", "margin_floor"]);
    expect(evaluation.blockingReasons).toEqual([
      "Requested discount 2000 bps exceeds allowed discount 1200 bps.",
      "Projected margin 1037 bps is below policy floor 2500 bps.",
    ]);
  });

  it("converts amount-off policies into allowed basis points for the evaluated subtotal", () => {
    const evaluation = evaluateDiscountPolicies({
      ...baseRequest,
      policies: [policy({ policy_type: "amount_off", amount_off: 250, max_discount_bps: 0, conditions: { replacement_from: "HX-500", replacement_to: "HX-500R" } })],
    });

    expect(evaluation.allowedDiscountBps).toBe(488);
  });

  it("loads active policies through the discount policy service before evaluation", async () => {
    const policies = [policy({ conditions: { sku: "HX-500R" } })];
    const service = createDiscountPolicyService({
      async listActiveDiscountPolicies(onDate) {
        expect(onDate).toBe("2026-07-18");
        return policies;
      },
    });

    await expect(service.evaluatePolicy({ ...baseRequest, onDate: "2026-07-18" })).resolves.toMatchObject({
      allowedDiscountBps: 1200,
      policySourceIds: ["30000000-0000-4000-8000-000000000001"],
    });
  });
});
