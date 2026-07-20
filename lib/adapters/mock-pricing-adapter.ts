import "server-only";

import { pricingPrecedence, resolvePricing, type ResolvedPrice } from "@/lib/rules/pricing-rules";
import type { Repositories } from "@/lib/repositories";
import type { PricingAdapter, PricingSourceMetadata, PricingSourceMetadataAdapter } from "./interfaces";

const today = () => new Date().toISOString().slice(0, 10);
const toRule = (price: Awaited<ReturnType<Repositories["prices"]["findActivePricesForProduct"]>>[number]) => ({
  id: price.id,
  productId: price.product_id,
  customerId: price.customer_id ?? "",
  customerTier: price.customer_tier ?? "",
  currencyCode: price.currency_code,
  unitPrice: price.unit_price,
  unitCost: price.unit_cost,
  effectiveFrom: price.effective_from,
  effectiveTo: price.effective_to,
  active: true,
  sourceName: price.source_name,
  sourceVersion: price.source_version,
});

export const createMockPricingAdapter = (repositories: Pick<Repositories, "prices">): PricingAdapter => ({
  async resolvePrice(input): Promise<ResolvedPrice> {
    const onDate = input.onDate ?? today();
    const activePrices = await repositories.prices.findActivePricesForProduct({ productId: input.productId, currencyCode: input.currencyCode, onDate });

    return resolvePricing({
      productId: input.productId,
      customerId: input.customerId,
      customerTier: input.customerTier,
      quantity: input.quantity,
      currencyCode: input.currencyCode,
      onDate,
      customerSpecificPrices: activePrices.filter((price) => price.price_type === "customer_specific" && price.customer_id).map((price) => ({ ...toRule(price), customerId: price.customer_id! })),
      customerTierPrices: activePrices.filter((price) => price.price_type === "customer_tier" && price.customer_tier).map((price) => ({ ...toRule(price), customerTier: price.customer_tier! })),
      listPrices: activePrices.filter((price) => price.price_type === "list").map(toRule),
    });
  },

  async getPriceCandidates() {
    return [];
  },

  async getMetadata(input = {}) {
    const onDate = input.onDate ?? today();
    const prices = await repositories.prices.listCurrentPrices([], input.currencyCode ?? "USD", onDate);
    const source = prices[0];
    return {
      sourceName: source?.source_name ?? "demo_erp_pricebook",
      sourceVersion: source?.source_version ?? onDate,
      refreshedAt: new Date(`${onDate}T00:00:00.000Z`).toISOString(),
      currencyCode: input.currencyCode ?? "USD",
      precedence: Object.keys(pricingPrecedence),
    } satisfies PricingSourceMetadata;
  },
});

export const createMockPricingSourceMetadataAdapter = (repositories?: Pick<Repositories, "prices">): PricingSourceMetadataAdapter => {
  if (repositories) return createMockPricingAdapter(repositories);
  return {
    async getMetadata(input = {}) {
      const onDate = input.onDate ?? today();
      return {
        sourceName: "demo_erp_pricebook",
        sourceVersion: onDate,
        refreshedAt: new Date(`${onDate}T00:00:00.000Z`).toISOString(),
        currencyCode: input.currencyCode ?? "USD",
        precedence: Object.keys(pricingPrecedence),
      };
    },
  };
};
