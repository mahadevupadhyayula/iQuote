import { describe, expect, it } from "vitest";

import {
  getApprovalPendingPageState,
  type ApprovalPendingPageApproval,
} from "@/lib/rules/approval-pending-page-rules";

const approval = (
  override: Partial<ApprovalPendingPageApproval>,
): ApprovalPendingPageApproval => ({
  id: "approval-1",
  required_role: "product_manager",
  status: "pending",
  requested_at: "2026-07-21T10:00:00.000Z",
  decided_at: null,
  comments: null,
  metadata: {},
  ...override,
});

describe("approval pending page state", () => {
  it("shows the pending approval action and hides Continue for pending quotes", () => {
    const state = getApprovalPendingPageState(
      "pending_approval",
      [approval({})],
      1,
    );

    expect(state.pendingApproval?.id).toBe("approval-1");
    expect(state.displayedApproval?.id).toBe("approval-1");
    expect(state.showOpenPendingApproval).toBe(true);
    expect(state.showContinue).toBe(false);
  });

  it("shows Continue and hides the pending action for approved quotes with no pending approvals", () => {
    const state = getApprovalPendingPageState(
      "approved",
      [
        approval({
          id: "approval-approved",
          status: "approved",
          decided_at: "2026-07-21T11:00:00.000Z",
        }),
      ],
      0,
    );

    expect(state.approvedApproval?.id).toBe("approval-approved");
    expect(state.displayedApproval?.id).toBe("approval-approved");
    expect(state.showOpenPendingApproval).toBe(false);
    expect(state.showContinue).toBe(true);
  });

  it("keeps Continue hidden when another approval remains pending after a partial approval", () => {
    const state = getApprovalPendingPageState(
      "pending_approval",
      [
        approval({
          id: "approval-approved",
          status: "approved",
          decided_at: "2026-07-21T11:00:00.000Z",
        }),
        approval({
          id: "approval-pending",
          status: "pending",
          requested_at: "2026-07-21T12:00:00.000Z",
        }),
      ],
      1,
    );

    expect(state.pendingApproval?.id).toBe("approval-pending");
    expect(state.displayedApproval?.id).toBe("approval-pending");
    expect(state.showOpenPendingApproval).toBe(true);
    expect(state.showContinue).toBe(false);
  });
});
