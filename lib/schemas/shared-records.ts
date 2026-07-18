import { z } from "zod";

import { approvalStatuses } from "@/lib/domain/approvals";
import { discountPolicyTypes } from "@/lib/domain/pricing";
import { quoteStatuses } from "@/lib/domain/quote-statuses";
import { workflowEventTypes } from "@/lib/domain/workflow-events";

export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const timestampSchema = z.string().datetime({ offset: true });
export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);
export const jsonObjectSchema = z.record(z.string(), z.unknown());

export const customerRecordSchema = z.object({
  id: uuidSchema,
  external_id: z.string().nullable(),
  name: z.string().min(1),
  legal_name: z.string().nullable(),
  domain: z.string().nullable(),
  billing_email: z.string().email().nullable(),
  phone: z.string().nullable(),
  billing_address: jsonObjectSchema,
  shipping_address: jsonObjectSchema,
  metadata: jsonObjectSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});


export const opportunityRecordSchema = z.object({
  id: uuidSchema,
  customer_id: uuidSchema,
  external_id: z.string().nullable(),
  name: z.string().min(1),
  stage: z.enum(["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"]),
  expected_close_date: dateSchema.nullable(),
  owner_id: uuidSchema.nullable(),
  currency_code: currencyCodeSchema,
  estimated_amount: z.number().nonnegative(),
  metadata: jsonObjectSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const productRecordSchema = z.object({
  id: uuidSchema,
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  status: z.enum(["active", "inactive", "discontinued"]),
  unit_of_measure: z.string().min(1),
  metadata: jsonObjectSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const priceRecordSchema = z.object({
  id: uuidSchema,
  product_id: uuidSchema,
  currency_code: currencyCodeSchema,
  unit_price: z.number().nonnegative(),
  effective_from: dateSchema,
  effective_to: dateSchema.nullable(),
  price_type: z.enum(["list", "customer_tier", "customer_specific"]).default("list"),
  customer_tier: z.string().nullable().default(null),
  customer_id: uuidSchema.nullable().default(null),
  unit_cost: z.number().nonnegative().default(0),
  source_name: z.string().min(1).default("manual"),
  source_version: z.string().min(1).default("1"),
  created_at: timestampSchema,
});

export const inventoryRecordSchema = z.preprocess((value) => {
  if (value && typeof value === "object" && !("location_code" in value) && "warehouse_code" in value) {
    return { ...value, location_code: (value as { warehouse_code: unknown }).warehouse_code };
  }
  return value;
}, z.object({
  id: uuidSchema,
  product_id: uuidSchema,
  location_code: z.string().min(1),
  quantity_on_hand: z.number().nonnegative(),
  quantity_reserved: z.number().nonnegative(),
  reorder_point: z.number().nonnegative(),
  source_name: z.string().min(1).default("manual"),
  source_version: z.string().min(1).default("1"),
  refreshed_at: timestampSchema.optional(),
  updated_at: timestampSchema,
}));

export const discountPolicyRecordSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  policy_type: z.enum(discountPolicyTypes),
  discount_bps: z.number().int().min(0).max(10000),
  max_discount_bps: z.number().int().min(0).max(10000),
  amount_off: z.number().nonnegative(),
  conditions: jsonObjectSchema.default({}),
  minimum_margin_bps: z.number().int().min(0).max(10000).default(0),
  starts_on: dateSchema.nullable(),
  ends_on: dateSchema.nullable(),
  active: z.boolean(),
  metadata: jsonObjectSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const quoteRecordSchema = z.object({
  id: uuidSchema,
  opportunity_id: uuidSchema.nullable(),
  customer_id: uuidSchema,
  quote_number: z.string().min(1),
  status: z.enum(quoteStatuses),
  currency_code: currencyCodeSchema,
  subtotal_amount: z.number().nonnegative(),
  discount_amount: z.number().nonnegative(),
  tax_amount: z.number().nonnegative(),
  total_amount: z.number().nonnegative(),
  valid_until: dateSchema.nullable(),
  submitted_at: timestampSchema.nullable(),
  approved_at: timestampSchema.nullable(),
  sent_at: timestampSchema.nullable(),
  accepted_at: timestampSchema.nullable(),
  sla_due_at: timestampSchema.nullable().default(null),
  metadata: jsonObjectSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const quoteItemRecordSchema = z.object({
  id: uuidSchema,
  quote_id: uuidSchema,
  product_id: uuidSchema.nullable(),
  line_number: z.number().int().positive(),
  sku: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  discount_bps: z.number().int().min(0).max(10000),
  discount_amount: z.number().nonnegative(),
  line_total_amount: z.number().nonnegative(),
  metadata: jsonObjectSchema,
  created_at: timestampSchema,
});

export const approvalRecordSchema = z.object({
  id: uuidSchema,
  quote_id: uuidSchema,
  required_role: z.string().min(1),
  status: z.enum(approvalStatuses),
  requested_by: uuidSchema.nullable(),
  approver_id: uuidSchema.nullable(),
  requested_at: timestampSchema,
  decided_at: timestampSchema.nullable(),
  comments: z.string().nullable(),
  metadata: jsonObjectSchema,
});

export const workflowEventRecordSchema = z.object({
  id: uuidSchema,
  quote_id: uuidSchema,
  event_type: z.enum(workflowEventTypes),
  actor_id: uuidSchema.nullable(),
  from_status: z.enum(quoteStatuses).nullable(),
  to_status: z.enum(quoteStatuses).nullable(),
  payload: jsonObjectSchema,
  created_at: timestampSchema,
});

export type QuoteRecord = z.infer<typeof quoteRecordSchema>;
export type QuoteItemRecord = z.infer<typeof quoteItemRecordSchema>;
export type ApprovalRecord = z.infer<typeof approvalRecordSchema>;
export type WorkflowEventRecord = z.infer<typeof workflowEventRecordSchema>;
export type CustomerRecord = z.infer<typeof customerRecordSchema>;
export type ProductRecord = z.infer<typeof productRecordSchema>;
export type OpportunityRecord = z.infer<typeof opportunityRecordSchema>;
export type PriceRecord = z.infer<typeof priceRecordSchema>;
export type InventoryRecordRow = z.infer<typeof inventoryRecordSchema>;
export type DiscountPolicyRecord = z.infer<typeof discountPolicyRecordSchema>;
