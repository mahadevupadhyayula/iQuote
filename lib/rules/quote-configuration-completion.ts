import { normalizeProductMatchState } from "@/lib/rules/product-match-state";
import { getQuoteLineResolution, isQuotableLine, isUnavailableLine, isUnresolvedLine } from "@/lib/domain/quote-line-resolution";

type QuoteConfigurationLine = {
  product_id: string | null;
  line_number: number;
  metadata: Record<string, unknown>;
};

export type QuoteConfigurationCompletion = {
  requestedLineCount: number;
  selectedLineCount: number;
  unavailableLineCount: number;
  unresolvedLineCount: number;
  quotableLineCount: number;
  allLinesResolved: boolean;
  hasAtLeastOneQuotableLine: boolean;
  allSelectedProductsConfirmed: boolean;
  allSelectedInventoryConfirmed: boolean;
  allSelectedPricingResolved: boolean;
  selectedLineNumbers: number[];
  unavailableLineNumbers: number[];
  unresolvedLineNumbers: number[];
  canPriceSelectedLines: boolean;
  canContinue: boolean;
  inventoryRequiredCount: number;
  inventoryResolvedCount: number;
  allInventorySelectionsApplied: boolean;
  allProductMatchesConfirmed: boolean;
  allInventoryConfirmed: boolean;
};

const hasConfirmedProductMatch = (item: QuoteConfigurationLine) => {
  const productState = normalizeProductMatchState(item.metadata, item.product_id);
  return Boolean(productState.productId && productState.confirmed);
};

export const quoteConfigurationCompletion = (items: QuoteConfigurationLine[]): QuoteConfigurationCompletion => {
  const selected = items.filter((item) => getQuoteLineResolution(item).status === "selected");
  const unavailable = items.filter(isUnavailableLine);
  const unresolved = items.filter(isUnresolvedLine);
  const quotable = selected.filter(isQuotableLine);
  const selectedLineNumbers = selected.map((item) => item.line_number);
  const unavailableLineNumbers = unavailable.map((item) => item.line_number);
  const unresolvedLineNumbers = unresolved.map((item) => item.line_number);
  const allSelectedProductsConfirmed = selected.every(hasConfirmedProductMatch);
  const allSelectedInventoryConfirmed = selected.every(isQuotableLine);
  const allSelectedPricingResolved = selected.every((item) => item.metadata.pricing_resolved === true && !item.metadata.pricing_blocker);
  const allLinesResolved = unresolved.length === 0;
  const hasAtLeastOneQuotableLine = quotable.length >= 1;
  const canContinue = allLinesResolved && hasAtLeastOneQuotableLine && allSelectedProductsConfirmed && allSelectedInventoryConfirmed && allSelectedPricingResolved;
  return {
    requestedLineCount: items.length, selectedLineCount: selected.length, unavailableLineCount: unavailable.length, unresolvedLineCount: unresolved.length, quotableLineCount: quotable.length,
    allLinesResolved, hasAtLeastOneQuotableLine, allSelectedProductsConfirmed, allSelectedInventoryConfirmed, allSelectedPricingResolved,
    selectedLineNumbers, unavailableLineNumbers, unresolvedLineNumbers, canPriceSelectedLines: quotable.length > 0, canContinue,
    inventoryRequiredCount: selected.length, inventoryResolvedCount: quotable.length, allInventorySelectionsApplied: allSelectedInventoryConfirmed, allProductMatchesConfirmed: allSelectedProductsConfirmed, allInventoryConfirmed: allSelectedInventoryConfirmed && allSelectedProductsConfirmed,
  };
};

export const allInventoryConfirmed = (items: QuoteConfigurationLine[]) => quoteConfigurationCompletion(items).canPriceSelectedLines;
