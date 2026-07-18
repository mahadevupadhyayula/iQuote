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
  customer_email: nullableString(),
  opportunity_name: nullableString(),
  currency_code: nullableString(),
  requested_valid_until: nullableString(),
  lines: [
    {
      line_number: 1,
      sku: nullableString(),
      description: sourceText.trim() ? { value: sourceText.trim(), missing: false, confidence: 0.5, source_span: { start: 0, end: sourceText.length, text: sourceText.trim() } } : nullableString(),
      quantity: nullableNumber(),
      requested_unit_price: nullableNumber(),
      needed_by: nullableString(),
      notes: nullableString(),
    },
  ],
  missing_fields: ["customer_name", "customer_email", "opportunity_name", "currency_code", "requested_valid_until", "lines[0].sku", "lines[0].quantity", "lines[0].requested_unit_price", "lines[0].needed_by", "lines[0].notes"],
  clarification_questions: [],
  source_spans: {},
  field_confidence: {},
});

const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["source_text", "customer_name", "customer_email", "opportunity_name", "currency_code", "requested_valid_until", "lines", "missing_fields", "clarification_questions", "source_spans", "field_confidence"],
  properties: {
    source_text: { type: "string" },
    customer_name: extractedStringJsonSchema(),
    customer_email: extractedStringJsonSchema(),
    opportunity_name: extractedStringJsonSchema(),
    currency_code: extractedStringJsonSchema(),
    requested_valid_until: extractedStringJsonSchema(),
    lines: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["line_number", "sku", "description", "quantity", "requested_unit_price", "needed_by", "notes"],
        properties: {
          line_number: { type: "integer", minimum: 1 },
          sku: extractedStringJsonSchema(),
          description: extractedStringJsonSchema(),
          quantity: extractedNumberJsonSchema(),
          requested_unit_price: extractedNumberJsonSchema(),
          needed_by: extractedStringJsonSchema(),
          notes: extractedStringJsonSchema(),
        },
      },
    },
    missing_fields: { type: "array", items: { type: "string" } },
    clarification_questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["field", "question"], properties: { field: { type: "string" }, question: { type: "string" } } } },
    source_spans: { type: "object", additionalProperties: sourceSpanJsonSchema() },
    field_confidence: { type: "object", additionalProperties: { type: "number", minimum: 0, maximum: 1 } },
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
                  text: "Extract only quote-request facts explicitly present in the source. Represent every missing value as null with missing=true. Do not invent SKU, price, inventory, margin, approval, or workflow-status claims. Include confidence scores and source spans only when supported by the source text; use confidence 0 and source_span null for missing fields. Return no fields outside the schema.",
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
