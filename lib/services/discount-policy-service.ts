import { evaluateDiscountPolicies, type DiscountPolicyEvaluation, type DiscountPolicySubject } from "@/lib/rules/discount-policy-rules";
import type { PricesRepository } from "@/lib/repositories/prices";

export type DiscountPolicyProvider = Pick<PricesRepository, "listActiveDiscountPolicies">;

export type DiscountPolicyRequest = DiscountPolicySubject & {
  onDate?: string;
};

export const createDiscountPolicyService = (provider: DiscountPolicyProvider) => ({
  async evaluatePolicy(request: DiscountPolicyRequest): Promise<DiscountPolicyEvaluation> {
    const policies = await provider.listActiveDiscountPolicies(request.onDate);
    return evaluateDiscountPolicies({ ...request, policies });
  },
});

export type DiscountPolicyService = ReturnType<typeof createDiscountPolicyService>;
