import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/server", () => ({ createServerSupabaseClient: vi.fn(() => ({})) }));

const quoteId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const timestamp = "2026-07-18T12:00:00.000Z";

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
  metadata: {
    extraction: { original_request_text: "Original immutable request" },
    requirements: { existing: true },
    review: {},
  },
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
      storedQuote = {
        ...storedQuote,
        items: items.map((item, index) => buildItem({ ...item, id: `${index + 1}`.padStart(8, "0") + "-4444-4444-8444-444444444444", quote_id: quoteId, created_at: timestamp })),
      };
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

import { applyRepCorrections, saveQuoteDraft } from "@/lib/actions/quote-actions";

describe("quote actions", () => {
  beforeEach(() => {
    storedQuote = buildQuote();
    events.length = 0;
    vi.clearAllMocks();
  });

  it("persists rep corrections in structured metadata and records before/after workflow summaries", async () => {
    const result = await applyRepCorrections({
      quote_id: quoteId,
      actor_id: actorId,
      requirements: { delivery_window: "Q3" },
      clarification_answers: { shipping: "Dock 4" },
      product_candidates: { 1: "SKU-NEW" },
      rep_confirmation: { confirmed: true, confirmed_by: actorId },
      metadata: { extraction: { original_request_text: "Attempted overwrite" } },
      lines: [{ sku: "SKU-NEW", description: "New item", quantity: 2, unit_price: 50, discount_bps: 1000, metadata: {} }],
    });

    expect(result.status).toBe("needs_information");
    expect(result.metadata.extraction).toEqual({ original_request_text: "Original immutable request" });
    expect(result.metadata.requirements).toMatchObject({ existing: true, delivery_window: "Q3", clarification_answers: { shipping: "Dock 4" } });
    expect(result.metadata.review).toMatchObject({ product_candidates: { 1: "SKU-NEW" }, rep_confirmation: { confirmed: true, confirmed_by: actorId } });
    expect(result.total_amount).toBe(90);
    expect(repositories.workflowEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "updated",
      from_status: "needs_information",
      to_status: "needs_information",
      payload: expect.objectContaining({ action: "apply_rep_corrections", before: expect.any(Object), after: expect.any(Object) }),
    }));
  });

  it("saves drafts without advancing quote status", async () => {
    await saveQuoteDraft({ quote_id: quoteId, actor_id: actorId, requirements: { note: "keep drafting" }, metadata: {} });

    expect(storedQuote.status).toBe("needs_information");
    expect(repositories.quotes.updateStatus).not.toHaveBeenCalled();
    expect(repositories.workflowEvents.record).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "updated",
      from_status: "needs_information",
      to_status: "needs_information",
      payload: expect.objectContaining({ action: "save_quote_draft" }),
    }));
  });
});
