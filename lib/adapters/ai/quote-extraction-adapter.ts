import { extractionOutputSchema, type ExtractionOutput } from "@/lib/schemas/extraction-schema";

import { createOpenAIClient, getOpenAIModel, type OpenAIResponsesClient } from "./openai-client";

export type QuoteExtractionAdapter = {
  extractQuoteRequest(sourceText: string): Promise<ExtractionOutput>;
};

type QuoteExtractionAdapterOptions = {
  client?: OpenAIResponsesClient;
  model?: string;
  useFallbackOnError?: boolean;
};

const nullableString = () => ({ value: null, missing: true, confidence: 0, source_span: null });
const nullableNumber = () => ({ value: null, missing: true, confidence: 0, source_span: null });

const buildFallbackExtraction = (sourceText: string): ExtractionOutput => ({
  source_text: sourceText,
  customer_name: nullableString(),
  opportunity_name: nullableString(),
  requested_items: [
    {
      line_number: 1,
      raw_item_description: sourceText.trim() ? { value: sourceText.trim(), missing: false, confidence: 0.5, source_span: { start: 0, end: sourceText.length, text: sourceText.trim() } } : nullableString(),
      requested_sku: nullableString(),
      quantity: nullableNumber(),
      specifications: nullableString(),
    },
  ],
  delivery_location: nullableString(),
  delivery_date: nullableString(),
  requested_discount: nullableString(),
  installation_requirement: nullableString(),
  special_requirements: nullableString(),
  missing_fields: [
    "customer_name",
    "opportunity_name",
    "requested_items[0].requested_sku",
    "requested_items[0].quantity",
    "requested_items[0].specifications",
    "delivery_location",
    "delivery_date",
    "requested_discount",
    "installation_requirement",
    "special_requirements",
  ],
  ambiguities: [],
  clarification_questions: [],
  field_confidence: {},
  overall_confidence: 0,
});

const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["source_text", "customer_name", "opportunity_name", "requested_items", "delivery_location", "delivery_date", "requested_discount", "installation_requirement", "special_requirements", "missing_fields", "ambiguities", "clarification_questions", "field_confidence", "overall_confidence"],
  properties: {
    source_text: { type: "string" },
    customer_name: extractedStringJsonSchema(),
    opportunity_name: extractedStringJsonSchema(),
    requested_items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["line_number", "raw_item_description", "requested_sku", "quantity", "specifications"],
        properties: {
          line_number: { type: "integer", minimum: 1 },
          raw_item_description: extractedStringJsonSchema(),
          requested_sku: extractedStringJsonSchema(),
          quantity: extractedNumberJsonSchema(),
          specifications: extractedStringJsonSchema(),
        },
      },
    },
    delivery_location: extractedStringJsonSchema(),
    delivery_date: extractedStringJsonSchema(),
    requested_discount: extractedStringJsonSchema(),
    installation_requirement: extractedStringJsonSchema(),
    special_requirements: extractedStringJsonSchema(),
    missing_fields: { type: "array", items: { type: "string" } },
    ambiguities: { type: "array", items: { type: "object", additionalProperties: false, required: ["field", "description"], properties: { field: { type: "string" }, description: { type: "string" } } } },
    clarification_questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["field", "question"], properties: { field: { type: "string" }, question: { type: "string" } } } },
    field_confidence: { type: "object", additionalProperties: { type: "number", minimum: 0, maximum: 1 } },
    overall_confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

function sourceSpanJsonSchema() {
  return { type: "object", additionalProperties: false, required: ["start", "end", "text"], properties: { start: { type: "integer", minimum: 0 }, end: { type: "integer", minimum: 0 }, text: { type: "string" } } } as const;
}

function extractedStringJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "missing", "confidence", "source_span"],
    properties: {
      value: { type: ["string", "null"] },
      missing: { type: "boolean" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      source_span: { anyOf: [sourceSpanJsonSchema(), { type: "null" }] },
    },
  } as const;
}

function extractedNumberJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "missing", "confidence", "source_span"],
    properties: {
      value: { type: ["number", "null"] },
      missing: { type: "boolean" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      source_span: { anyOf: [sourceSpanJsonSchema(), { type: "null" }] },
    },
  } as const;
}

const getResponseText = (response: { output_text?: string; output?: unknown }) => {
  if (typeof response.output_text === "string") return response.output_text;

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "text" in content && typeof content.text === "string") return content.text;
    }
  }

  throw new Error("OpenAI response did not include structured output text.");
};

const parseExtraction = (responseText: string) => extractionOutputSchema.parse(JSON.parse(responseText));

export const createQuoteExtractionAdapter = (options: QuoteExtractionAdapterOptions = {}): QuoteExtractionAdapter => {
  const client = options.client ?? createOpenAIClient();
  const model = options.model ?? getOpenAIModel();
  const useFallbackOnError = options.useFallbackOnError ?? false;

  return {
    async extractQuoteRequest(sourceText: string) {
      try {
        const response = await client.responses.create({
          model,
          input: [
            {
              role: "system",
              content: [
                {
                  type: "input_text",
                  text: "Extract only Phase 3 quote-request facts explicitly present in the source. Represent every missing value as null with missing=true. Populate requested_items with raw_item_description, requested_sku, quantity, and specifications only from source evidence. Do not invent SKU, discounts, pricing, inventory, margin, approval, quote totals, or workflow-status claims. Include confidence scores from 0 to 1 and source spans only when supported by the source text; use confidence 0 and source_span null for missing fields. Return no fields outside the schema.",
                },
              ],
            },
            {
              role: "user",
              content: [{ type: "input_text", text: sourceText }],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "quote_extraction",
              strict: true,
              schema: extractionJsonSchema,
            },
          },
        });

        return parseExtraction(getResponseText(response));
      } catch (error) {
        if (useFallbackOnError) return extractionOutputSchema.parse(buildFallbackExtraction(sourceText));
        throw error;
      }
    },
  };
};
