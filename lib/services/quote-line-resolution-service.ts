import "server-only";

import { toPersistedLineResolution, getQuoteLineResolution } from "@/lib/domain/quote-line-resolution";
import type { InventoryRepository } from "@/lib/repositories/inventory";
import type { ProductsRepository } from "@/lib/repositories/products";
import type { QuoteItemCreateInput, QuotesRepository } from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";
import { createInventoryService } from "@/lib/services/inventory-service";
import { createQuotePricingResolutionService, type QuotePricingResolutionRepositories } from "@/lib/services/quote-pricing-resolution-service";

export type ResolveQuoteLineSelectionInput =
  | { quote_id: string; line_number: number; mode: "recommended"; actor_id?: string | null; idempotency_key?: string }
  | { quote_id: string; line_number: number; mode: "catalogue"; product_id: string; actor_id?: string | null; idempotency_key?: string }
  | { quote_id: string; line_number: number; mode: "unavailable"; reason?: string | null; actor_id?: string | null; idempotency_key?: string };

export type QuoteLineResolutionRepositories = QuotePricingResolutionRepositories & {
  products: Pick<ProductsRepository, "findById">;
  inventory: Pick<InventoryRepository, "listByProduct" | "listByProducts" | "findAtLocation">;
  quotes: QuotePricingResolutionRepositories["quotes"] & Pick<QuotesRepository, "findById" | "replaceItems" | "update">;
  workflowEvents: Pick<WorkflowEventsRepository, "record">;
};

const stalePricingKeys = ["price_application", "pricing_resolved", "pricing_blocker", "pricing_resolution", "unit_cost", "commercial_calculation", "approval_evaluation", "readiness"];
const staleInventoryKeys = ["inventory_decision", "selected_inventory_decision", "selected_fulfillment", "inventory_confirmed_at", "inventory_blocker"];
const without = (metadata: Record<string, unknown>, keys: string[]) => {
  const next = { ...metadata };
  for (const key of keys) delete next[key];
  return next;
};
const replacement = (item: Parameters<QuotesRepository["replaceItems"]>[1][number]): QuoteItemCreateInput => item as QuoteItemCreateInput;

export const createQuoteLineResolutionService = (repositories: QuoteLineResolutionRepositories) => ({
  async resolveQuoteLineSelection(input: ResolveQuoteLineSelectionInput) {
    const quote = await repositories.quotes.findById(input.quote_id);
    if (!quote) throw new Error(`Quote ${input.quote_id} was not found.`);
    const target = quote.items.find((item) => item.line_number === input.line_number);
    if (!target) throw new Error(`Quote line ${input.line_number} was not found.`);
    const previous = getQuoteLineResolution(target);
    const resolvedAt = new Date().toISOString();
    const inventoryService = createInventoryService({ inventoryRepository: repositories.inventory, productsRepository: repositories.products });
    let action = "quote_line_selection_changed";

    const replacements = await Promise.all(quote.items.map(async (item) => {
      if (item.line_number !== input.line_number) return replacement(item);
      const baseMetadata = without({ ...item.metadata, original_requested_sku: item.metadata.original_requested_sku ?? item.sku, original_requested_description: item.metadata.original_requested_description ?? item.description }, [...staleInventoryKeys, ...stalePricingKeys, "product_match", "product_confirmation", "product_confirmed", "excluded_from_quote", "excluded_from_pricing"]);
      if (input.mode === "unavailable") {
        action = "quote_line_marked_unavailable";
        return { ...item, product_id: null, unit_price: 0, discount_amount: 0, line_total_amount: 0, metadata: { ...baseMetadata, excluded_from_quote: true, excluded_from_pricing: true, line_resolution: toPersistedLineResolution({ status: "unavailable", source: "not_available", requestedLineNumber: item.line_number, selectedProductId: null, resolvedAt, resolvedBy: input.actor_id ?? null, reason: input.reason ?? null }) } };
      }
      const productId = input.mode === "catalogue" ? input.product_id : item.product_id;
      if (!productId) throw new Error(`Quote line ${item.line_number} does not have a recommended product.`);
      const product = await repositories.products.findById(productId);
      if (!product || product.status !== "active") throw new Error(`Selected product for line ${item.line_number} is not active.`);
      const inventoryDecision = await inventoryService.evaluateAvailability({ product, quantity: item.quantity, allowSplitFulfillment: true });
      const fulfillment = inventoryDecision.fulfillment;
      const inventoryValid = fulfillment.length > 0 && !inventoryDecision.blocked;
      action = input.mode === "catalogue" ? "quote_line_catalogue_product_selected" : "quote_line_recommended_product_selected";
      return { ...item, product_id: product.id, sku: product.sku, description: product.name ?? product.description ?? item.description, unit_price: 0, discount_amount: 0, line_total_amount: 0, metadata: { ...baseMetadata, product_match: { product_id: product.id, method: input.mode === "catalogue" ? "catalogue_selection" : "recommended", confidence: 1, ambiguous: false }, product_confirmation: { confirmed: true, product_id: product.id, confirmed_at: resolvedAt, confirmation_source: input.mode === "catalogue" ? "catalogue_selection" : "recommended" }, product_confirmed: true, inventory_decision: inventoryDecision, selected_inventory_decision: inventoryValid ? { ...inventoryDecision, fulfillment } : { ...inventoryDecision, blocked: true }, selected_fulfillment: inventoryValid ? fulfillment : [], inventory_confirmed_at: inventoryValid ? resolvedAt : null, inventory_blocker: inventoryValid ? null : "Selected product cannot currently fulfill the requested quantity. Select another product or mark this line Not available.", line_resolution: toPersistedLineResolution({ status: "selected", source: input.mode === "catalogue" ? "catalogue_selection" : "recommended", requestedLineNumber: item.line_number, selectedProductId: product.id, resolvedAt, resolvedBy: input.actor_id ?? null, reason: null }) } };
    }));
    await repositories.quotes.replaceItems(quote.id, replacements);
    await repositories.workflowEvents.record({ quote_id: quote.id, event_type: "updated", actor_id: input.actor_id ?? null, from_status: quote.status, to_status: quote.status, payload: { action, quote_id: quote.id, line_number: input.line_number, previous_resolution: previous, selected_product_id: input.mode === "catalogue" ? input.product_id : previous.selectedProductId, reason: input.mode === "unavailable" ? input.reason ?? null : null, actor_id: input.actor_id ?? null } });
    const pricing = await createQuotePricingResolutionService(repositories).resolveQuotePricing({ quoteId: quote.id, actorId: input.actor_id ?? null });
    return pricing.quote;
  },
});
