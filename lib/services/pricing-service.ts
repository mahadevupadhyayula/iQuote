import { resolvePricing, type ResolvePricingInput, type ResolvedPrice } from "@/lib/rules/pricing-rules";

export type PricingRulesProvider = {
  getPricingRules(
    input: Pick<ResolvePricingInput, "productId" | "customerId" | "customerTier" | "currencyCode" | "onDate">,
  ): Promise<
    Pick<
      ResolvePricingInput,
      "customerSpecificPrices" | "customerTierPrices" | "quantityVolumeRules" | "listPrices" | "pricingExceptions"
    >
  >;
};

export type PriceRequest = Pick<
  ResolvePricingInput,
  "productId" | "customerId" | "customerTier" | "quantity" | "currencyCode" | "onDate"
>;

export const createPricingService = (provider: PricingRulesProvider) => ({
  async resolvePrice(request: PriceRequest): Promise<ResolvedPrice> {
    const rules = await provider.getPricingRules(request);
    return resolvePricing({ ...request, ...rules });
  },
});

export type PricingService = ReturnType<typeof createPricingService>;
