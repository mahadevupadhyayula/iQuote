import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createServerSupabaseClient: vi.fn(() => ({})) }));

const state = vi.hoisted(() => {
  const timestamp = "2026-07-18T12:00:00.000Z";
  const customer = { id: "22222222-2222-4222-8222-222222222222", external_id: "buyer@example.com", name: "Atlas", legal_name: null, domain: null, billing_email: "buyer@example.com", phone: null, billing_address: {}, shipping_address: {}, metadata: {}, created_at: timestamp, updated_at: timestamp };
  const quote = { id: "11111111-1111-4111-8111-111111111111", opportunity_id: null, customer_id: customer.id, quote_number: "Q-1000", status: "draft", currency_code: "USD", subtotal_amount: 0, discount_amount: 0, tax_amount: 0, total_amount: 0, valid_until: null, submitted_at: null, approved_at: null, sent_at: null, accepted_at: null, metadata: {}, created_at: timestamp, updated_at: timestamp, items: [] };
  return { timestamp, customer, quote: { ...quote }, baseQuote: quote, events: [] as Record<string, unknown>[] };
});

const repositories = vi.hoisted(() => ({
  customers: { findByExternalId: vi.fn(), create: vi.fn() },
  quotes: { create: vi.fn(), findById: vi.fn(), update: vi.fn(), updateStatus: vi.fn(), replaceItems: vi.fn() },
  workflowEvents: { record: vi.fn(), findByIdempotencyKey: vi.fn() },
  products: { search: vi.fn(), findBySku: vi.fn(), findByAlias: vi.fn() },
}));

vi.mock("@/lib/repositories", () => ({ createRepositories: vi.fn(() => repositories) }));
vi.mock("@/lib/adapters/ai/quote-extraction-adapter", () => ({
  createQuoteExtractionAdapter: vi.fn(() => ({ extractQuoteRequest: vi.fn(async () => { throw new Error("OpenAI request timed out with sk-secret"); }) })),
}));

import { submitQuoteIntake } from "@/app/quotes/new/actions";

describe("submitQuoteIntake manual fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.events.length = 0;
    state.quote = { ...state.baseQuote, metadata: {}, items: [] };
    repositories.customers.findByExternalId.mockResolvedValue(state.customer);
    repositories.customers.create.mockResolvedValue(state.customer);
    repositories.quotes.create.mockImplementation(async (input: Record<string, unknown>) => {
      state.quote = { ...state.baseQuote, ...input, quote_number: "Q-1000", id: state.baseQuote.id, status: "draft", created_at: state.timestamp, updated_at: state.timestamp, items: [] };
      return state.quote;
    });
    repositories.quotes.findById.mockImplementation(async () => state.quote);
    repositories.quotes.update.mockImplementation(async (_id: string, input: Record<string, unknown>) => {
      state.quote = { ...state.quote, ...input };
      return state.quote;
    });
    repositories.quotes.updateStatus.mockImplementation(async (_id: string, status: string) => {
      state.quote = { ...state.quote, status };
      return state.quote;
    });
    repositories.workflowEvents.findByIdempotencyKey.mockResolvedValue(null);
    repositories.workflowEvents.record.mockImplementation(async (input: Record<string, unknown>) => {
      const event = { id: `${state.events.length + 1}`, created_at: state.timestamp, ...input };
      state.events.push(event);
      return event;
    });
  });

  it("returns the saved quote id with manual fallback state when extraction times out", async () => {
    const result = await submitQuoteIntake({ customerName: "Atlas", customerEmail: "buyer@example.com", currencyCode: "USD", requestText: "Need rugged scanners for a warehouse rollout." });

    expect(result).toMatchObject({
      ok: true,
      quoteId: state.baseQuote.id,
      status: "needs_information",
      extractionStatus: "manual_fallback",
      manualFallback: true,
      manualFallbackState: { enabled: true, reason: "extraction_failed", category: "timeout" },
    });
    expect(JSON.stringify(result)).not.toContain("sk-secret");
    expect(state.quote.metadata.manual_entry).toMatchObject({ enabled: true, failure_category: "timeout" });
  });
});
