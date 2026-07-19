import { describe, expect, it } from "vitest";

import { allInventoryConfirmed, createQuotePricingResolutionService } from "@/lib/services/quote-pricing-resolution-service";

const productId = "20000000-0000-4000-8000-000000000200";
const customerId = "10000000-0000-4000-8000-000000000001";
const quote = {
  id: "90000000-0000-4000-8000-000000000001",
  customer_id: customerId,
  currency_code: "USD",
  status: "configuring",
  metadata: {},
  items: [{ id: "91000000-0000-4000-8000-000000000001", quote_id: "90000000-0000-4000-8000-000000000001", product_id: productId, line_number: 1, sku: "AX-200", description: "AX", quantity: 2, unit_price: 0, discount_bps: 500, discount_amount: 0, line_total_amount: 0, metadata: { product_match: { method: "exact_sku", confidence: 1 }, selected_inventory_decision: { productId, status: "available", blocked: false }, selected_fulfillment: [{ warehouse: "CHI", quantity: 2 }], inventory_confirmed_at: "2026-07-19T00:00:00.000Z" }, created_at: "2026-07-19T00:00:00.000Z" }],
} as any;
const price = (price_type: "customer_specific" | "customer_tier" | "list", unit_price: number) => ({ id: `${price_type}-id`, product_id: productId, currency_code: "USD", unit_price, effective_from: "2026-01-01", effective_to: null, price_type, customer_tier: price_type === "customer_tier" ? "gold" : null, customer_id: price_type === "customer_specific" ? customerId : null, unit_cost: 60, source_name: "pricebook", source_version: "1", created_at: "2026-07-19T00:00:00.000Z" });

const makeRepositories = (prices: Record<string, any>) => {
  const state = { quote: structuredClone(quote), items: [] as any[] };
  return {
    state,
    customers: { findById: async () => ({ metadata: { customer_tier: "gold" } }) },
    prices: {
      findCustomerSpecificPrice: async () => prices.customer_specific ?? null,
      findCustomerTierPrice: async () => prices.customer_tier ?? null,
      findListPrice: async () => prices.list ?? null,
    },
    quotes: {
      findById: async () => state.quote,
      replaceItems: async (_quoteId: string, items: any[]) => { state.items = items.map((item, index) => ({ ...item, id: `new-${index}`, quote_id: state.quote.id, created_at: "2026-07-19T00:00:00.000Z" })); state.quote.items = state.items; return state.items; },
      update: async (_quoteId: string, update: any) => { state.quote = { ...state.quote, ...update, metadata: update.metadata ?? state.quote.metadata }; return state.quote; },
    },
    workflowEvents: { record: async () => ({}) },
  };
};

describe("quote pricing resolution", () => {
  it("recognizes when all inventory lines are confirmed", () => {
    expect(allInventoryConfirmed(quote.items)).toBe(true);
  });

  it("uses customer-specific pricing before tier and list", async () => {
    const repositories = makeRepositories({ customer_specific: price("customer_specific", 90), customer_tier: price("customer_tier", 95), list: price("list", 100) });
    const result = await createQuotePricingResolutionService(repositories as any).resolveQuotePricing({ quoteId: quote.id, onDate: "2026-07-19" });
    expect(result.items[0].unit_price).toBe(90);
    expect(result.items[0].metadata.price_application.price_type).toBe("customer_specific");
    expect(result.quote.total_amount).toBe(171);
    expect(result.quote.metadata.commercial_calculation.gross_margin_bps).toBe(2982);
  });

  it("falls back from tier pricing to list pricing and blocks missing prices", async () => {
    const tier = await createQuotePricingResolutionService(makeRepositories({ customer_tier: price("customer_tier", 95), list: price("list", 100) }) as any).resolveQuotePricing({ quoteId: quote.id, onDate: "2026-07-19" });
    expect(tier.items[0].metadata.price_application.price_type).toBe("customer_tier");
    const list = await createQuotePricingResolutionService(makeRepositories({ list: price("list", 100) }) as any).resolveQuotePricing({ quoteId: quote.id, onDate: "2026-07-19" });
    expect(list.items[0].metadata.price_application.price_type).toBe("list");
    const missing = await createQuotePricingResolutionService(makeRepositories({}) as any).resolveQuotePricing({ quoteId: quote.id, onDate: "2026-07-19" });
    expect(missing.blockers[0]).toMatchObject({ code: "missing_price", lineNumber: 1 });
  });
});
