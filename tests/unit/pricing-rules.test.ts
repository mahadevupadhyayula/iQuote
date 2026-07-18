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
  unitCost: 64,
};

const resolve = (overrides: Partial<ResolvePricingInput>) =>
  resolvePricing({
    ...baseRequest,
    listPrices: [listPrice],
    ...overrides,
  });

describe("pricing rules", () => {
  it("uses active customer-specific price before tier and list prices", () => {
    const result = resolve({
      customerSpecificPrices: [{ ...source, id: "customer-price-1", customerId: "cust-1", unitPrice: 72, unitCost: 51 }],
      customerTierPrices: [{ ...source, id: "tier-price-1", customerTier: "gold", unitPrice: 80, unitCost: 58 }],
    });

    expect(result).toMatchObject({
      unitPriceCents: 7200,
      unitCostCents: 5100,
      currencyCode: "USD",
      priceType: "customer_specific",
      sourceName: "pricing-catalog",
      sourceVersion: "2026.07",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      blocked: false,
    });
    expect(result.precedenceReason).toContain("customer-specific");
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
      customerSpecificPrices: [{ ...source, id: "inactive-customer-price", customerId: "cust-1", unitPrice: 70, unitCost: 50, active: false }],
      customerTierPrices: [{ ...source, id: "tier-price-1", customerTier: "gold", unitPrice: 82, unitCost: 60 }],
    });

    expect(result.unitPriceCents).toBe(8200);
    expect(result.unitCostCents).toBe(6000);
    expect(result.priceType).toBe("customer_tier");
    expect(result.provenance.precedenceRank).toBe(pricingPrecedence.customerTierPrice);
  });

  it("uses current list price when no higher-precedence price applies", () => {
    const result = resolve({
      customerTierPrices: [{ ...source, id: "wrong-tier-price", customerTier: "silver", unitPrice: 84, unitCost: 60 }],
    });

    expect(result.unitPriceCents).toBe(10000);
    expect(result.unitCostCents).toBe(6400);
    expect(result.priceType).toBe("list");
    expect(result.provenance.precedenceRank).toBe(pricingPrecedence.listPrice);
  });

  it("ignores expired customer-specific prices and falls back to customer-tier pricing", () => {
    const result = resolve({
      customerSpecificPrices: [
        { ...source, id: "expired-customer-price", customerId: "cust-1", unitPrice: 60, unitCost: 40, effectiveTo: "2026-07-17" },
      ],
      customerTierPrices: [{ ...source, id: "tier-price-1", customerTier: "gold", unitPrice: 82, unitCost: 60 }],
    });

    expect(result.unitPriceCents).toBe(8200);
    expect(result.provenance.price_id).toBe("tier-price-1");
  });

  it("ignores future-dated customer-specific prices and falls back to customer-tier pricing", () => {
    const result = resolve({
      customerSpecificPrices: [
        { ...source, id: "future-customer-price", customerId: "cust-1", unitPrice: 61, unitCost: 41, effectiveFrom: "2026-07-19" },
      ],
      customerTierPrices: [{ ...source, id: "tier-price-1", customerTier: "gold", unitPrice: 82, unitCost: 60 }],
    });

    expect(result.unitPriceCents).toBe(8200);
    expect(result.provenance.price_id).toBe("tier-price-1");
  });

  it("resolves overlapping prices deterministically by latest effective date within the same precedence", () => {
    const result = resolve({
      customerSpecificPrices: [
        { ...source, id: "older-customer-price", customerId: "cust-1", unitPrice: 72, unitCost: 51, effectiveFrom: "2026-01-01" },
        { ...source, id: "newer-customer-price", customerId: "cust-1", unitPrice: 68, unitCost: 49, effectiveFrom: "2026-06-01" },
      ],
    });

    expect(result.unitPriceCents).toBe(6800);
    expect(result.provenance.price_id).toBe("newer-customer-price");
  });

  it("blocks quoting when the selected price is missing unit cost", () => {
    const result = resolve({
      customerSpecificPrices: [{ ...source, id: "customer-price-no-cost", customerId: "cust-1", unitPrice: 72, unitCost: null }],
    });

    expect(result).toMatchObject({
      unitPriceCents: 7200,
      unitCostCents: null,
      blocked: true,
      reason: "Unit cost is required before this quote is commercially ready.",
      priceType: "customer_specific",
    });
    expect(result.precedenceReason).toContain("missing unit cost");
  });

  it("returns a blocking result when no active price branch applies", () => {
    const result = resolve({ listPrices: [] });

    expect(result).toMatchObject({
      unitPriceCents: null,
      unitCostCents: null,
      currencyCode: "USD",
      priceType: "blocking_exception",
      blocked: true,
      sourceName: "pricing-rules",
      sourceVersion: "unresolved",
    });
    expect(result.reason).toContain("No active price found");
  });

  it("loads rules through the pricing service before resolving precedence", async () => {
    const service = createPricingService({
      async getPricingRules() {
        return {
          listPrices: [listPrice],
          customerTierPrices: [{ ...source, id: "tier-price-1", customerTier: "gold", unitPrice: 82, unitCost: 60 }],
        };
      },
    });

    await expect(service.resolvePrice(baseRequest)).resolves.toMatchObject({
      unitPriceCents: 8200,
      unitCostCents: 6000,
      provenance: { price_id: "tier-price-1", precedenceRank: pricingPrecedence.customerTierPrice },
    });
  });
});
