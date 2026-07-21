"use server";

import { createQuoteExtractionAdapter } from "@/lib/adapters/ai/quote-extraction-adapter";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { classifyIntakeBusinessReview, type IntakeBusinessReviewStatus } from "@/lib/rules/intake-classification-rules";
import { evaluateApprovalPolicy } from "@/lib/rules/approval-rules";
import { toIntakeRequirementsMetadata, toReviewRequiredQuoteItems, type IntakeLinePersistenceInput } from "@/lib/rules/intake-requirements-rules";
import { quoteIntakeSchema, type QuoteIntakeInput } from "@/lib/schemas/quote-intake";
import { createExtractionService } from "@/lib/services/extraction-service";
import { createInventoryService } from "@/lib/services/inventory-service";
import { createProductResolverService } from "@/lib/services/product-resolver-service";
import { createWorkflowService } from "@/lib/services/workflow-service";

type PreviewLine = { sku: string | null; description: string | null; quantity: number | null };
type ClarificationQuestion = { field: string; question: string };
type ExtractionSummary = {
  requestedItemCount: number;
  overallConfidence: number | null;
  ambiguityCount: number;
  missingFieldCount: number;
};
type ManualFallbackState = { enabled: boolean; reason: string | null; category: string | null; summary: string | null };

export type IntakeActionState =
  | {
      ok: true;
      quoteId: string;
      quoteNumber: string;
      status: string;
      slaStartedAt: string;
      slaDueAt: string;
      extractionStatus: "completed" | "manual_fallback";
      extractionSummary: ExtractionSummary;
      missingFields: string[];
      clarificationQuestions: ClarificationQuestion[];
      manualFallback: boolean;
      manualFallbackState: ManualFallbackState;
      suggestions: string[];
      previewLines: PreviewLine[];
      businessReviewStatus: IntakeBusinessReviewStatus;
    }
  | { ok: false; error: string; manualFallback: true; suggestions: string[] };

const quoteNumber = () => `Q-${Date.now()}`;
const intakeSlaMinutes = 15;

const toSuggestions = (missingFields: string[], clarificationQuestions: ClarificationQuestion[]) => {
  if (clarificationQuestions.length > 0) return clarificationQuestions.map((question) => question.question);
  return missingFields.length > 0
    ? missingFields.map((field: string) => `Ask the customer for ${field.replace(/[_.[\]]+/g, " ").trim()}.`)
    : ["Review extracted request details, then configure catalog-backed products, pricing, inventory, and approvals before sending."];
};

const optionalString = (value: string | undefined) => (value && value.length > 0 ? value : null);

const requestedDiscountBps = (value: number | null) => value == null ? 0 : Math.round(value * 100);

const buildSla = (now = new Date()) => {
  const due = new Date(now.getTime() + intakeSlaMinutes * 60 * 1000);
  return { startedAt: now.toISOString(), dueAt: due.toISOString(), policyMinutes: intakeSlaMinutes };
};

export async function submitQuoteIntake(input: QuoteIntakeInput): Promise<IntakeActionState> {
  try {
    const data = quoteIntakeSchema.parse(input);
    const sla = buildSla();
    const repositories = createRepositories(createServerSupabaseClient());
    const workflowService = createWorkflowService({ quotesRepository: repositories.quotes, workflowEventsRepository: repositories.workflowEvents });

    const customerExternalId = data.customerEmail.toLowerCase();
    const existingCustomer = await repositories.customers.findByExternalId(customerExternalId);
    const customer = existingCustomer ?? await repositories.customers.create({
      external_id: customerExternalId,
      name: data.customerName,
      legal_name: null,
      domain: optionalString(data.companyDomain),
      billing_email: data.customerEmail,
      phone: null,
      billing_address: {},
      shipping_address: {},
      metadata: { source: "quote_intake" },
    });

    const quote = await repositories.quotes.create({
      customer_id: customer.id,
      opportunity_id: null,
      quote_number: quoteNumber(),
      status: "draft",
      currency_code: data.currencyCode,
      subtotal_amount: 0,
      discount_amount: 0,
      tax_amount: 0,
      total_amount: 0,
      valid_until: optionalString(data.validUntil),
      submitted_at: null,
      approved_at: null,
      sent_at: null,
      accepted_at: null,
      sla_due_at: sla.dueAt,
      metadata: {
        opportunity_name: optionalString(data.opportunityName),
        intake: {
          request_text: data.requestText,
          attachment_v1: data.attachmentName ? { file_name: data.attachmentName, status: "metadata_only" } : null,
        },
        seeded_scenario: data.seededScenarioId ? { id: data.seededScenarioId, selected_at: sla.startedAt } : null,
        sla: {
          started_at: sla.startedAt,
          due_at: sla.dueAt,
          policy_minutes: sla.policyMinutes,
        },
      },
    });

    await repositories.workflowEvents.record({
      quote_id: quote.id,
      event_type: "created",
      actor_id: null,
      from_status: null,
      to_status: "draft",
      payload: { action: "quote_intake_created", sla: { started_at: sla.startedAt, due_at: sla.dueAt, policy_minutes: sla.policyMinutes } },
    });

    await workflowService.transitionQuote({ quoteId: quote.id, toStatus: "extracting", payload: { action: "quote_extraction_started" } });

    const extractionResult = await createExtractionService({
      quotesRepository: repositories.quotes,
      workflowEventsRepository: repositories.workflowEvents,
      extractionAdapter: createQuoteExtractionAdapter(),
    }).extractAndPersist({ quoteId: quote.id, sourceText: data.requestText });

    const extraction = extractionResult.extraction;
    let businessReviewStatus: IntakeBusinessReviewStatus = "technical_extraction_failure";

    if (extraction) {
      const productResolver = createProductResolverService({ productsRepository: repositories.products });
      const policies = await repositories.prices.listActiveDiscountPolicies();
      const canEvaluateApproval = policies.some((policy: { active: boolean; policy_type: string }) => policy.active && policy.policy_type === "percent_off");
      const persistedLines: IntakeLinePersistenceInput[] = await Promise.all(extraction.requested_items.map(async (line: typeof extraction.requested_items[number]) => {
        const requestedSku = line.requested_sku.value;
        const description = line.raw_item_description.value;
        const deterministicResolution = await productResolver.resolve({ sku: requestedSku, alias: requestedSku, description });
        const searchQuery = requestedSku ?? description;
        const candidates = searchQuery ? await repositories.products.search(searchQuery, 5) : [];
        const quantity = line.quantity.value;
        const price = deterministicResolution.product
          ? await repositories.prices.findCurrentPrice(deterministicResolution.product.id, data.currencyCode)
          : null;
        const inventoryDecision = deterministicResolution.product && quantity !== null
          ? await createInventoryService({ inventoryRepository: repositories.inventory, productsRepository: repositories.products }).evaluateAvailability({ product: deterministicResolution.product!, quantity, allowSplitFulfillment: true })
          : null;
        const discountBps = requestedDiscountBps(extraction.requested_discount.value);
        const approvalRequired = canEvaluateApproval
          ? evaluateApprovalPolicy({ requestedDiscountBps: discountBps, projectedMarginBps: 3_000, policies }).requirement !== "straight_through"
          : false;

        return {
          lineNumber: line.line_number,
          requestedSku,
          description,
          quantity,
          deterministicResolution,
          candidates: deterministicResolution.product && candidates.every((candidate: { id: string }) => candidate.id !== deterministicResolution.product?.id)
            ? [deterministicResolution.product, ...candidates].slice(0, 5)
            : candidates,
          price: price ? { id: price.id, currency_code: price.currency_code, unit_price: price.unit_price, effective_from: price.effective_from, effective_to: price.effective_to } : null,
          inventoryDecision,
          requestedDiscountBps: discountBps,
          approvalRequired,
        };
      }));

      await repositories.quotes.update(quote.id, {
        metadata: {
          ...extractionResult.quote.metadata,
          intake_persistence: toIntakeRequirementsMetadata(extraction, persistedLines),
        },
      });

      const reviewItems = toReviewRequiredQuoteItems(persistedLines);
      if (reviewItems.length > 0) await repositories.quotes.replaceItems(quote.id, reviewItems);
      businessReviewStatus = classifyIntakeBusinessReview({
        extraction,
        productResolutions: persistedLines.map((line) => line.deterministicResolution),
        inventoryDecisions: persistedLines.flatMap((line) => line.inventoryDecision ? [line.inventoryDecision] : []),
        approvalRequired: persistedLines.some((line) => line.approvalRequired),
      });
    }

    const missingFields = extraction?.missing_fields ?? ["requested_items", "delivery_date", "delivery_location"];
    const clarificationQuestions = extraction?.clarification_questions ?? missingFields.map((field: string) => ({ field, question: `Please provide ${field.replace(/[_.[\]]+/g, " ").trim()}.` }));

    const failure = "failure" in extractionResult ? extractionResult.failure : null;

    return {
      ok: true,
      quoteId: quote.id,
      quoteNumber: quote.quote_number,
      status: extractionResult.quote.status,
      slaStartedAt: sla.startedAt,
      slaDueAt: sla.dueAt,
      extractionStatus: extraction ? "completed" : "manual_fallback",
      extractionSummary: {
        requestedItemCount: extraction?.requested_items.length ?? 0,
        overallConfidence: extraction?.overall_confidence ?? null,
        ambiguityCount: extraction?.ambiguities.length ?? 0,
        missingFieldCount: missingFields.length,
      },
      missingFields,
      clarificationQuestions,
      manualFallback: !extraction,
      manualFallbackState: {
        enabled: !extraction,
        reason: extraction ? null : "extraction_failed",
        category: failure?.category ?? null,
        summary: failure?.summary ?? null,
      },
      suggestions: toSuggestions(missingFields, clarificationQuestions),
      previewLines: extraction?.requested_items.map((line: typeof extraction.requested_items[number]) => ({
        sku: line.requested_sku.value,
        description: line.raw_item_description.value,
        quantity: line.quantity.value,
      })) ?? [],
      businessReviewStatus,
    };
  } catch (error) {
  console.error("[quote-intake] failed", error);

  const message =
    error instanceof Error
      ? error.message
      : "Unknown quote-intake failure";

  return {
    ok: false,
    error:
      process.env.NODE_ENV === "development"
        ? `Unable to create the draft quote: ${message}`
        : "Unable to create the draft quote. Please try again later.",
    manualFallback: true,
    suggestions: [
      "Check the server log for the failing database or extraction stage.",
    ],
  };
  }
}
