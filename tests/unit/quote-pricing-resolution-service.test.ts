import { describe, expect, it } from "vitest";

import type { CustomerRecord, PriceRecord, QuoteItemRecord, WorkflowEventRecord } from "@/lib/schemas/shared-records";
import { allInventoryConfirmed, createQuotePricingResolutionService, type QuotePricingResolutionRepositories } from "@/lib/services/quote-pricing-resolution-service";
import type { QuoteItemCreateInput, QuoteUpdateInput, QuoteWithItems } from "@/lib/repositories/quotes";

const productId = "20000000-0000-4000-8000-000000000200";
const customerId = "10000000-0000-4000-8000-000000000001";
const quoteId = "90000000-0000-4000-8000-000000000001";
const timestamp = "2026-07-19T00:00:00.000Z";

type PriceType = "customer_specific" | "customer_tier" | "list";
type PriceFixtures = Partial<Record<PriceType, PriceRecord>>;
type TestState = { quote: QuoteWithItems; items: QuoteItemRecord[] };

type ResolvedLine = QuoteItemRecord & {
  metadata: QuoteItemRecord["metadata"] & {
    price_application?: { price_type?: PriceType } | null;
  };
};

type ResolvedQuote = QuoteWithItems & {
  metadata: QuoteWithItems["metadata"] & {
    commercial_calculation?: { gross_margin_bps?: number };
  };
};

const quoteItem: QuoteItemRecord = {
  id: "91000000-0000-4000-8000-000000000001",
  quote_id: quoteId,
  product_id: productId,
  line_number: 1,
  sku: "AX-200",
  description: "AX",
  quantity: 2,
  unit_price: 0,
  discount_bps: 500,
  discount_amount: 0,
  line_total_amount: 0,
  metadata: {
    product_match: { method: "exact_sku", confidence: 1 },
    selected_inventory_decision: { productId, status: "available", blocked: false },
    selected_fulfillment: [{ warehouse: "CHI", quantity: 2 }],
    inventory_confirmed_at: timestamp,
  },
  created_at: timestamp,
};

const customer: CustomerRecord = {
  id: customerId,
  external_id: "DEMO-CUST",
  name: "Demo Customer",
  legal_name: null,
  domain: null,
  billing_email: null,
  phone: null,
  billing_address: {},
  shipping_address: {},
  metadata: { customer_tier: "gold" },
  created_at: timestamp,
  updated_at: timestamp,
};

const workflowEvent: WorkflowEventRecord = {
  id: "92000000-0000-4000-8000-000000000001",
  quote_id: quoteId,
  event_type: "updated",
  actor_id: null,
  from_status: "configuring",
  to_status: "configuring",
  payload: {},
  created_at: timestamp,
};

const quote: QuoteWithItems = {
  id: quoteId,
  customer_id: customerId,
  opportunity_id: null,
  quote_number: "Q-TEST",
  currency_code: "USD",
  status: "configuring",
  subtotal_amount: 0,
  discount_amount: 0,
  tax_amount: 0,
  total_amount: 0,
  valid_until: null,
  submitted_at: null,
  approved_at: null,
  sent_at: null,
  accepted_at: null,
  sla_due_at: null,
  metadata: {},
  created_at: timestamp,
  updated_at: timestamp,
  items: [quoteItem],
};

const price = (price_type: PriceType, unit_price: number): PriceRecord => ({
  id: `40000000-0000-4000-8000-${price_type === "customer_specific" ? "000000000001" : price_type === "customer_tier" ? "000000000002" : "000000000003"}`,
  product_id: productId,
  currency_code: "USD",
  unit_price,
  effective_from: "2026-01-01",
  effective_to: null,
  price_type,
  customer_tier: price_type === "customer_tier" ? "gold" : null,
  customer_id: price_type === "customer_specific" ? customerId : null,
  unit_cost: 60,
  source_name: "pricebook",
  source_version: "1",
  created_at: timestamp,
});

const makeRepositories = (priceFixtures: PriceFixtures): QuotePricingResolutionRepositories & { state: TestState } => {
  const state: TestState = { quote: structuredClone(quote), items: [] };
  return {
    state,
    customers: { findById: async () => customer },
    prices: {
      findCustomerSpecificPrice: async () => priceFixtures.customer_specific ?? null,
      findCustomerTierPrice: async () => priceFixtures.customer_tier ?? null,
      findListPrice: async () => priceFixtures.list ?? null,
    },
    quotes: {
      findById: async () => state.quote,
      replaceItems: async (_currentQuoteId: string, items: Omit<QuoteItemCreateInput, "quote_id">[]) => {
        state.items = items.map((item, index) => ({ ...item, id: `91000000-0000-4000-8000-00000000000${index + 2}`, quote_id: state.quote.id, created_at: timestamp }));
        state.quote.items = state.items;
        return state.items;
      },
      update: async (_currentQuoteId: string, update: QuoteUpdateInput) => {
        state.quote = { ...state.quote, ...update, metadata: update.metadata ?? state.quote.metadata, items: state.quote.items };
        return state.quote;
      },
    },
    workflowEvents: { record: async () => workflowEvent },
  };
};

const firstLine = (items: QuoteItemRecord[]): ResolvedLine => items[0] as ResolvedLine;
const resolvedQuote = (candidate: QuoteWithItems): ResolvedQuote => candidate as ResolvedQuote;

describe("quote pricing resolution", () => {
  it("recognizes when all inventory lines are confirmed", () => {
    expect(allInventoryConfirmed(quote.items)).toBe(true);
  });

  it("uses customer-specific pricing before tier and list", async () => {
    const repositories = makeRepositories({ customer_specific: price("customer_specific", 90), customer_tier: price("customer_tier", 95), list: price("list", 100) });
    const result = await createQuotePricingResolutionService(repositories).resolveQuotePricing({ quoteId: quote.id, onDate: "2026-07-19" });
    expect(firstLine(result.items).unit_price).toBe(90);
    expect(firstLine(result.items).metadata.price_application?.price_type).toBe("customer_specific");
    expect(result.quote.total_amount).toBe(171);
    expect(resolvedQuote(result.quote).metadata.commercial_calculation?.gross_margin_bps).toBe(2982);
  });

  it("falls back from tier pricing to list pricing and blocks missing prices", async () => {
    const tier = await createQuotePricingResolutionService(makeRepositories({ customer_tier: price("customer_tier", 95), list: price("list", 100) })).resolveQuotePricing({ quoteId: quote.id, onDate: "2026-07-19" });
    expect(firstLine(tier.items).metadata.price_application?.price_type).toBe("customer_tier");
    const list = await createQuotePricingResolutionService(makeRepositories({ list: price("list", 100) })).resolveQuotePricing({ quoteId: quote.id, onDate: "2026-07-19" });
    expect(firstLine(list.items).metadata.price_application?.price_type).toBe("list");
    const missing = await createQuotePricingResolutionService(makeRepositories({})).resolveQuotePricing({ quoteId: quote.id, onDate: "2026-07-19" });
    expect(missing.blockers[0]).toMatchObject({ code: "missing_price", lineNumber: 1 });
  });
});
