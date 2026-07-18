import { z } from "zod";

import { quoteStatuses } from "@/lib/domain/quote-statuses";
import { currencyCodeSchema, dateSchema, jsonObjectSchema, uuidSchema } from "./shared-records";

export const quoteActionTypes = ["create", "update", "submit_for_approval", "send", "accept", "reject", "cancel", "expire"] as const;

export const quoteLineActionSchema = z.object({
  product_id: uuidSchema.nullable(),
  sku: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  discount_bps: z.number().int().min(0).max(10000).default(0),
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

export type QuoteAction = z.infer<typeof quoteActionSchema>;
