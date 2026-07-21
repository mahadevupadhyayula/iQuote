"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { decideApproval } from "@/app/approvals/[approvalId]/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalRecord } from "@/lib/schemas/shared-records";

const actorId = null;

type Props = {
  approval: ApprovalRecord;
  quoteId: string;
  currentDiscountBps: number;
};

export function ApprovalDecisionForm({
  approval,
  quoteId,
  currentDiscountBps,
}: Props) {
  const router = useRouter();
  const [pendingDecision, setPendingDecision] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const idempotencyKey = useMemo(
    () =>
      `approval-decision-${approval.id}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    [approval.id],
  );
  const disabled =
    isPending || approval.status !== "pending" || pendingDecision !== null;

  const submit = (formData: FormData) => {
    const decision = String(formData.get("decision"));
    setPendingDecision(decision);
    setMessage(null);
    startTransition(async () => {
      try {
        const comments = String(formData.get("comments") ?? "") || null;
        const base = {
          approval_id: approval.id,
          quote_id: quoteId,
          actor_id: actorId,
          comments,
          idempotency_key: idempotencyKey,
        };
        if (decision === "approve_with_modified_discount") {
          await decideApproval({
            ...base,
            decision,
            modified_discount_bps: Number(
              formData.get("modified_discount_bps") ?? currentDiscountBps,
            ),
          });
        } else if (decision === "reject") {
          await decideApproval({
            ...base,
            decision,
            comments: comments ?? "Rejected from approval workspace.",
          });
        } else {
          await decideApproval({ ...base, decision: "approve" });
        }
        if (
          decision === "approve" ||
          decision === "approve_with_modified_discount"
        ) {
          router.push(`/quotes/${quoteId}/approval-pending`);
          return;
        }

        setMessage("Decision saved. The quote workflow has resumed.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to save approval decision.",
        );
        setPendingDecision(null);
      }
    });
  };

  return (
    <form action={submit} className="space-y-4">
      <label className="block text-sm font-semibold text-slate-600">
        Comments
        <Textarea
          name="comments"
          required={false}
          placeholder="Add approval context or rejection reason"
          className="mt-2"
          disabled={disabled}
        />
      </label>
      <label className="block text-sm font-semibold text-slate-600">
        Modified discount (bps)
        <input
          name="modified_discount_bps"
          type="number"
          min={0}
          max={10000}
          defaultValue={currentDiscountBps}
          className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
          disabled={disabled}
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          name="decision"
          value="approve"
          type="submit"
          disabled={disabled}
        >
          {pendingDecision === "approve" ? "Approving..." : "Approve"}
        </Button>
        <Button
          name="decision"
          value="approve_with_modified_discount"
          type="submit"
          variant="outline"
          disabled={disabled}
        >
          {pendingDecision === "approve_with_modified_discount"
            ? "Approving..."
            : "Approve Edited"}
        </Button>
        <Button
          name="decision"
          value="reject"
          type="submit"
          variant="destructive"
          disabled={disabled}
        >
          {pendingDecision === "reject" ? "Rejecting..." : "Reject"}
        </Button>
      </div>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </form>
  );
}
