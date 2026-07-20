import { describe, expect, it } from "vitest";
import { createQuotePdfDocument, QuotePdfNotReadyError } from "@/lib/pdf/quote-document";
import { quotePdfDefaults } from "@/lib/pdf/quote-pdf-defaults";
import type { CustomerQuoteViewModel } from "@/lib/services/quote-workspace-query-service";

const now = new Date("2026-07-20T12:00:00.000Z");

const line = (overrides: Partial<CustomerQuoteViewModel["lines"][number]> = {}): CustomerQuoteViewModel["lines"][number] => ({
  id: "line-1",
  lineNumber: 1,
  sku: "AX-200",
  description: "AX-200 Industrial Compressor",
  productName: "AX-200 Industrial Compressor",
  catalogDescription: "Standard industrial compressor package with a long wrapped customer-safe description that must remain intact in the document model.",
  customerRequestedDescription: "Compressor requested by customer",
  customerSpecifications: null,
  quantity: 2,
  unitPrice: 1800,
  discountBps: 800,
  discountAmount: 288,
  lineTotalAmount: 3312,
  grossAmount: 3600,
  discountPercentage: 8,
  netAmount: 3312,
  resolutionStatus: "selected",
  requestedSku: "AX-200",
  requestedDescription: "Compressor requested by customer",
  selectedSku: "AX-200",
  selectedProductName: "AX-200 Industrial Compressor",
  quotable: true,
  unavailableReason: null,
  ...overrides,
});

const quote = (overrides: Partial<CustomerQuoteViewModel> = {}): CustomerQuoteViewModel => ({
  id: "quote-1",
  quoteNumber: "Q-2026-00142",
  status: "approved",
  currencyCode: "USD",
  customer: {
    id: "customer-1",
    name: "Atlas Manufacturing",
    legal_name: "Atlas Manufacturing LLC",
    billing_email: "billing@atlas.example",
    phone: "+1 (555) 010-2000",
    billing_address: { line1: "100 Industrial Way", city: "Houston", state: "Texas", postal_code: "77002" },
    shipping_address: { line1: "200 Delivery Road", city: "Houston", state: "Texas", postal_code: "77015" },
  },
  subtotalAmount: 3600,
  discountAmount: 288,
  taxAmount: 265,
  totalAmount: 3577,
  validUntil: null,
  sentAt: null,
  acceptedAt: null,
  metadata: {},
  lines: [line()],
  ...overrides,
});

describe("quote PDF document model", () => {
  it("uses real workflow values ahead of mocked defaults", () => {
    const document = createQuotePdfDocument(quote({ metadata: { revision_number: "Revision 3", reviewed_workflow: { prepared_by_name: "Jordan Lee", payment_terms: "Net 15", delivery_location: "Austin, Texas", installation_requirement: "vendor_installation_requested", special_requirements: ["Customer requires morning delivery window."] } } }), now);
    expect(document.quote.revisionNumber).toBe("Revision 3");
    expect(document.preparedBy.name).toBe("Jordan Lee");
    expect(document.commercialTerms.paymentTerms).toBe("Net 15");
    expect(document.commercialTerms.deliveryAndFulfilment).toContain("Austin, Texas");
    expect(document.commercialTerms.installationAndStartup).toContain("Vendor installation requested");
    expect(document.notesAndAssumptions).toContain("Customer requires morning delivery window.");
  });

  it("centralizes mocked fallback values and tracks them", () => {
    const document = createQuotePdfDocument(quote(), now);
    expect(document.company).toEqual(quotePdfDefaults.company);
    expect(document.commercialTerms.paymentTerms).toBe(quotePdfDefaults.paymentTerms);
    expect(document.commercialTerms.installationAndStartup).toBe(quotePdfDefaults.installationAndStartup);
    expect(document.commercialTerms.deliveryAndFulfilment).toContain(quotePdfDefaults.deliveryAndFulfilment);
    expect(document.validUntil).toBe("2026-08-19T00:00:00.000Z");
    expect(document.mockedFields).toEqual(expect.arrayContaining(["company.legalName", "commercialTerms.paymentTerms", "commercialTerms.installationAndStartup", "validUntil"]));
  });

  it("uses persisted valid-until when present", () => {
    expect(createQuotePdfDocument(quote({ validUntil: "2026-08-20" }), now).validUntil).toBe("2026-08-20T00:00:00.000Z");
  });

  it("keeps quoted and unavailable lines in separate customer-facing sections", () => {
    const unavailable = line({ id: "line-2", lineNumber: 2, resolutionStatus: "unavailable", quotable: false, unitPrice: 0, grossAmount: 0, discountAmount: 0, netAmount: 0, requestedSku: "HX-500", requestedDescription: "HX-500 Hydraulic Pump", unavailableReason: "Not currently available for this quote." });
    const document = createQuotePdfDocument(quote({ lines: [line(), unavailable] }), now);
    expect(document.quote.partialQuote).toBe(true);
    expect(document.quotedLines).toHaveLength(1);
    expect(document.unavailableLines).toEqual([{ lineNumber: 2, requestedSku: "HX-500", requestedDescription: "HX-500 Hydraulic Pump", quantity: 2, reason: "Not currently available for this quote." }]);
    expect(document.totals).toEqual({ grossAmount: 3600, discountAmount: 288, taxAmount: 265, totalAmount: 3577 });
  });

  it("rejects unresolved and all-unavailable quotes", () => {
    expect(() => createQuotePdfDocument(quote({ lines: [line({ resolutionStatus: "unresolved", quotable: false })] }), now)).toThrow(QuotePdfNotReadyError);
    expect(() => createQuotePdfDocument(quote({ lines: [line({ resolutionStatus: "unavailable", quotable: false })] }), now)).toThrow(QuotePdfNotReadyError);
  });

  it("does not include internal economics or pricing-source fields", () => {
    const document = createQuotePdfDocument(quote({ metadata: { product_cost: 1, gross_margin: 2, price_source: "internal" } }), now);
    expect(JSON.stringify(document)).not.toContain("product_cost");
    expect(JSON.stringify(document)).not.toContain("gross_margin");
    expect(JSON.stringify(document)).not.toContain("price_source");
  });
});
