import "server-only";

import { createOpenAIClient, getOpenAIModel, type OpenAIResponsesClient } from "@/lib/adapters/ai/openai-client";
import type { ProductsRepository } from "@/lib/repositories/products";
import { productMatchingSuggestionSchema } from "@/lib/schemas/product-matching";
import type { ProductRecord } from "@/lib/schemas/shared-records";
import { createProductResolverService } from "@/lib/services/product-resolver-service";

export type ProductMatchLine = {
  lineNumber: number;
  sku?: string | null;
  alias?: string | null;
  description?: string | null;
};

export type ProductMatch = {
  lineNumber: number;
  product: ProductRecord | null;
  method: "sku" | "product_name" | "alias" | "replacement" | "substitute" | "ai_suggestion" | "unmatched";
  confidence: number;
  ambiguous: boolean;
  requiresRepConfirmation: boolean;
  candidates: ProductRecord[];
  reason: string;
};

type ProductMatchingServiceOptions = {
  productsRepository: ProductsRepository;
  client?: OpenAIResponsesClient;
  model?: string;
};

const getResponseText = (response: { output_text?: string; output?: unknown }) => {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("OpenAI response did not include suggestion text.");
};

const toMatch = (line: ProductMatchLine, product: ProductRecord | null, method: ProductMatch["method"], confidence: number, ambiguous: boolean, candidates: ProductRecord[], reason: string): ProductMatch => ({
  lineNumber: line.lineNumber,
  product,
  method,
  confidence,
  ambiguous,
  requiresRepConfirmation: ambiguous,
  candidates,
  reason,
});

export const createProductMatchingService = ({ productsRepository, client = createOpenAIClient(), model = getOpenAIModel() }: ProductMatchingServiceOptions) => {
  const resolver = createProductResolverService({ productsRepository });

  const matchLine = async (line: ProductMatchLine): Promise<ProductMatch> => {
    const sku = line.sku?.trim() ?? "";
    const description = line.description?.trim() ?? "";

    const skuResolution = sku ? await resolver.resolve({ sku }) : null;
    if (skuResolution?.product) return toMatch(line, skuResolution.product, skuResolution.method, skuResolution.confidence, false, [skuResolution.product], skuResolution.reason);

    const nameResolution = description ? await resolver.resolve({ name: description }) : null;
    if (nameResolution?.product) return toMatch(line, nameResolution.product, nameResolution.method, nameResolution.confidence, false, [nameResolution.product], nameResolution.reason);

    const alias = line.alias?.trim() ?? "";
    const aliasResolution = alias || description ? await resolver.resolve({ alias: alias || description }) : null;
    if (aliasResolution?.product) return toMatch(line, aliasResolution.product, aliasResolution.method, aliasResolution.confidence, false, [aliasResolution.product], aliasResolution.reason);

    const query = sku || description;
    const candidates = query ? await productsRepository.search(query, 10) : [];
    if (candidates.length === 0) return toMatch(line, null, "unmatched", 0, false, candidates, "No deterministic product candidates found.");
    if (candidates.length === 1) return toMatch(line, candidates[0], "unmatched", 0.5, true, candidates, "Single catalogue text-search candidate requires rep confirmation before product selection.");

    try {
      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: [{ type: "input_text", text: "Rank the supplied product candidates for the extracted quote line. Choose product_id only from provided candidates. Return JSON: {\"product_id\": string|null, \"confidence\": number, \"reason\": string}. Use null for ambiguous or weak matches. Never infer pricing, discounts, inventory, approval status, or quote totals." }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify({ extracted_line: line, candidates: candidates.map(({ id, sku, name, description }) => ({ id, sku, name, description })) }) }] },
        ],
      });
      const suggestion = productMatchingSuggestionSchema.parse(JSON.parse(getResponseText(response)));
      const product = suggestion.product_id === null ? null : candidates.find((candidate) => candidate.id === suggestion.product_id) ?? null;
      if (suggestion.product_id !== null && !product) {
        return toMatch(line, null, "unmatched", suggestion.confidence, true, candidates, "AI selected a product id that was not in the supplied candidate list; rep confirmation required.");
      }
      if (!product || suggestion.confidence < 0.75 || suggestion.ambiguous === true) return toMatch(line, null, "unmatched", suggestion.confidence, true, candidates, suggestion.reason || "AI suggestion was ambiguous; rep confirmation required.");
      return toMatch(line, product, "ai_suggestion", suggestion.confidence, true, candidates, `${suggestion.reason} Rep confirmation required for AI-ranked product match.`);
    } catch (error) {
      return toMatch(line, null, "unmatched", 0, true, candidates, error instanceof Error ? `${error.message}; rep confirmation required.` : "AI product suggestion failed; rep confirmation required.");
    }
  };

  return {
    matchLine,
    async matchLines(lines: ProductMatchLine[]) {
      return Promise.all(lines.map((line) => matchLine(line)));
    },
  };
};

export type ProductMatchingService = ReturnType<typeof createProductMatchingService>;
