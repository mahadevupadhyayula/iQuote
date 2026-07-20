import { describe, expect, it } from "vitest";

import { deriveApprovalThresholds, evaluateApprovalPolicy } from "@/lib/rules/approval-rules";
import { createApprovalService } from "@/lib/services/approval-service";
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
  conditions: {},
  minimum_margin_bps: 0,
  starts_on: "2026-01-01",
  ends_on: null,
  active: true,
  metadata: {},
  created_at: timestamp,
  updated_at: timestamp,
  ...overrides,
});

const seededPolicies = [
  policy({ id: "30000000-0000-4000-8000-000000000001", name: "Atlas volume discount", discount_bps: 800, max_discount_bps: 1200 }),
  policy({ id: "30000000-0000-4000-8000-000000000002", name: "Northstar replacement incentive", policy_type: "amount_off", discount_bps: 0, max_discount_bps: 0, amount_off: 250 }),
  policy({ id: "30000000-0000-4000-8000-000000000003", name: "Standard installation bundle", discount_bps: 1500, max_discount_bps: 1500 }),
];

const evaluate = (requestedDiscountBps: number, projectedMarginBps: number) =>
  evaluateApprovalPolicy({ requestedDiscountBps, projectedMarginBps, policies: seededPolicies });

describe("approval rules", () => {
  it("derives seeded discount thresholds from active percent-off discount policies", () => {
    expect(deriveApprovalThresholds(seededPolicies)).toMatchObject({
      straightThroughDiscountBps: 800,
      productManagerDiscountBps: 1200,
      salesDirectorDiscountBps: 1500,
      straightThroughMarginBps: 3000,
      productManagerMarginBps: 2500,
      salesDirectorMarginBps: 2000,
    });
  });

  it("ignores inactive and amount-off policies when deriving percent discount thresholds", () => {
    expect(
      deriveApprovalThresholds([
        policy({ active: false, discount_bps: 500, max_discount_bps: 500 }),
        policy({ policy_type: "amount_off", discount_bps: 0, max_discount_bps: 0, amount_off: 100 }),
        policy({ discount_bps: 900, max_discount_bps: 1100 }),
      ]),
    ).toMatchObject({
      straightThroughDiscountBps: 900,
      productManagerDiscountBps: 1100,
      salesDirectorDiscountBps: 1100,
    });
  });

  it.each([
    [800, 3000],
    [799, 3001],
  ])("returns straight-through at or under the straight-through boundaries (%i bps discount, %i bps margin)", (discount: number, margin: number) => {
    expect(evaluate(discount, margin)).toMatchObject({ requirement: "straight_through", requiredRole: null, blocked: false });
  });

  it.each([
    [801, 3000],
    [1200, 3000],
    [800, 2999],
    [800, 2500],
  ])("requires product-manager approval at product-manager boundaries (%i bps discount, %i bps margin)", (discount: number, margin: number) => {
    expect(evaluate(discount, margin)).toMatchObject({ requirement: "product_manager", requiredRole: "product_manager", blocked: false });
  });

  it.each([
    [1201, 3000],
    [1500, 3000],
    [800, 2499],
    [800, 2000],
  ])("requires sales-director approval at sales-director boundaries (%i bps discount, %i bps margin)", (discount: number, margin: number) => {
    expect(evaluate(discount, margin)).toMatchObject({ requirement: "sales_director", requiredRole: "sales_director", blocked: false });
  });

  it.each([
    [1501, 3000],
    [800, 1999],
  ])("blocks as a finance exception beyond delegated boundaries (%i bps discount, %i bps margin)", (discount: number, margin: number) => {
    expect(evaluate(discount, margin)).toMatchObject({
      requirement: "finance_exception",
      requiredRole: "finance",
      blocked: true,
      reason: "Requested discount or projected margin falls outside delegated approval thresholds. Finance exception required.",
    });
  });

  it("returns the strictest approval path when discount and margin cross different thresholds", () => {
    expect(evaluate(801, 2000)).toMatchObject({ requirement: "sales_director", requiredRole: "sales_director", blocked: false });
  });

  it("loads active discount policies through the approval service before evaluating policy", async () => {
    const service = createApprovalService({
      async listActiveDiscountPolicies(onDate) {
        expect(onDate).toBe("2026-07-18");
        return seededPolicies;
      },
    });

    await expect(service.evaluatePolicy({ requestedDiscountBps: 1201, projectedMarginBps: 3000, onDate: "2026-07-18" })).resolves.toMatchObject({
      requirement: "sales_director",
      requiredRole: "sales_director",
      blocked: false,
    });
  });
});
