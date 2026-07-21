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
  requested_discount: nullableNumber(),
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

const confidenceJsonSchema = { type: "number", minimum: 0, maximum: 1 } as const;

const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "source_text",
    "customer_name",
    "opportunity_name",
    "requested_items",
    "delivery_location",
    "delivery_date",
    "requested_discount",
    "installation_requirement",
    "special_requirements",
    "missing_fields",
    "ambiguities",
    "clarification_questions",
    "overall_confidence",
  ],
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
    delivery_date: extractedDateJsonSchema(),
    requested_discount: extractedRequestedDiscountJsonSchema(),
    installation_requirement: extractedInstallationRequirementJsonSchema(),
    special_requirements: extractedStringJsonSchema(),
    missing_fields: { type: "array", items: { type: "string", minLength: 1 }, default: [] },
    ambiguities: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "description"],
        properties: { field: { type: "string", minLength: 1 }, description: { type: "string", minLength: 1 } },
      },
      default: [],
    },
    clarification_questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "question"],
        properties: { field: { type: "string", minLength: 1 }, question: { type: "string", minLength: 1 } },
      },
      default: [],
    },
    overall_confidence: confidenceJsonSchema,
  },
} as const;

function sourceSpanJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["start", "end","text"],
    properties: { start: { type: "integer", minimum: 0 }, end: { type: "integer", minimum: 0 }, text: { type: "string", minLength: 1 } },
  } as const;
}

function extractedFieldJsonSchema(valueSchema: unknown) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["value", "missing", "confidence", "source_span"],
    properties: {
      value: valueSchema,
      missing: { type: "boolean" },
      confidence: confidenceJsonSchema,
      source_span: { anyOf: [sourceSpanJsonSchema(), { type: "null" }] },
    },
  } as const;
}

function extractedStringJsonSchema() {
  return extractedFieldJsonSchema({ anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] });
}

function extractedNumberJsonSchema() {
  return extractedFieldJsonSchema({ anyOf: [{ type: "number" }, { type: "null" }] });
}

function extractedRequestedDiscountJsonSchema() {
  return extractedFieldJsonSchema({ anyOf: [{ type: "number", minimum: 0, maximum: 100 }, { type: "null" }] });
}

function extractedInstallationRequirementJsonSchema() {
  return extractedFieldJsonSchema({ anyOf: [{ type: "string", enum: ["vendor_installation_requested", "customer_installed", "not_required"] }, { type: "null" }] });
}

function extractedDateJsonSchema() {
  return extractedFieldJsonSchema({ anyOf: [{ type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }, { type: "null" }] });
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

const parseExtraction = (responseText: string) => {
  console.log(
    "[quote-extraction] raw response:",
    responseText.slice(0, 5000),
  );

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(responseText);
  } catch (error) {
    console.error("[quote-extraction] JSON parsing failed:", {
      error,
      responseText: responseText.slice(0, 5000),
    });

    throw error;
  }

  const normalizedJson =
  parsedJson &&
  typeof parsedJson === "object" &&
  !Array.isArray(parsedJson)
    ? {
        ...parsedJson,
        field_confidence: {},
      }
    : parsedJson;

const validationResult =
  extractionOutputSchema.safeParse(normalizedJson);

  if (!validationResult.success) {
    console.error(
      "[quote-extraction] schema validation failed:",
      JSON.stringify(
        validationResult.error.issues,
        null,
        2,
      ),
    );

    throw validationResult.error;
  }

  return validationResult.data;
};
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
                  text: [
                    "Extract Phase 3 quote-request facts only when they are explicitly present in the supplied source text.",
                    "Use null with missing=true for every absent fact; never fill absent values with guesses or placeholders.",
                    "Do not invent SKUs. Capture requested_sku only when the source text supplies the SKU or part number.",
                    "Do not retrieve, infer, calculate, or assert price, inventory, approval status, quote totals, margin, workflow state, or any other commercial truth.",
                    "Return requested_discount as a numeric percentage without the percent symbol. For example, 8% must be returned as 8 and 12.5% as 12.5. Use 0 with missing=false only when the customer explicitly requests no discount; use null with missing=true when discount information is absent.",
                    "Return installation_requirement as exactly one of vendor_installation_requested, customer_installed, not_required, or null with missing=true.",
                    "Use vendor_installation_requested only when the customer explicitly requests vendor, supplier, manufacturer, commissioning, installation, or startup support.",
                    "Use customer_installed only when the request explicitly says the customer, client, internal team, in-house team, or buyer will handle installation.",
                    "Use not_required only when the request explicitly says installation, commissioning, or startup support is not required.",
                    "When installation is absent or ambiguous, return null with missing=true and create an ambiguity or clarification question where appropriate.",
                    "Mark uncertain information explicitly by lowering confidence and adding an ambiguity or clarification question when appropriate.",
                    "Include source spans only when directly supported by the source text; use confidence 0 and source_span null for missing fields.",
                    "Return only the supplied schema fields and no extra fields.",
                  ].join(" "),
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

console.log("[quote-extraction] response metadata:", {
  status: response.status,
  error: response.error,
  incompleteDetails: response.incomplete_details,
  outputTextLength:
    typeof response.output_text === "string"
      ? response.output_text.length
      : 0,
});

const responseText = getResponseText(response);

return parseExtraction(responseText);

      } catch (error) {
        console.error(
          "[quote-extraction] extraction failed:",
          error,
        );

        if (useFallbackOnError) {
          console.warn(
            "[quote-extraction] using deterministic fallback",
          );

          return extractionOutputSchema.parse(
            buildFallbackExtraction(sourceText),
          );
        }

        throw error;
      }
    },
  };
};
