export const approvalStatuses = ["pending", "approved", "rejected", "cancelled"] as const;

export type ApprovalStatus = (typeof approvalStatuses)[number];

export const approvalActionTypes = ["request", "approve", "reject", "cancel"] as const;

export type ApprovalActionType = (typeof approvalActionTypes)[number];

export const approvalStatusLabels: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const approvalActionResultStatus: Record<ApprovalActionType, ApprovalStatus> = {
  request: "pending",
  approve: "approved",
  reject: "rejected",
  cancel: "cancelled",
};
