import "server-only";

import { evaluateMarginFloor } from "@/lib/rules/margin-rules";
import { evaluateQuoteReadiness, type QuoteReadinessEvaluation } from "@/lib/rules/readiness-rules";
import type { ApprovalsRepository } from "@/lib/repositories/approvals";
import type { CustomersRepository } from "@/lib/repositories/customers";
import type { PricesRepository } from "@/lib/repositories/prices";
import type { ProductsRepository } from "@/lib/repositories/products";
import type { QuoteWithItems, QuotesRepository } from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";
import { calculateQuote } from "@/lib/services/quote-calculation-service";
import type { ApprovalRecord, CustomerRecord, WorkflowEventRecord } from "@/lib/schemas/shared-records";
import type { BasisPoints, Cents } from "@/lib/utils/money";

export type QuoteWorkspaceQueryRepositories = {
  approvals: Pick<ApprovalsRepository, "listByQuote">;
  customers: Pick<CustomersRepository, "findById">;
  prices: Pick<PricesRepository, "listCurrentPrices">;
  products: Pick<ProductsRepository, "findById">;
  quotes: Pick<QuotesRepository, "findById">;
  workflowEvents: Pick<WorkflowEventsRepository, "listByQuote">;
};

export type CustomerQuoteLineViewModel = {
  id: string;
  lineNumber: number;
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountBps: BasisPoints;
  discountAmount: number;
  lineTotalAmount: number;
};

export type CustomerQuoteViewModel = {
  id: string;
  quoteNumber: string;
  status: QuoteWithItems["status"];
  currencyCode: string;
  customer: Pick<CustomerRecord, "id" | "name" | "legal_name" | "billing_email" | "phone" | "billing_address" | "shipping_address"> | null;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  validUntil: string | null;
  sentAt: string | null;
  acceptedAt: string | null;
  lines: CustomerQuoteLineViewModel[];
};

export type InternalQuoteLineViewModel = CustomerQuoteLineViewModel & {
  productId: string | null;
  unitCost: number;
  lineCost: number;
  grossProfit: number;
  grossMarginBps: BasisPoints;
  marginFloorPasses: boolean | null;
  inventoryDecision: unknown;
  internalNotes: unknown;
};

export type InternalApprovalViewModel = Pick<ApprovalRecord, "id" | "required_role" | "status" | "requested_by" | "approver_id" | "requested_at" | "decided_at" | "comments" | "metadata">;

export type InternalQuoteWorkspaceViewModel = Omit<CustomerQuoteViewModel, "lines"> & {
  opportunityId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lines: InternalQuoteLineViewModel[];
  readiness: QuoteReadinessEvaluation;
  margin: {
    costAmount: number;
    grossProfitAmount: number;
    grossMarginBps: BasisPoints;
    floorBps: BasisPoints;
    floorPasses: boolean;
  };
  approvalStatus: {
    status: "not_required" | "pending" | "approved" | "rejected" | "cancelled";
    pendingCount: number;
    rejectedCount: number;
    requiredRoles: string[];
    approvals: InternalApprovalViewModel[];
  };
  sla: {
    startedAt: string | null;
    dueAt: string | null;
    policyMinutes: number | null;
    breached: boolean;
    minutesRemaining: number | null;
    source: "metadata" | "column" | "valid_until" | "none";
  };
  workflowEvents: WorkflowEventRecord[];
  internalNotes: unknown;
  reviewMetadata: {
    extraction: Record<string, unknown>;
    extractionStatus: string | null;
    extractionFields: Record<string, unknown>;
    fieldConfidence: Record<string, unknown>;
    missingFields: string[];
    clarificationQuestions: unknown[];
    manualEntry: { enabled: boolean; reason: string | null };
    requirements: Record<string, unknown>;
    review: Record<string, unknown>;
    originalRequestText: string | null;
  };
};

const cents = (amount: number): Cents => Math.round(amount * 100) as Cents;
const money = (amountCents: number) => Math.round(amountCents) / 100;
const metadataNumber = (metadata: Record<string, unknown>, key: string, fallback = 0) => {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};
const metadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};
const metadataObject = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});
const metadataStringArray = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const metadataArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const reviewMetadata = (metadata: Record<string, unknown>): InternalQuoteWorkspaceViewModel["reviewMetadata"] => {
  const extraction = metadataObject(metadata.extraction);
  const manualEntry = metadataObject(metadata.manual_entry);
  return {
    extraction,
    extractionStatus: typeof extraction.status === "string" ? extraction.status : null,
    extractionFields: metadataObject(extraction.fields),
    fieldConfidence: metadataObject(extraction.field_confidence),
    missingFields: metadataStringArray(extraction.missing_fields),
    clarificationQuestions: metadataArray(extraction.clarification_questions),
    manualEntry: { enabled: manualEntry.enabled === true, reason: typeof manualEntry.reason === "string" ? manualEntry.reason : null },
    requirements: metadataObject(metadata.requirements),
    review: metadataObject(metadata.review),
    originalRequestText: typeof extraction.original_request_text === "string" ? extraction.original_request_text : typeof extraction.source_text === "string" ? extraction.source_text : null,
  };
};

const toCustomer = (quote: QuoteWithItems, customer: CustomerRecord | null): CustomerQuoteViewModel => ({
  id: quote.id,
  quoteNumber: quote.quote_number,
  status: quote.status,
  currencyCode: quote.currency_code,
  customer: customer
    ? {
        id: customer.id,
        name: customer.name,
        legal_name: customer.legal_name,
        billing_email: customer.billing_email,
        phone: customer.phone,
        billing_address: customer.billing_address,
        shipping_address: customer.shipping_address,
      }
    : null,
  subtotalAmount: quote.subtotal_amount,
  discountAmount: quote.discount_amount,
  taxAmount: quote.tax_amount,
  totalAmount: quote.total_amount,
  validUntil: quote.valid_until,
  sentAt: quote.sent_at,
  acceptedAt: quote.accepted_at,
  lines: quote.items
    .slice()
    .sort((left, right) => left.line_number - right.line_number)
    .map((item) => ({
      id: item.id,
      lineNumber: item.line_number,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountBps: item.discount_bps,
      discountAmount: item.discount_amount,
      lineTotalAmount: item.line_total_amount,
    })),
});

const approvalStatus = (approvals: ApprovalRecord[]): InternalQuoteWorkspaceViewModel["approvalStatus"] => {
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;
  const rejectedCount = approvals.filter((approval) => approval.status === "rejected").length;
  const cancelledCount = approvals.filter((approval) => approval.status === "cancelled").length;
  const approvedCount = approvals.filter((approval) => approval.status === "approved").length;
  const status = pendingCount > 0 ? "pending" : rejectedCount > 0 ? "rejected" : cancelledCount > 0 ? "cancelled" : approvedCount > 0 ? "approved" : "not_required";
  return { status, pendingCount, rejectedCount, requiredRoles: [...new Set(approvals.map((approval) => approval.required_role))], approvals };
};

const sla = (quote: QuoteWithItems, now: Date): InternalQuoteWorkspaceViewModel["sla"] => {
  const slaMetadata = metadataObject(quote.metadata.sla);
  const metadataStartedAt = metadataString(slaMetadata, "started_at") ?? metadataString(quote.metadata, "sla_started_at");
  const metadataDueAt = metadataString(slaMetadata, "due_at") ?? metadataString(quote.metadata, "sla_due_at");
  const policyMinutes = metadataNumber(slaMetadata, "policy_minutes", metadataNumber(quote.metadata, "sla_policy_minutes", Number.NaN));
  const columnDueAt = quote.sla_due_at;
  const source = metadataDueAt ? "metadata" : columnDueAt ? "column" : quote.valid_until ? "valid_until" : "none";
  const effectiveDueAt = metadataDueAt ?? columnDueAt ?? (quote.valid_until ? `${quote.valid_until}T23:59:59.999Z` : null);
  const minutesRemaining = effectiveDueAt ? Math.floor((new Date(effectiveDueAt).getTime() - now.getTime()) / 60_000) : null;
  return {
    startedAt: metadataStartedAt,
    dueAt: effectiveDueAt,
    policyMinutes: Number.isFinite(policyMinutes) ? policyMinutes : null,
    breached: minutesRemaining != null && minutesRemaining < 0,
    minutesRemaining,
    source,
  };
};

export const createQuoteWorkspaceQueryService = (repositories: QuoteWorkspaceQueryRepositories, now = () => new Date()) => ({
  async getCustomerQuote(quoteId: string): Promise<CustomerQuoteViewModel | null> {
    const quote = await repositories.quotes.findById(quoteId);
    if (!quote) return null;
    return toCustomer(quote, await repositories.customers.findById(quote.customer_id));
  },

  async getInternalWorkspace(quoteId: string): Promise<InternalQuoteWorkspaceViewModel | null> {
    const quote = await repositories.quotes.findById(quoteId);
    if (!quote) return null;

    const productIds = [...new Set(quote.items.map((item) => item.product_id).filter((id): id is string => Boolean(id)))];
    const [customer, products, prices, approvals, workflowEvents] = await Promise.all([
      repositories.customers.findById(quote.customer_id),
      Promise.all(productIds.map((id) => repositories.products.findById(id))),
      repositories.prices.listCurrentPrices(productIds, quote.currency_code),
      repositories.approvals.listByQuote(quote.id),
      repositories.workflowEvents.listByQuote(quote.id),
    ]);

    const calculated = calculateQuote(
      quote.items.map((item) => ({
        lineId: item.id,
        quantity: item.quantity,
        unitPriceCents: cents(item.unit_price),
        unitCostCents: cents(metadataNumber(item.metadata, "unit_cost")),
        discountBps: item.discount_bps,
        marginFloorBps: metadataNumber(item.metadata, "margin_floor_bps", metadataNumber(quote.metadata, "margin_floor_bps")) as BasisPoints,
      })),
    );
    const floorBps = metadataNumber(quote.metadata, "margin_floor_bps") as BasisPoints;
    const marginPolicy = evaluateMarginFloor({ sellPriceCents: calculated.sellPriceCents, costCents: calculated.costCents, floorBps });
    const readiness = (quote.metadata.readiness as QuoteReadinessEvaluation | undefined) ?? evaluateQuoteReadiness({
      customerId: quote.customer_id,
      currencyCode: quote.currency_code,
      lines: quote.items.map((item) => ({ productId: item.product_id, sku: item.sku, description: item.description, quantity: item.quantity })),
      products: products.filter((product): product is NonNullable<typeof product> => Boolean(product)),
      prices: prices.map((price) => ({ productId: price.product_id, unitPrice: price.unit_price, currencyCode: price.currency_code, effectiveFrom: price.effective_from, effectiveTo: price.effective_to })),
      inventoryDecisions: quote.items.map((item) => item.metadata.inventory_decision).filter(Boolean) as never,
      marginPolicy,
      approvals: approvals.map((approval) => ({ requiredRole: approval.required_role, status: approval.status })),
      paymentTerms: quote.metadata.payment_terms as never,
    });
    const calculationsByLineId = new Map(calculated.lines.map((line) => [line.lineId, line]));
    const customerView = toCustomer(quote, customer);

    return {
      ...customerView,
      opportunityId: quote.opportunity_id,
      submittedAt: quote.submitted_at,
      approvedAt: quote.approved_at,
      createdAt: quote.created_at,
      updatedAt: quote.updated_at,
      lines: customerView.lines.map((line) => {
        const calculation = calculationsByLineId.get(line.id);
        return {
          ...line,
          productId: quote.items.find((item) => item.id === line.id)?.product_id ?? null,
          unitCost: money(calculation?.unitCostCents ?? 0),
          lineCost: money(calculation?.costCents ?? 0),
          grossProfit: money(calculation?.grossProfitCents ?? 0),
          grossMarginBps: (calculation?.grossMarginBps ?? 0) as BasisPoints,
          marginFloorPasses: calculation?.marginFloorPasses ?? null,
          inventoryDecision: quote.items.find((item) => item.id === line.id)?.metadata.inventory_decision,
          internalNotes: quote.items.find((item) => item.id === line.id)?.metadata.internal_notes,
        };
      }),
      readiness,
      margin: { costAmount: money(calculated.costCents), grossProfitAmount: money(calculated.grossProfitCents), grossMarginBps: calculated.grossMarginBps, floorBps, floorPasses: marginPolicy.passes },
      approvalStatus: approvalStatus(approvals),
      sla: sla(quote, now()),
      workflowEvents,
      internalNotes: quote.metadata.internal_notes,
      reviewMetadata: reviewMetadata(quote.metadata),
    };
  },
});

export type QuoteWorkspaceQueryService = ReturnType<typeof createQuoteWorkspaceQueryService>;
