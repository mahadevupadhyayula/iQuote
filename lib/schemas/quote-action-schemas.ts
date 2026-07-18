import { z } from "zod";

import { quoteStatuses } from "@/lib/domain/quote-statuses";
import { currencyCodeSchema, dateSchema, jsonObjectSchema, uuidSchema } from "./shared-records";

const optionalUuidSchema = uuidSchema.optional().nullable();
const actionLineSchema = z.object({
  product_id: uuidSchema.optional().nullable(),
  sku: z.string().trim().min(1),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().nonnegative().optional(),
  discount_bps: z.coerce.number().int().min(0).max(10000).default(0),
  metadata: jsonObjectSchema.default({}),
});


export const quoteActionTypes = ["create", "update", "submit_for_approval", "send", "accept", "reject", "cancel", "expire"] as const;

export const quoteLineActionSchema = actionLineSchema.extend({
  product_id: uuidSchema.nullable(),
  unit_price: z.coerce.number().nonnegative(),
});

export const quoteActionSchema = z.object({
  action: z.enum(quoteActionTypes),
  quote_id: uuidSchema.nullable(),
  customer_id: uuidSchema.nullable(),
  opportunity_id: uuidSchema.nullable(),
  actor_id: uuidSchema.nullable(),
  target_status: z.enum(quoteStatuses).nullable(),
  currency_code: currencyCodeSchema.default("USD"),
  valid_until: dateSchema.nullable(),
  lines: z.array(quoteLineActionSchema).default([]),
  metadata: jsonObjectSchema.default({}),
});

export const createQuoteDraftActionSchema = z.object({
  customer_id: uuidSchema,
  opportunity_id: optionalUuidSchema,
  actor_id: optionalUuidSchema,
  currency_code: currencyCodeSchema.default("USD"),
  valid_until: dateSchema.optional().nullable(),
  metadata: jsonObjectSchema.default({}),
});

export const extractAndBuildQuoteActionSchema = z.object({
  quote_id: uuidSchema,
  source_text: z.string().trim().min(1),
  actor_id: optionalUuidSchema,
  idempotency_key: z.string().trim().min(1).optional(),
});

export const applyRepCorrectionsActionSchema = z.object({
  quote_id: uuidSchema,
  actor_id: optionalUuidSchema,
  customer_id: optionalUuidSchema,
  opportunity_id: optionalUuidSchema,
  currency_code: currencyCodeSchema.optional(),
  valid_until: dateSchema.optional().nullable(),
  lines: z.array(actionLineSchema).min(1).optional(),
  metadata: jsonObjectSchema.default({}),
});

export const selectFulfillmentActionSchema = z.object({
  quote_id: uuidSchema,
  actor_id: optionalUuidSchema,
  line_number: z.coerce.number().int().positive(),
  fulfillment: z.array(z.object({
    productId: uuidSchema,
    locationCode: z.string().trim().min(1),
    quantity: z.coerce.number().positive(),
    availableQuantity: z.coerce.number().nonnegative(),
  })).min(1),
});

export const submitQuoteForApprovalActionSchema = z.object({
  quote_id: uuidSchema,
  actor_id: optionalUuidSchema,
  idempotency_key: z.string().trim().min(1).optional(),
});

export const generateQuoteActionSchema = z.object({
  quote_id: uuidSchema,
  actor_id: optionalUuidSchema,
  payment_terms: z.object({ termsCode: z.string().trim().min(1), accepted: z.boolean() }).optional(),
  idempotency_key: z.string().trim().min(1).optional(),
});

export const sendQuoteActionSchema = z.object({
  quote_id: uuidSchema,
  actor_id: optionalUuidSchema,
  recipient_email: z.string().email(),
  message: z.string().trim().optional(),
  idempotency_key: z.string().trim().min(1).optional(),
});

export const saveQuoteDraftActionSchema = z.object({
  quote_id: uuidSchema,
  actor_id: optionalUuidSchema,
  currency_code: currencyCodeSchema.optional(),
  valid_until: dateSchema.optional().nullable(),
  lines: z.array(actionLineSchema).optional(),
  metadata: jsonObjectSchema.default({}),
});

export type CreateQuoteDraftActionInput = z.infer<typeof createQuoteDraftActionSchema>;
export type ExtractAndBuildQuoteActionInput = z.infer<typeof extractAndBuildQuoteActionSchema>;
export type ApplyRepCorrectionsActionInput = z.infer<typeof applyRepCorrectionsActionSchema>;
export type SelectFulfillmentActionInput = z.infer<typeof selectFulfillmentActionSchema>;
export type SubmitQuoteForApprovalActionInput = z.infer<typeof submitQuoteForApprovalActionSchema>;
export type GenerateQuoteActionInput = z.infer<typeof generateQuoteActionSchema>;
export type SendQuoteActionInput = z.infer<typeof sendQuoteActionSchema>;
export type SaveQuoteDraftActionInput = z.infer<typeof saveQuoteDraftActionSchema>;

export type QuoteAction = z.infer<typeof quoteActionSchema>;
