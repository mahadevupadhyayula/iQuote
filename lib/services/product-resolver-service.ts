import "server-only";

import type { ProductsRepository } from "@/lib/repositories/products";
import type { ProductRecord } from "@/lib/schemas/shared-records";

export type ProductResolutionInput = {
  sku?: string | null;
  name?: string | null;
  alias?: string | null;
  description?: string | null;
};

export type ProductResolutionMethod = "sku" | "product_name" | "alias" | "replacement" | "substitute" | "unmatched";

export type ProductResolutionRelationship = {
  type: "replacement" | "substitute";
  originalProduct: ProductRecord;
  reason: string;
};

export type ProductResolution = {
  product: ProductRecord | null;
  originalInput: ProductResolutionInput;
  method: ProductResolutionMethod;
  confidence: number;
  reason: string;
  relationship: ProductResolutionRelationship | null;
};

type ProductResolverRepository = Pick<ProductsRepository, "findBySku" | "findByAlias" | "findReplacement"> &
  Partial<Pick<ProductsRepository, "findByName" | "findByNormalizedName">>;

type ProductResolverServiceOptions = {
  productsRepository: ProductResolverRepository;
};

type MatchedProduct = {
  product: ProductRecord;
  method: Extract<ProductResolutionMethod, "sku" | "product_name" | "alias">;
  confidence: number;
  reason: string;
};

const clean = (value?: string | null) => value?.trim() ?? "";
export const normalizeProductLookupValue = (value: string) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
const isUnavailable = (product: ProductRecord) => product.status === "inactive" || product.status === "discontinued";
const relationshipType = (product: ProductRecord): ProductResolutionRelationship["type"] => (product.status === "discontinued" ? "replacement" : "substitute");

export const createProductResolverService = ({ productsRepository }: ProductResolverServiceOptions) => {
  const findNormalizedSku = async (sku: string): Promise<MatchedProduct | null> => {
    const normalizedSku = normalizeProductLookupValue(sku);
    if (!normalizedSku || normalizedSku === sku) return null;
    const product = await productsRepository.findBySku(normalizedSku);
    return product ? { product, method: "sku", confidence: 1, reason: "Matched normalized requested SKU." } : null;
  };

  const findProductName = async (name: string): Promise<MatchedProduct | null> => {
    if (productsRepository.findByName) {
      const exact = await productsRepository.findByName(name);
      if (exact) return { product: exact, method: "product_name", confidence: 1, reason: "Matched exact requested product name." };
    }

    const normalizedName = normalizeProductLookupValue(name);
    if (!normalizedName) return null;
    if (productsRepository.findByNormalizedName) {
      const normalized = await productsRepository.findByNormalizedName(normalizedName);
      if (normalized) return { product: normalized, method: "product_name", confidence: 1, reason: "Matched normalized requested product name." };
    }
    if (productsRepository.findByName && normalizedName !== name) {
      const normalized = await productsRepository.findByName(normalizedName);
      if (normalized) return { product: normalized, method: "product_name", confidence: 1, reason: "Matched normalized requested product name." };
    }
    return null;
  };

  const findExactMatch = async (input: ProductResolutionInput): Promise<MatchedProduct | null> => {
    const sku = clean(input.sku);
    if (sku) {
      const product = await productsRepository.findBySku(sku);
      if (product) return { product, method: "sku", confidence: 1, reason: "Matched exact requested SKU." };
      const normalizedSku = await findNormalizedSku(sku);
      if (normalizedSku) return normalizedSku;
    }

    const nameCandidates = [clean(input.name), clean(input.description)].filter(Boolean);
    for (const name of nameCandidates) {
      const product = await findProductName(name);
      if (product) return product;
    }

    const aliasCandidates = [clean(input.alias), clean(input.description)].filter(Boolean);
    for (const alias of aliasCandidates) {
      const product = await productsRepository.findByAlias(alias);
      if (product) return { product, method: "alias", confidence: 1, reason: "Matched exact requested alias." };
    }

    return null;
  };

  const resolve = async (input: ProductResolutionInput): Promise<ProductResolution> => {
    const match = await findExactMatch(input);
    if (!match) {
      return { product: null, originalInput: input, method: "unmatched", confidence: 0, reason: "No exact SKU, product-name, or alias match found.", relationship: null };
    }

    const replacement = await productsRepository.findReplacement(match.product.id);
    const shouldUseReplacement = Boolean(replacement) && (isUnavailable(match.product) || match.product.status === "active");
    if (replacement && shouldUseReplacement) {
      const type = relationshipType(match.product);
      const reason = isUnavailable(match.product)
        ? `Matched product ${match.product.sku} is ${match.product.status}; resolved to mapped ${type} ${replacement.sku}.`
        : `Matched product ${match.product.sku} has an explicit mapped ${type} ${replacement.sku}.`;
      return {
        product: replacement,
        originalInput: input,
        method: type,
        confidence: 1,
        reason,
        relationship: { type, originalProduct: match.product, reason },
      };
    }

    return { product: match.product, originalInput: input, method: match.method, confidence: match.confidence, reason: match.reason, relationship: null };
  };

  return { resolve };
};

export type ProductResolverService = ReturnType<typeof createProductResolverService>;
