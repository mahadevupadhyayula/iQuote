"use server";

import { decideApproval as decideApprovalAction } from "@/lib/actions/approval-actions";
import type { DecideApprovalActionInput } from "@/lib/schemas/approval-actions";

export async function decideApproval(input: DecideApprovalActionInput) {
  return decideApprovalAction(input);
}
