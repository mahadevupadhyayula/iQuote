import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createServerSupabaseClient: vi.fn(() => ({})) }));

const quoteId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const productId = "99999999-9999-4999-8999-999999999999";
const timestamp = "2026-07-18T12:00:00.000Z";
const freshInventoryTimestamp = new Date().toISOString();

const buildItem = (overrides = {}) => ({
  id: "44444444-4444-4444-8444-444444444444",
  quote_id: quoteId,
  product_id: null,
  line_number: 1,
  sku: "OLD-SKU",
  description: "Old item",
  quantity: 1,
  unit_price: 100,
  discount_bps: 0,
  discount_amount: 0,
  line_total_amount: 100,
  metadata: {},
  created_at: timestamp,
  ...overrides,
});

const buildQuote = (overrides = {}) => ({
  id: quoteId,
  opportunity_id: null,
  customer_id: customerId,
  quote_number: "Q-1000",
  status: "needs_information",
  currency_code: "USD",
  subtotal_amount: 100,
  discount_amount: 0,
  tax_amount: 0,
  total_amount: 100,
  valid_until: null,
  submitted_at: null,
  approved_at: null,
  sent_at: null,
  accepted_at: null,
  metadata: { extraction: { original_request_text: "Original immutable request" }, requirements: { existing: true }, review: {} },
  created_at: timestamp,
  updated_at: timestamp,
  items: [buildItem()],
  ...overrides,
});

let storedQuote = buildQuote();
const events: Record<string, unknown>[] = [];

const repositories = {
  quotes: {
    findById: vi.fn(async () => storedQuote),
    replaceItems: vi.fn(async (_quoteId: string, items: Record<string, unknown>[]) => {
      storedQuote = { ...storedQuote, items: items.map((item, index) => buildItem({ ...item, id: `${index + 1}`.padStart(8, "0") + "-4444-4444-8444-444444444444", quote_id: quoteId, created_at: timestamp })) };
      return storedQuote.items;
    }),
    update: vi.fn(async (_quoteId: string, input: Record<string, unknown>) => {
      storedQuote = { ...storedQuote, ...input };
      return storedQuote;
    }),
    updateStatus: vi.fn(async (_quoteId: string, status: string) => {
      storedQuote = { ...storedQuote, status };
      return storedQuote;
    }),
  },
  products: { findById: vi.fn(async () => ({ id: productId, sku: "SKU-1", name: "Matched product", status: "active", description: null, unit_of_measure: "ea", metadata: {}, created_at: timestamp, updated_at: timestamp })), listSubstitutes: vi.fn(async () => []) },
  inventory: {
    listByProduct: vi.fn(async () => [{ id: "10101010-1010-4010-8010-101010101010", product_id: productId, warehouse_code: "MAIN", quantity_on_hand: 5, quantity_reserved: 0, reorder_point: 0, source_name: "test", source_version: "v1", refreshed_at: timestamp, metadata: {}, updated_at: timestamp }]),
    listByProducts: vi.fn(async () => []),
    findAtLocation: vi.fn(async () => null),
  },
  customers: { findById: vi.fn(async () => ({ id: customerId, external_id: null, name: "Acme", legal_name: null, domain: null, billing_email: null, phone: null, billing_address: {}, shipping_address: {}, metadata: {}, created_at: timestamp, updated_at: timestamp })) },
  prices: {
    findCustomerSpecificPrice: vi.fn(async () => null),
    findCustomerTierPrice: vi.fn(async () => null),
    findListPrice: vi.fn(async () => ({ id: "12121212-1212-4212-8212-121212121212", product_id: productId, currency_code: "USD", price_type: "list", unit_price: 250, unit_cost: 125, effective_from: "2026-01-01", effective_to: null, source_name: "test", source_version: "v1", metadata: {}, created_at: timestamp, updated_at: timestamp })),
  },
  workflowEvents: {
    record: vi.fn(async (input: Record<string, unknown>) => {
      const event = { id: `${events.length + 1}`.padStart(8, "0") + "-5555-4555-8555-555555555555", created_at: timestamp, ...input };
      events.push(event);
      return event;
    }),
    findByIdempotencyKey: vi.fn(async () => null),
  },
};

vi.mock("@/lib/repositories", () => ({ createRepositories: vi.fn(() => repositories) }));

import { applyRepCorrections, saveQuoteDraft, selectFulfillment } from "@/lib/actions/quote-actions";

describe("quote actions", () => {
  beforeEach(() => {
    storedQuote = buildQuote();
    events.length = 0;
    vi.clearAllMocks();
  });

  it("persists rep corrections in structured metadata and records before/after workflow summaries", async () => {
    const result = await applyRepCorrections({ quote_id: quoteId, actor_id: actorId, requirements: { delivery_window: "Q3" }, clarification_answers: { shipping: "Dock 4" }, product_candidates: { 1: "SKU-NEW" }, rep_confirmation: { confirmed: true, confirmed_by: actorId }, metadata: { extraction: { original_request_text: "Attempted overwrite" } }, lines: [{ sku: "SKU-NEW", description: "New item", quantity: 2, unit_price: 50, discount_bps: 1000, metadata: {} }] });
    expect(result.status).toBe("needs_information");
    expect(result.metadata.extraction).toEqual({ original_request_text: "Original immutable request" });
    expect(result.metadata.requirements).toMatchObject({ existing: true, delivery_window: "Q3", clarification_answers: { shipping: "Dock 4" } });
    expect(result.metadata.review).toMatchObject({ product_candidates: { 1: "SKU-NEW" }, rep_confirmation: { confirmed: true, confirmed_by: actorId } });
    expect(result.total_amount).toBe(90);
  });

  it("saves drafts without advancing quote status", async () => {
    await saveQuoteDraft({ quote_id: quoteId, actor_id: actorId, requirements: { note: "keep drafting" }, metadata: {} });
    expect(storedQuote.status).toBe("needs_information");
    expect(repositories.quotes.updateStatus).not.toHaveBeenCalled();
  });

  it("triggers pricing when final deterministic line inventory is applied and persists pricing metadata", async () => {
    storedQuote = buildQuote({ status: "draft", items: [buildItem({ product_id: productId, sku: "SKU-1", description: "Matched product", quantity: 2, unit_price: 0, line_total_amount: 0, metadata: { product_match: { method: "sku", confidence: 1, ambiguous: false, product_id: productId } } })] });
    const result = await selectFulfillment({ quote_id: quoteId, actor_id: actorId, line_number: 1 });
    expect(result.pricingStatus).toBe("resolved");
    expect(result.pricingBlockers).toEqual([]);
    expect(result.quote.metadata).toMatchObject({ pricing_status: "resolved", pricing_resolved: true, pricing_blockers: [], commercial_calculation: expect.any(Object) });
    expect(storedQuote.items[0]).toMatchObject({ unit_price: 250, line_total_amount: 500, metadata: expect.objectContaining({ pricing_resolved: true, price_application: expect.objectContaining({ price_type: "list", source_name: "test" }) }) });
    expect(repositories.workflowEvents.record).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ action: "pricing_resolution", status: "resolved" }) }));
  });
});
