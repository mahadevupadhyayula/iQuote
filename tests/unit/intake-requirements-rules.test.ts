import { describe, expect, it } from "vitest";

import { toIntakeRequirementsMetadata, toReviewRequiredQuoteItems, type IntakeLinePersistenceInput } from "@/lib/rules/intake-requirements-rules";
import type { ExtractionOutput } from "@/lib/schemas/extraction-schema";
import type { ProductRecord } from "@/lib/schemas/shared-records";

const field = <T,>(value: T | null, missing = value === null) => ({ value, missing, confidence: value === null ? 0 : 0.8, source_span: null });
const now = "2026-07-18T00:00:00.000Z";

const product: ProductRecord = {
  id: "10000000-0000-4000-8000-000000000001",
  sku: "HX-500",
  name: "HX-500 Scanner",
  description: "Rugged scanner",
  status: "active",
  unit_of_measure: "each",
  metadata: {},
  created_at: now,
  updated_at: now,
};

const extraction = (requestedDiscount: number | null): ExtractionOutput => ({
  source_text: requestedDiscount !== null ? `Need 4 HX-500. ${requestedDiscount}%` : "Need 4 HX-500.",
  customer_name: field("Atlas"),
  opportunity_name: field(null),
  requested_items: [
    {
      line_number: 1,
      raw_item_description: field("4 HX-500"),
      requested_sku: field("HX-500"),
      quantity: field(4),
      specifications: field(null),
    },
  ],
  delivery_location: field(null),
  delivery_date: field(null),
  requested_discount: field(requestedDiscount),
  installation_requirement: field(null),
  special_requirements: field(null),
  missing_fields: [],
  ambiguities: [],
  clarification_questions: [],
  field_confidence: {},
  overall_confidence: 0.8,
});

const line = (quantity: number | null): IntakeLinePersistenceInput => ({
  lineNumber: 1,
  requestedSku: "HX-500",
  description: "4 HX-500",
  quantity,
  deterministicResolution: {
    product,
    originalInput: { sku: "HX-500", alias: "HX-500", description: "4 HX-500" },
    method: "sku",
    confidence: 1,
    reason: "Matched exact requested SKU.",
    relationship: null,
  },
  candidates: [product],
});

describe("intake requirements persistence rules", () => {
  it("stores canonical numeric discount percentage as customer request metadata without applying line discounts", () => {
    const metadata = toIntakeRequirementsMetadata(extraction(8), [line(4)]);
    const items = toReviewRequiredQuoteItems([line(4)]);

    expect(metadata.customer_request.requested_discount).toMatchObject({
      value: 8,
      unit: "percent",
      status: "customer_requested_review_required",
    });
    expect(JSON.stringify(metadata.customer_request.requested_discount)).not.toContain("discount_bps");
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ unit_price: 0, discount_bps: 0, discount_amount: 0, line_total_amount: 0 });
    expect(items[0].metadata).toMatchObject({ review_required: true, discount_status: "not_applied" });
  });

  it("stores zero discount distinctly and does not create quantity placeholders when quantity was not explicit", () => {
    const metadata = toIntakeRequirementsMetadata(extraction(0), [line(null)]);
    const items = toReviewRequiredQuoteItems([line(null)]);

    expect(metadata.customer_request.requested_discount).toMatchObject({
      value: 0,
      unit: "percent",
      status: "customer_requested_review_required",
    });
    expect(metadata.requirements.requested_items[0]).toMatchObject({ quantity: null, review_required: true });
    expect(items).toEqual([]);
  });
});
