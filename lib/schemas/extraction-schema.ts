import { z } from "zod";

import { dateSchema } from "./shared-records";

const sourceSpanSchema = z.object({ start: z.number().int().nonnegative(), end: z.number().int().nonnegative(), text: z.string().min(1).optional() }).strict();

const confidenceSchema = z.number().min(0).max(1);

const extractedFieldSchema = <T extends z.ZodTypeAny>(valueSchema: T, label: string) =>
  z
    .object({
      value: valueSchema.nullable(),
      missing: z.boolean(),
      confidence: confidenceSchema,
      source_span: sourceSpanSchema.nullable(),
    })
    .strict()
    .superRefine((field, context) => {
      if (field.missing && field.value !== null) {
        context.addIssue({ code: "custom", message: `Missing ${label} fields must use null values.` });
      }
    });

export const extractedStringFieldSchema = extractedFieldSchema(z.string().min(1), "string");
export const extractedNumberFieldSchema = extractedFieldSchema(z.number(), "number");
export const extractedDateFieldSchema = extractedFieldSchema(dateSchema, "date");

export const extractedRequestedItemSchema = z
  .object({
    line_number: z.number().int().positive(),
    raw_item_description: extractedStringFieldSchema,
    requested_sku: extractedStringFieldSchema,
    quantity: extractedNumberFieldSchema,
    specifications: extractedStringFieldSchema,
  })
  .strict();

const clarificationQuestionSchema = z.object({ field: z.string().min(1), question: z.string().min(1) }).strict();
const ambiguitySchema = z.object({ field: z.string().min(1), description: z.string().min(1) }).strict();

type ExtractedField = { value: unknown; missing: boolean };

const getFieldAtPath = (output: { requested_items: unknown[] } & Record<string, unknown>, path: string): ExtractedField | null => {
  const itemMatch = /^requested_items\[(\d+)\]\.(.+)$/.exec(path);
  if (itemMatch) {
    const item = output.requested_items[Number(itemMatch[1])];
    if (!item || typeof item !== "object") return null;
    const value = (item as Record<string, unknown>)[itemMatch[2]];
    return value && typeof value === "object" && "value" in value && "missing" in value ? (value as ExtractedField) : null;
  }

  const value = output[path];
  return value && typeof value === "object" && "value" in value && "missing" in value ? (value as ExtractedField) : null;
};

export const extractionOutputSchema = z
  .object({
    source_text: z.string(),
    customer_name: extractedStringFieldSchema,
    opportunity_name: extractedStringFieldSchema,
    requested_items: z.array(extractedRequestedItemSchema).min(1),
    delivery_location: extractedStringFieldSchema,
    delivery_date: extractedDateFieldSchema,
    requested_discount: extractedStringFieldSchema,
    installation_requirement: extractedStringFieldSchema,
    special_requirements: extractedStringFieldSchema,
    missing_fields: z.array(z.string().min(1)).default([]),
    ambiguities: z.array(ambiguitySchema).default([]),
    clarification_questions: z.array(clarificationQuestionSchema).default([]),
    field_confidence: z.record(z.string(), confidenceSchema).default({}),
    overall_confidence: confidenceSchema,
  })
  .strict()
  .superRefine((output, context) => {
    output.missing_fields.forEach((path, index) => {
      const field = getFieldAtPath(output, path);
      if (!field) return;
      if (!field.missing || field.value !== null) {
        context.addIssue({
          code: "custom",
          path: ["missing_fields", index],
          message: `Field ${path} is listed as missing and must be marked missing with a null value.`,
        });
      }
    });
  });

export type ExtractedSourceSpan = z.infer<typeof sourceSpanSchema>;
export type ExtractedStringField = z.infer<typeof extractedStringFieldSchema>;
export type ExtractedNumberField = z.infer<typeof extractedNumberFieldSchema>;
export type ExtractedDateField = z.infer<typeof extractedDateFieldSchema>;
export type ExtractedRequestedItem = z.infer<typeof extractedRequestedItemSchema>;
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
export type QuoteExtractionAdapterOutput = ExtractionOutput;
export type QuoteExtractionServiceOutput = ExtractionOutput;
export type QuoteExtractionRepositoryPayload = ExtractionOutput;
export type QuoteExtractionViewModel = ExtractionOutput;
