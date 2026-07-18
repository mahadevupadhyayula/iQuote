import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createExtractionService } from "@/lib/services/extraction-service";

const quoteId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-07-18T12:00:00.000Z";

const buildQuote = (overrides: Record<string, unknown> = {}) => ({
  id: quoteId,
  opportunity_id: null,
  customer_id: customerId,
  quote_number: "Q-1000",
  status: "extracting",
  currency_code: "USD",
  subtotal_amount: 0,
  discount_amount: 0,
  tax_amount: 0,
  total_amount: 0,
  valid_until: null,
  submitted_at: null,
  approved_at: null,
  sent_at: null,
  accepted_at: null,
  metadata: { intake: { request_text: "Need scanners" }, existing: "preserved" },
  created_at: timestamp,
  updated_at: timestamp,
  items: [],
  ...overrides,
});

const buildHarness = (adapterError: unknown) => {
  let storedQuote = buildQuote();
  const events: Record<string, unknown>[] = [];
  const quotesRepository = {
    findById: vi.fn(async () => storedQuote),
    update: vi.fn(async (_id: string, input: Record<string, unknown>) => {
      storedQuote = { ...storedQuote, ...input };
      return storedQuote;
    }),
    updateStatus: vi.fn(async (_id: string, status: string) => {
      storedQuote = { ...storedQuote, status };
      return storedQuote;
    }),
  };
  const workflowEventsRepository = {
    findByIdempotencyKey: vi.fn(async () => null),
    record: vi.fn(async (input: Record<string, unknown>) => {
      const event = { id: `${events.length + 1}`, created_at: timestamp, ...input };
      events.push(event);
      return event;
    }),
  };
  const extractionAdapter = { extractQuoteRequest: vi.fn(async () => { throw adapterError; }) };
  const service = createExtractionService({ quotesRepository: quotesRepository as never, workflowEventsRepository: workflowEventsRepository as never, extractionAdapter });
  return { service, quotesRepository, workflowEventsRepository, get storedQuote() { return storedQuote; } };
};

describe("createExtractionService failure fallback", () => {
  beforeEach(() => vi.useRealTimers());

  it("preserves the draft quote and enables manual entry for malformed model responses", async () => {
    const { service, workflowEventsRepository, storedQuote } = buildHarness(new SyntaxError("Unexpected token super-secret-api-key"));

    const result = await service.extractAndPersist({ quoteId, sourceText: "Need scanners" });

    expect(result.extraction).toBeNull();
    expect(result.failure).toMatchObject({ category: "malformed_response", summary: expect.stringContaining("could not be read") });
    expect(storedQuote.metadata).toMatchObject({ existing: "preserved", manual_entry: { enabled: true, reason: "extraction_failed", failure_category: "malformed_response" } });
    expect((storedQuote.metadata as Record<string, unknown>).extraction).toMatchObject({ status: "failed", source_text: "Need scanners", failure: { category: "malformed_response", recoverable: true } });
    expect(JSON.stringify(storedQuote.metadata)).not.toContain("super-secret-api-key");
    expect(workflowEventsRepository.record).toHaveBeenCalledWith(expect.objectContaining({
      event_type: "extraction_failed",
      from_status: "extracting",
      to_status: "needs_information",
      payload: { action: "quote_extraction_failed", error_category: "malformed_response", error_summary: expect.any(String), manual_entry_enabled: true },
    }));
  });

  it("classifies timeouts without exposing the adapter error message", async () => {
    const { service, storedQuote } = buildHarness(new Error("OpenAI request timed out with token sk-live-secret"));

    const result = await service.extractAndPersist({ quoteId, sourceText: "Need scanners" });

    expect(result.failure?.category).toBe("timeout");
    expect(storedQuote.status).toBe("needs_information");
    expect(JSON.stringify(storedQuote.metadata)).not.toContain("sk-live-secret");
  });

  it("classifies Zod parse failures and returns manual fallback metadata", async () => {
    const { service, storedQuote } = buildHarness({ source_text: "Need scanners" });

    const result = await service.extractAndPersist({ quoteId, sourceText: "Need scanners" });

    expect(result).toMatchObject({ extraction: null, failure: { category: "schema_validation", summary: expect.stringContaining("required schema") } });
    expect((storedQuote.metadata as Record<string, unknown>).manual_entry).toMatchObject({ enabled: true, failure_category: "schema_validation" });
  });
});
