"use server";

import { createQuoteExtractionAdapter } from "@/lib/adapters/ai/quote-extraction-adapter";
import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import { createExtractionService } from "@/lib/services/extraction-service";
import { createProductMatchingService } from "@/lib/services/product-matching-service";
import { quoteIntakeSchema, type QuoteIntakeInput } from "@/lib/schemas/quote-intake";
import type { QuoteItemCreateInput } from "@/lib/repositories/quotes";
import type { ExtractionOutput } from "@/lib/schemas/extraction-schema";

export type IntakeActionState =
  | { ok: true; quoteId: string; quoteNumber: string; status: string; extractionStatus: "completed" | "manual_fallback"; missingFields: string[]; suggestions: string[]; previewLines: { sku: string | null; description: string | null; quantity: number | null }[] }
  | { ok: false; error: string; manualFallback: true; suggestions: string[] };

const money = (amount: number) => Math.round(amount * 100) / 100;
const lineTotals = (items: Omit<QuoteItemCreateInput, "quote_id">[]) => {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discount = items.reduce((sum, item) => sum + item.discount_amount, 0);
  return { subtotal: money(subtotal), discount: money(discount), total: money(subtotal - discount) };
};
const quoteNumber = () => `Q-${Date.now()}`;

const toSuggestions = (missingFields: string[]) =>
  missingFields.length > 0
    ? missingFields.map((field) => `Ask the customer for ${field.replace(/[_.[\]]+/g, " ").trim()}.`)
    : ["Review extracted line items, confirm pricing, and add fulfillment details before sending."];

const toQuoteItem = (line: ExtractionOutput["lines"][number], productId: string | null): Omit<QuoteItemCreateInput, "quote_id"> => {
  const quantity = line.quantity.value ?? 1;
  const unitPrice = line.unit_price.value ?? 0;
  const discountBps = line.discount_bps.value ?? 0;
  const subtotal = quantity * unitPrice;
  const discount = (subtotal * discountBps) / 10_000;
  return {
    product_id: productId,
    line_number: line.line_number,
    sku: line.sku.value ?? "UNMATCHED",
    description: line.description.value ?? "Manual review needed",
    quantity,
    unit_price: money(unitPrice),
    discount_bps: discountBps,
    discount_amount: money(discount),
    line_total_amount: money(subtotal - discount),
    metadata: { intake_created: true },
  };
};

export async function submitQuoteIntake(input: QuoteIntakeInput): Promise<IntakeActionState> {
  const data = quoteIntakeSchema.parse(input);

  try {
    const repositories = createRepositories(createServerSupabaseClient());
    const existingCustomer = await repositories.customers.findByExternalId(data.customerEmail.toLowerCase());
    const customer = existingCustomer ?? await repositories.customers.create({
      external_id: data.customerEmail.toLowerCase(),
      name: data.customerName,
      legal_name: null,
      domain: data.companyDomain || null,
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
      valid_until: data.validUntil || null,
      submitted_at: null,
      approved_at: null,
      sent_at: null,
      accepted_at: null,
      metadata: { opportunity_name: data.opportunityName || null, intake: { attachment_name: data.attachmentName || null, request_text: data.requestText } },
    });

    await repositories.workflowEvents.record({ quote_id: quote.id, event_type: "created", actor_id: null, from_status: null, to_status: "draft", payload: { action: "quote_intake_created" } });

    const extractionService = createExtractionService({ quotesRepository: repositories.quotes, workflowEventsRepository: repositories.workflowEvents, extractionAdapter: createQuoteExtractionAdapter() });
    const extractionResult = await extractionService.extractAndPersist({ quoteId: quote.id, sourceText: data.requestText });
    const missingFields = extractionResult.extraction?.missing_fields ?? ["line_items", "pricing", "requested_delivery_date"];

    if (extractionResult.extraction) {
      const matches = await createProductMatchingService({ productsRepository: repositories.products }).matchLines(
        extractionResult.extraction.lines.map((line) => ({ lineNumber: line.line_number, sku: line.sku.value, description: line.description.value })),
      );
      const items = extractionResult.extraction.lines.map((line) => toQuoteItem(line, matches.find((match) => match.lineNumber === line.line_number)?.product?.id ?? null));
      if (items.length > 0) {
        await repositories.quotes.replaceItems(quote.id, items);
        const totals = lineTotals(items);
        await repositories.quotes.update(quote.id, { subtotal_amount: totals.subtotal, discount_amount: totals.discount, total_amount: totals.total });
      }
    }

    const finalQuote = await repositories.quotes.findById(quote.id);
    return {
      ok: true,
      quoteId: quote.id,
      quoteNumber: quote.quote_number,
      status: finalQuote?.status ?? extractionResult.quote.status,
      extractionStatus: extractionResult.extraction ? "completed" : "manual_fallback",
      missingFields,
      suggestions: toSuggestions(missingFields),
      previewLines: extractionResult.extraction?.lines.map((line) => ({ sku: line.sku.value, description: line.description.value, quantity: line.quantity.value })) ?? [],
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to create the draft quote.",
      manualFallback: true,
      suggestions: ["Save the request details offline, create the quote manually, and retry extraction once services recover."],
    };
  }
}
