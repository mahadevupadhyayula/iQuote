import "server-only";

import type { QuoteStatus } from "@/lib/domain/quote-statuses";
import type { WorkflowEventType } from "@/lib/domain/workflow-events";
import type { QuoteRecord } from "@/lib/schemas/shared-records";
import type { QuotesRepository, QuoteWithItems } from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";

type WorkflowQuote = QuoteWithItems | QuoteRecord;

export type WorkflowTransition = {
  readonly eventType: WorkflowEventType | ((payload: Record<string, unknown>) => WorkflowEventType);
  readonly guard?: (quote: WorkflowQuote) => string | null;
  readonly timestamps?: readonly (keyof Pick<QuoteRecord, "submitted_at" | "approved_at" | "sent_at" | "accepted_at">)[];
};

export const workflowTransitions = {
  draft: {
    extracting: { eventType: "extraction_started" },
    needs_information: { eventType: "updated" },
    reviewing: { eventType: "updated" },
    pending_approval: {
      eventType: "submitted_for_approval",
      timestamps: ["submitted_at"],
      guard: (quote) => ("items" in quote && quote.items.length === 0 ? "Quote must have at least one item before approval submission." : null),
    },
    approved: { eventType: "approved", timestamps: ["approved_at"] },
    sent: { eventType: "sent", timestamps: ["sent_at"] },
    cancelled: { eventType: "cancelled" },
  },
  extracting: {
    reviewing: { eventType: (payload) => (payload.action === "quote_extraction_failed" ? "extraction_failed" : "extraction_completed") },
    needs_information: { eventType: (payload) => (payload.action === "quote_extraction_failed" ? "extraction_failed" : "extraction_completed") },
    cancelled: { eventType: "cancelled" },
  },
  needs_information: {
    reviewing: { eventType: "updated" },
    draft: { eventType: "updated" },
    configuring: { eventType: "updated" },
    cancelled: { eventType: "cancelled" },
  },
  reviewing: {
    configuring: { eventType: "updated" },
    cancelled: { eventType: "cancelled" },
  },
  configuring: {
    pending_approval: {
      eventType: "submitted_for_approval",
      timestamps: ["submitted_at"],
      guard: (quote) => ("items" in quote && quote.items.length === 0 ? "Quote must have at least one item before approval submission." : null),
    },
    approved: { eventType: "approved", timestamps: ["approved_at"] },
    sent: { eventType: "sent", timestamps: ["sent_at"] },
    cancelled: { eventType: "cancelled" },
  },
  pending_approval: {
    approved: { eventType: "approved", timestamps: ["approved_at"] },
    rejected: { eventType: "rejected" },
    cancelled: { eventType: "cancelled" },
  },
  approved: {
    sent: { eventType: "sent", timestamps: ["sent_at"] },
    cancelled: { eventType: "cancelled" },
  },
  sent: {
    accepted: { eventType: "accepted", timestamps: ["accepted_at"] },
    rejected: { eventType: "rejected" },
    expired: { eventType: "expired" },
    cancelled: { eventType: "cancelled" },
  },
  accepted: {},
  rejected: {
    draft: { eventType: "updated" },
  },
  expired: {
    draft: { eventType: "updated" },
  },
  cancelled: {},
} as const satisfies Record<QuoteStatus, Partial<Record<QuoteStatus, WorkflowTransition>>>;

export class WorkflowTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowTransitionError";
  }
}

export type TransitionQuoteInput = {
  quoteId: string;
  toStatus: QuoteStatus;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type WorkflowServiceOptions = {
  quotesRepository: QuotesRepository;
  workflowEventsRepository: WorkflowEventsRepository;
  now?: () => Date;
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

const normalizeLegacyPayload = (payload: Record<string, unknown>) => {
  const structuredPayload = { ...payload };
  delete structuredPayload.idempotency_key;
  return structuredPayload;
};

export const createWorkflowService = ({ quotesRepository, workflowEventsRepository, now = () => new Date() }: WorkflowServiceOptions) => ({
  async transitionQuote({ quoteId, toStatus, actorId = null, payload = {}, idempotencyKey }: TransitionQuoteInput) {
    const existingEvent = idempotencyKey ? await workflowEventsRepository.findByIdempotencyKey(quoteId, idempotencyKey) : null;
    if (existingEvent) {
      const quote = await quotesRepository.findById(quoteId);
      if (!quote) throw new Error(`Quote ${quoteId} was not found.`);
      if (
        existingEvent.to_status !== toStatus ||
        existingEvent.actor_id !== actorId ||
        stableStringify(normalizeLegacyPayload(existingEvent.payload)) !== stableStringify(payload)
      ) {
        throw new WorkflowTransitionError(`Idempotency key ${idempotencyKey} was already used with different workflow event details.`);
      }
      return { quote, event: existingEvent, idempotent: true };
    }

    const quote = await quotesRepository.findById(quoteId);
    if (!quote) throw new Error(`Quote ${quoteId} was not found.`);

    const fromStatus = quote.status as QuoteStatus;
    const transition = (workflowTransitions as Record<QuoteStatus, Partial<Record<QuoteStatus, WorkflowTransition>>>)[fromStatus][toStatus];
    if (!transition) throw new WorkflowTransitionError(`Cannot transition quote ${quoteId} from ${quote.status} to ${toStatus}.`);

    const guardFailure = transition.guard?.(quote);
    if (guardFailure) throw new WorkflowTransitionError(guardFailure);

    const timestamp = now().toISOString();
    const timestamps: Partial<Pick<QuoteRecord, "submitted_at" | "approved_at" | "sent_at" | "accepted_at">> = Object.fromEntries(
      (transition.timestamps ?? []).map((field: keyof Pick<QuoteRecord, "submitted_at" | "approved_at" | "sent_at" | "accepted_at">) => [field, timestamp]),
    );
    const updatedQuote = await quotesRepository.updateStatus(quoteId, toStatus, timestamps);
    const event = await workflowEventsRepository.record({
      quote_id: quoteId,
      event_type: typeof transition.eventType === "function" ? transition.eventType(payload) : transition.eventType,
      actor_id: actorId,
      from_status: fromStatus,
      to_status: toStatus,
      payload,
      idempotency_key: idempotencyKey ?? null,
    });

    return { quote: updatedQuote, event, idempotent: false };
  },
});

export type WorkflowService = ReturnType<typeof createWorkflowService>;
