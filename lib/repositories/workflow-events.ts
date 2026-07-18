import "server-only";

import { workflowEventRecordSchema, type WorkflowEventRecord } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

export type WorkflowEventCreateInput = Omit<WorkflowEventRecord, "id" | "created_at"> & { id?: string };

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

  async record(input: WorkflowEventCreateInput) {
    const { data, error } = await client.from("workflow_events").insert(input).select("*").single();
    throwRepositoryError("Record workflow event", error);
    return workflowEventRecordSchema.parse(data);
  },
});

export type WorkflowEventsRepository = ReturnType<typeof createWorkflowEventsRepository>;
