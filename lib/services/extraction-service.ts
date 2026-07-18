import "server-only";

import type { QuoteExtractionAdapter } from "@/lib/adapters/ai/quote-extraction-adapter";
import type { QuoteStatus } from "@/lib/domain/quote-statuses";
import { extractionOutputSchema, type ExtractionOutput } from "@/lib/schemas/extraction-schema";
import type { QuotesRepository } from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";

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

const needsInformationStatus: QuoteStatus = "needs_information";

const buildClarificationQuestions = (missingFields: string[]) =>
  missingFields.map((field) => ({ field, question: `Please provide ${field.replace(/[_.[\]]+/g, " ").trim()}.` }));

const toStoredExtraction = (extraction: ExtractionOutput) => ({
  source_text: extraction.source_text,
  fields: {
    customer_name: extraction.customer_name,
    customer_email: extraction.customer_email,
    opportunity_name: extraction.opportunity_name,
    currency_code: extraction.currency_code,
    requested_valid_until: extraction.requested_valid_until,
    lines: extraction.lines,
  },
  field_confidence: extraction.field_confidence,
  missing_fields: extraction.missing_fields,
  clarification_questions: extraction.clarification_questions,
  source_spans: extraction.source_spans,
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

    try {
      const extraction = extractionOutputSchema.parse(await extractionAdapter.extractQuoteRequest(sourceText));
      const clarificationQuestions = extraction.clarification_questions.length > 0 ? extraction.clarification_questions : buildClarificationQuestions(extraction.missing_fields);
      const normalizedExtraction = { ...extraction, clarification_questions: clarificationQuestions };

      const updatedQuote = await quotesRepository.update(quoteId, {
        currency_code: extraction.currency_code.value ?? quote.currency_code,
        valid_until: extraction.requested_valid_until.value ?? quote.valid_until,
        metadata: {
          ...quote.metadata,
          extraction: { ...toStoredExtraction(normalizedExtraction), status: "completed" },
          manual_entry: { enabled: extraction.missing_fields.length > 0, reason: extraction.missing_fields.length > 0 ? "missing_extracted_fields" : null },
        },
      });

      await workflowEventsRepository.record({
        quote_id: quoteId,
        event_type: "updated",
        actor_id: actorId,
        from_status: quote.status,
        to_status: updatedQuote.status,
        payload: { action: "quote_extraction_completed", missing_fields: extraction.missing_fields, clarification_questions: clarificationQuestions },
      });

      return { quote: updatedQuote, extraction: normalizedExtraction };
    } catch (error) {
      const updatedQuote = await quotesRepository.update(quoteId, {
        status: needsInformationStatus,
        metadata: enableManualEntryMetadata(quote.metadata, "openai_extraction_failed_or_invalid", error),
      });

      await workflowEventsRepository.record({
        quote_id: quoteId,
        event_type: "extraction_failed",
        actor_id: actorId,
        from_status: quote.status,
        to_status: needsInformationStatus,
        payload: { action: "quote_extraction_failed", source_text: sourceText, error_message: error instanceof Error ? error.message : String(error) },
      });

      return { quote: updatedQuote, extraction: null };
    }
  },
});

export type ExtractionService = ReturnType<typeof createExtractionService>;
