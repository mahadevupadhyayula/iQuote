import { describe, expect, it } from "vitest";

import { normalizeProductMatchState } from "@/lib/rules/product-match-state";

const productId = "20000000-0000-4000-8000-000000000200";

describe("normalizeProductMatchState", () => {
  it("resolves exact deterministic SKU matches", () => {
    expect(normalizeProductMatchState({ product_match: { method: "exact_sku", confidence: 1 } }, productId)).toMatchObject({ productId, confirmed: true, requiresConfirmation: false });
  });

  it("resolves high-confidence exact alias matches", () => {
    expect(normalizeProductMatchState({ product_match: { method: "exact_alias", confidence: 0.99, product_id: productId } })).toMatchObject({ confirmed: true, requiresConfirmation: false });
  });

  it("requires confirmation for AI ranked matches", () => {
    expect(normalizeProductMatchState({ product_match: { method: "ai_ranked", confidence: 0.91, product_id: productId } })).toMatchObject({ confirmed: false, requiresConfirmation: true });
  });

  it("blocks missing product IDs", () => {
    expect(normalizeProductMatchState({ product_match: { method: "unmatched", confidence: 0 } })).toMatchObject({ productId: null, confirmed: false, requiresConfirmation: true });
  });

  it("normalizes legacy deterministic_match metadata", () => {
    expect(normalizeProductMatchState({ deterministic_match: { id: productId, confidence: 1 } })).toMatchObject({ productId, confirmed: true, requiresConfirmation: false });
  });
});
