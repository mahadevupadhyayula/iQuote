import "server-only";

import { Buffer } from "node:buffer";
import { renderToBuffer } from "@react-pdf/renderer";
import { QuoteDocument } from "@/lib/pdf/quote-pdf-component";
import { createQuotePdfDocument } from "@/lib/pdf/quote-document";
import type { CustomerQuoteViewModel } from "@/lib/services/quote-workspace-query-service";

export const renderQuotePdf = async (quote: CustomerQuoteViewModel, now = new Date()) => {
  const document = createQuotePdfDocument(quote, now);
  const rendered = await renderToBuffer(<QuoteDocument document={document} />);
  return { buffer: Buffer.isBuffer(rendered) ? rendered : Buffer.from(rendered), fileName: document.fileName, document };
};
