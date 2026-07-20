import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createServerSupabaseClient: vi.fn(() => ({})) }));

const state = vi.hoisted(() => {
  const timestamp = "2026-07-18T12:00:00.000Z";
  const customer = { id: "22222222-2222-4222-8222-222222222222", external_id: "buyer@example.com", name: "Atlas", legal_name: null, domain: null, billing_email: "buyer@example.com", phone: null, billing_address: {}, shipping_address: {}, metadata: {}, created_at: timestamp, updated_at: timestamp };
  const quote = { id: "11111111-1111-4111-8111-111111111111", opportunity_id: null, customer_id: customer.id, quote_number: "Q-1000", status: "draft", currency_code: "USD", subtotal_amount: 0, discount_amount: 0, tax_amount: 0, total_amount: 0, valid_until: null, submitted_at: null, approved_at: null, sent_at: null, accepted_at: null, sla_due_at: null, metadata: {}, created_at: timestamp, updated_at: timestamp, items: [] };
  return { timestamp, customer, quote: { ...quote }, baseQuote: quote, events: [] as Record<string, unknown>[], extractionOutput: null as Record<string, unknown> | null, extractionError: new Error("OpenAI request timed out with sk-secret") as Error | null };
});

const repositories = vi.hoisted(() => ({
  customers: { findByExternalId: vi.fn(), create: vi.fn() },
  quotes: { create: vi.fn(), findById: vi.fn(), update: vi.fn(), updateStatus: vi.fn(), replaceItems: vi.fn() },
  workflowEvents: { record: vi.fn(), findByIdempotencyKey: vi.fn() },
  products: { search: vi.fn(), findBySku: vi.fn(), findByAlias: vi.fn() },
}));

vi.mock("@/lib/repositories", () => ({ createRepositories: vi.fn(() => repositories) }));
vi.mock("@/lib/adapters/ai/quote-extraction-adapter", () => ({
  createQuoteExtractionAdapter: vi.fn(() => ({ extractQuoteRequest: vi.fn(async () => { if (state.extractionError) throw state.extractionError; return state.extractionOutput; }) })),
}));

import { submitQuoteIntake } from "@/app/quotes/new/actions";

const completeExtraction = (overrides: Record<string, unknown> = {}) => ({
  source_text: "Atlas needs 2 AX-200 delivered to Dallas by 2026-09-15.",
  customer_name: { value: "Atlas", missing: false, confidence: 0.95, source_span: null },
  opportunity_name: { value: "Warehouse", missing: false, confidence: 0.9, source_span: null },
  requested_items: [{ line_number: 1, raw_item_description: { value: "AX-200", missing: false, confidence: 0.95, source_span: null }, requested_sku: { value: "AX-200", missing: false, confidence: 0.95, source_span: null }, quantity: { value: 2, missing: false, confidence: 0.95, source_span: null }, specifications: { value: "standard", missing: false, confidence: 0.8, source_span: null } }],
  delivery_location: { value: "Dallas", missing: false, confidence: 0.9, source_span: null },
  delivery_date: { value: "2026-09-15", missing: false, confidence: 0.9, source_span: null },
  requested_discount: { value: null, missing: true, confidence: 0, source_span: null },
  installation_requirement: { value: "not required", missing: false, confidence: 0.8, source_span: null },
  special_requirements: { value: "none", missing: false, confidence: 0.8, source_span: null },
  missing_fields: [],
  ambiguities: [],
  clarification_questions: [],
  field_confidence: {},
  overall_confidence: 0.92,
  ...overrides,
});

describe("submitQuoteIntake", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(state.timestamp));
    vi.clearAllMocks();
    state.events.length = 0;
    state.quote = { ...state.baseQuote, metadata: {}, items: [] };
    state.extractionOutput = null;
    state.extractionError = new Error("OpenAI request timed out with sk-secret");
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
    repositories.products.findBySku.mockResolvedValue(null);
    repositories.products.findByAlias.mockResolvedValue(null);
    repositories.products.search.mockResolvedValue([]);
    repositories.quotes.replaceItems.mockResolvedValue([]);
    repositories.workflowEvents.findByIdempotencyKey.mockResolvedValue(null);
    repositories.workflowEvents.record.mockImplementation(async (input: Record<string, unknown>) => {
      const event = { id: `${state.events.length + 1}`, created_at: state.timestamp, ...input };
      state.events.push(event);
      return event;
    });
  });

  it("returns the saved quote id with manual fallback state when extraction times out", async () => {
    const result = await submitQuoteIntake({ customerName: "Atlas", customerEmail: "buyer@example.com", currencyCode: "USD", requestText: "Need rugged scanners for a warehouse rollout." });

    expect(result).toMatchObject({ ok: true, quoteId: state.baseQuote.id, status: "reviewing", extractionStatus: "manual_fallback", manualFallback: true, manualFallbackState: { enabled: true, reason: "extraction_failed", category: "timeout" } });
    expect(JSON.stringify(result)).not.toContain("sk-secret");
    expect(result).toMatchObject({ slaStartedAt: "2026-07-18T12:00:00.000Z", slaDueAt: "2026-07-18T12:15:00.000Z" });
    expect(state.quote.sla_due_at).toBe("2026-07-18T12:15:00.000Z");
    const metadata = state.quote.metadata as Record<string, unknown>;
    expect(metadata.sla).toMatchObject({ started_at: "2026-07-18T12:00:00.000Z", due_at: "2026-07-18T12:15:00.000Z", policy_minutes: 15 });
    expect(metadata.manual_entry).toMatchObject({ enabled: true, failure_category: "timeout" });
  });

  it("returns reviewing when extraction completes with required information", async () => {
    state.extractionError = null;
    state.extractionOutput = completeExtraction();

    const result = await submitQuoteIntake({ customerName: "Atlas", customerEmail: "buyer@example.com", currencyCode: "USD", requestText: "Atlas needs 2 AX-200 delivered to Dallas by 2026-09-15." });

    expect(result).toMatchObject({ ok: true, quoteId: state.baseQuote.id, status: "reviewing", extractionStatus: "completed" });
  });

  it("returns reviewing when extraction reports ambiguous information requiring review", async () => {
    state.extractionError = null;
    state.extractionOutput = completeExtraction({
      source_text: "Atlas needs 2 AX-200 delivered to Dallas by 2026-09-15, but installation ownership is unclear.",
      installation_requirement: { value: "installation ownership unclear", missing: false, confidence: 0.35, source_span: null },
      ambiguities: [{ field: "installation_requirement", description: "Customer text does not confirm whether Atlas or the vendor owns installation." }],
      clarification_questions: [{ field: "installation_requirement", question: "Should Atlas install internally, or should vendor installation be included?" }],
      overall_confidence: 0.72,
    });

    const result = await submitQuoteIntake({ customerName: "Atlas", customerEmail: "buyer@example.com", currencyCode: "USD", requestText: "Atlas needs 2 AX-200 delivered to Dallas by 2026-09-15, but installation ownership is unclear." });

    expect(result).toMatchObject({ ok: true, status: "reviewing" });
    expect(result.ok && result.clarificationQuestions).toEqual(expect.arrayContaining([expect.objectContaining({ field: "installation_requirement" })]));
  });
});
