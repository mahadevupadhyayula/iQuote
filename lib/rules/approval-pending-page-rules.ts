import type { QuoteStatus } from "@/lib/domain/quote-statuses";

export type ApprovalPendingPageApproval = {
  id: string;
  required_role: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_at: string;
  decided_at: string | null;
  comments: string | null;
  metadata: unknown;
};

export const getApprovalPendingPageState = (
  status: QuoteStatus,
  approvals: ApprovalPendingPageApproval[],
  pendingCount: number,
) => {
  const isPending = status === "pending_approval";
  const isApproved = status === "approved";
  const pendingApproval =
    approvals.find((approval) => approval.status === "pending") ?? null;
  const approvedApproval =
    approvals
      .filter((approval) => approval.status === "approved")
      .sort(
        (a, b) =>
          new Date(b.decided_at ?? b.requested_at).getTime() -
          new Date(a.decided_at ?? a.requested_at).getTime(),
      )[0] ?? null;
  const displayedApproval = pendingApproval ?? approvedApproval;

  return {
    isPending,
    isApproved,
    pendingApproval,
    approvedApproval,
    displayedApproval,
    showOpenPendingApproval: isPending && pendingApproval !== null,
    showContinue: isApproved && pendingCount === 0,
  };
};
