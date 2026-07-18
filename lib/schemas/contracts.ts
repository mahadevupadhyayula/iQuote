import { z } from "zod";

import { approvalStatuses } from "@/lib/domain/approvals";
import { quoteStatuses, quoteStatusTransitions } from "@/lib/domain/quote-statuses";
import { workflowEventTypes } from "@/lib/domain/workflow-events";
import { approvalRequirementTypes } from "@/lib/rules/approval-rules";
import { quoteIntakeSchema } from "./quote-intake";
import {
  currencyCodeSchema,
  dateSchema,
  jsonObjectSchema,
  productRecordSchema,
  timestampSchema,
  uuidSchema,
} from "./shared-records";

export const quoteRequestSchema = quoteIntakeSchema;

export const productSchema = productRecordSchema;

export const pricingProvenanceSchema = z.object({
  price_id: z.string().min(1),
  sourceName: z.string().min(1),
  sourceVersion: z.string().min(1),
  priceType: z.enum(["customer_specific", "customer_tier", "quantity_volume", "list", "blocking_exception"]),
  effectiveFrom: dateSchema.nullable(),
  effectiveTo: dateSchema.nullable(),
  precedenceRank: z.number().int().positive(),
});

export const priceResultSchema = z.object({
  unitPrice: z.number().nonnegative().nullable(),
  currencyCode: currencyCodeSchema,
  blocked: z.boolean(),
  reason: z.string().nullable(),
  provenance: pricingProvenanceSchema,
});

export const inventoryRuleRecordSchema = z.object({
  productId: uuidSchema,
  locationCode: z.string().min(1),
  quantityOnHand: z.number().nonnegative(),
  quantityReserved: z.number().nonnegative(),
  reorderPoint: z.number().nonnegative(),
  updatedAt: timestampSchema,
});

export const fulfillmentSourceSchema = z.object({
  productId: uuidSchema,
  locationCode: z.string().min(1),
  quantity: z.number().nonnegative(),
  availableQuantity: z.number().nonnegative(),
});

export const replacementProposalSchema = z.object({
  productId: uuidSchema,
  sku: z.string().min(1),
  name: z.string().min(1),
  reason: z.string().min(1),
  fulfillment: z.array(fulfillmentSourceSchema),
});

export const laterDeliveryOptionSchema = z.object({
  productId: uuidSchema,
  earliestShipDate: dateSchema,
  quantity: z.number().positive(),
  reason: z.string().min(1),
});

export const inventoryDecisionStatusSchema = z.enum([
  "single_warehouse",
  "split_fulfillment",
  "insufficient_single_warehouse",
  "replacement_proposed",
  "stale_inventory",
  "backordered",
]);

export const inventoryResultSchema = z.object({
  status: inventoryDecisionStatusSchema,
  blocked: z.boolean(),
  productId: uuidSchema,
  requestedQuantity: z.number().positive(),
  availableQuantity: z.number().nonnegative(),
  staleRecords: z.array(inventoryRuleRecordSchema),
  fulfillment: z.array(fulfillmentSourceSchema),
  replacementProposal: replacementProposalSchema.nullable(),
  laterDeliveryOptions: z.array(laterDeliveryOptionSchema),
  reason: z.string().nullable(),
});

export const approvalThresholdsSchema = z.object({
  straightThroughDiscountBps: z.number().int().min(0).max(10000),
  productManagerDiscountBps: z.number().int().min(0).max(10000),
  salesDirectorDiscountBps: z.number().int().min(0).max(10000),
  straightThroughMarginBps: z.number().int().min(0).max(10000),
  productManagerMarginBps: z.number().int().min(0).max(10000),
  salesDirectorMarginBps: z.number().int().min(0).max(10000),
});

export const discountDecisionSchema = z.object({
  requirement: z.enum(approvalRequirementTypes),
  requiredRole: z.enum(["product_manager", "sales_director", "finance"]).nullable(),
  blocked: z.boolean(),
  reason: z.string().nullable(),
  thresholds: approvalThresholdsSchema,
});

export const approvalSchema = z.object({
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

export const quoteReadinessBlockerSchema = z.object({
  code: z.enum([
    "missing_required_information",
    "invalid_product",
    "missing_price",
    "stale_price",
    "pricing_exception",
    "unresolved_inventory",
    "stale_inventory",
    "margin_policy_failed",
    "approval_pending",
    "approval_rejected",
    "payment_terms_missing",
    "blocking_exception",
  ]),
  message: z.string().min(1),
  productId: uuidSchema.optional(),
  field: z.string().min(1).optional(),
});

export const quoteReadinessSchema = z.object({
  ready: z.boolean(),
  status: z.enum(["ready", "blocked"]),
  blockers: z.array(quoteReadinessBlockerSchema),
});

export const workflowEventSchema = z.object({
  id: uuidSchema,
  quoteId: uuidSchema,
  eventType: z.enum(workflowEventTypes),
  actorId: uuidSchema.nullable(),
  fromStatus: z.enum(quoteStatuses).nullable(),
  toStatus: z.enum(quoteStatuses).nullable(),
  payload: jsonObjectSchema,
  createdAt: timestampSchema,
});

export const quoteStatusUnionSchema = z.enum(quoteStatuses);

export const allowedTransitionTableSchema = z.object(
  Object.fromEntries(
    quoteStatuses.map((status) => [status, z.array(quoteStatusUnionSchema)]),
  ) as Record<(typeof quoteStatuses)[number], z.ZodArray<typeof quoteStatusUnionSchema>>,
).superRefine((table, context) => {
  for (const status of quoteStatuses) {
    const allowed = table[status];
    const expected = quoteStatusTransitions[status];
    const hasSameTransitions = allowed.length === expected.length && allowed.every((transition, index) => transition === expected[index]);

    if (!hasSameTransitions) {
      context.addIssue({
        code: "custom",
        path: [status],
        message: `Allowed transitions for ${status} must match the domain transition table.`,
      });
    }
  }
});

export const allowedTransitionTable = quoteStatusTransitions;

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
export type Product = z.infer<typeof productSchema>;
export type PriceResult = z.infer<typeof priceResultSchema>;
export type InventoryResult = z.infer<typeof inventoryResultSchema>;
export type DiscountDecision = z.infer<typeof discountDecisionSchema>;
export type Approval = z.infer<typeof approvalSchema>;
export type QuoteReadiness = z.infer<typeof quoteReadinessSchema>;
export type WorkflowEventContract = z.infer<typeof workflowEventSchema>;
export type QuoteStatusUnion = z.infer<typeof quoteStatusUnionSchema>;
export type AllowedTransitionTable = z.infer<typeof allowedTransitionTableSchema>;
