import { normalizeProductMatchState } from "@/lib/rules/product-match-state";

type QuoteConfigurationLine = {
  product_id: string | null;
  metadata: Record<string, unknown>;
};

export type QuoteConfigurationCompletion = {
  inventoryRequiredCount: number;
  inventoryResolvedCount: number;
  allInventorySelectionsApplied: boolean;
  allProductMatchesConfirmed: boolean;
  allInventoryConfirmed: boolean;
};

const hasAppliedInventorySelection = (item: QuoteConfigurationLine) => {
  const fulfillment = item.metadata.selected_fulfillment;
  return Boolean(
    item.product_id
      && item.metadata.selected_inventory_decision
      && Array.isArray(fulfillment)
      && fulfillment.length > 0
      && typeof item.metadata.inventory_confirmed_at === "string",
  );
};

const hasConfirmedProductMatch = (item: QuoteConfigurationLine) => {
  const productState = normalizeProductMatchState(item.metadata, item.product_id);
  return Boolean(productState.productId && productState.confirmed);
};

export const quoteConfigurationCompletion = (items: QuoteConfigurationLine[]): QuoteConfigurationCompletion => {
  const inventoryRequiredCount = items.filter((item) => Boolean(item.product_id)).length;
  const inventoryResolvedCount = items.filter(hasAppliedInventorySelection).length;
  const allInventorySelectionsApplied = inventoryRequiredCount > 0 && inventoryRequiredCount === inventoryResolvedCount;
  const allProductMatchesConfirmed = items.every(hasConfirmedProductMatch);

  return {
    inventoryRequiredCount,
    inventoryResolvedCount,
    allInventorySelectionsApplied,
    allProductMatchesConfirmed,
    allInventoryConfirmed: allInventorySelectionsApplied && allProductMatchesConfirmed,
  };
};

export const allInventoryConfirmed = (items: QuoteConfigurationLine[]) => quoteConfigurationCompletion(items).allInventoryConfirmed;
