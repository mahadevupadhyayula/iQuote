import { expect, it } from "vitest";

import { evaluateConfigurationContinuation } from "@/lib/rules/configuration-continuation";

it("ignores approval, payment terms, SLA, and generation-stage blockers", () => {
  const result = evaluateConfigurationContinuation({
    readinessBlockers: [
      { code: "approval_outcome_missing", message: "approval" },
      { code: "approval_pending", message: "pending" },
      { code: "payment_terms_missing", message: "payment" },
      { code: "sla_due_time_missing", message: "sla" },
      { code: "completion_time_missing", message: "done" },
      { code: "discount_policy_not_evaluated", message: "policy" },
    ],
    pricingResolved: true,
    pricingBlockers: [],
    allProductMatchesConfirmed: true,
    allInventorySelectionsApplied: true,
    commercialTotalsExist: true,
  });

  expect(result).toEqual({ canContinue: true, blockers: [] });
});

it("keeps real configuration blockers disabled", () => {
  const result = evaluateConfigurationContinuation({
    readinessBlockers: [{ code: "margin_policy_failed", message: "Projected margin is below the allowed floor." }],
    pricingResolved: true,
    pricingBlockers: [],
    allProductMatchesConfirmed: true,
    allInventorySelectionsApplied: true,
    commercialTotalsExist: true,
  });

  expect(result.canContinue).toBe(false);
  expect(result.blockers[0]?.message).toBe("Projected margin is below the allowed floor.");
});
