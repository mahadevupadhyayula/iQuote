import { z } from "zod";

import { approvalActionTypes } from "@/lib/domain/approvals";
import { jsonObjectSchema, uuidSchema } from "./shared-records";

const optionalUuidSchema = uuidSchema.optional().nullable();

export const approvalDecisionTypes = ["approve", "reject", "approve_with_modified_discount"] as const;

export const approvalActionSchema = z.object({
  action: z.enum(approvalActionTypes),
  approval_id: uuidSchema.nullable(),
  quote_id: uuidSchema,
  required_role: z.string().min(1).nullable(),
  actor_id: uuidSchema.nullable(),
  comments: z.string().nullable(),
  metadata: jsonObjectSchema.default({}),
});

export type ApprovalAction = z.infer<typeof approvalActionSchema>;


export const decideApprovalActionSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("approve"),
    approval_id: uuidSchema,
    quote_id: uuidSchema,
    actor_id: optionalUuidSchema,
    comments: z.string().trim().min(1).optional().nullable(),
    idempotency_key: z.string().trim().min(1).optional(),
  }),
  z.object({
    decision: z.literal("reject"),
    approval_id: uuidSchema,
    quote_id: uuidSchema,
    actor_id: optionalUuidSchema,
    comments: z.string().trim().min(1),
    idempotency_key: z.string().trim().min(1).optional(),
  }),
  z.object({
    decision: z.literal("approve_with_modified_discount"),
    approval_id: uuidSchema,
    quote_id: uuidSchema,
    actor_id: optionalUuidSchema,
    comments: z.string().trim().min(1).optional().nullable(),
    modified_discount_bps: z.coerce.number().int().min(0).max(10000),
    idempotency_key: z.string().trim().min(1).optional(),
  }),
]);

export type DecideApprovalActionInput = z.infer<typeof decideApprovalActionSchema>;
