import "server-only";

import { workflowEventRecordSchema, type WorkflowEventRecord } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { isUniqueViolation, throwRepositoryError } from "./types";

export type WorkflowEventCreateInput = Omit<WorkflowEventRecord, "id" | "created_at"> & { id?: string; idempotency_key?: string | null };

export const createWorkflowEventsRepository = (client: RepositoryClient) => ({
  async listByQuote(quoteId: string) {
    const { data, error } = await client
      .from("workflow_events")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false });
    throwRepositoryError("List workflow events by quote", error);
    return workflowEventRecordSchema.array().parse(data ?? []);
  },

  async findByIdempotencyKey(quoteId: string, idempotencyKey: string) {
    const { data, error } = await client
      .from("workflow_events")
      .select("*")
      .eq("quote_id", quoteId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    throwRepositoryError("Find workflow event by idempotency key", error);
    return data ? workflowEventRecordSchema.parse(data) : null;
  },

  async record(input: WorkflowEventCreateInput) {
    if (input.idempotency_key) {
      const existing = await this.findByIdempotencyKey(input.quote_id, input.idempotency_key);
      if (existing) return existing;
    }

    const { data, error } = await client.from("workflow_events").insert(input).select("*").single();
    if (isUniqueViolation(error) && input.idempotency_key) {
      const existing = await this.findByIdempotencyKey(input.quote_id, input.idempotency_key);
      if (existing) return existing;
    }
    throwRepositoryError("Record workflow event", error);
    return workflowEventRecordSchema.parse(data);
  },
});

export type WorkflowEventsRepository = ReturnType<typeof createWorkflowEventsRepository>;
