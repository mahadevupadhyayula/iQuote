import { quotePdfDefaults } from "@/lib/pdf/quote-pdf-defaults";
import type { QuotePdfDocument } from "@/lib/pdf/quote-pdf-types";
import type { CustomerQuoteViewModel } from "@/lib/services/quote-workspace-query-service";

type Address = Record<string, unknown>;
type Metadata = Record<string, unknown>;

export class QuotePdfNotReadyError extends Error {
  constructor(public readonly reason: "unresolved_lines" | "no_quotable_lines", message: string) {
    super(message);
    this.name = "QuotePdfNotReadyError";
  }
}

const object = (value: unknown): Metadata => value && typeof value === "object" && !Array.isArray(value) ? value as Metadata : {};
const string = (value: unknown) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const stringArray = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()) : [];
const addDays = (date: Date, days: number) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

const readAddressLine = (address: Address | undefined | null, keys: string[]) => {
  for (const key of keys) {
    const value = address?.[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
};

export const formatAddress = (address: Address | undefined | null) => {
  const line1 = readAddressLine(address, ["line1", "address1", "street", "street1"]);
  const line2 = readAddressLine(address, ["line2", "address2", "suite"]);
  const city = readAddressLine(address, ["city"]);
  const state = readAddressLine(address, ["state", "region", "province"]);
  const postal = readAddressLine(address, ["postal_code", "postalCode", "zip"]);
  const country = readAddressLine(address, ["country"]);
  const cityLine = [city, state, postal].filter(Boolean).join(", ");
  return [line1, line2, cityLine, country].filter((line): line is string => Boolean(line));
};

export const formatCurrency = (amount: number, currencyCode: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(amount);

export const formatDate = (value: string | null | undefined) => {
  if (!value) return "Not specified";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
};

const firstString = (sources: Array<[unknown, string]>, mocked: string[], fallback: string, fallbackField: string) => {
  for (const [value] of sources) {
    const resolved = string(value);
    if (resolved) return resolved;
  }
  mocked.push(fallbackField);
  return fallback;
};

const unique = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];
const statusLabel = (status: string) => status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
const sanitizeFile = (value: string) => `quote-${value}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");

const installationText = (value: string | null) => {
  if (value === "vendor_installation_requested") return "Vendor installation requested. Installation and startup support will be coordinated with the customer before fulfilment.";
  if (value === "customer_installed") return "Installation handled by customer. Startup support is not included unless explicitly stated.";
  if (value === "not_required") return "Installation not required for the quoted products.";
  return quotePdfDefaults.installationAndStartup;
};

export const createQuotePdfDocument = (quote: CustomerQuoteViewModel, issuedOn = new Date()): QuotePdfDocument => {
  const mockedFields: string[] = [];
  const metadata = object(quote.metadata);
  const workflow = object(metadata.reviewed_workflow ?? metadata.review ?? metadata.requirements);
  const commercial = object(object(metadata.requirements).commercial);
  const companyMetadata = object(metadata.company);
  const preparedByMetadata = object(metadata.prepared_by);

  if (quote.lines.some((line) => line.resolutionStatus === "unresolved")) {
    throw new QuotePdfNotReadyError("unresolved_lines", "Quote PDF is not available while requested lines remain unresolved.");
  }
  const quotedLines = quote.lines.filter((line) => line.resolutionStatus === "selected" && line.quotable);
  if (quotedLines.length === 0) {
    throw new QuotePdfNotReadyError("no_quotable_lines", "Quote PDF requires at least one quoted product.");
  }

  const issued = issuedOn.toISOString();
  const validUntil = quote.validUntil ? `${quote.validUntil}T00:00:00.000Z` : addDays(issuedOn, quotePdfDefaults.quoteValidityDays).toISOString();
  if (!quote.validUntil) mockedFields.push("validUntil");
  const revisionNumber = string(metadata.revision_number) ?? "Revision 1";
  if (!string(metadata.revision_number)) mockedFields.push("quote.revisionNumber");

  const customerName = quote.customer?.name ?? "Not specified";
  if (!quote.customer?.name) mockedFields.push("customer.name");
  const billingAddressLines = formatAddress(quote.customer?.billing_address);
  const shippingAddressLines = formatAddress(quote.customer?.shipping_address);
  if (billingAddressLines.length === 0) mockedFields.push("customer.billingAddressLines");

  const deliveryLocation = string(workflow.delivery_location) ?? string(commercial.delivery_location) ?? string(metadata.delivery_location) ?? (shippingAddressLines.length > 0 ? shippingAddressLines.join("\n") : null);
  const deliveryBase = string(workflow.delivery_and_fulfilment) ?? string(commercial.delivery_and_fulfilment) ?? string(metadata.delivery_and_fulfilment);
  const deliveryText = deliveryBase ?? quotePdfDefaults.deliveryAndFulfilment;
  if (!deliveryBase && !deliveryLocation) mockedFields.push("commercialTerms.deliveryAndFulfilment");

  const installationValue = string(workflow.installation_requirement) ?? string(commercial.installation_requirement) ?? string(metadata.installation_requirement);
  if (!installationValue) mockedFields.push("commercialTerms.installationAndStartup");
  const paymentTerms = string(workflow.payment_terms) ?? string(commercial.payment_terms) ?? string(metadata.payment_terms) ?? quotePdfDefaults.paymentTerms;
  if (paymentTerms === quotePdfDefaults.paymentTerms) mockedFields.push("commercialTerms.paymentTerms");

  const notes = unique([
    ...stringArray(metadata.customer_notes),
    ...stringArray(workflow.special_requirements),
    ...stringArray(commercial.special_requirements),
    ...quotePdfDefaults.notesAndAssumptions,
  ]);
  if (!metadata.customer_notes && !workflow.special_requirements && !commercial.special_requirements) mockedFields.push("notesAndAssumptions");

  const unavailableLines = quote.lines.filter((line) => line.resolutionStatus === "unavailable").map((line) => ({
    lineNumber: line.lineNumber,
    requestedSku: line.requestedSku,
    requestedDescription: line.requestedDescription || "Requested item",
    quantity: line.quantity,
    reason: line.unavailableReason ?? "Not currently available for this quote.",
  }));

  return {
    title: `Quote ${quote.quoteNumber}`,
    fileName: sanitizeFile(quote.quoteNumber),
    issuedOn: issued,
    validUntil,
    quote: { id: quote.id, quoteNumber: quote.quoteNumber, revisionNumber, statusLabel: statusLabel(quote.status), currencyCode: quote.currencyCode, partialQuote: unavailableLines.length > 0 },
    company: {
      legalName: firstString([[companyMetadata.legal_name, "metadata"], [companyMetadata.legalName, "metadata"]], mockedFields, quotePdfDefaults.company.legalName, "company.legalName"),
      tradingName: firstString([[companyMetadata.trading_name, "metadata"], [companyMetadata.tradingName, "metadata"]], mockedFields, quotePdfDefaults.company.tradingName, "company.tradingName"),
      addressLines: stringArray(companyMetadata.address_lines).length > 0 ? stringArray(companyMetadata.address_lines) : (mockedFields.push("company.addressLines"), [...quotePdfDefaults.company.addressLines]),
      email: firstString([[companyMetadata.email, "metadata"]], mockedFields, quotePdfDefaults.company.email, "company.email"),
      phone: firstString([[companyMetadata.phone, "metadata"]], mockedFields, quotePdfDefaults.company.phone, "company.phone"),
      website: firstString([[companyMetadata.website, "metadata"]], mockedFields, quotePdfDefaults.company.website, "company.website"),
    },
    customer: { name: customerName, legalName: quote.customer?.legal_name ?? null, billingAddressLines, shippingAddressLines, email: quote.customer?.billing_email ?? null, phone: quote.customer?.phone ?? null },
    preparedBy: {
      name: firstString([[workflow.prepared_by_name, "workflow"], [preparedByMetadata.name, "metadata"]], mockedFields, quotePdfDefaults.preparedBy.name, "preparedBy.name"),
      title: firstString([[workflow.prepared_by_title, "workflow"], [preparedByMetadata.title, "metadata"]], mockedFields, quotePdfDefaults.preparedBy.title, "preparedBy.title"),
      email: firstString([[workflow.prepared_by_email, "workflow"], [preparedByMetadata.email, "metadata"]], mockedFields, quotePdfDefaults.preparedBy.email, "preparedBy.email"),
      phone: firstString([[workflow.prepared_by_phone, "workflow"], [preparedByMetadata.phone, "metadata"]], mockedFields, quotePdfDefaults.preparedBy.phone, "preparedBy.phone"),
    },
    quotedLines: quotedLines.map((line) => ({ lineNumber: line.lineNumber, sku: line.selectedSku ?? line.sku, productName: line.selectedProductName ?? line.productName ?? line.description, description: line.catalogDescription ?? line.customerRequestedDescription, quantity: line.quantity, unitPrice: line.unitPrice, discountPercent: line.discountPercentage, discountAmount: line.discountAmount, netAmount: line.netAmount })),
    unavailableLines,
    totals: { grossAmount: quote.subtotalAmount, discountAmount: quote.discountAmount, taxAmount: quote.taxAmount, totalAmount: quote.totalAmount },
    commercialTerms: { paymentTerms, quoteValidity: `This quote is valid until ${formatDate(validUntil)}.`, deliveryAndFulfilment: [deliveryLocation ? `Delivery location:\n${deliveryLocation}` : null, `Delivery and fulfilment:\n${deliveryText}${unavailableLines.length > 0 ? " This applies only to products included in this commercial quote." : ""}`].filter(Boolean).join("\n\n"), installationAndStartup: installationText(installationValue) },
    notesAndAssumptions: notes,
    confidentialityNotice: quotePdfDefaults.confidentialityNotice,
    termsReference: quotePdfDefaults.termsReference,
    acceptanceInstructions: quotePdfDefaults.acceptanceInstructions.replace("the quote number", `quote ${quote.quoteNumber}`),
    mockedFields: unique(mockedFields),
  };
};
