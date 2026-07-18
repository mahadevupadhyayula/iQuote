import { z } from "zod";

import { currencyCodeSchema, dateSchema } from "./shared-records";

const extractedStringSchema = z.object({
  value: z.string().min(1).nullable(),
  missing: z.boolean(),
});

const extractedNumberSchema = z.object({
  value: z.number().nullable(),
  missing: z.boolean(),
});

export const extractedQuoteLineSchema = z.object({
  line_number: z.number().int().positive(),
  sku: extractedStringSchema,
  description: extractedStringSchema,
  quantity: extractedNumberSchema,
  requested_unit_price: extractedNumberSchema,
  needed_by: z.object({ value: dateSchema.nullable(), missing: z.boolean() }),
  notes: extractedStringSchema,
});

export const extractionOutputSchema = z.object({
  source_text: z.string(),
  customer_name: extractedStringSchema,
  customer_email: z.object({ value: z.string().email().nullable(), missing: z.boolean() }),
  opportunity_name: extractedStringSchema,
  currency_code: z.object({ value: currencyCodeSchema.nullable(), missing: z.boolean() }),
  requested_valid_until: z.object({ value: dateSchema.nullable(), missing: z.boolean() }),
  lines: z.array(extractedQuoteLineSchema).min(1),
  missing_fields: z.array(z.string()).default([]),
});

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
