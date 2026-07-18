import "server-only";

import { approvalRecordSchema, type ApprovalRecord } from "@/lib/schemas/shared-records";
import type { ApprovalStatus } from "@/lib/domain/approvals";
import type { RepositoryClient } from "./types";
import { isUniqueViolation, throwRepositoryError } from "./types";

export type ApprovalCreateInput = Omit<ApprovalRecord, "id" | "requested_at" | "decided_at" | "status" | "approver_id" | "comments"> & {
  id?: string;
  approval_type?: string;
  idempotency_key?: string | null;
  approver_id?: string | null;
  comments?: string | null;
};

export const createApprovalsRepository = (client: RepositoryClient) => ({
  async findById(id: string) {
    const { data, error } = await client.from("approvals").select("*").eq("id", id).maybeSingle();
    throwRepositoryError("Find approval", error);
    return data ? approvalRecordSchema.parse(data) : null;
  },

  async listByQuote(quoteId: string) {
    const { data, error } = await client.from("approvals").select("*").eq("quote_id", quoteId).order("requested_at");
    throwRepositoryError("List approvals by quote", error);
    return approvalRecordSchema.array().parse(data ?? []);
  },

  async findPendingByQuoteAndType(quoteId: string, approvalType: string) {
    const { data, error } = await client
      .from("approvals")
      .select("*")
      .eq("quote_id", quoteId)
      .eq("approval_type", approvalType)
      .eq("status", "pending")
      .maybeSingle();
    throwRepositoryError("Find pending approval by quote and type", error);
    return data ? approvalRecordSchema.parse(data) : null;
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

  async createPendingApproval(input: ApprovalCreateInput) {
    const approvalType = input.approval_type ?? input.required_role;
    const existing = await this.findPendingByQuoteAndType(input.quote_id, approvalType);
    if (existing) return existing;

    const { data, error } = await client
      .from("approvals")
      .insert({ ...input, approval_type: approvalType, status: "pending" })
      .select("*")
      .single();
    if (isUniqueViolation(error)) {
      const idempotent = await this.findPendingByQuoteAndType(input.quote_id, approvalType);
      if (idempotent) return idempotent;
    }
    throwRepositoryError("Create pending approval", error);
    return approvalRecordSchema.parse(data);
  },

  async request(input: ApprovalCreateInput) {
    return this.createPendingApproval(input);
  },

  async recordDecision(id: string, status: Extract<ApprovalStatus, "approved" | "rejected" | "cancelled">, approverId: string | null, comments?: string | null) {
    const { data, error } = await client
      .from("approvals")
      .update({ status, approver_id: approverId, comments: comments ?? null, decided_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .single();
    throwRepositoryError("Record approval decision", error);
    return approvalRecordSchema.parse(data);
  },

  async decide(id: string, status: Extract<ApprovalStatus, "approved" | "rejected" | "cancelled">, approverId: string | null, comments?: string | null) {
    return this.recordDecision(id, status, approverId, comments);
  },
});

export type ApprovalsRepository = ReturnType<typeof createApprovalsRepository>;
