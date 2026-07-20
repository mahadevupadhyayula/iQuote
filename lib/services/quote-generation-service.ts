import "server-only";

import { Buffer } from "node:buffer";
import type { QuoteStatus } from "@/lib/domain/quote-statuses";
import type { CustomersRepository } from "@/lib/repositories/customers";
import type { QuotesRepository } from "@/lib/repositories/quotes";
import type { WorkflowEventsRepository } from "@/lib/repositories/workflow-events";
import { QuotePdfNotReadyError } from "@/lib/pdf/quote-document";
import { renderQuotePdf } from "@/lib/pdf/render-quote-pdf";
import { createQuoteWorkspaceQueryService } from "@/lib/services/quote-workspace-query-service";

type QuoteGenerationRepositories = {
  customers: Pick<CustomersRepository, "findById">;
  quotes: Pick<QuotesRepository, "findById">;
  workflowEvents: Pick<WorkflowEventsRepository, "record">;
};

type QuotePdfResult =
  | { ok: true; buffer: Buffer; fileName: string; contentType: "application/pdf" }
  | { ok: false; status: 404 | 409 | 500; code: "not_found" | "not_ready" | "pdf_generation_failed"; message: string };

const customerReadyStatuses = new Set<QuoteStatus>(["approved", "sent", "accepted"]);

export const createQuoteGenerationService = (repositories: QuoteGenerationRepositories, now = () => new Date()) => ({
  async renderCustomerQuotePdf(quoteId: string): Promise<QuotePdfResult> {
    const quote = await repositories.quotes.findById(quoteId);
    if (!quote) return { ok: false, status: 404, code: "not_found", message: "Quote not found." };

    if (!customerReadyStatuses.has(quote.status)) {
      return { ok: false, status: 409, code: "not_ready", message: "Quote PDF is not available until the quote is approved." };
    }

    try {
      const queryService = createQuoteWorkspaceQueryService({
        quotes: { findById: async () => quote },
        customers: repositories.customers,
        approvals: { listByQuote: async () => [] },
        prices: { listCurrentPrices: async () => [] },
        products: { findById: async () => null, listActive: async () => [] },
        workflowEvents: { listByQuote: async () => [] },
      });
      const customerQuote = await queryService.getCustomerQuote(quoteId);
      if (!customerQuote) return { ok: false, status: 404, code: "not_found", message: "Quote not found." };
      if (customerQuote.lines.some((line) => line.resolutionStatus === "unresolved")) {
        return { ok: false, status: 409, code: "not_ready", message: "Quote PDF is not available while requested lines remain unresolved." };
      }
      const quotedLineCount = customerQuote.lines.filter((line) => line.resolutionStatus === "selected" && line.quotable).length;
      const unavailableLineCount = customerQuote.lines.filter((line) => line.resolutionStatus === "unavailable").length;
      if (quotedLineCount === 0) {
        return { ok: false, status: 409, code: "not_ready", message: "Quote PDF requires at least one quoted product." };
      }
      const pdf = await renderQuotePdf(customerQuote, now());
      try {
        await repositories.workflowEvents.record({
          quote_id: quote.id,
          event_type: "updated",
          actor_id: null,
          from_status: quote.status,
          to_status: quote.status,
          payload: { action: "customer_quote_pdf_generated", quoted_line_count: quotedLineCount, unavailable_line_count: unavailableLineCount, partial_quote: unavailableLineCount > 0, revision_number: pdf.document.quote.revisionNumber },
        });
      } catch (loggingError) {
        console.error("Failed to record quote PDF generated workflow event", loggingError);
      }
      return { ok: true, buffer: pdf.buffer, fileName: pdf.fileName, contentType: "application/pdf" };
    } catch (error) {
      if (error instanceof QuotePdfNotReadyError) {
        return { ok: false, status: 409, code: "not_ready", message: error.message };
      }
      try {
        await repositories.workflowEvents.record({
          quote_id: quote.id,
          event_type: "updated",
          actor_id: null,
          from_status: quote.status,
          to_status: quote.status,
          payload: {
            action: "pdf_generation_failed",
            error: error instanceof Error ? error.message : "Unknown PDF generation error",
          },
        });
      } catch (loggingError) {
        console.error("Failed to record quote PDF failure workflow event", loggingError);
      }

      return { ok: false, status: 500, code: "pdf_generation_failed", message: "Unable to generate the quote PDF right now." };
    }
  },
});

export type QuoteGenerationService = ReturnType<typeof createQuoteGenerationService>;
