import "server-only";

import { evaluateQuoteReadiness } from "@/lib/rules/readiness-rules";
import { evaluateMarginFloor } from "@/lib/rules/margin-rules";
import type { ApprovalsRepository } from "@/lib/repositories/approvals";
import type { PricesRepository } from "@/lib/repositories/prices";
import type { ProductsRepository } from "@/lib/repositories/products";
import type { QuotesRepository, QuoteItemCreateInput } from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";
import { calculateQuote } from "@/lib/services/quote-calculation-service";
import { createInventoryService } from "@/lib/services/inventory-service";
import { createApprovalService } from "@/lib/services/approval-service";
import type { BasisPoints } from "@/lib/utils/money";

export type CommercialConfigurationRepositories = {
  approvals: Pick<ApprovalsRepository, "listByQuote">;
  inventory: Parameters<typeof createInventoryService>[0]["inventoryRepository"];
  prices: Pick<PricesRepository, "findCurrentPrice" | "listActiveDiscountPolicies">;
  products: Pick<ProductsRepository, "findById" | "listSubstitutes">;
  quotes: Pick<QuotesRepository, "findById" | "replaceItems" | "update">;
  workflowEvents: Pick<WorkflowEventsRepository, "record">;
};

type ConfigureInput = { quoteId: string; actorId?: string | null; onDate?: string };

const money = (cents: number) => Math.round(cents) / 100;
const cents = (amount: number) => Math.round(amount * 100);
const metadataObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const numberMeta = (metadata: Record<string, unknown>, key: string, fallback = 0) => typeof metadata[key] === "number" ? metadata[key] as number : fallback;
const requiresConfirmation = (metadata: Record<string, unknown>) => {
  const match = metadataObject(metadata.product_match);
  const method = typeof match.method === "string" ? match.method : "unmatched";
  const confidence = typeof match.confidence === "number" ? match.confidence : 0;
  const confirmed = metadataObject(metadata.product_confirmation).confirmed === true;
  return method === "unmatched" || method === "ai_ranked" || confidence < 1 ? !confirmed : false;
};

export const createQuoteCommercialConfigurationService = (repositories: CommercialConfigurationRepositories) => ({
  async configureQuoteCommercials({ quoteId, actorId = null, onDate = new Date().toISOString().slice(0, 10) }: ConfigureInput) {
    const quote = await repositories.quotes.findById(quoteId);
    if (!quote) throw new Error(`Quote ${quoteId} was not found.`);

    const products = (await Promise.all(quote.items.map((item) => item.product_id ? repositories.products.findById(item.product_id) : null))).filter((p): p is NonNullable<typeof p> => Boolean(p));
    const productsById = new Map(products.map((product) => [product.id, product]));
    const inventoryService = createInventoryService({ inventoryRepository: repositories.inventory, productsRepository: repositories.products });
    const events: Promise<unknown>[] = [];
    const blockingExceptions: { code: string; message: string; blocking: boolean; productId?: string }[] = [];

    const replacements: Omit<QuoteItemCreateInput, "quote_id">[] = [];
    for (const item of quote.items.sort((a, b) => a.line_number - b.line_number)) {
      const metadata = { ...item.metadata };
      const product = item.product_id ? productsById.get(item.product_id) : null;
      let unitPrice = item.unit_price;
      let unitCost = numberMeta(metadata, "unit_cost");
      let priceMetadata = metadataObject(metadata.price_application);

      if (product && requiresConfirmation(metadata)) {
        blockingExceptions.push({ code: "unresolved_product_match", message: `Quote line ${item.line_number} requires rep confirmation for the ERP product match.`, blocking: true, productId: product.id });
      }

      if (product && !requiresConfirmation(metadata)) {
        const price = await repositories.prices.findCurrentPrice(product.id, quote.currency_code, onDate);
        if (price) {
          unitPrice = price.unit_price;
          unitCost = price.unit_cost;
          priceMetadata = { product_id: product.id, price_id: price.id, currency_code: price.currency_code, effective_from: price.effective_from, effective_to: price.effective_to, source_name: price.source_name, source_version: price.source_version, applied_at: new Date().toISOString() };
          events.push(repositories.workflowEvents.record({ quote_id: quote.id, event_type: "updated", actor_id: actorId, from_status: quote.status, to_status: quote.status, payload: { action: "price_application", line_number: item.line_number, price: priceMetadata } }));
        }

        if (!metadata.inventory_decision) {
          const inventoryDecision = await inventoryService.evaluateAvailability({ product, quantity: item.quantity, allowSplitFulfillment: true });
          metadata.inventory_decision = inventoryDecision;
        }
      }

      metadata.unit_cost = unitCost;
      metadata.price_application = priceMetadata;
      const lineCalc = calculateQuote([{ quantity: item.quantity, unitPriceCents: cents(unitPrice), unitCostCents: cents(unitCost), discountBps: item.discount_bps as BasisPoints }]).lines[0];
      replacements.push({ product_id: item.product_id, line_number: item.line_number, sku: product?.sku ?? item.sku, description: product?.description ?? product?.name ?? item.description, quantity: item.quantity, unit_price: unitPrice, discount_bps: item.discount_bps, discount_amount: money(lineCalc.lineDiscountCents), line_total_amount: money(lineCalc.lineNetTotalCents), metadata });
    }

    const items = await repositories.quotes.replaceItems(quote.id, replacements);
    const calculated = calculateQuote(items.map((item) => ({ lineId: item.id, quantity: item.quantity, unitPriceCents: cents(item.unit_price), unitCostCents: cents(numberMeta(item.metadata, "unit_cost")), discountBps: item.discount_bps as BasisPoints })));
    const marginFloorBps = numberMeta(quote.metadata, "margin_floor_bps") as BasisPoints;
    const marginPolicy = evaluateMarginFloor({ sellPriceCents: calculated.sellPriceCents, costCents: calculated.costCents, floorBps: marginFloorBps });
    const discountBps = calculated.subtotalCents > 0 ? Math.round((calculated.discountAmountCents / calculated.subtotalCents) * 10_000) as BasisPoints : 0 as BasisPoints;
    const approvalEvaluation = await createApprovalService(repositories.prices).evaluatePolicy({ requestedDiscountBps: discountBps, projectedMarginBps: calculated.grossMarginBps, onDate });
    const approvals = await repositories.approvals.listByQuote(quote.id);
    const prices = items.map((item) => metadataObject(item.metadata.price_application)).filter((p) => typeof p.product_id === "string").map((p) => ({ productId: p.product_id as string, unitPrice: items.find((i) => i.product_id === p.product_id)?.unit_price ?? null, unitCost: numberMeta(items.find((i) => i.product_id === p.product_id)?.metadata ?? {}, "unit_cost"), currencyCode: p.currency_code as string, effectiveFrom: p.effective_from as string, effectiveTo: p.effective_to as string | null, sourceName: p.source_name as string, sourceVersion: p.source_version as string }));
    const readiness = evaluateQuoteReadiness({ customerId: quote.customer_id, currencyCode: quote.currency_code, lines: items.map((item) => ({ productId: item.product_id, sku: item.sku, description: item.description, quantity: item.quantity })), products, prices, inventoryDecisions: items.map((item) => item.metadata.selected_inventory_decision ?? item.metadata.inventory_decision).filter(Boolean) as never, marginPolicy, commercialCalculation: { subtotalAmount: money(calculated.subtotalCents), discountAmount: money(calculated.discountAmountCents), totalAmount: money(calculated.netTotalCents), grossMarginBps: calculated.grossMarginBps }, discountPolicyEvaluation: approvalEvaluation, approvals: approvals.map((approval) => ({ requiredRole: approval.required_role, status: approval.status })), paymentTerms: quote.metadata.payment_terms as never, slaDueAt: quote.sla_due_at, quoteStatus: quote.status, blockingExceptions });
    const updated = await repositories.quotes.update(quote.id, { subtotal_amount: money(calculated.subtotalCents), discount_amount: money(calculated.discountAmountCents), total_amount: money(calculated.netTotalCents), metadata: { ...quote.metadata, readiness, commercial_calculation: { cost_amount: money(calculated.costCents), gross_profit_amount: money(calculated.grossProfitCents), gross_margin_bps: calculated.grossMarginBps }, approval_evaluation: approvalEvaluation } });
    await Promise.all(events);
    return { quote: updated, items, calculation: calculated, readiness, approvalEvaluation, effectiveDiscountBps: discountBps };
  },
});
