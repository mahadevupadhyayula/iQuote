import "server-only";

import type { QuoteExtractionAdapter } from "@/lib/adapters/ai/quote-extraction-adapter";
import type { QuoteStatus } from "@/lib/domain/quote-statuses";
import { extractionOutputSchema, type ExtractionOutput } from "@/lib/schemas/extraction-schema";
import type { QuotesRepository } from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";
import { createWorkflowService } from "@/lib/services/workflow-service";

export type ExtractionServiceOptions = {
  quotesRepository: QuotesRepository;
  workflowEventsRepository: WorkflowEventsRepository;
  extractionAdapter: QuoteExtractionAdapter;
};

export type ExtractQuoteInput = {
  quoteId: string;
  sourceText: string;
  actorId?: string | null;
};

const configuringStatus: QuoteStatus = "configuring";
const extractingStatus: QuoteStatus = "extracting";
const needsInformationStatus: QuoteStatus = "needs_information";

const buildClarificationQuestions = (missingFields: string[]) =>
  missingFields.map((field) => ({ field, question: `Please provide ${field.replace(/[_.[\]]+/g, " ").trim()}.` }));

const toStoredExtraction = (extraction: ExtractionOutput) => ({
  source_text: extraction.source_text,
  fields: {
    customer_name: extraction.customer_name,
    opportunity_name: extraction.opportunity_name,
    requested_items: extraction.requested_items,
    delivery_location: extraction.delivery_location,
    delivery_date: extraction.delivery_date,
    requested_discount: extraction.requested_discount,
    installation_requirement: extraction.installation_requirement,
    special_requirements: extraction.special_requirements,
    ambiguities: extraction.ambiguities,
    overall_confidence: extraction.overall_confidence,
  },
  field_confidence: extraction.field_confidence,
  missing_fields: extraction.missing_fields,
  clarification_questions: extraction.clarification_questions,
  raw_validated_response: extraction,
  extracted_at: new Date().toISOString(),
});

const enableManualEntryMetadata = (metadata: Record<string, unknown>, reason: string, error?: unknown) => ({
  ...metadata,
  extraction: {
    ...(typeof metadata.extraction === "object" && metadata.extraction !== null ? metadata.extraction : {}),
    status: "failed",
    failed_at: new Date().toISOString(),
    failure_reason: reason,
    error_message: error instanceof Error ? error.message : typeof error === "string" ? error : "Invalid extraction output",
  },
  manual_entry: { enabled: true, reason },
});

export const createExtractionService = ({ quotesRepository, workflowEventsRepository, extractionAdapter }: ExtractionServiceOptions) => ({
  async extractAndPersist({ quoteId, sourceText, actorId = null }: ExtractQuoteInput) {
    const quote = await quotesRepository.findById(quoteId);
    if (!quote) throw new Error(`Quote ${quoteId} was not found.`);

    const workflowService = createWorkflowService({ quotesRepository, workflowEventsRepository });
    const extractingQuote = quote.status === "draft"
      ? (await workflowService.transitionQuote({ quoteId, toStatus: extractingStatus, actorId, payload: { action: "quote_extraction_started" } })).quote
      : quote;

    try {
      const extraction = extractionOutputSchema.parse(await extractionAdapter.extractQuoteRequest(sourceText));
      const clarificationQuestions = extraction.clarification_questions.length > 0 ? extraction.clarification_questions : buildClarificationQuestions(extraction.missing_fields);
      const normalizedExtraction = { ...extraction, clarification_questions: clarificationQuestions };

      const updatedQuote = await quotesRepository.update(quoteId, {
        currency_code: quote.currency_code,
        valid_until: extraction.delivery_date.value ?? quote.valid_until,
        metadata: {
          ...extractingQuote.metadata,
          extraction: { ...toStoredExtraction(normalizedExtraction), status: "completed" },
          manual_entry: { enabled: extraction.missing_fields.length > 0, reason: extraction.missing_fields.length > 0 ? "missing_extracted_fields" : null },
        },
      });

      const needsInformation = extraction.missing_fields.length > 0 || extraction.ambiguities.length > 0 || clarificationQuestions.length > 0;
      const targetStatus = needsInformation ? needsInformationStatus : configuringStatus;
      const transitioned = updatedQuote.status === targetStatus
        ? updatedQuote
        : (await workflowService.transitionQuote({
            quoteId,
            toStatus: targetStatus,
            actorId,
            payload: { action: "quote_extraction_completed", missing_fields: extraction.missing_fields, clarification_questions: clarificationQuestions },
          })).quote;

      return { quote: transitioned, extraction: normalizedExtraction };
    } catch (error) {
      await quotesRepository.update(quoteId, {
        metadata: enableManualEntryMetadata(extractingQuote.metadata, "openai_extraction_failed_or_invalid", error),
      });

      const { quote: updatedQuote } = await workflowService.transitionQuote({
        quoteId,
        toStatus: needsInformationStatus,
        actorId,
        payload: { action: "quote_extraction_failed", source_text: sourceText, error_message: error instanceof Error ? error.message : String(error) },
      });

      return { quote: updatedQuote, extraction: null };
    }
  },
});

export type ExtractionService = ReturnType<typeof createExtractionService>;
