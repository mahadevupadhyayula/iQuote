import type { ExtractionOutput } from "@/lib/schemas/extraction-schema";
import type { InventoryDecision } from "@/lib/rules/inventory-rules";
import type { ProductResolution } from "@/lib/services/product-resolver-service";

export type IntakeBusinessReviewInput = {
  extraction: ExtractionOutput | null;
  productResolutions?: ProductResolution[];
  inventoryDecisions?: InventoryDecision[];
  approvalRequired?: boolean;
};

export type IntakeBusinessReviewStatus =
  | "technical_extraction_failure"
  | "ready_for_review"
  | "clarification_required"
  | "unresolved_product"
  | "inventory_shortage"
  | "approval_required";

export const classifyIntakeBusinessReview = ({
  extraction,
  productResolutions = [],
  inventoryDecisions = [],
  approvalRequired = false,
}: IntakeBusinessReviewInput): IntakeBusinessReviewStatus => {
  if (!extraction) return "technical_extraction_failure";
  if (extraction.missing_fields.length > 0 || extraction.ambiguities.length > 0 || extraction.clarification_questions.length > 0) {
    return "clarification_required";
  }
  if (productResolutions.some((resolution) => !resolution.product)) return "unresolved_product";
  if (inventoryDecisions.some((decision) => decision.blocked || decision.status === "backordered")) return "inventory_shortage";
  if (approvalRequired) return "approval_required";
  return "ready_for_review";
};

export const intakeBusinessReviewLabels: Record<IntakeBusinessReviewStatus, string> = {
  technical_extraction_failure: "Technical extraction failure",
  ready_for_review: "Ready for review",
  clarification_required: "Clarification required",
  unresolved_product: "Product review required",
  inventory_shortage: "Fulfillment review required",
  approval_required: "Approval required",
};
