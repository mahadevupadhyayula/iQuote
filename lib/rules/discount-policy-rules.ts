import type { DiscountPolicyRecord } from "@/lib/schemas/shared-records";
import {
  assertBasisPoints,
  assertCents,
  basisPointsAmount,
  ratioToBasisPoints,
  type BasisPoints,
  type Cents,
} from "@/lib/utils/money";

export const discountApprovalTypes = ["discount_threshold", "margin_floor"] as const;

export type DiscountApprovalType = (typeof discountApprovalTypes)[number];

export type ReplacementCondition = {
  fromSku?: string | null;
  toSku?: string | null;
  fromProductId?: string | null;
  toProductId?: string | null;
};

export type DiscountPolicySubject = {
  customerId?: string | null;
  customerExternalId?: string | null;
  customerTier?: string | null;
  productId?: string | null;
  productSku?: string | null;
  productFamily?: string | null;
  replacement?: ReplacementCondition | null;
  quantity: number;
  lineSubtotalCents: Cents;
  unitCostCents?: Cents | null;
  requestedDiscountBps: BasisPoints;
  metadata?: Record<string, unknown>;
};

export type DiscountPolicyEvaluationInput = DiscountPolicySubject & {
  policies: DiscountPolicyRecord[];
};

export type DiscountPolicyEvaluation = {
  allowedDiscountBps: BasisPoints;
  appliedDiscountBps: BasisPoints;
  requiredApprovalTypes: DiscountApprovalType[];
  blockingReasons: string[];
  policySourceIds: string[];
};

type Conditions = Record<string, unknown>;

type MatchResult = {
  matched: boolean;
  scoped: boolean;
};

const directConditionKeys = new Set([
  "customer_id",
  "customer_external_id",
  "customer_tier",
  "product_id",
  "sku",
  "product_sku",
  "product_family",
  "minimum_quantity",
  "min_quantity",
  "replacement_from",
  "replacement_to",
  "replacement_from_product_id",
  "replacement_to_product_id",
]);

const asRecord = (value: unknown): Conditions =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Conditions) : {};

const conditionValues = (value: unknown) =>
  (Array.isArray(value) ? value : [value]).filter((item) => item !== null && item !== undefined);

const equalsAny = (actual: string | null | undefined, expected: unknown) => {
  const actualValue = actual?.toLowerCase();
  return conditionValues(expected).some((value) => String(value).toLowerCase() === actualValue);
};

const numberCondition = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const metadataMatches = (metadata: Record<string, unknown> | undefined, metadataConditions: Conditions) => {
  const source = metadata ?? {};
  return Object.entries(metadataConditions).every(([key, expected]) => {
    const actual = source[key];
    if (Array.isArray(expected)) return expected.includes(actual);
    return actual === expected;
  });
};

const mergePolicyConditions = (policy: DiscountPolicyRecord): Conditions => ({
  ...asRecord(policy.metadata),
  ...asRecord(policy.conditions),
});

const matchesPolicy = (policy: DiscountPolicyRecord, subject: DiscountPolicySubject): MatchResult => {
  const conditions = mergePolicyConditions(policy);
  let scoped = false;

  for (const [key, expected] of Object.entries(conditions)) {
    if (key === "demo_seed") continue;
    if (key === "metadata") {
      scoped = true;
      if (!metadataMatches(subject.metadata, asRecord(expected))) return { matched: false, scoped };
      continue;
    }

    if (!directConditionKeys.has(key)) continue;
    scoped = true;

    if (key === "customer_id" && !equalsAny(subject.customerId, expected)) return { matched: false, scoped };
    if (key === "customer_external_id" && !equalsAny(subject.customerExternalId, expected)) return { matched: false, scoped };
    if (key === "customer_tier" && !equalsAny(subject.customerTier, expected)) return { matched: false, scoped };
    if (key === "product_id" && !equalsAny(subject.productId, expected)) return { matched: false, scoped };
    if ((key === "sku" || key === "product_sku") && !equalsAny(subject.productSku, expected)) return { matched: false, scoped };
    if (key === "product_family" && !equalsAny(subject.productFamily, expected)) return { matched: false, scoped };
    if (
      (key === "minimum_quantity" || key === "min_quantity") &&
      subject.quantity < (numberCondition(expected) ?? Number.POSITIVE_INFINITY)
    ) {
      return { matched: false, scoped };
    }
    if (key === "replacement_from" && !equalsAny(subject.replacement?.fromSku, expected)) return { matched: false, scoped };
    if (key === "replacement_to" && !equalsAny(subject.replacement?.toSku, expected)) return { matched: false, scoped };
    if (key === "replacement_from_product_id" && !equalsAny(subject.replacement?.fromProductId, expected)) return { matched: false, scoped };
    if (key === "replacement_to_product_id" && !equalsAny(subject.replacement?.toProductId, expected)) return { matched: false, scoped };
  }

  return { matched: true, scoped };
};

const allowedDiscountBpsForPolicy = (policy: DiscountPolicyRecord, lineSubtotalCents: Cents): BasisPoints => {
  if (policy.policy_type === "amount_off") {
    return ratioToBasisPoints(Math.round(policy.amount_off * 100), lineSubtotalCents);
  }
  return policy.max_discount_bps;
};

const appliedSellPriceCents = (lineSubtotalCents: Cents, appliedDiscountBps: BasisPoints) =>
  lineSubtotalCents - basisPointsAmount(lineSubtotalCents, appliedDiscountBps);

export const evaluateDiscountPolicies = (input: DiscountPolicyEvaluationInput): DiscountPolicyEvaluation => {
  assertBasisPoints(input.requestedDiscountBps, "requestedDiscountBps");
  assertCents(input.lineSubtotalCents, "lineSubtotalCents");
  if (input.unitCostCents !== null && input.unitCostCents !== undefined) assertCents(input.unitCostCents, "unitCostCents");

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("quantity must be a positive finite number");
  }

  const policyMatches = input.policies
    .filter((policy) => policy.active)
    .map((policy) => ({ policy, match: matchesPolicy(policy, input) }))
    .filter(({ match }) => match.matched);
  const scopedPolicyMatches = policyMatches.filter(({ match }) => match.scoped);
  const policyMatchesForAllowance = scopedPolicyMatches.length > 0 ? scopedPolicyMatches : policyMatches;
  const policiesForAllowance = policyMatchesForAllowance.map(({ policy }) => policy);
  const allowedDiscountBps = policiesForAllowance.reduce<BasisPoints>(
    (allowed, policy) => Math.max(allowed, allowedDiscountBpsForPolicy(policy, input.lineSubtotalCents)),
    0,
  );
  const appliedDiscountBps = input.requestedDiscountBps;
  const policySourceIds = policiesForAllowance.map((policy) => policy.id);
  const requiredApprovalTypes: DiscountApprovalType[] = [];
  const blockingReasons: string[] = [];

  if (appliedDiscountBps > allowedDiscountBps) {
    requiredApprovalTypes.push("discount_threshold");
    blockingReasons.push(`Requested discount ${appliedDiscountBps} bps exceeds allowed discount ${allowedDiscountBps} bps.`);
  }

  const minimumMarginBps = policiesForAllowance.reduce<BasisPoints>((floor, policy) => Math.max(floor, policy.minimum_margin_bps), 0);
  if (minimumMarginBps > 0 && input.unitCostCents !== null && input.unitCostCents !== undefined) {
    const sellPriceCents = appliedSellPriceCents(input.lineSubtotalCents, appliedDiscountBps);
    const grossMarginBps = ratioToBasisPoints(Math.max(sellPriceCents - input.unitCostCents, 0), sellPriceCents);
    if (grossMarginBps < minimumMarginBps) {
      requiredApprovalTypes.push("margin_floor");
      blockingReasons.push(`Projected margin ${grossMarginBps} bps is below policy floor ${minimumMarginBps} bps.`);
    }
  }

  return {
    allowedDiscountBps,
    appliedDiscountBps,
    requiredApprovalTypes,
    blockingReasons,
    policySourceIds,
  };
};
