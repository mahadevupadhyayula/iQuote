export const pricingPrecedence = {
  customerSpecificPrice: 1,
  customerTierPrice: 2,
  listPrice: 3,
  pricingBlocker: 4,
} as const;

export type PriceType = "customer_specific" | "customer_tier" | "list" | "blocking_exception";

export type PricingProvenance = {
  price_id: string;
  sourceName: string;
  sourceVersion: string;
  priceType: PriceType;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  precedenceRank: number;
};

export type ResolvedPrice = {
  unitPriceCents: number | null;
  unitCostCents: number | null;
  currencyCode: string;
  priceType: PriceType;
  sourceName: string;
  sourceVersion: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  precedenceReason: string;
  blocked: boolean;
  reason: string | null;
  provenance: PricingProvenance;
  /** @deprecated Use unitPriceCents for commercial calculations. */
  unitPrice: number | null;
};

type PricedRule = {
  id: string;
  productId: string;
  currencyCode: string;
  unitPrice: number;
  unitCost?: number | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
  sourceName: string;
  sourceVersion: string;
};

export type CustomerSpecificPrice = PricedRule & { customerId: string };
export type CustomerTierPrice = PricedRule & { customerTier: string };
export type ListPrice = Omit<PricedRule, "active"> & { active?: boolean };

export type QuantityVolumeRule = Omit<PricedRule, "unitPrice"> & {
  minimumQuantity: number;
  unitPrice?: number | null;
  percentOff?: number | null;
  amountOff?: number | null;
};

export type PricingException = {
  id: string;
  productId: string;
  currencyCode: string;
  active: boolean;
  reason: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  sourceName: string;
  sourceVersion: string;
};

export type ResolvePricingInput = {
  productId: string;
  customerId: string;
  customerTier?: string | null;
  quantity: number;
  currencyCode: string;
  onDate?: string;
  customerSpecificPrices?: CustomerSpecificPrice[];
  customerTierPrices?: CustomerTierPrice[];
  quantityVolumeRules?: QuantityVolumeRule[];
  listPrices?: ListPrice[];
  pricingExceptions?: PricingException[];
};

const moneyToCents = (amount: number) => Math.round(amount * 100);

const isEffective = (
  rule: { active?: boolean; effectiveFrom: string; effectiveTo?: string | null },
  onDate: string,
) => rule.active !== false && rule.effectiveFrom <= onDate && (rule.effectiveTo == null || rule.effectiveTo >= onDate);

const newestFirst = <T extends { effectiveFrom: string; id: string }>(left: T, right: T) =>
  right.effectiveFrom.localeCompare(left.effectiveFrom) || left.id.localeCompare(right.id);

const provenanceFor = ({
  rule,
  priceType,
  precedenceRank,
}: {
  rule: {
    id: string;
    sourceName: string;
    sourceVersion: string;
    effectiveFrom: string | null;
    effectiveTo?: string | null;
  };
  priceType: PriceType;
  precedenceRank: number;
}): PricingProvenance => ({
  price_id: rule.id,
  sourceName: rule.sourceName,
  sourceVersion: rule.sourceVersion,
  priceType,
  effectiveFrom: rule.effectiveFrom,
  effectiveTo: rule.effectiveTo ?? null,
  precedenceRank,
});

const appliesToRequest = (
  rule: {
    productId: string;
    currencyCode: string;
    active?: boolean;
    effectiveFrom: string;
    effectiveTo?: string | null;
  },
  input: Pick<ResolvePricingInput, "productId" | "currencyCode">,
  onDate: string,
) => rule.productId === input.productId && rule.currencyCode === input.currencyCode && isEffective(rule, onDate);

type SelectedPriceRule = CustomerSpecificPrice | CustomerTierPrice | ListPrice;

const block = ({
  currencyCode,
  reason,
  sourceName = "pricing-rules",
  sourceVersion = "unresolved",
  effectiveFrom = null,
  effectiveTo = null,
}: {
  currencyCode: string;
  reason: string;
  sourceName?: string;
  sourceVersion?: string;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
}): ResolvedPrice => ({
  unitPriceCents: null,
  unitCostCents: null,
  currencyCode,
  priceType: "blocking_exception",
  sourceName,
  sourceVersion,
  effectiveFrom,
  effectiveTo,
  precedenceReason: reason,
  blocked: true,
  reason,
  unitPrice: null,
  provenance: {
    price_id: "pricing-blocker",
    sourceName,
    sourceVersion,
    priceType: "blocking_exception",
    effectiveFrom,
    effectiveTo,
    precedenceRank: pricingPrecedence.pricingBlocker,
  },
});

const resolved = (rule: SelectedPriceRule, priceType: Exclude<PriceType, "blocking_exception">, precedenceRank: number, precedenceReason: string): ResolvedPrice => {
  const effectiveTo = rule.effectiveTo ?? null;
  const unitCostCents = rule.unitCost == null ? null : moneyToCents(rule.unitCost);

  return {
    unitPriceCents: moneyToCents(rule.unitPrice),
    unitCostCents,
    currencyCode: rule.currencyCode,
    priceType,
    sourceName: rule.sourceName,
    sourceVersion: rule.sourceVersion,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo,
    precedenceReason: unitCostCents == null ? `${precedenceReason}; missing unit cost blocks commercial readiness` : precedenceReason,
    blocked: unitCostCents == null,
    reason: unitCostCents == null ? "Unit cost is required before this quote is commercially ready." : null,
    unitPrice: rule.unitPrice,
    provenance: provenanceFor({ rule, priceType, precedenceRank }),
  };
};

export const resolvePricing = (input: ResolvePricingInput): ResolvedPrice => {
  const onDate = input.onDate ?? new Date().toISOString().slice(0, 10);

  const customerSpecificPrice = [...(input.customerSpecificPrices ?? [])]
    .filter((rule) => rule.customerId === input.customerId && appliesToRequest(rule, input, onDate))
    .sort(newestFirst)[0];
  if (customerSpecificPrice) {
    return resolved(customerSpecificPrice, "customer_specific", pricingPrecedence.customerSpecificPrice, "Active customer-specific price matched customer, product, currency, and date.");
  }

  const customerTierPrice = [...(input.customerTierPrices ?? [])]
    .filter((rule) => rule.customerTier === input.customerTier && appliesToRequest(rule, input, onDate))
    .sort(newestFirst)[0];
  if (customerTierPrice) {
    return resolved(customerTierPrice, "customer_tier", pricingPrecedence.customerTierPrice, "No active customer-specific price matched; active customer-tier price matched tier, product, currency, and date.");
  }

  const listPrice = [...(input.listPrices ?? [])]
    .filter((rule) => appliesToRequest(rule, input, onDate))
    .sort(newestFirst)[0];
  if (listPrice) {
    return resolved(listPrice, "list", pricingPrecedence.listPrice, "No active customer-specific or customer-tier price matched; active list price matched product, currency, and date.");
  }

  const pricingException = [...(input.pricingExceptions ?? [])]
    .filter((rule) => appliesToRequest(rule, input, onDate))
    .sort(newestFirst)[0];
  if (pricingException) {
    return block({
      currencyCode: pricingException.currencyCode,
      reason: pricingException.reason,
      sourceName: pricingException.sourceName,
      sourceVersion: pricingException.sourceVersion,
      effectiveFrom: pricingException.effectiveFrom,
      effectiveTo: pricingException.effectiveTo ?? null,
    });
  }

  return block({
    currencyCode: input.currencyCode,
    reason: `No active price found for product ${input.productId} in ${input.currencyCode} on ${onDate}; quoting is blocked.`,
  });
};
