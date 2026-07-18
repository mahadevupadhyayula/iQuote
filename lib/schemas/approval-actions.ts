import { z } from "zod";

import { approvalActionTypes } from "@/lib/domain/approvals";
import { jsonObjectSchema, uuidSchema } from "./shared-records";

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
