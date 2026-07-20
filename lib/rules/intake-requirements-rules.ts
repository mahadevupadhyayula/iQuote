import type { QuoteItemCreateInput } from "@/lib/repositories/quotes";
import type { ExtractionOutput } from "@/lib/schemas/extraction-schema";
import type { ProductRecord } from "@/lib/schemas/shared-records";
import type { InventoryDecision } from "@/lib/rules/inventory-rules";
import type { ProductResolution } from "@/lib/services/product-resolver-service";

export type IntakeProductCandidate = Pick<ProductRecord, "id" | "sku" | "name" | "status">;

export type IntakeLinePersistenceInput = {
  lineNumber: number;
  requestedSku: string | null;
  description: string | null;
  quantity: number | null;
  deterministicResolution: ProductResolution;
  candidates: IntakeProductCandidate[];
  price?: { id: string; currency_code: string; unit_price: number; effective_from: string; effective_to: string | null } | null;
  inventoryDecision?: InventoryDecision | null;
  requestedDiscountBps?: number;
  approvalRequired?: boolean;
};

export const toIntakeRequirementsMetadata = (extraction: ExtractionOutput, lines: IntakeLinePersistenceInput[]) => ({
  customer_request: {
    source_text: extraction.source_text,
    requested_discount: extraction.requested_discount.value
      ? {
          text: extraction.requested_discount.value,
          confidence: extraction.requested_discount.confidence,
          source_span: extraction.requested_discount.source_span,
          status: "customer_requested_review_required",
        }
      : null,
    delivery_location: extraction.delivery_location,
    delivery_date: extraction.delivery_date,
    installation_requirement: extraction.installation_requirement,
    special_requirements: extraction.special_requirements,
  },
  requirements: {
    requested_items: lines.map((line) => ({
      line_number: line.lineNumber,
      requested_sku: line.requestedSku,
      description: line.description,
      quantity: line.quantity,
      deterministic_match: line.deterministicResolution.product
        ? {
            product_id: line.deterministicResolution.product.id,
            sku: line.deterministicResolution.product.sku,
            method: line.deterministicResolution.method,
            confidence: line.deterministicResolution.confidence,
            reason: line.deterministicResolution.reason,
          }
        : null,
      candidates: line.candidates.map(({ id, sku, name, status }) => ({ id, sku, name, status })),
      active_price: line.price,
      inventory_decision: line.inventoryDecision ?? null,
      requested_discount_bps: line.requestedDiscountBps ?? 0,
      approval_required: line.approvalRequired ?? false,
      review_required: !line.deterministicResolution.product || Boolean(line.inventoryDecision?.blocked) || Boolean(line.approvalRequired),
    })),
  },
});

export const toReviewRequiredQuoteItems = (lines: IntakeLinePersistenceInput[]): Omit<QuoteItemCreateInput, "quote_id">[] =>
  lines
    .filter((line) => line.quantity !== null)
    .map((line, index) => {
      const product = line.deterministicResolution.product;
      return {
        product_id: product?.id ?? null,
        line_number: index + 1,
        sku: product?.sku ?? line.requestedSku ?? "REVIEW-REQUIRED",
        description: product?.name ?? line.description ?? "Review required item",
        quantity: line.quantity ?? 1,
        unit_price: 0,
        discount_bps: 0,
        discount_amount: 0,
        line_total_amount: 0,
        metadata: {
          review_required: true,
          source: "customer_intake_extraction",
          pricing_status: "not_applied",
          discount_status: "not_applied",
          requested_sku: line.requestedSku,
          requested_description: line.description,
          deterministic_match: product
            ? {
                product_id: product.id,
                method: line.deterministicResolution.method,
                confidence: line.deterministicResolution.confidence,
                reason: line.deterministicResolution.reason,
              }
            : null,
          candidates: line.candidates.map(({ id, sku, name, status }) => ({ id, sku, name, status })),
          active_price: line.price,
          inventory_decision: line.inventoryDecision ?? null,
          requested_discount_bps: line.requestedDiscountBps ?? 0,
          approval_required: line.approvalRequired ?? false,
        },
      };
    });
