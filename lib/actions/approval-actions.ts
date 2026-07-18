"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import type { QuoteItemRecord } from "@/lib/schemas/shared-records";
import { decideApprovalActionSchema, type DecideApprovalActionInput } from "@/lib/schemas/approval-actions";
import { createWorkflowService } from "@/lib/services/workflow-service";

const money = (amount: number) => Math.round(amount * 100) / 100;
const quotePath = (quoteId: string) => `/quotes/${quoteId}`;
const approvalPath = (approvalId: string) => `/approvals/${approvalId}`;

const getContext = () => {
  const repositories = createRepositories(createServerSupabaseClient());
  return {
    repositories,
    workflowService: createWorkflowService({ quotesRepository: repositories.quotes, workflowEventsRepository: repositories.workflowEvents }),
  };
};

const recalculateLineWithDiscount = (item: QuoteItemRecord, discountBps: number): Omit<QuoteItemRecord, "id" | "quote_id" | "created_at"> => {
  const subtotal = item.quantity * item.unit_price;
  const discountAmount = money((subtotal * discountBps) / 10_000);

  return {
    product_id: item.product_id,
    line_number: item.line_number,
    sku: item.sku,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount_bps: discountBps,
    discount_amount: discountAmount,
    line_total_amount: money(subtotal - discountAmount),
    metadata: item.metadata,
  };
};

const quoteTotals = (items: Pick<QuoteItemRecord, "quantity" | "unit_price" | "discount_bps">[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price * item.discount_bps) / 10_000, 0);
  return { subtotal: money(subtotal), discount: money(discount), total: money(subtotal - discount) };
};

export async function decideApproval(input: DecideApprovalActionInput) {
  const data = decideApprovalActionSchema.parse(input);
  const { repositories, workflowService } = getContext();
  const approvals = await repositories.approvals.listByQuote(data.quote_id);
  const approval = approvals.find((record) => record.id === data.approval_id);

  if (!approval) throw new Error(`Approval ${data.approval_id} was not found for quote ${data.quote_id}.`);
  if (approval.status !== "pending") throw new Error(`Approval ${data.approval_id} has already been ${approval.status}.`);

  const quote = await repositories.quotes.findById(data.quote_id);
  if (!quote) throw new Error(`Quote ${data.quote_id} was not found.`);
  if (quote.status !== "pending_approval") throw new Error(`Quote ${data.quote_id} is ${quote.status} and is not pending approval.`);

  let updatedQuote = quote;
  if (data.decision === "approve_with_modified_discount") {
    const items = await repositories.quotes.replaceItems(
      data.quote_id,
      quote.items.map((item) => recalculateLineWithDiscount(item, data.modified_discount_bps)),
    );
    const totals = quoteTotals(items);
    updatedQuote = {
      ...(await repositories.quotes.update(data.quote_id, {
        subtotal_amount: totals.subtotal,
        discount_amount: totals.discount,
        total_amount: totals.total,
        metadata: {
          ...quote.metadata,
          approval_modified_discount: {
            approval_id: approval.id,
            approver_id: data.actor_id ?? null,
            discount_bps: data.modified_discount_bps,
          },
        },
      })),
      items,
    };
  }

  const decidedApproval = await repositories.approvals.decide(
    approval.id,
    data.decision === "reject" ? "rejected" : "approved",
    data.actor_id ?? null,
    data.comments ?? null,
  );

  const pendingApprovals = (await repositories.approvals.listByQuote(data.quote_id)).filter((record) => record.status === "pending");
  const toStatus = data.decision === "reject" ? "rejected" : pendingApprovals.length === 0 ? "approved" : null;
  const transition = toStatus
    ? await workflowService.transitionQuote({
        quoteId: data.quote_id,
        toStatus,
        actorId: data.actor_id ?? null,
        payload: {
          action: data.decision,
          approval_id: decidedApproval.id,
          required_role: decidedApproval.required_role,
          modified_discount_bps: data.decision === "approve_with_modified_discount" ? data.modified_discount_bps : null,
        },
        idempotencyKey: data.idempotency_key,
      })
    : null;

  revalidatePath(quotePath(data.quote_id));
  revalidatePath(approvalPath(data.approval_id));

  return { approval: decidedApproval, quote: transition?.quote ?? updatedQuote, pendingApprovals };
}
