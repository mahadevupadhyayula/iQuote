"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import type { QuoteItemRecord } from "@/lib/schemas/shared-records";
import {
  decideApprovalActionSchema,
  type DecideApprovalActionInput,
} from "@/lib/schemas/approval-actions";
import { createApprovalService } from "@/lib/services/approval-service";
import { calculateQuote } from "@/lib/services/quote-calculation-service";
import { createWorkflowService } from "@/lib/services/workflow-service";

const money = (amount: number) => Math.round(amount * 100) / 100;
const quotePath = (quoteId: string) => `/quotes/${quoteId}`;
const hasIdempotencyKey = (payload: Record<string, unknown>, key?: string) =>
  Boolean(key && payload.idempotency_key === key);
const approvalPath = (approvalId: string) => `/approvals/${approvalId}`;
const approvalPendingPath = (quoteId: string) =>
  `/quotes/${quoteId}/approval-pending`;
const generatePath = (quoteId: string) => `/quotes/${quoteId}/generate`;

const getContext = () => {
  const repositories = createRepositories(createServerSupabaseClient());
  return {
    repositories,
    workflowService: createWorkflowService({
      quotesRepository: repositories.quotes,
      workflowEventsRepository: repositories.workflowEvents,
    }),
  };
};

const recalculateLineWithDiscount = (
  item: QuoteItemRecord,
  discountBps: number,
): Omit<QuoteItemRecord, "id" | "quote_id" | "created_at"> => {
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

const quoteTotals = (
  items: Pick<QuoteItemRecord, "quantity" | "unit_price" | "discount_bps">[],
) => {
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  );
  const discount = items.reduce(
    (sum, item) =>
      sum + (item.quantity * item.unit_price * item.discount_bps) / 10_000,
    0,
  );
  return {
    subtotal: money(subtotal),
    discount: money(discount),
    total: money(subtotal - discount),
  };
};

const roleRank = { product_manager: 1, sales_director: 2, finance: 3 } as const;
const canApproveRequirement = (
  approverRole: string,
  requiredRole: string | null,
) =>
  !requiredRole ||
  (roleRank[approverRole as keyof typeof roleRank] ?? 0) >=
    (roleRank[requiredRole as keyof typeof roleRank] ?? 999);

export async function decideApproval(input: DecideApprovalActionInput) {
  const data = decideApprovalActionSchema.parse(input);
  const { repositories, workflowService } = getContext();
  const approvals = await repositories.approvals.listByQuote(data.quote_id);
  const approval = approvals.find((record) => record.id === data.approval_id);

  if (!approval)
    throw new Error(
      `Approval ${data.approval_id} was not found for quote ${data.quote_id}.`,
    );

  const quote = await repositories.quotes.findById(data.quote_id);
  if (!quote) throw new Error(`Quote ${data.quote_id} was not found.`);

  if (approval.status !== "pending" || quote.status !== "pending_approval") {
    const existingEvent = data.idempotency_key
      ? (await repositories.workflowEvents.listByQuote(data.quote_id)).find(
          (event) => hasIdempotencyKey(event.payload, data.idempotency_key),
        )
      : null;
    if (existingEvent)
      return {
        approval,
        quote,
        pendingApprovals: approvals.filter(
          (record) => record.status === "pending",
        ),
      };
    if (approval.status !== "pending")
      throw new Error(
        `Approval ${data.approval_id} has already been ${approval.status}.`,
      );
    throw new Error(
      `Quote ${data.quote_id} is ${quote.status} and is not pending approval.`,
    );
  }

  let updatedQuote = quote;
  const previousDiscountBps =
    quote.subtotal_amount > 0
      ? Math.round((quote.discount_amount / quote.subtotal_amount) * 10_000)
      : 0;
  let modifiedEvaluation = null as Awaited<
    ReturnType<ReturnType<typeof createApprovalService>["evaluatePolicy"]>
  > | null;
  let modifiedMarginBps: number | null = null;
  if (data.decision === "approve_with_modified_discount") {
    const recalculatedLines = quote.items.map((item) =>
      recalculateLineWithDiscount(item, data.modified_discount_bps),
    );
    const calculation = calculateQuote(
      recalculatedLines.map((item) => ({
        quantity: item.quantity,
        unitPriceCents: Math.round(item.unit_price * 100),
        unitCostCents: Math.round(Number(item.metadata.unit_cost ?? 0) * 100),
        discountBps: item.discount_bps,
      })),
    );
    modifiedMarginBps = calculation.grossMarginBps;
    modifiedEvaluation = await createApprovalService(
      repositories.prices,
    ).evaluatePolicy({
      requestedDiscountBps: data.modified_discount_bps,
      projectedMarginBps: calculation.grossMarginBps,
    });
    if (
      !canApproveRequirement(
        approval.required_role,
        modifiedEvaluation.requiredRole,
      )
    )
      throw new Error(
        "Modified discount is outside this approver role delegated authority.",
      );
    const items = await repositories.quotes.replaceItems(
      data.quote_id,
      recalculatedLines,
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
            previous_discount_bps: previousDiscountBps,
            modified_discount_bps: data.modified_discount_bps,
            projected_margin_bps: modifiedMarginBps,
            evaluation: modifiedEvaluation,
            decided_at: new Date().toISOString(),
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

  const pendingApprovals = (
    await repositories.approvals.listByQuote(data.quote_id)
  ).filter((record) => record.status === "pending");
  const toStatus =
    data.decision === "reject"
      ? "rejected"
      : pendingApprovals.length === 0
        ? "approved"
        : null;
  const transition = toStatus
    ? await workflowService.transitionQuote({
        quoteId: data.quote_id,
        toStatus,
        actorId: data.actor_id ?? null,
        payload: {
          action: data.decision,
          approval_id: decidedApproval.id,
          required_role: decidedApproval.required_role,
          previous_discount_bps: previousDiscountBps,
          modified_discount_bps:
            data.decision === "approve_with_modified_discount"
              ? data.modified_discount_bps
              : null,
          projected_margin_bps: modifiedMarginBps,
          evaluation: modifiedEvaluation,
        },
        idempotencyKey: data.idempotency_key,
      })
    : null;

  revalidatePath(quotePath(data.quote_id));
  revalidatePath(approvalPath(data.approval_id));
  revalidatePath(approvalPendingPath(data.quote_id));
  revalidatePath(generatePath(data.quote_id));

  return {
    approval: decidedApproval,
    quote: transition?.quote ?? updatedQuote,
    pendingApprovals,
  };
}
