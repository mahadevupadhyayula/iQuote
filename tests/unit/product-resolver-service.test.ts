import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createProductResolverService } from "@/lib/services/product-resolver-service";
import type { ProductRecord } from "@/lib/schemas/shared-records";

const timestamp = "2026-07-18T00:00:00.000Z";

const product = (overrides: Partial<ProductRecord> = {}): ProductRecord => ({
  id: "10000000-0000-4000-8000-000000000001",
  sku: "AX-100",
  name: "AX-100 Pump",
  description: null,
  status: "active",
  unit_of_measure: "ea",
  metadata: {},
  created_at: timestamp,
  updated_at: timestamp,
  ...overrides,
});

const repository = (products: { sku?: ProductRecord | null; name?: ProductRecord | null; normalizedName?: ProductRecord | null; alias?: ProductRecord | null; replacement?: ProductRecord | null } = {}) => ({
  findBySku: vi.fn(async (sku: string) => (sku === products.sku?.sku ? products.sku : null) ?? null),
  findByName: vi.fn(async () => products.name ?? null),
  findByNormalizedName: vi.fn(async () => products.normalizedName ?? null),
  findByAlias: vi.fn(async () => products.alias ?? null),
  findReplacement: vi.fn(async () => products.replacement ?? null),
});

describe("createProductResolverService", () => {
  it("resolves exact SKU before exact alias", async () => {
    const skuProduct = product({ sku: "AX-100" });
    const aliasProduct = product({ id: "10000000-0000-4000-8000-000000000002", sku: "HX-500" });
    const productsRepository = repository({ sku: skuProduct, alias: aliasProduct });

    const result = await createProductResolverService({ productsRepository }).resolve({ sku: "AX-100", alias: "HX alias", description: "HX alias" });

    expect(result).toMatchObject({ product: skuProduct, method: "sku", confidence: 1, relationship: null });
    expect(productsRepository.findByAlias).not.toHaveBeenCalled();
  });

  it("resolves normalized SKU before product-name or alias matches", async () => {
    const skuProduct = product({ sku: "ax100" });
    const productsRepository = repository({ sku: skuProduct });

    const result = await createProductResolverService({ productsRepository }).resolve({ sku: "AX-100", alias: "legacy HX", description: "AX-100 Pump" });

    expect(result).toMatchObject({ product: skuProduct, method: "sku", confidence: 1, relationship: null });
    expect(productsRepository.findBySku).toHaveBeenNthCalledWith(1, "AX-100");
    expect(productsRepository.findBySku).toHaveBeenNthCalledWith(2, "ax100");
    expect(productsRepository.findByAlias).not.toHaveBeenCalled();
  });

  it("resolves exact product name before exact alias", async () => {
    const nameProduct = product({ sku: "NAME-100", name: "AX-100 Pump" });
    const aliasProduct = product({ id: "10000000-0000-4000-8000-000000000005", sku: "ALIAS-100" });
    const productsRepository = repository({ name: nameProduct, alias: aliasProduct });

    const result = await createProductResolverService({ productsRepository }).resolve({ alias: "AX-100 Pump Alias", description: "AX-100 Pump" });

    expect(result).toMatchObject({ product: nameProduct, method: "product_name", confidence: 1, relationship: null });
    expect(productsRepository.findByAlias).not.toHaveBeenCalled();
  });

  it("resolves normalized product name before exact alias", async () => {
    const nameProduct = product({ sku: "NAME-100", name: "AX 100 Pump" });
    const productsRepository = repository({ normalizedName: nameProduct });

    const result = await createProductResolverService({ productsRepository }).resolve({ alias: "AX pump alias", description: "AX-100 Pump" });

    expect(result).toMatchObject({ product: nameProduct, method: "product_name", confidence: 1, relationship: null });
    expect(productsRepository.findByNormalizedName).toHaveBeenCalledWith("ax100pump");
    expect(productsRepository.findByAlias).not.toHaveBeenCalled();
  });

  it("resolves exact alias after SKU and product-name lookups miss", async () => {
    const aliasProduct = product({ sku: "HX-500" });
    const productsRepository = repository({ alias: aliasProduct });

    const result = await createProductResolverService({ productsRepository }).resolve({ sku: "UNKNOWN", alias: "legacy HX" });

    expect(result).toMatchObject({ product: aliasProduct, method: "alias", confidence: 1, relationship: null });
    expect(productsRepository.findBySku).toHaveBeenCalledWith("UNKNOWN");
    expect(productsRepository.findByAlias).toHaveBeenCalledWith("legacy HX");
  });

  it("returns a mapped replacement for a discontinued exact match", async () => {
    const discontinued = product({ sku: "OLD-100", status: "discontinued" });
    const replacement = product({ id: "10000000-0000-4000-8000-000000000003", sku: "NEW-100" });
    const productsRepository = repository({ sku: discontinued, replacement });

    const result = await createProductResolverService({ productsRepository }).resolve({ sku: "OLD-100" });

    expect(result.product).toBe(replacement);
    expect(result.method).toBe("replacement");
    expect(result.relationship).toMatchObject({ type: "replacement", originalProduct: discontinued });
  });

  it("returns an explicit mapped substitute for an active exact match", async () => {
    const original = product({ sku: "AX-100" });
    const substitute = product({ id: "10000000-0000-4000-8000-000000000004", sku: "AX-100-SUB" });
    const productsRepository = repository({ sku: original, replacement: substitute });

    const result = await createProductResolverService({ productsRepository }).resolve({ sku: "AX-100" });

    expect(result.product).toBe(substitute);
    expect(result.method).toBe("substitute");
    expect(result.relationship).toMatchObject({ type: "substitute", originalProduct: original });
  });

  it("returns unmatched without searching or AI when exact repository lookups miss", async () => {
    const productsRepository = repository();

    const result = await createProductResolverService({ productsRepository }).resolve({ sku: "MISSING", alias: "missing alias", description: "missing description" });

    expect(result).toEqual({ product: null, originalInput: { sku: "MISSING", alias: "missing alias", description: "missing description" }, method: "unmatched", confidence: 0, reason: "No exact SKU, product-name, or alias match found.", relationship: null });
    expect(productsRepository.findReplacement).not.toHaveBeenCalled();
  });
});
