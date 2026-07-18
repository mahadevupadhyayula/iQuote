import "server-only";

import type { ProductsRepository } from "@/lib/repositories/products";
import type { ProductRecord } from "@/lib/schemas/shared-records";

export type ProductResolutionInput = {
  sku?: string | null;
  alias?: string | null;
  description?: string | null;
};

export type ProductResolutionMethod = "sku" | "alias" | "replacement" | "substitute" | "unmatched";

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

type ProductResolverServiceOptions = {
  productsRepository: Pick<ProductsRepository, "findBySku" | "findByAlias" | "findReplacement">;
};

type MatchedProduct = {
  product: ProductRecord;
  method: Extract<ProductResolutionMethod, "sku" | "alias">;
  confidence: number;
  reason: string;
};

const clean = (value?: string | null) => value?.trim() ?? "";
const isUnavailable = (product: ProductRecord) => product.status === "inactive" || product.status === "discontinued";
const relationshipType = (product: ProductRecord): ProductResolutionRelationship["type"] => (product.status === "discontinued" ? "replacement" : "substitute");

export const createProductResolverService = ({ productsRepository }: ProductResolverServiceOptions) => {
  const findExactMatch = async (input: ProductResolutionInput): Promise<MatchedProduct | null> => {
    const sku = clean(input.sku);
    if (sku) {
      const product = await productsRepository.findBySku(sku);
      if (product) return { product, method: "sku", confidence: 1, reason: "Matched exact requested SKU." };
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
      return { product: null, originalInput: input, method: "unmatched", confidence: 0, reason: "No exact SKU or alias match found.", relationship: null };
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
