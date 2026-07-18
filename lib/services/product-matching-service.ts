import "server-only";

import { createOpenAIClient, getOpenAIModel, type OpenAIResponsesClient } from "@/lib/adapters/ai/openai-client";
import type { ProductsRepository } from "@/lib/repositories/products";
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
  method: "sku" | "alias" | "replacement" | "substitute" | "ai_suggestion" | "unmatched";
  confidence: number;
  ambiguous: boolean;
  candidates: ProductRecord[];
  reason: string;
};

type ProductMatchingServiceOptions = {
  productsRepository: ProductsRepository;
  client?: OpenAIResponsesClient;
  model?: string;
};

const normalize = (value: string) => value.trim().toLowerCase();

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

export const createProductMatchingService = ({ productsRepository, client = createOpenAIClient(), model = getOpenAIModel() }: ProductMatchingServiceOptions) => {
  const matchLine = async (line: ProductMatchLine): Promise<ProductMatch> => {
    const sku = line.sku?.trim() ?? "";
    const description = line.description?.trim() ?? "";
    const deterministicResolution = await createProductResolverService({ productsRepository }).resolve({ sku, alias: line.alias ?? sku, description });
    if (deterministicResolution.product) {
      return {
        lineNumber: line.lineNumber,
        product: deterministicResolution.product,
        method: deterministicResolution.method,
        confidence: deterministicResolution.confidence,
        ambiguous: false,
        candidates: [deterministicResolution.product],
        reason: deterministicResolution.reason,
      };
    }

    const query = sku || description;
    const candidates = query ? await productsRepository.search(query, 10) : [];
    if (candidates.length === 1) {
      const candidate = candidates[0];
      if (sku && normalize(candidate.sku) === normalize(sku)) {
        return { lineNumber: line.lineNumber, product: candidate, method: "sku", confidence: 1, ambiguous: false, candidates, reason: "Matched normalized SKU from search candidates before AI." };
      }
    }
    if (candidates.length === 0) return { lineNumber: line.lineNumber, product: null, method: "unmatched", confidence: 0, ambiguous: false, candidates, reason: "No deterministic product candidates found." };

    try {
      const response = await client.responses.create({
        model,
        input: [
          { role: "system", content: [{ type: "input_text", text: "Choose the best product id for the quote line only from provided candidates. Return JSON: {\"product_id\": string|null, \"confidence\": number, \"reason\": string}. Use null for ambiguous or weak matches." }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify({ line, candidates: candidates.map(({ id, sku, name, description }) => ({ id, sku, name, description })) }) }] },
        ],
      });
      const suggestion = JSON.parse(getResponseText(response)) as { product_id?: string | null; confidence?: number; reason?: string };
      const product = candidates.find((candidate) => candidate.id === suggestion.product_id) ?? null;
      const confidence = typeof suggestion.confidence === "number" ? Math.max(0, Math.min(1, suggestion.confidence)) : 0;
      if (!product || confidence < 0.75) return { lineNumber: line.lineNumber, product: null, method: "unmatched", confidence, ambiguous: true, candidates, reason: suggestion.reason ?? "AI suggestion was ambiguous." };
      return { lineNumber: line.lineNumber, product, method: "ai_suggestion", confidence, ambiguous: candidates.length > 1, candidates, reason: suggestion.reason ?? "AI selected among ambiguous candidates." };
    } catch (error) {
      return { lineNumber: line.lineNumber, product: null, method: "unmatched", confidence: 0, ambiguous: true, candidates, reason: error instanceof Error ? error.message : "AI product suggestion failed." };
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
