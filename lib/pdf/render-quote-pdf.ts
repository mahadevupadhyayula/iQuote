import "server-only";

import { Buffer } from "node:buffer";
import { createQuotePdfDocument, formatAddress, formatCurrency, formatDate, type QuotePdfDocument } from "@/lib/pdf/quote-document";
import type { CustomerQuoteViewModel } from "@/lib/services/quote-workspace-query-service";

type PdfText = { text: string; x: number; y: number; size?: number; color?: string; font?: "regular" | "bold" };
type PdfLine = { x1: number; y1: number; x2: number; y2: number; width?: number; color?: string };
type PdfRect = { x: number; y: number; width: number; height: number; color?: string; fill?: boolean };

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;

const escapePdf = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
const rgb = (hex = "#0f172a") => {
  const value = hex.replace("#", "");
  const parts = [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)].map((part) => parseInt(part, 16) / 255);
  return parts.map((part) => Number.isFinite(part) ? part.toFixed(3) : "0").join(" ");
};
const line = (x1: number, y1: number, x2: number, y2: number, color = "#cbd5e1", width = 1): PdfLine => ({ x1, y1, x2, y2, color, width });
const rect = (x: number, y: number, width: number, height: number, color = "#f8fafc", fill = true): PdfRect => ({ x, y, width, height, color, fill });
const text = (textValue: string, x: number, y: number, size = 10, color = "#0f172a", font: PdfText["font"] = "regular"): PdfText => ({ text: textValue, x, y, size, color, font });
const pdfY = (y: number) => PAGE_HEIGHT - y;

const toContentStream = (texts: PdfText[], lines: PdfLine[], rects: PdfRect[]) => {
  const commands: string[] = [];
  for (const item of rects) {
    commands.push(`${rgb(item.color)} ${item.fill ? "rg" : "RG"}`);
    commands.push(`${item.x} ${pdfY(item.y + item.height)} ${item.width} ${item.height} re ${item.fill ? "f" : "S"}`);
  }
  for (const item of lines) {
    commands.push(`${rgb(item.color)} RG ${item.width ?? 1} w ${item.x1} ${pdfY(item.y1)} m ${item.x2} ${pdfY(item.y2)} l S`);
  }
  for (const item of texts) {
    commands.push(`BT ${rgb(item.color)} rg /${item.font === "bold" ? "F2" : "F1"} ${item.size ?? 10} Tf ${item.x} ${pdfY(item.y)} Td (${escapePdf(item.text)}) Tj ET`);
  }
  return commands.join("\n");
};

const fit = (value: string, max = 64) => value.length <= max ? value : `${value.slice(0, max - 1)}…`;

const buildPage = (document: QuotePdfDocument) => {
  const { quote } = document;
  const texts: PdfText[] = [];
  const lines: PdfLine[] = [];
  const rects: PdfRect[] = [];
  rects.push(rect(0, 0, PAGE_WIDTH, 118, "#0f172a"));
  rects.push(rect(408, 40, 156, 82, "#22d3ee"));
  texts.push(text(document.company.name, MARGIN, 58, 24, "#ffffff", "bold"));
  texts.push(text(document.company.tagline, MARGIN, 78, 10, "#bae6fd"));
  texts.push(text("QUOTE", 428, 70, 24, "#083344", "bold"));
  texts.push(text(quote.quoteNumber, 428, 94, 11, "#164e63", "bold"));

  texts.push(text("Prepared for", MARGIN, 150, 10, "#64748b", "bold"));
  texts.push(text(quote.customer?.legal_name ?? quote.customer?.name ?? "Customer", MARGIN, 170, 16, "#0f172a", "bold"));
  const billing = formatAddress(quote.customer?.billing_address);
  billing.slice(0, 4).forEach((addressLine, index) => texts.push(text(addressLine, MARGIN, 190 + index * 14, 9, "#475569")));
  if (quote.customer?.billing_email) texts.push(text(quote.customer.billing_email, MARGIN, 250, 9, "#475569"));
  if (quote.customer?.phone) texts.push(text(quote.customer.phone, MARGIN, 264, 9, "#475569"));

  const metaX = 384;
  texts.push(text("Issued", metaX, 150, 9, "#64748b", "bold"));
  texts.push(text(formatDate(document.issuedOn), metaX + 74, 150, 9));
  texts.push(text("Valid until", metaX, 168, 9, "#64748b", "bold"));
  texts.push(text(formatDate(quote.validUntil), metaX + 74, 168, 9));
  texts.push(text("Status", metaX, 186, 9, "#64748b", "bold"));
  texts.push(text(quote.status.replace(/_/g, " ").toUpperCase(), metaX + 74, 186, 9));

  let y = 316;
  rects.push(rect(MARGIN, y - 22, PAGE_WIDTH - MARGIN * 2, 28, "#e0f2fe"));
  texts.push(text("Item", MARGIN + 10, y - 4, 9, "#075985", "bold"));
  texts.push(text("Qty", 330, y - 4, 9, "#075985", "bold"));
  texts.push(text("Unit", 382, y - 4, 9, "#075985", "bold"));
  texts.push(text("Discount", 452, y - 4, 9, "#075985", "bold"));
  texts.push(text("Total", 520, y - 4, 9, "#075985", "bold"));
  y += 24;
  quote.lines.forEach((item) => {
    lines.push(line(MARGIN, y + 6, PAGE_WIDTH - MARGIN, y + 6, "#e2e8f0"));
    texts.push(text(`${item.lineNumber}. ${fit(item.description, 44)}`, MARGIN + 10, y, 9, "#0f172a", "bold"));
    texts.push(text(item.sku, MARGIN + 10, y + 14, 8, "#64748b"));
    texts.push(text(String(item.quantity), 330, y, 9));
    texts.push(text(formatCurrency(item.unitPrice, quote.currencyCode), 382, y, 9));
    texts.push(text(formatCurrency(item.discountAmount, quote.currencyCode), 452, y, 9));
    texts.push(text(formatCurrency(item.lineTotalAmount, quote.currencyCode), 520, y, 9, "#0f172a", "bold"));
    y += 42;
  });

  const totalsY = Math.max(y + 20, 580);
  lines.push(line(360, totalsY - 18, PAGE_WIDTH - MARGIN, totalsY - 18, "#94a3b8"));
  texts.push(text("Subtotal", 382, totalsY, 10, "#475569"));
  texts.push(text(formatCurrency(quote.subtotalAmount, quote.currencyCode), 500, totalsY, 10));
  texts.push(text("Discount", 382, totalsY + 20, 10, "#475569"));
  texts.push(text(formatCurrency(quote.discountAmount, quote.currencyCode), 500, totalsY + 20, 10));
  texts.push(text("Tax", 382, totalsY + 40, 10, "#475569"));
  texts.push(text(formatCurrency(quote.taxAmount, quote.currencyCode), 500, totalsY + 40, 10));
  rects.push(rect(368, totalsY + 54, 196, 34, "#0f172a"));
  texts.push(text("Total", 382, totalsY + 76, 12, "#ffffff", "bold"));
  texts.push(text(formatCurrency(quote.totalAmount, quote.currencyCode), 488, totalsY + 76, 12, "#ffffff", "bold"));

  texts.push(text("Thank you for the opportunity to earn your business.", MARGIN, 724, 10, "#334155", "bold"));
  texts.push(text(`${document.company.email}  •  ${document.company.phone}`, MARGIN, 742, 8, "#64748b"));
  return { texts, lines, rects };
};

export const renderQuotePdf = async (quote: CustomerQuoteViewModel, now = new Date()) => {
  const document = createQuotePdfDocument(quote, now);
  const page = buildPage(document);
  const stream = toContentStream(page.texts, page.lines, page.rects);
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return { buffer: Buffer.from(pdf, "utf8"), fileName: document.fileName };
};
