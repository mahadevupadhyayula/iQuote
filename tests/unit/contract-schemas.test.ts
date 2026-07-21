import { describe, expect, it } from "vitest";

import {
  allowedTransitionTable,
  allowedTransitionTableSchema,
  approvalSchema,
  discountDecisionSchema,
  extractionOutputSchema,
  inventoryResultSchema,
  priceResultSchema,
  productSchema,
  quoteReadinessSchema,
  quoteRequestSchema,
  quoteStatusUnionSchema,
  workflowEventSchema,
} from "@/lib/schemas";
import { normalizeLegacyReviewValue, percentToBps } from "@/lib/rules/review-field-registry";

const uuid = "11111111-1111-4111-8111-111111111111";
const quoteUuid = "22222222-2222-4222-8222-222222222222";
const timestamp = "2026-07-18T12:00:00.000Z";

const expectValid = (schema: { safeParse: (payload: unknown) => { success: boolean } }, payload: unknown) => {
  expect(schema.safeParse(payload).success).toBe(true);
};

const expectInvalid = (schema: { safeParse: (payload: unknown) => { success: boolean } }, payload: unknown) => {
  expect(schema.safeParse(payload).success).toBe(false);
};

describe("contract schemas", () => {
  it("validates quote requests", () => {
    const valid = {
      customerName: "Ada Lovelace",
      customerEmail: "ada@example.com",
      currencyCode: "USD",
      requestText: "Please quote ten active products for delivery next month.",
    };

    expectValid(quoteRequestSchema, valid);
    expectInvalid(quoteRequestSchema, { ...valid, customerEmail: "not-an-email" });
  });

  it("validates products", () => {
    const valid = {
      id: uuid,
      sku: "SKU-001",
      name: "Industrial Sensor",
      description: null,
      status: "active",
      unit_of_measure: "each",
      metadata: {},
      created_at: timestamp,
      updated_at: timestamp,
    };

    expectValid(productSchema, valid);
    expectInvalid(productSchema, { ...valid, status: "draft" });
  });

  it("validates price results", () => {
    const valid = {
      unitPrice: 125,
      currencyCode: "USD",
      blocked: false,
      reason: null,
      provenance: {
        price_id: "price-list-2026",
        sourceName: "list_price",
        sourceVersion: "2026.07",
        priceType: "list",
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        precedenceRank: 4,
      },
    };

    expectValid(priceResultSchema, valid);
    expectInvalid(priceResultSchema, { ...valid, currencyCode: "usd" });
  });

  it("validates inventory results", () => {
    const valid = {
      status: "single_warehouse",
      blocked: false,
      productId: uuid,
      requestedQuantity: 3,
      availableQuantity: 10,
      staleRecords: [],
      fulfillment: [{ productId: uuid, locationCode: "EAST", quantity: 3, availableQuantity: 10 }],
      replacementProposal: null,
      laterDeliveryOptions: [{ productId: uuid, earliestShipDate: "2026-07-25", quantity: 3, reason: "Replenishment." }],
      reason: null,
    };

    expectValid(inventoryResultSchema, valid);
    expectInvalid(inventoryResultSchema, { ...valid, requestedQuantity: 0 });
  });

  it("validates discount decisions", () => {
    const valid = {
      requirement: "product_manager",
      requiredRole: "product_manager",
      blocked: false,
      reason: null,
      thresholds: {
        straightThroughDiscountBps: 500,
        productManagerDiscountBps: 1000,
        salesDirectorDiscountBps: 2000,
        straightThroughMarginBps: 3000,
        productManagerMarginBps: 2500,
        salesDirectorMarginBps: 2000,
      },
    };

    expectValid(discountDecisionSchema, valid);
    expectInvalid(discountDecisionSchema, { ...valid, requiredRole: "sales_ops" });
  });

  it("validates approvals", () => {
    const valid = {
      id: uuid,
      quote_id: quoteUuid,
      required_role: "sales_director",
      status: "pending",
      requested_by: null,
      approver_id: null,
      requested_at: timestamp,
      decided_at: null,
      comments: null,
      metadata: {},
    };

    expectValid(approvalSchema, valid);
    expectInvalid(approvalSchema, { ...valid, status: "approved_by_ai" });
  });

  it("validates quote readiness", () => {
    const valid = { ready: true, status: "ready", blockers: [] };

    expectValid(quoteReadinessSchema, valid);
    expectInvalid(quoteReadinessSchema, { ...valid, status: "draft" });
  });

  it("validates workflow events", () => {
    const valid = {
      id: uuid,
      quoteId: quoteUuid,
      eventType: "sent",
      actorId: null,
      fromStatus: "approved",
      toStatus: "sent",
      payload: {},
      createdAt: timestamp,
    };

    expectValid(workflowEventSchema, valid);
    expectInvalid(workflowEventSchema, { ...valid, eventType: "autonomous_agent_started" });
  });

  it("validates Phase 3 extraction outputs and rejects missing-field inventions", () => {
    const nullString = { value: null, missing: true, confidence: 0, source_span: null };
    const valid = {
      source_text: "Acme needs 2 HX-500 scanners in Denver by 2026-08-01.",
      customer_name: { value: "Acme", missing: false, confidence: 0.9, source_span: null },
      opportunity_name: nullString,
      requested_items: [
        {
          line_number: 1,
          raw_item_description: { value: "2 HX-500 scanners", missing: false, confidence: 0.8, source_span: null },
          requested_sku: { value: "HX-500", missing: false, confidence: 0.95, source_span: null },
          quantity: { value: 2, missing: false, confidence: 0.95, source_span: null },
          specifications: nullString,
        },
      ],
      delivery_location: { value: "Denver", missing: false, confidence: 0.8, source_span: null },
      delivery_date: { value: "2026-08-01", missing: false, confidence: 0.9, source_span: null },
      requested_discount: { value: 8, missing: false, confidence: 0.95, source_span: null },
      installation_requirement: { value: "vendor_installation_requested", missing: false, confidence: 0.9, source_span: null },
      special_requirements: nullString,
      missing_fields: ["opportunity_name", "requested_items[0].specifications", "special_requirements"],
      ambiguities: [],
      clarification_questions: [{ field: "requested_discount", question: "Please provide any requested discount." }],
      field_confidence: { customer_name: 0.9, "requested_items[0].quantity": 0.95 },
      overall_confidence: 0.86,
    };

    expectValid(extractionOutputSchema, valid);
    expectInvalid(extractionOutputSchema, { ...valid, overall_confidence: 1.01 });
    expectInvalid(extractionOutputSchema, { ...valid, field_confidence: { customer_name: -0.1 } });
    expectInvalid(extractionOutputSchema, { ...valid, opportunity_name: { value: "Invented opportunity", missing: true, confidence: 0.4, source_span: null } });
    expectInvalid(extractionOutputSchema, { ...valid, requested_discount: { value: "8%", missing: false, confidence: 0.95, source_span: null } });
    expectInvalid(extractionOutputSchema, { ...valid, requested_discount: { value: 120, missing: false, confidence: 0.95, source_span: null } });
    expectInvalid(extractionOutputSchema, { ...valid, installation_requirement: { value: "installation required", missing: false, confidence: 0.9, source_span: null } });
    expectInvalid(extractionOutputSchema, { ...valid, installation_requirement: { value: "vendor_install", missing: false, confidence: 0.9, source_span: null } });
  });

  it("preserves discount and installation missing semantics", () => {
    const nullString = { value: null, missing: true, confidence: 0, source_span: null };
    const base = {
      source_text: "Need 1 HX-500.",
      customer_name: nullString,
      opportunity_name: nullString,
      requested_items: [{ line_number: 1, raw_item_description: { value: "1 HX-500", missing: false, confidence: 0.8, source_span: null }, requested_sku: { value: "HX-500", missing: false, confidence: 0.8, source_span: null }, quantity: { value: 1, missing: false, confidence: 0.8, source_span: null }, specifications: nullString }],
      delivery_location: nullString,
      delivery_date: nullString,
      special_requirements: nullString,
      missing_fields: [],
      ambiguities: [],
      clarification_questions: [],
      field_confidence: {},
      overall_confidence: 0.8,
    };
    expectValid(extractionOutputSchema, { ...base, requested_discount: { value: 0, missing: false, confidence: 0.9, source_span: null }, installation_requirement: nullString, missing_fields: ["installation_requirement"] });
    expectValid(extractionOutputSchema, { ...base, requested_discount: { value: null, missing: true, confidence: 0, source_span: null }, installation_requirement: nullString, missing_fields: ["requested_discount", "installation_requirement"] });
    expectValid(extractionOutputSchema, { ...base, requested_discount: { value: null, missing: true, confidence: 0, source_span: null }, installation_requirement: { value: "not_required", missing: false, confidence: 0.9, source_span: null }, missing_fields: ["requested_discount"] });
    expectValid(extractionOutputSchema, { ...base, requested_discount: { value: null, missing: true, confidence: 0, source_span: null }, installation_requirement: { value: null, missing: true, confidence: 0.2, source_span: null }, missing_fields: ["requested_discount", "installation_requirement"], ambiguities: [{ field: "installation_requirement", description: "Installation ownership is ambiguous." }] });
  });

  it("normalizes legacy review values and converts reviewed percentages to basis points", () => {
    expect(normalizeLegacyReviewValue("requested_discount", "8%")).toBe(8);
    expect(normalizeLegacyReviewValue("requested_discount", "12.5 percent")).toBe(12.5);
    expect(percentToBps(8)).toBe(800);
    expect(percentToBps(12.5)).toBe(1250);
    expect(normalizeLegacyReviewValue("installation_requirement", "Installation required")).toBe("vendor_installation_requested");
    expect(normalizeLegacyReviewValue("installation_requirement", "vendor_install")).toBe("vendor_installation_requested");
  });

  it("validates quote status union values", () => {
    expectValid(quoteStatusUnionSchema, "pending_approval");
    expectInvalid(quoteStatusUnionSchema, "pending_ai_review");
  });

  it("validates the allowed transition table", () => {
    expectValid(allowedTransitionTableSchema, allowedTransitionTable);
    expectInvalid(allowedTransitionTableSchema, { ...allowedTransitionTable, draft: ["accepted"] });
  });
});
