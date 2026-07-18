import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { QuoteStatus } from "@/lib/domain/quote-statuses";
import type { WorkflowEventType } from "@/lib/domain/workflow-events";
import { createWorkflowService, WorkflowTransitionError, workflowTransitions } from "@/lib/services/workflow-service";
import type { QuoteWithItems } from "@/lib/repositories/quotes";

const quoteId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const timestamp = "2026-07-18T12:00:00.000Z";

const buildQuote = (status: QuoteStatus, items: QuoteWithItems["items"] = [{ id: "44444444-4444-4444-8444-444444444444" } as QuoteWithItems["items"][number]]): QuoteWithItems => ({
  id: quoteId,
  opportunity_id: null,
  customer_id: customerId,
  quote_number: "Q-1000",
  status,
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
  metadata: {},
  created_at: timestamp,
  updated_at: timestamp,
  items,
});

const buildHarness = (quote: QuoteWithItems, events: Record<string, unknown>[] = []) => {
  let storedQuote = quote;
  const quotesRepository = {
    findById: vi.fn(async () => storedQuote),
    updateStatus: vi.fn(async (_id: string, status: QuoteStatus, timestamps = {}) => {
      storedQuote = { ...storedQuote, status, ...timestamps };
      return storedQuote;
    }),
  };
  const workflowEventsRepository = {
    listByQuote: vi.fn(async () => events),
    record: vi.fn(async (input: Record<string, unknown>) => ({ id: "55555555-5555-4555-8555-555555555555", created_at: timestamp, ...input })),
  };

  return {
    quotesRepository,
    workflowEventsRepository,
    service: createWorkflowService({
      quotesRepository: quotesRepository as never,
      workflowEventsRepository: workflowEventsRepository as never,
      now: () => new Date(timestamp),
    }),
  };
};

describe("workflow service", () => {
  it("declares every V1 legal transition with a workflow event type", () => {
    const expectedTransitions: Record<QuoteStatus, Partial<Record<QuoteStatus, WorkflowEventType>>> = {
      draft: { needs_information: "updated", pending_approval: "submitted_for_approval", approved: "approved", sent: "sent", cancelled: "cancelled" },
      needs_information: { draft: "updated", pending_approval: "submitted_for_approval", cancelled: "cancelled" },
      pending_approval: { approved: "approved", rejected: "rejected", cancelled: "cancelled" },
      approved: { sent: "sent", cancelled: "cancelled" },
      sent: { accepted: "accepted", rejected: "rejected", expired: "expired", cancelled: "cancelled" },
      accepted: {},
      rejected: { draft: "updated" },
      expired: { draft: "updated" },
      cancelled: {},
    };

    expect(Object.fromEntries(Object.entries(workflowTransitions).map(([from, transitions]) => [from, Object.fromEntries(Object.entries(transitions).map(([to, transition]) => [to, transition.eventType]))]))).toEqual(expectedTransitions);
  });

  it("applies legal transitions, timestamps, and event logging", async () => {
    const { service, quotesRepository, workflowEventsRepository } = buildHarness(buildQuote("draft"));

    const result = await service.transitionQuote({ quoteId, toStatus: "pending_approval", actorId, payload: { source: "unit_test" }, idempotencyKey: "submit-1" });

    expect(result.idempotent).toBe(false);
    expect(result.quote.status).toBe("pending_approval");
    expect(quotesRepository.updateStatus).toHaveBeenCalledWith(quoteId, "pending_approval", { submitted_at: timestamp });
    expect(workflowEventsRepository.record).toHaveBeenCalledWith({
      quote_id: quoteId,
      event_type: "submitted_for_approval",
      actor_id: actorId,
      from_status: "draft",
      to_status: "pending_approval",
      payload: { source: "unit_test", idempotency_key: "submit-1" },
    });
  });

  it("rejects illegal transitions without updating or logging an event", async () => {
    const { service, quotesRepository, workflowEventsRepository } = buildHarness(buildQuote("accepted"));

    await expect(service.transitionQuote({ quoteId, toStatus: "draft" })).rejects.toBeInstanceOf(WorkflowTransitionError);
    expect(quotesRepository.updateStatus).not.toHaveBeenCalled();
    expect(workflowEventsRepository.record).not.toHaveBeenCalled();
  });

  it("enforces guard conditions before status updates", async () => {
    const { service, quotesRepository, workflowEventsRepository } = buildHarness(buildQuote("draft", []));

    await expect(service.transitionQuote({ quoteId, toStatus: "pending_approval" })).rejects.toThrow("at least one item");
    expect(quotesRepository.updateStatus).not.toHaveBeenCalled();
    expect(workflowEventsRepository.record).not.toHaveBeenCalled();
  });

  it("returns the original event and skips writes for idempotent retries", async () => {
    const originalEvent = {
      id: "66666666-6666-4666-8666-666666666666",
      quote_id: quoteId,
      event_type: "sent",
      actor_id: actorId,
      from_status: "approved",
      to_status: "sent",
      payload: { idempotency_key: "send-1" },
      created_at: timestamp,
    };
    const { service, quotesRepository, workflowEventsRepository } = buildHarness(buildQuote("sent"), [originalEvent]);

    const result = await service.transitionQuote({ quoteId, toStatus: "sent", actorId, idempotencyKey: "send-1" });

    expect(result).toMatchObject({ event: originalEvent, idempotent: true });
    expect(quotesRepository.updateStatus).not.toHaveBeenCalled();
    expect(workflowEventsRepository.record).not.toHaveBeenCalled();
  });
});
