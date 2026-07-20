import { normalizeProductMatchState } from "@/lib/rules/product-match-state";
import type { QuoteItemRecord } from "@/lib/schemas/shared-records";

export type QuoteLineResolutionStatus = "unresolved" | "selected" | "unavailable";
export type QuoteLineResolutionSource = "recommended" | "catalogue_selection" | "not_available";

export type QuoteLineResolution = {
  status: QuoteLineResolutionStatus;
  source: QuoteLineResolutionSource | null;
  requestedLineNumber: number;
  selectedProductId: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  reason?: string | null;
};

type QuoteLineResolutionItem = Pick<QuoteItemRecord, "line_number" | "product_id" | "metadata">;

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const string = (value: unknown) => (typeof value === "string" && value.length > 0 ? value : null);

export const toPersistedLineResolution = (resolution: QuoteLineResolution) => ({
  status: resolution.status,
  source: resolution.source,
  requested_line_number: resolution.requestedLineNumber,
  selected_product_id: resolution.selectedProductId,
  resolved_at: resolution.resolvedAt,
  resolved_by: resolution.resolvedBy,
  reason: resolution.reason ?? null,
});

export const getQuoteLineResolution = (item: QuoteLineResolutionItem): QuoteLineResolution => {
  const persisted = object(item.metadata.line_resolution);
  const status = string(persisted.status);
  if (status === "selected") {
    return {
      status,
      source: string(persisted.source) === "catalogue_selection" ? "catalogue_selection" : "recommended",
      requestedLineNumber: Number(persisted.requested_line_number ?? item.line_number),
      selectedProductId: string(persisted.selected_product_id) ?? item.product_id,
      resolvedAt: string(persisted.resolved_at),
      resolvedBy: string(persisted.resolved_by),
      reason: string(persisted.reason),
    };
  }
  if (status === "unavailable" && persisted.source === "not_available") {
    return {
      status,
      source: "not_available",
      requestedLineNumber: Number(persisted.requested_line_number ?? item.line_number),
      selectedProductId: null,
      resolvedAt: string(persisted.resolved_at),
      resolvedBy: string(persisted.resolved_by),
      reason: string(persisted.reason),
    };
  }
  const productState = normalizeProductMatchState(item.metadata, item.product_id);
  if (productState.productId && item.metadata.selected_inventory_decision && Array.isArray(item.metadata.selected_fulfillment)) {
    return {
      status: "selected",
      source: string(object(item.metadata.product_confirmation).confirmation_source) === "catalogue_selection" ? "catalogue_selection" : "recommended",
      requestedLineNumber: item.line_number,
      selectedProductId: productState.productId,
      resolvedAt: string(item.metadata.inventory_confirmed_at),
      resolvedBy: string(object(item.metadata.product_confirmation).confirmed_by),
      reason: null,
    };
  }
  return { status: "unresolved", source: null, requestedLineNumber: item.line_number, selectedProductId: null, resolvedAt: null, resolvedBy: null, reason: null };
};

export const isUnavailableLine = (item: QuoteLineResolutionItem) => getQuoteLineResolution(item).status === "unavailable";
export const isUnresolvedLine = (item: QuoteLineResolutionItem) => getQuoteLineResolution(item).status === "unresolved";
export const isSelectedLine = (item: QuoteLineResolutionItem) => getQuoteLineResolution(item).status === "selected";
export const hasConfirmedSelectedInventory = (item: QuoteLineResolutionItem) => {
  const productState = normalizeProductMatchState(item.metadata, item.product_id);
  return isSelectedLine(item) && Boolean(productState.productId && productState.confirmed && item.metadata.selected_inventory_decision && Array.isArray(item.metadata.selected_fulfillment) && item.metadata.selected_fulfillment.length > 0 && typeof item.metadata.inventory_confirmed_at === "string" && !object(item.metadata.selected_inventory_decision).blocked && !item.metadata.inventory_blocker);
};
export const isQuotableLine = (item: QuoteLineResolutionItem) => hasConfirmedSelectedInventory(item);
