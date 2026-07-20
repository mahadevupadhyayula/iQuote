import "server-only";

import { evaluateConfigurationContinuation } from "@/lib/rules/configuration-continuation";
import { evaluateMarginFloor } from "@/lib/rules/margin-rules";
import { normalizeProductMatchState } from "@/lib/rules/product-match-state";
import { quoteConfigurationCompletion } from "@/lib/rules/quote-configuration-completion";
import {
  evaluateQuoteReadiness,
  type QuoteReadinessEvaluation,
} from "@/lib/rules/readiness-rules";
import type { ApprovalsRepository } from "@/lib/repositories/approvals";
import type { CustomersRepository } from "@/lib/repositories/customers";
import type { PricesRepository } from "@/lib/repositories/prices";
import type { ProductsRepository } from "@/lib/repositories/products";
import type {
  QuoteWithItems,
  QuotesRepository,
} from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";
import { calculateQuote } from "@/lib/services/quote-calculation-service";
import type { PricingBlocker } from "@/lib/services/quote-pricing-resolution-service";
import type {
  ApprovalRecord,
  CustomerRecord,
  WorkflowEventRecord,
} from "@/lib/schemas/shared-records";
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
  productName: string | null;
  catalogDescription: string | null;
  customerRequestedDescription: string | null;
  customerSpecifications: string | null;
  quantity: number;
  unitPrice: number;
  discountBps: BasisPoints;
  discountAmount: number;
  lineTotalAmount: number;
  grossAmount: number;
  discountPercentage: number;
  netAmount: number;
};

export type CustomerQuoteViewModel = {
  id: string;
  quoteNumber: string;
  status: QuoteWithItems["status"];
  currencyCode: string;
  customer: Pick<
    CustomerRecord,
    | "id"
    | "name"
    | "legal_name"
    | "billing_email"
    | "phone"
    | "billing_address"
    | "shipping_address"
  > | null;
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
  inventoryRecommendation: unknown;
  selectedFulfillment: unknown;
  inventoryApplied: boolean;
  inventoryConfirmedAt: string | null;
  priceApplication: unknown;
  priceId: string | null;
  priceType: string | null;
  priceSource: string | null;
  priceSourceVersion: string | null;
  priceAppliedAt: string | null;
  pricingResolved: boolean;
  productMatchConfirmed: boolean;
  productMatchMethod: string;
  productMatchConfidence: number;
};

export type InternalApprovalViewModel = Pick<
  ApprovalRecord,
  | "id"
  | "required_role"
  | "status"
  | "requested_by"
  | "approver_id"
  | "requested_at"
  | "decided_at"
  | "comments"
  | "metadata"
>;

export type InternalQuoteWorkspaceViewModel = Omit<
  CustomerQuoteViewModel,
  "lines"
> & {
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
  commercialSummary: {
    grossAmount: number;
    discountAmount: number;
    netAmount: number;
    taxAmount: number;
    totalPayable: number;
    productCost: number;
    grossProfit: number;
    grossMarginBps: BasisPoints;
  };
  configuration: {
    inventoryRequiredCount: number;
    inventoryResolvedCount: number;
    allInventorySelectionsApplied: boolean;
    allProductMatchesConfirmed: boolean;
    allInventoryConfirmed: boolean;
    pricingStatus:
      | "pending_inventory"
      | "pending_product_confirmation"
      | "not_started"
      | "resolved"
      | "blocked";
    pricingResolved: boolean;
    pricingBlockers: Array<PricingBlocker>;
    canContinue: boolean;
    blockers: Array<{ code: string; message: string; lineNumber?: number | null; productId?: string | null }>;
  };
  requirementsSummary: {
    requestedDiscountPercent: number | null;
    requestedDiscountBps: number | null;
  };
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
const metadataNumber = (
  metadata: Record<string, unknown>,
  key: string,
  fallback = 0,
) => {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};
const metadataString = (metadata: Record<string, unknown>, key: string) => {
  const value = metadata[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};
const metadataObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const metadataStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
const metadataArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const appliedReadinessPrices = (quote: QuoteWithItems) =>
  quote.items.flatMap((item) => {
    if (!item.product_id) return [];

    const application = metadataObject(item.metadata.price_application);
    const effectiveFrom = metadataString(application, "effective_from");
    const sourceName = metadataString(application, "source_name");
    const sourceVersion = metadataString(application, "source_version");
    const currencyCode =
      metadataString(application, "currency_code") ?? quote.currency_code;
    const unitCost =
      typeof item.metadata.unit_cost === "number" &&
      Number.isFinite(item.metadata.unit_cost)
        ? item.metadata.unit_cost
        : null;

    if (!effectiveFrom) return [];

    return [
      {
        productId: item.product_id,
        unitPrice: item.unit_price,
        unitCost,
        currencyCode,
        sourceName,
        sourceVersion,
        effectiveFrom,
        effectiveTo: metadataString(application, "effective_to") ?? null,
      },
    ];
  });
const reviewMetadata = (
  metadata: Record<string, unknown>,
): InternalQuoteWorkspaceViewModel["reviewMetadata"] => {
  const extraction = metadataObject(metadata.extraction);
  const manualEntry = metadataObject(metadata.manual_entry);
  return {
    extraction,
    extractionStatus:
      typeof extraction.status === "string" ? extraction.status : null,
    extractionFields: metadataObject(extraction.fields),
    fieldConfidence: metadataObject(extraction.field_confidence),
    missingFields: metadataStringArray(extraction.missing_fields),
    clarificationQuestions: metadataArray(extraction.clarification_questions),
    manualEntry: {
      enabled: manualEntry.enabled === true,
      reason:
        typeof manualEntry.reason === "string" ? manualEntry.reason : null,
    },
    requirements: metadataObject(metadata.requirements),
    review: metadataObject(metadata.review),
    originalRequestText:
      typeof extraction.original_request_text === "string"
        ? extraction.original_request_text
        : typeof extraction.source_text === "string"
          ? extraction.source_text
          : null,
  };
};

const toCustomer = (
  quote: QuoteWithItems,
  customer: CustomerRecord | null,
): CustomerQuoteViewModel => ({
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
      productName: null,
      catalogDescription: null,
      customerRequestedDescription: item.description,
      customerSpecifications: null,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountBps: item.discount_bps,
      discountAmount: item.discount_amount,
      lineTotalAmount: item.line_total_amount,
      grossAmount: money(cents(item.unit_price) * item.quantity),
      discountPercentage: item.discount_bps / 100,
      netAmount: item.line_total_amount,
    })),
});

const approvalStatus = (
  approvals: ApprovalRecord[],
): InternalQuoteWorkspaceViewModel["approvalStatus"] => {
  const pendingCount = approvals.filter(
    (approval) => approval.status === "pending",
  ).length;
  const rejectedCount = approvals.filter(
    (approval) => approval.status === "rejected",
  ).length;
  const cancelledCount = approvals.filter(
    (approval) => approval.status === "cancelled",
  ).length;
  const approvedCount = approvals.filter(
    (approval) => approval.status === "approved",
  ).length;
  const status =
    pendingCount > 0
      ? "pending"
      : rejectedCount > 0
        ? "rejected"
        : cancelledCount > 0
          ? "cancelled"
          : approvedCount > 0
            ? "approved"
            : "not_required";
  return {
    status,
    pendingCount,
    rejectedCount,
    requiredRoles: [
      ...new Set(approvals.map((approval) => approval.required_role)),
    ],
    approvals,
  };
};

const sla = (
  quote: QuoteWithItems,
  now: Date,
): InternalQuoteWorkspaceViewModel["sla"] => {
  const slaMetadata = metadataObject(quote.metadata.sla);
  const metadataStartedAt =
    metadataString(slaMetadata, "started_at") ??
    metadataString(quote.metadata, "sla_started_at");
  const metadataDueAt =
    metadataString(slaMetadata, "due_at") ??
    metadataString(quote.metadata, "sla_due_at");
  const policyMinutes = metadataNumber(
    slaMetadata,
    "policy_minutes",
    metadataNumber(quote.metadata, "sla_policy_minutes", Number.NaN),
  );
  const columnDueAt = quote.sla_due_at;
  const source = metadataDueAt
    ? "metadata"
    : columnDueAt
      ? "column"
      : quote.valid_until
        ? "valid_until"
        : "none";
  const effectiveDueAt =
    metadataDueAt ??
    columnDueAt ??
    (quote.valid_until ? `${quote.valid_until}T23:59:59.999Z` : null);
  const minutesRemaining = effectiveDueAt
    ? Math.floor((new Date(effectiveDueAt).getTime() - now.getTime()) / 60_000)
    : null;
  return {
    startedAt: metadataStartedAt,
    dueAt: effectiveDueAt,
    policyMinutes: Number.isFinite(policyMinutes) ? policyMinutes : null,
    breached: minutesRemaining != null && minutesRemaining < 0,
    minutesRemaining,
    source,
  };
};

export const createQuoteWorkspaceQueryService = (
  repositories: QuoteWorkspaceQueryRepositories,
  now = () => new Date(),
) => ({
  async getCustomerQuote(
    quoteId: string,
  ): Promise<CustomerQuoteViewModel | null> {
    const quote = await repositories.quotes.findById(quoteId);
    if (!quote) return null;
    return toCustomer(
      quote,
      await repositories.customers.findById(quote.customer_id),
    );
  },

  async getInternalWorkspace(
    quoteId: string,
  ): Promise<InternalQuoteWorkspaceViewModel | null> {
    const quote = await repositories.quotes.findById(quoteId);
    if (!quote) return null;

    const productIds = [
      ...new Set(
        quote.items
          .map((item) => item.product_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const customer = await repositories.customers.findById(quote.customer_id);
    const products = await Promise.all(
      productIds.map((id) => repositories.products.findById(id)),
    );
    const [approvals, workflowEvents] = await Promise.all([
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
        marginFloorBps: metadataNumber(
          item.metadata,
          "margin_floor_bps",
          metadataNumber(quote.metadata, "margin_floor_bps"),
        ) as BasisPoints,
      })),
    );
    const floorBps = metadataNumber(
      quote.metadata,
      "margin_floor_bps",
    ) as BasisPoints;
    const marginPolicy = evaluateMarginFloor({
      sellPriceCents: calculated.sellPriceCents,
      costCents: calculated.costCents,
      floorBps,
    });
    const readiness = evaluateQuoteReadiness({
        customerId: quote.customer_id,
        currencyCode: quote.currency_code,
        lines: quote.items.map((item) => ({
          productId: item.product_id,
          sku: item.sku,
          description: item.description,
          quantity: item.quantity,
        })),
        products: products.filter(
          (product): product is NonNullable<typeof product> => Boolean(product),
        ),
        prices: appliedReadinessPrices(quote),
        inventoryDecisions: quote.items
          .map(
            (item) =>
              item.metadata.selected_inventory_decision ??
              item.metadata.inventory_decision,
          )
          .filter(Boolean) as never,
        marginPolicy,
        approvals: approvals.map((approval) => ({
          requiredRole: approval.required_role,
          status: approval.status,
        })),
        paymentTerms: quote.metadata.payment_terms as never,
        slaDueAt: quote.sla_due_at,
        quoteStatus: quote.status,
        commercialCalculation: { subtotalAmount: money(calculated.subtotalCents), discountAmount: money(calculated.discountAmountCents), totalAmount: money(calculated.netTotalCents), grossMarginBps: calculated.grossMarginBps },
        discountPolicyEvaluation: quote.metadata.approval_evaluation as never,
      });
    const calculationsByLineId = new Map(
      calculated.lines.map((line) => [line.lineId, line]),
    );
    const customerView = toCustomer(quote, customer);
    const productById = new Map(products.filter((product): product is NonNullable<typeof product> => Boolean(product)).map((product) => [product.id, product]));
    const requirements = metadataObject(quote.metadata.requirements);
    const commercialRequirements = metadataObject(requirements.commercial);
    const requestedDiscountPercent = typeof commercialRequirements.requested_discount_percent === "number" ? commercialRequirements.requested_discount_percent : null;
    const requestedDiscountBps = typeof commercialRequirements.requested_discount_bps === "number" ? commercialRequirements.requested_discount_bps : null;
    const pricingBlockers = Array.isArray(quote.metadata.pricing_blockers)
      ? (quote.metadata.pricing_blockers as PricingBlocker[])
      : [];
    const {
      inventoryRequiredCount,
      inventoryResolvedCount,
      allInventorySelectionsApplied,
      allProductMatchesConfirmed,
      allInventoryConfirmed,
    } = quoteConfigurationCompletion(quote.items);
    const pricingResolved =
      quote.items.length > 0 &&
      quote.items.every((item) => item.metadata.pricing_resolved === true);
    const pricingStatus: InternalQuoteWorkspaceViewModel["configuration"]["pricingStatus"] =
      pricingBlockers.length > 0
        ? "blocked"
        : pricingResolved
          ? "resolved"
          : !allInventorySelectionsApplied
            ? "pending_inventory"
            : !allProductMatchesConfirmed
              ? "pending_product_confirmation"
              : "not_started";

    const commercialTotalsExist =
      quote.items.length > 0 &&
      pricingResolved &&
      Number.isFinite(calculated.subtotalCents) &&
      Number.isFinite(calculated.netTotalCents) &&
      calculated.subtotalCents > 0;
    const configurationContinuation = evaluateConfigurationContinuation({ readinessBlockers: readiness.blockers, pricingResolved, pricingBlockers, allProductMatchesConfirmed, allInventorySelectionsApplied, commercialTotalsExist });

    if (process.env.NODE_ENV !== "production") {
      console.info("[quote-configuration]", {
        quoteId: quote.id,
        allProductMatchesConfirmed,
        allInventorySelectionsApplied,
        pricingResolved,
        pricingBlockers,
        readinessBlockers: readiness.blockers,
        continuationBlockers: configurationContinuation.blockers,
      });
    }

    return {
      ...customerView,
      opportunityId: quote.opportunity_id,
      submittedAt: quote.submitted_at,
      approvedAt: quote.approved_at,
      createdAt: quote.created_at,
      updatedAt: quote.updated_at,
      lines: customerView.lines.map((line) => {
        const calculation = calculationsByLineId.get(line.id);
        const item = quote.items.find((candidate) => candidate.id === line.id);
        const metadata = item?.metadata ?? {};
        const product = item?.product_id ? productById.get(item.product_id) : null;
        const customerRequirements = metadataObject(metadata.customer_requirements);
        const priceApplication = metadataObject(metadata.price_application);
        const productMatch = normalizeProductMatchState(
          metadata,
          item?.product_id ?? null,
        );
        return {
          ...line,
          productId: item?.product_id ?? null,
          productName: product?.name ?? null,
          catalogDescription: product?.description ?? null,
          customerRequestedDescription: item?.description ?? null,
          customerSpecifications: metadataString(customerRequirements, "specifications"),
          unitCost: money(calculation?.unitCostCents ?? 0),
          lineCost: money(calculation?.costCents ?? 0),
          grossProfit: money(calculation?.grossProfitCents ?? 0),
          grossMarginBps: (calculation?.grossMarginBps ?? 0) as BasisPoints,
          marginFloorPasses: calculation?.marginFloorPasses ?? null,
          inventoryDecision: item?.metadata.inventory_decision,
          internalNotes: item?.metadata.internal_notes,
          inventoryRecommendation: item?.metadata.inventory_decision,
          selectedFulfillment: item?.metadata.selected_fulfillment,
          inventoryApplied: Array.isArray(item?.metadata.selected_fulfillment),
          inventoryConfirmedAt:
            typeof item?.metadata.inventory_confirmed_at === "string"
              ? item.metadata.inventory_confirmed_at
              : null,
          priceApplication: metadata.price_application,
          priceId: metadataString(priceApplication, "price_id"),
          priceType: metadataString(priceApplication, "price_type"),
          priceSource: metadataString(priceApplication, "source_name"),
          priceSourceVersion: metadataString(
            priceApplication,
            "source_version",
          ),
          priceAppliedAt: metadataString(priceApplication, "applied_at"),
          pricingResolved: metadata.pricing_resolved === true,
          productMatchConfirmed: productMatch.confirmed,
          productMatchMethod: productMatch.method,
          productMatchConfidence: productMatch.confidence,
        };
      }),
      readiness,
      margin: {
        costAmount: money(calculated.costCents),
        grossProfitAmount: money(calculated.grossProfitCents),
        grossMarginBps: calculated.grossMarginBps,
        floorBps,
        floorPasses: marginPolicy.passes,
      },
      commercialSummary: {
        grossAmount: money(calculated.subtotalCents),
        discountAmount: money(calculated.discountAmountCents),
        netAmount: money(calculated.netTotalCents),
        taxAmount: quote.tax_amount,
        totalPayable: money(calculated.netTotalCents) + quote.tax_amount,
        productCost: money(calculated.costCents),
        grossProfit: money(calculated.grossProfitCents),
        grossMarginBps: calculated.grossMarginBps,
      },
      approvalStatus: approvalStatus(approvals),
      sla: sla(quote, now()),
      workflowEvents,
      configuration: {
        inventoryRequiredCount,
        inventoryResolvedCount,
        allInventorySelectionsApplied,
        allProductMatchesConfirmed,
        allInventoryConfirmed,
        pricingStatus,
        pricingResolved,
        pricingBlockers,
        canContinue: configurationContinuation.canContinue,
        blockers: configurationContinuation.blockers,
      },
      requirementsSummary: { requestedDiscountPercent, requestedDiscountBps },
      internalNotes: quote.metadata.internal_notes,
      reviewMetadata: reviewMetadata(quote.metadata),
    };
  },
});

export type QuoteWorkspaceQueryService = ReturnType<
  typeof createQuoteWorkspaceQueryService
>;
