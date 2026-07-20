export type QuotePdfPricedLine = {
  lineNumber: number;
  sku: string;
  productName: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  netAmount: number;
};

export type QuotePdfUnavailableLine = {
  lineNumber: number;
  requestedSku: string | null;
  requestedDescription: string;
  quantity: number;
  reason: string;
};

export type QuotePdfDocument = {
  title: string;
  fileName: string;
  issuedOn: string;
  validUntil: string;
  quote: {
    id: string;
    quoteNumber: string;
    revisionNumber: string;
    statusLabel: string;
    currencyCode: string;
    partialQuote: boolean;
  };
  company: {
    legalName: string;
    tradingName: string;
    addressLines: string[];
    email: string;
    phone: string;
    website: string;
  };
  customer: {
    name: string;
    legalName: string | null;
    billingAddressLines: string[];
    shippingAddressLines: string[];
    email: string | null;
    phone: string | null;
  };
  preparedBy: {
    name: string;
    title: string;
    email: string;
    phone: string;
  };
  quotedLines: QuotePdfPricedLine[];
  unavailableLines: QuotePdfUnavailableLine[];
  totals: {
    grossAmount: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
  };
  commercialTerms: {
    paymentTerms: string;
    quoteValidity: string;
    deliveryAndFulfilment: string;
    installationAndStartup: string;
  };
  notesAndAssumptions: string[];
  confidentialityNotice: string;
  termsReference: string;
  acceptanceInstructions: string;
  mockedFields: string[];
};
