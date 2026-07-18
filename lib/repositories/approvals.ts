import "server-only";

import { approvalRecordSchema, type ApprovalRecord } from "@/lib/schemas/shared-records";
import type { ApprovalStatus } from "@/lib/domain/approvals";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

export type ApprovalCreateInput = Omit<ApprovalRecord, "id" | "requested_at" | "decided_at" | "status" | "approver_id" | "comments"> & {
  id?: string;
  approver_id?: string | null;
  comments?: string | null;
};

export const createApprovalsRepository = (client: RepositoryClient) => ({
  async listByQuote(quoteId: string) {
    const { data, error } = await client.from("approvals").select("*").eq("quote_id", quoteId).order("requested_at");
    throwRepositoryError("List approvals by quote", error);
    return approvalRecordSchema.array().parse(data ?? []);
  },

  async findPendingForRole(quoteId: string, requiredRole: string) {
    const { data, error } = await client
      .from("approvals")
      .select("*")
      .eq("quote_id", quoteId)
      .eq("required_role", requiredRole)
      .eq("status", "pending")
      .maybeSingle();
    throwRepositoryError("Find pending approval", error);
    return data ? approvalRecordSchema.parse(data) : null;
  },

  async request(input: ApprovalCreateInput) {
    const { data, error } = await client.from("approvals").insert({ ...input, status: "pending" }).select("*").single();
    throwRepositoryError("Request approval", error);
    return approvalRecordSchema.parse(data);
  },

  async decide(id: string, status: Extract<ApprovalStatus, "approved" | "rejected" | "cancelled">, approverId: string | null, comments?: string | null) {
    const { data, error } = await client
      .from("approvals")
      .update({ status, approver_id: approverId, comments: comments ?? null, decided_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    throwRepositoryError("Decide approval", error);
    return approvalRecordSchema.parse(data);
  },
});

export type ApprovalsRepository = ReturnType<typeof createApprovalsRepository>;
