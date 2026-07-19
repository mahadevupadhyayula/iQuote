import "server-only";

import { evaluateApprovalPolicy, type ApprovalEvaluation } from "@/lib/rules/approval-rules";
import { evaluateDiscountPolicies, type DiscountPolicyEvaluation } from "@/lib/rules/discount-policy-rules";
import type { InventoryDecision } from "@/lib/rules/inventory-rules";
import type { BasisPoints, Cents } from "@/lib/utils/money";
import type { ApprovalsRepository } from "@/lib/repositories/approvals";
import type { CustomersRepository } from "@/lib/repositories/customers";
import type { InventoryRepository } from "@/lib/repositories/inventory";
import type { PricesRepository } from "@/lib/repositories/prices";
import type { ProductsRepository } from "@/lib/repositories/products";
import type { QuotesRepository } from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";
import type { ApprovalRecord, CustomerRecord, PriceRecord, ProductRecord, QuoteItemRecord, QuoteRecord } from "@/lib/schemas/shared-records";
import { calculateQuote, type QuoteCalculation } from "@/lib/services/quote-calculation-service";
import { createInventoryService } from "@/lib/services/inventory-service";
import { createProductResolverService, type ProductResolution } from "@/lib/services/product-resolver-service";
import { createWorkflowService } from "@/lib/services/workflow-service";

export type QuoteFoundationLineInput = {
  sku?: string | null;
  alias?: string | null;
  description?: string | null;
  quantity: number;
  requestedDiscountBps?: BasisPoints;
  warehouseCodes?: string[];
  metadata?: Record<string, unknown>;
};

export type QuoteFoundationInput = {
  customerId?: string | null;
  customerExternalId?: string | null;
  customerName?: string | null;
  opportunityId?: string | null;
  currencyCode?: string;
  validUntil?: string | null;
  lines: QuoteFoundationLineInput[];
  actorId?: string | null;
  idempotencyKey?: string;
  quoteNumber?: string;
  metadata?: Record<string, unknown>;
};

export type QuoteFoundationRepositories = {
  customers: Pick<CustomersRepository, "findById" | "findByExternalId" | "findByName">;
  products: Pick<ProductsRepository, "findBySku" | "findByAlias" | "findReplacement" | "listSubstitutes">;
  prices: Pick<PricesRepository, "findCustomerSpecificPrice" | "findCustomerTierPrice" | "findListPrice" | "listActiveDiscountPolicies">;
  inventory: Pick<InventoryRepository, "listByProduct" | "listByProducts" | "findAtLocation">;
  quotes: Pick<QuotesRepository, "createQuote" | "addItems" | "findById" | "updateStatus">;
  approvals: Pick<ApprovalsRepository, "request">;
  workflowEvents: Pick<WorkflowEventsRepository, "record" | "findByIdempotencyKey">;
};

type ResolvedQuoteFoundationLine = {
  lineNumber: number;
  input: QuoteFoundationLineInput;
  productResolution: ProductResolution;
  product: ProductRecord;
  price: PriceRecord;
  inventoryDecision: InventoryDecision;
  requestedDiscountBps: BasisPoints;
};

export type QuoteFoundationLineResult = ResolvedQuoteFoundationLine & {
  discountPolicyEvaluation: DiscountPolicyEvaluation;
};

export type QuoteFoundationResult = {
  customer: CustomerRecord;
  lines: QuoteFoundationLineResult[];
  calculation: QuoteCalculation;
  approvalEvaluation: ApprovalEvaluation;
  quote: QuoteRecord;
  items: QuoteItemRecord[];
  approvals: ApprovalRecord[];
  workflowEvent: Awaited<ReturnType<WorkflowEventsRepository["record"]>>;
};

export type QuoteFoundationServiceOptions = {
  repositories: QuoteFoundationRepositories;
  now?: () => Date;
  quoteNumber?: () => string;
};

const cents = (amount: number): Cents => Math.round(amount * 100);
const money = (amountCents: Cents) => Math.round(amountCents) / 100;
const today = (date: Date) => date.toISOString().slice(0, 10);

const resolveCustomer = async (repositories: QuoteFoundationRepositories, input: QuoteFoundationInput) => {
  if (input.customerId) return repositories.customers.findById(input.customerId);
  if (input.customerExternalId) return repositories.customers.findByExternalId(input.customerExternalId);
  if (input.customerName) return (await repositories.customers.findByName(input.customerName, 2))[0] ?? null;
  return null;
};

const resolvePrice = async (
  repositories: QuoteFoundationRepositories,
  product: ProductRecord,
  customer: CustomerRecord,
  currencyCode: string,
  onDate: string,
) =>
  (await repositories.prices.findCustomerSpecificPrice({ productId: product.id, customerId: customer.id, currencyCode, onDate })) ??
  (typeof customer.metadata.tier === "string"
    ? await repositories.prices.findCustomerTierPrice({ productId: product.id, customerTier: customer.metadata.tier, currencyCode, onDate })
    : null) ??
  (await repositories.prices.findListPrice({ productId: product.id, currencyCode, onDate }));

export const createQuoteFoundationService = ({ repositories, now = () => new Date(), quoteNumber = () => `Q-${Date.now()}` }: QuoteFoundationServiceOptions) => {
  const productResolver = createProductResolverService({ productsRepository: repositories.products });
  const inventoryService = createInventoryService({ inventoryRepository: repositories.inventory, productsRepository: repositories.products });
  const workflowService = createWorkflowService({
    quotesRepository: repositories.quotes as QuotesRepository,
    workflowEventsRepository: repositories.workflowEvents as WorkflowEventsRepository,
    now,
  });

  return {
    async accept(input: QuoteFoundationInput): Promise<QuoteFoundationResult> {
      if (input.lines.length === 0) throw new Error("At least one quote line is required.");

      const timestamp = now();
      const currencyCode = input.currencyCode ?? "USD";
      const onDate = today(timestamp);
      const customer = await resolveCustomer(repositories, input);
      if (!customer) throw new Error("Unable to resolve customer for quote foundation acceptance.");

      const lines = await Promise.all(
        input.lines.map(async (line, index): Promise<ResolvedQuoteFoundationLine> => {
          const productResolution = await productResolver.resolve(line);
          if (!productResolution.product) throw new Error(`Unable to resolve product for quote line ${index + 1}.`);
          const price = await resolvePrice(repositories, productResolution.product, customer, currencyCode, onDate);
          if (!price) throw new Error(`Unable to resolve ${currencyCode} price for quote line ${index + 1}.`);
          const inventoryDecision = await inventoryService.evaluateAvailability({
            product: productResolution.product,
            quantity: line.quantity,
            warehouseCodes: line.warehouseCodes,
            now: timestamp.toISOString(),
          });
          return { lineNumber: index + 1, input: line, productResolution, product: productResolution.product, price, inventoryDecision, requestedDiscountBps: line.requestedDiscountBps ?? 0 };
        }),
      );

      const calculation = calculateQuote(
        lines.map((line) => ({
          lineId: String(line.lineNumber),
          quantity: line.input.quantity,
          unitPriceCents: cents(line.price.unit_price),
          unitCostCents: cents(line.price.unit_cost),
          discountBps: line.requestedDiscountBps,
        })),
      );
      const policies = await repositories.prices.listActiveDiscountPolicies(onDate);
      const linesWithDiscountEvaluations = lines.map((line) => {
        const calculated = calculation.lines[line.lineNumber - 1];
        return {
          ...line,
          discountPolicyEvaluation: evaluateDiscountPolicies({
            customerId: customer.id,
            customerExternalId: customer.external_id,
            customerTier: typeof customer.metadata.tier === "string" ? customer.metadata.tier : null,
            productId: line.product.id,
            productSku: line.product.sku,
            productFamily: typeof line.product.metadata.family === "string" ? line.product.metadata.family : null,
            replacement: line.productResolution.relationship
              ? {
                  fromSku: line.productResolution.relationship.originalProduct.sku,
                  toSku: line.product.sku,
                  fromProductId: line.productResolution.relationship.originalProduct.id,
                  toProductId: line.product.id,
                }
              : null,
            quantity: line.input.quantity,
            lineSubtotalCents: calculated.lineSubtotalCents,
            unitCostCents: calculated.extendedUnitCostCents,
            requestedDiscountBps: line.requestedDiscountBps,
            metadata: line.input.metadata,
            policies,
          }),
        };
      });
      const requestedDiscountBps = calculation.quoteSubtotalCents > 0 ? Math.round((calculation.totalDiscountCents / calculation.quoteSubtotalCents) * 10_000) : 0;
      const approvalEvaluation = evaluateApprovalPolicy({ requestedDiscountBps, projectedMarginBps: calculation.grossMarginBps, policies });

      const quote = await repositories.quotes.createQuote({
        customer_id: customer.id,
        opportunity_id: input.opportunityId ?? null,
        quote_number: input.quoteNumber ?? quoteNumber(),
        status: "draft",
        currency_code: currencyCode,
        subtotal_amount: money(calculation.quoteSubtotalCents),
        discount_amount: money(calculation.totalDiscountCents),
        tax_amount: 0,
        total_amount: money(calculation.netTotalCents),
        valid_until: input.validUntil ?? null,
        submitted_at: null,
        approved_at: null,
        sent_at: null,
        accepted_at: null,
        sla_due_at: null,
        metadata: {
          ...input.metadata,
          acceptance_flow: "phase_1",
          margin: { grossProfitCents: calculation.grossProfitCents, grossMarginBps: calculation.grossMarginBps },
          discountPolicyEvaluations: linesWithDiscountEvaluations.map((line) => line.discountPolicyEvaluation),
          approvalEvaluation,
        },
      });

      const items = await repositories.quotes.addItems(
        quote.id,
        linesWithDiscountEvaluations.map((line) => {
          const calculated = calculation.lines[line.lineNumber - 1];
          return {
            product_id: line.product.id,
            line_number: line.lineNumber,
            sku: line.product.sku,
            description: line.input.description ?? line.product.name,
            quantity: line.input.quantity,
            unit_price: money(calculated.unitPriceCents),
            discount_bps: calculated.discountBps,
            discount_amount: money(calculated.lineDiscountCents),
            line_total_amount: money(calculated.lineNetTotalCents),
            metadata: { ...line.input.metadata, product_resolution: line.productResolution, inventory_decision: line.inventoryDecision, price_id: line.price.id, unit_cost: line.price.unit_cost },
          };
        }),
      );

      const approvals = approvalEvaluation.requiredRole
        ? [
            await repositories.approvals.request({
              quote_id: quote.id,
              required_role: approvalEvaluation.requiredRole,
              requested_by: input.actorId ?? null,
              metadata: { approvalEvaluation, requestedDiscountBps, grossMarginBps: calculation.grossMarginBps },
            }),
          ]
        : [];

      const transition = await workflowService.transitionQuote({
        quoteId: quote.id,
        toStatus: approvalEvaluation.requiredRole ? "pending_approval" : "approved",
        actorId: input.actorId ?? null,
        payload: { action: "phase_1_acceptance", approvalEvaluation, line_count: items.length },
        idempotencyKey: input.idempotencyKey,
      });

      return { customer, lines: linesWithDiscountEvaluations, calculation, approvalEvaluation, quote: transition.quote, items, approvals, workflowEvent: transition.event };
    },
  };
};

export type QuoteFoundationService = ReturnType<typeof createQuoteFoundationService>;
