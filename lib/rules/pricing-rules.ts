export const pricingPrecedence = {
  customerSpecificPrice: 1,
  customerTierPrice: 2,
  quantityVolumeRule: 3,
  listPrice: 4,
  pricingException: 5,
} as const;

export type PriceType =
  | "customer_specific"
  | "customer_tier"
  | "quantity_volume"
  | "list"
  | "blocking_exception";

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
  unitPrice: number | null;
  currencyCode: string;
  blocked: boolean;
  reason: string | null;
  provenance: PricingProvenance;
};

type PricedRule = {
  id: string;
  productId: string;
  currencyCode: string;
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  active: boolean;
  sourceName: string;
  sourceVersion: string;
};

export type CustomerSpecificPrice = PricedRule & { customerId: string };
export type CustomerTierPrice = PricedRule & { customerTier: string };

export type QuantityVolumeRule = Omit<PricedRule, "unitPrice"> & {
  minimumQuantity: number;
  unitPrice?: number | null;
  percentOff?: number | null;
  amountOff?: number | null;
};

export type ListPrice = Omit<PricedRule, "active"> & { active?: boolean };

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

const resolveQuantityUnitPrice = (rule: QuantityVolumeRule, listPrice: ListPrice | null) => {
  if (rule.unitPrice != null) return rule.unitPrice;
  if (!listPrice) return null;
  if (rule.percentOff != null) return Math.max(listPrice.unitPrice * (1 - rule.percentOff / 100), 0);
  if (rule.amountOff != null) return Math.max(listPrice.unitPrice - rule.amountOff, 0);
  return null;
};

export const resolvePricing = (input: ResolvePricingInput): ResolvedPrice => {
  const onDate = input.onDate ?? new Date().toISOString().slice(0, 10);
  const currentListPrice =
    [...(input.listPrices ?? [])]
      .filter((rule) => appliesToRequest(rule, input, onDate))
      .sort(newestFirst)[0] ?? null;

  const customerSpecificPrice = [...(input.customerSpecificPrices ?? [])]
    .filter((rule) => rule.customerId === input.customerId && appliesToRequest(rule, input, onDate))
    .sort(newestFirst)[0];
  if (customerSpecificPrice) {
    return {
      unitPrice: customerSpecificPrice.unitPrice,
      currencyCode: customerSpecificPrice.currencyCode,
      blocked: false,
      reason: null,
      provenance: provenanceFor({
        rule: customerSpecificPrice,
        priceType: "customer_specific",
        precedenceRank: pricingPrecedence.customerSpecificPrice,
      }),
    };
  }

  const customerTierPrice = [...(input.customerTierPrices ?? [])]
    .filter((rule) => rule.customerTier === input.customerTier && appliesToRequest(rule, input, onDate))
    .sort(newestFirst)[0];
  if (customerTierPrice) {
    return {
      unitPrice: customerTierPrice.unitPrice,
      currencyCode: customerTierPrice.currencyCode,
      blocked: false,
      reason: null,
      provenance: provenanceFor({
        rule: customerTierPrice,
        priceType: "customer_tier",
        precedenceRank: pricingPrecedence.customerTierPrice,
      }),
    };
  }

  const quantityVolumeRule = [...(input.quantityVolumeRules ?? [])]
    .filter((rule) => input.quantity >= rule.minimumQuantity && appliesToRequest(rule, input, onDate))
    .sort((left, right) => right.minimumQuantity - left.minimumQuantity || newestFirst(left, right))[0];
  if (quantityVolumeRule) {
    const unitPrice = resolveQuantityUnitPrice(quantityVolumeRule, currentListPrice);
    if (unitPrice != null) {
      return {
        unitPrice,
        currencyCode: quantityVolumeRule.currencyCode,
        blocked: false,
        reason: null,
        provenance: provenanceFor({
          rule: quantityVolumeRule,
          priceType: "quantity_volume",
          precedenceRank: pricingPrecedence.quantityVolumeRule,
        }),
      };
    }
  }

  if (currentListPrice) {
    return {
      unitPrice: currentListPrice.unitPrice,
      currencyCode: currentListPrice.currencyCode,
      blocked: false,
      reason: null,
      provenance: provenanceFor({
        rule: currentListPrice,
        priceType: "list",
        precedenceRank: pricingPrecedence.listPrice,
      }),
    };
  }

  const pricingException = [...(input.pricingExceptions ?? [])]
    .filter((rule) => appliesToRequest(rule, input, onDate))
    .sort(newestFirst)[0];
  if (pricingException) {
    return {
      unitPrice: null,
      currencyCode: pricingException.currencyCode,
      blocked: true,
      reason: pricingException.reason,
      provenance: provenanceFor({
        rule: pricingException,
        priceType: "blocking_exception",
        precedenceRank: pricingPrecedence.pricingException,
      }),
    };
  }

  throw new Error(`No price or pricing exception found for product ${input.productId} in ${input.currencyCode}`);
};
