import { describe, expect, it } from "vitest";

import { pricingPrecedence, resolvePricing, type ResolvePricingInput } from "@/lib/rules/pricing-rules";
import { createPricingService } from "@/lib/services/pricing-service";

const baseRequest = {
  productId: "prod-1",
  customerId: "cust-1",
  customerTier: "gold",
  quantity: 25,
  currencyCode: "USD",
  onDate: "2026-07-18",
} satisfies Pick<ResolvePricingInput, "productId" | "customerId" | "customerTier" | "quantity" | "currencyCode" | "onDate">;

const source = {
  productId: "prod-1",
  currencyCode: "USD",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  active: true,
  sourceName: "pricing-catalog",
  sourceVersion: "2026.07",
};

const listPrice = {
  ...source,
  id: "list-price-1",
  unitPrice: 100,
};

const resolve = (overrides: Partial<ResolvePricingInput>) =>
  resolvePricing({
    ...baseRequest,
    listPrices: [listPrice],
    ...overrides,
  });

describe("pricing rules", () => {
  it("uses active customer-specific price before every other price source", () => {
    const result = resolve({
      customerSpecificPrices: [{ ...source, id: "customer-price-1", customerId: "cust-1", unitPrice: 72 }],
      customerTierPrices: [{ ...source, id: "tier-price-1", customerTier: "gold", unitPrice: 80 }],
      quantityVolumeRules: [{ ...source, id: "volume-rule-1", minimumQuantity: 10, unitPrice: 90 }],
    });

    expect(result.unitPrice).toBe(72);
    expect(result.blocked).toBe(false);
    expect(result.provenance).toEqual({
      price_id: "customer-price-1",
      sourceName: "pricing-catalog",
      sourceVersion: "2026.07",
      priceType: "customer_specific",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      precedenceRank: pricingPrecedence.customerSpecificPrice,
    });
  });

  it("uses active customer-tier price when no customer-specific price applies", () => {
    const result = resolve({
      customerSpecificPrices: [{ ...source, id: "inactive-customer-price", customerId: "cust-1", unitPrice: 70, active: false }],
      customerTierPrices: [{ ...source, id: "tier-price-1", customerTier: "gold", unitPrice: 82 }],
      quantityVolumeRules: [{ ...source, id: "volume-rule-1", minimumQuantity: 10, unitPrice: 90 }],
    });

    expect(result.unitPrice).toBe(82);
    expect(result.provenance.price_id).toBe("tier-price-1");
    expect(result.provenance.priceType).toBe("customer_tier");
    expect(result.provenance.precedenceRank).toBe(pricingPrecedence.customerTierPrice);
  });

  it("uses applicable quantity/volume rule when customer-specific and tier prices do not apply", () => {
    const result = resolve({
      customerTierPrices: [{ ...source, id: "wrong-tier-price", customerTier: "silver", unitPrice: 84 }],
      quantityVolumeRules: [
        { ...source, id: "volume-rule-10", minimumQuantity: 10, unitPrice: 91 },
        { ...source, id: "volume-rule-20", minimumQuantity: 20, percentOff: 15 },
      ],
    });

    expect(result.unitPrice).toBe(85);
    expect(result.provenance.price_id).toBe("volume-rule-20");
    expect(result.provenance.priceType).toBe("quantity_volume");
    expect(result.provenance.precedenceRank).toBe(pricingPrecedence.quantityVolumeRule);
  });

  it("uses current list price when no higher-precedence price applies", () => {
    const result = resolve({
      quantityVolumeRules: [{ ...source, id: "too-large-volume-rule", minimumQuantity: 100, unitPrice: 75 }],
    });

    expect(result.unitPrice).toBe(100);
    expect(result.provenance.price_id).toBe("list-price-1");
    expect(result.provenance.priceType).toBe("list");
    expect(result.provenance.precedenceRank).toBe(pricingPrecedence.listPrice);
  });

  it("returns a blocking pricing exception when no price branch applies", () => {
    const result = resolve({
      listPrices: [],
      pricingExceptions: [{ ...source, id: "exception-1", reason: "Manual price review required" }],
    });

    expect(result).toMatchObject({
      unitPrice: null,
      currencyCode: "USD",
      blocked: true,
      reason: "Manual price review required",
    });
    expect(result.provenance).toEqual({
      price_id: "exception-1",
      sourceName: "pricing-catalog",
      sourceVersion: "2026.07",
      priceType: "blocking_exception",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      precedenceRank: pricingPrecedence.pricingException,
    });
  });

  it("loads rules through the pricing service before resolving precedence", async () => {
    const service = createPricingService({
      async getPricingRules() {
        return {
          listPrices: [listPrice],
          customerTierPrices: [{ ...source, id: "tier-price-1", customerTier: "gold", unitPrice: 82 }],
        };
      },
    });

    await expect(service.resolvePrice(baseRequest)).resolves.toMatchObject({
      unitPrice: 82,
      provenance: { price_id: "tier-price-1", precedenceRank: pricingPrecedence.customerTierPrice },
    });
  });
});
