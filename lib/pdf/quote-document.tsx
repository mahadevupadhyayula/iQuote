import type { CustomerQuoteViewModel } from "@/lib/services/quote-workspace-query-service";

type Address = Record<string, unknown>;

export type QuotePdfDocument = {
  title: string;
  fileName: string;
  quote: CustomerQuoteViewModel;
  issuedOn: string;
  company: {
    name: string;
    tagline: string;
    email: string;
    phone: string;
  };
};

const readAddressLine = (address: Address | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = address?.[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
};

export const formatAddress = (address: Address | undefined) => {
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
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
};

export const createQuotePdfDocument = (quote: CustomerQuoteViewModel, issuedOn = new Date()): QuotePdfDocument => ({
  title: `Quote ${quote.quoteNumber}`,
  fileName: `quote-${quote.quoteNumber}.pdf`,
  quote,
  issuedOn: issuedOn.toISOString(),
  company: {
    name: "iQuote",
    tagline: "Customer-ready quote",
    email: "quotes@example.com",
    phone: "+1 (555) 010-1000",
  },
});

export function QuoteDocument({ document }: { document: QuotePdfDocument }) {
  return `${document.title} — ${document.company.tagline}`;
}
