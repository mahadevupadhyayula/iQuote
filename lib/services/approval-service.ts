import { evaluateApprovalPolicy, type ApprovalEvaluation } from "@/lib/rules/approval-rules";
import type { BasisPoints } from "@/lib/utils/money";
import type { PricesRepository } from "@/lib/repositories/prices";

export type ApprovalPolicyProvider = Pick<PricesRepository, "listActiveDiscountPolicies">;

export type ApprovalPolicyRequest = {
  requestedDiscountBps: BasisPoints;
  projectedMarginBps: BasisPoints;
  onDate?: string;
};

export const createApprovalService = (provider: ApprovalPolicyProvider) => ({
  async evaluatePolicy(request: ApprovalPolicyRequest): Promise<ApprovalEvaluation> {
    const policies = await provider.listActiveDiscountPolicies(request.onDate);
    return evaluateApprovalPolicy({
      requestedDiscountBps: request.requestedDiscountBps,
      projectedMarginBps: request.projectedMarginBps,
      policies,
    });
  },
});

export type ApprovalService = ReturnType<typeof createApprovalService>;
