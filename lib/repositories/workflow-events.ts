import "server-only";

import { z } from "zod";

import { workflowEventRecordSchema } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { isUniqueViolation, throwRepositoryError } from "./types";

const workflowEventRecordWithIdempotencySchema = workflowEventRecordSchema.extend({
  idempotency_key: z.string().nullable(),
});

export type WorkflowEventRecordWithIdempotency = z.infer<typeof workflowEventRecordWithIdempotencySchema>;
export type WorkflowEventCreateInput = Omit<WorkflowEventRecordWithIdempotency, "id" | "created_at" | "idempotency_key"> & { id?: string; idempotency_key?: string | null };

export class WorkflowEventIdempotencyConflictError extends Error {
  constructor(idempotencyKey: string) {
    super(`Workflow event idempotency key ${idempotencyKey} was already used with different event details.`);
    this.name = "WorkflowEventIdempotencyConflictError";
  }
}

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

const matchesIdempotentEvent = (existing: WorkflowEventRecordWithIdempotency, input: WorkflowEventCreateInput) =>
  existing.quote_id === input.quote_id &&
  existing.event_type === input.event_type &&
  existing.actor_id === (input.actor_id ?? null) &&
  existing.from_status === (input.from_status ?? null) &&
  existing.to_status === (input.to_status ?? null) &&
  stableStringify(existing.payload) === stableStringify(input.payload ?? {});

export const createWorkflowEventsRepository = (client: RepositoryClient) => ({
  async listByQuote(quoteId: string) {
    const { data, error } = await client
      .from("workflow_events")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false });
    throwRepositoryError("List workflow events by quote", error);
    return workflowEventRecordWithIdempotencySchema.array().parse(data ?? []);
  },

  async findByIdempotencyKey(quoteId: string, idempotencyKey: string) {
    const { data, error } = await client
      .from("workflow_events")
      .select("*")
      .eq("quote_id", quoteId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    throwRepositoryError("Find workflow event by idempotency key", error);
    return data ? workflowEventRecordWithIdempotencySchema.parse(data) : null;
  },

  async record(input: WorkflowEventCreateInput) {
    if (input.idempotency_key) {
      const existing = await this.findByIdempotencyKey(input.quote_id, input.idempotency_key);
      if (existing) {
        if (matchesIdempotentEvent(existing, input)) return existing;
        throw new WorkflowEventIdempotencyConflictError(input.idempotency_key);
      }
    }

    const { data, error } = await client.from("workflow_events").insert(input).select("*").single();
    if (isUniqueViolation(error) && input.idempotency_key) {
      const existing = await this.findByIdempotencyKey(input.quote_id, input.idempotency_key);
      if (existing) {
        if (matchesIdempotentEvent(existing, input)) return existing;
        throw new WorkflowEventIdempotencyConflictError(input.idempotency_key);
      }
    }
    throwRepositoryError("Record workflow event", error);
    return workflowEventRecordWithIdempotencySchema.parse(data);
  },
});

export type WorkflowEventsRepository = ReturnType<typeof createWorkflowEventsRepository>;
