import { z } from "zod";

import { currencyCodeSchema, dateSchema } from "./shared-records";

const extractedStringSchema = z
  .object({
    value: z.string().min(1).nullable(),
    missing: z.boolean(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.missing && field.value !== null) {
      context.addIssue({ code: "custom", message: "Missing string fields must use null values." });
    }
  });

const extractedNumberSchema = z
  .object({
    value: z.number().nullable(),
    missing: z.boolean(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.missing && field.value !== null) {
      context.addIssue({ code: "custom", message: "Missing number fields must use null values." });
    }
  });

const extractedDateSchema = z
  .object({
    value: dateSchema.nullable(),
    missing: z.boolean(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.missing && field.value !== null) {
      context.addIssue({ code: "custom", message: "Missing date fields must use null values." });
    }
  });

const extractedCurrencySchema = z
  .object({
    value: currencyCodeSchema.nullable(),
    missing: z.boolean(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.missing && field.value !== null) {
      context.addIssue({ code: "custom", message: "Missing currency fields must use null values." });
    }
  });

const extractedEmailSchema = z
  .object({
    value: z.string().email().nullable(),
    missing: z.boolean(),
  })
  .strict()
  .superRefine((field, context) => {
    if (field.missing && field.value !== null) {
      context.addIssue({ code: "custom", message: "Missing email fields must use null values." });
    }
  });

export const extractedQuoteLineSchema = z
  .object({
    line_number: z.number().int().positive(),
    sku: extractedStringSchema,
    description: extractedStringSchema,
    quantity: extractedNumberSchema,
    requested_unit_price: extractedNumberSchema,
    needed_by: extractedDateSchema,
    notes: extractedStringSchema,
  })
  .strict();

export const extractionOutputSchema = z
  .object({
    source_text: z.string(),
    customer_name: extractedStringSchema,
    customer_email: extractedEmailSchema,
    opportunity_name: extractedStringSchema,
    currency_code: extractedCurrencySchema,
    requested_valid_until: extractedDateSchema,
    lines: z.array(extractedQuoteLineSchema).min(1),
    missing_fields: z.array(z.string()).default([]),
  })
  .strict();

export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
