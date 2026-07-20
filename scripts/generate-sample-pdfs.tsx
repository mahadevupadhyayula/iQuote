import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuoteDocument } from "../lib/pdf/quote-pdf-component";
import { createQuotePdfDocument } from "../lib/pdf/quote-document";
import type { CustomerQuoteViewModel } from "../lib/services/quote-workspace-query-service";

const now = new Date("2026-07-20T12:00:00.000Z");

const baseQuote = (quoteNumber: string, lines: CustomerQuoteViewModel["lines"]): CustomerQuoteViewModel => ({
  id: `sample-${quoteNumber}`,
  quoteNumber,
  status: "approved",
  currencyCode: "USD",
  customer: {
    id: "sample-customer",
    name: "Atlas Manufacturing",
    legal_name: "Atlas Manufacturing LLC",
    billing_email: "billing@atlas.example",
    phone: "+1 (555) 010-2000",
    billing_address: { line1: "400 Industrial Parkway", line2: "Procurement Building", city: "Houston", state: "Texas", postal_code: "77002", country: "United States" },
    shipping_address: { line1: "950 Fulfilment Road", city: "Houston", state: "Texas", postal_code: "77015", country: "United States" },
  },
  subtotalAmount: lines.filter((line) => line.quotable).reduce((sum, line) => sum + line.grossAmount, 0),
  discountAmount: lines.filter((line) => line.quotable).reduce((sum, line) => sum + line.discountAmount, 0),
  taxAmount: 72,
  totalAmount: lines.filter((line) => line.quotable).reduce((sum, line) => sum + line.netAmount, 0) + 72,
  validUntil: null,
  sentAt: null,
  acceptedAt: null,
  metadata: { revision_number: "Revision 1", delivery_location: "Houston, Texas", payment_terms: "Net 30 days from the invoice date." },
  lines,
});

const quotedLine = (lineNumber: number, extra = ""): CustomerQuoteViewModel["lines"][number] => ({
  id: `line-${lineNumber}`,
  lineNumber,
  sku: `AX-${String(lineNumber).padStart(3, "0")}`,
  description: `Industrial compressor package ${extra}`.trim(),
  productName: `AX-${lineNumber} Industrial Compressor`,
  catalogDescription: `Standard industrial compressor package with documented catalogue specifications. ${extra}`.trim(),
  customerRequestedDescription: `Requested compressor ${lineNumber}`,
  customerSpecifications: null,
  quantity: lineNumber % 3 + 1,
  unitPrice: 500 + lineNumber * 25,
  discountBps: 800,
  discountAmount: 40 + lineNumber,
  lineTotalAmount: 500 + lineNumber * 25 - (40 + lineNumber),
  grossAmount: 500 + lineNumber * 25,
  discountPercentage: 8,
  netAmount: 500 + lineNumber * 25 - (40 + lineNumber),
  resolutionStatus: "selected",
  requestedSku: `AX-${String(lineNumber).padStart(3, "0")}`,
  requestedDescription: `Requested compressor ${lineNumber}`,
  selectedSku: `AX-${String(lineNumber).padStart(3, "0")}`,
  selectedProductName: `AX-${lineNumber} Industrial Compressor`,
  quotable: true,
  unavailableReason: null,
});

const unavailableLine = (lineNumber: number): CustomerQuoteViewModel["lines"][number] => ({ ...quotedLine(lineNumber), productName: null, selectedProductName: null, selectedSku: null, unitPrice: 0, discountAmount: 0, lineTotalAmount: 0, grossAmount: 0, netAmount: 0, resolutionStatus: "unavailable", quotable: false, requestedSku: "HX-500", requestedDescription: "HX-500 Hydraulic Pump", unavailableReason: "Not currently available for this quote." });

const samples = [
  ["standard-one-product.pdf", baseQuote("Q-SAMPLE-001", [quotedLine(1)])],
  ["multi-product.pdf", baseQuote("Q-SAMPLE-002", [1, 2, 3, 4, 5].map((line) => quotedLine(line)))],
  ["partial-quote.pdf", baseQuote("Q-SAMPLE-003", [quotedLine(1), unavailableLine(2)])],
  ["long-15-line.pdf", baseQuote("Q-SAMPLE-004", Array.from({ length: 15 }, (_, index) => quotedLine(index + 1)))],
  ["long-descriptions-addresses.pdf", baseQuote("Q-SAMPLE-005", [quotedLine(1, "Long description: ".repeat(20))])],
] as const;

const outputDir = join(process.cwd(), "tmp", "pdf-samples");
await mkdir(outputDir, { recursive: true });
for (const [name, quote] of samples) {
  const document = createQuotePdfDocument(quote, now);
  const buffer = await renderToBuffer(<QuoteDocument document={document} />);
  await writeFile(join(outputDir, name), buffer);
  console.log(`Wrote ${join("tmp/pdf-samples", name)} (${buffer.length} bytes)`);
}
