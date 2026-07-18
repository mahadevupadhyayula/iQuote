import type { DiscountPolicyRecord } from "@/lib/schemas/shared-records";
import { assertBasisPoints, type BasisPoints } from "@/lib/utils/money";

export const approvalRequirementTypes = [
  "straight_through",
  "product_manager",
  "sales_director",
  "finance_exception",
] as const;

export type ApprovalRequirementType = (typeof approvalRequirementTypes)[number];

export type ApprovalRole = "product_manager" | "sales_director" | "finance";

export type ApprovalPolicyThresholds = {
  straightThroughDiscountBps: BasisPoints;
  productManagerDiscountBps: BasisPoints;
  salesDirectorDiscountBps: BasisPoints;
  straightThroughMarginBps: BasisPoints;
  productManagerMarginBps: BasisPoints;
  salesDirectorMarginBps: BasisPoints;
};

export type ApprovalEvaluationInput = {
  requestedDiscountBps: BasisPoints;
  projectedMarginBps: BasisPoints;
  policies: Pick<DiscountPolicyRecord, "active" | "discount_bps" | "max_discount_bps" | "policy_type">[];
};

export type ApprovalEvaluation = {
  requirement: ApprovalRequirementType;
  requiredRole: ApprovalRole | null;
  blocked: boolean;
  reason: string | null;
  thresholds: ApprovalPolicyThresholds;
};

export const defaultMarginApprovalThresholds = {
  straightThroughMarginBps: 3_000,
  productManagerMarginBps: 2_500,
  salesDirectorMarginBps: 2_000,
} as const satisfies Pick<
  ApprovalPolicyThresholds,
  "straightThroughMarginBps" | "productManagerMarginBps" | "salesDirectorMarginBps"
>;

const uniqueAscending = (values: number[]) => [...new Set(values)].sort((left, right) => left - right);

export const deriveApprovalThresholds = (
  policies: Pick<DiscountPolicyRecord, "active" | "discount_bps" | "max_discount_bps" | "policy_type">[],
): ApprovalPolicyThresholds => {
  const activePercentPolicies = policies.filter((policy) => policy.active && policy.policy_type === "percent_off");
  const discountThresholds = uniqueAscending(
    activePercentPolicies.flatMap((policy) => [policy.discount_bps, policy.max_discount_bps]).filter((threshold) => threshold > 0),
  );

  if (discountThresholds.length === 0) {
    throw new Error("At least one active percent-off discount policy is required to evaluate approval thresholds");
  }

  const [straightThroughDiscountBps, productManagerDiscountBps = straightThroughDiscountBps] = discountThresholds;
  const salesDirectorDiscountBps = discountThresholds[discountThresholds.length - 1];

  return {
    straightThroughDiscountBps,
    productManagerDiscountBps,
    salesDirectorDiscountBps,
    ...defaultMarginApprovalThresholds,
  };
};

const maxRequirement = (left: ApprovalRequirementType, right: ApprovalRequirementType) => {
  const rank: Record<ApprovalRequirementType, number> = {
    straight_through: 0,
    product_manager: 1,
    sales_director: 2,
    finance_exception: 3,
  };
  return rank[left] >= rank[right] ? left : right;
};

const roleForRequirement = (requirement: ApprovalRequirementType): ApprovalRole | null => {
  if (requirement === "product_manager") return "product_manager";
  if (requirement === "sales_director") return "sales_director";
  if (requirement === "finance_exception") return "finance";
  return null;
};

export const evaluateApprovalPolicy = (input: ApprovalEvaluationInput): ApprovalEvaluation => {
  assertBasisPoints(input.requestedDiscountBps, "requestedDiscountBps");
  assertBasisPoints(input.projectedMarginBps, "projectedMarginBps");

  const thresholds = deriveApprovalThresholds(input.policies);

  const discountRequirement =
    input.requestedDiscountBps <= thresholds.straightThroughDiscountBps
      ? "straight_through"
      : input.requestedDiscountBps <= thresholds.productManagerDiscountBps
        ? "product_manager"
        : input.requestedDiscountBps <= thresholds.salesDirectorDiscountBps
          ? "sales_director"
          : "finance_exception";

  const marginRequirement =
    input.projectedMarginBps >= thresholds.straightThroughMarginBps
      ? "straight_through"
      : input.projectedMarginBps >= thresholds.productManagerMarginBps
        ? "product_manager"
        : input.projectedMarginBps >= thresholds.salesDirectorMarginBps
          ? "sales_director"
          : "finance_exception";

  const requirement = maxRequirement(discountRequirement, marginRequirement);

  return {
    requirement,
    requiredRole: roleForRequirement(requirement),
    blocked: requirement === "finance_exception",
    reason:
      requirement === "finance_exception"
        ? "Requested discount or projected margin falls outside delegated approval thresholds. Finance exception required."
        : null,
    thresholds,
  };
};
