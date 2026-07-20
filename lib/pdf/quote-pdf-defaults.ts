export const quotePdfDefaults = {
  company: {
    legalName: "iQuote Industrial Solutions, Inc.",
    tradingName: "iQuote",
    addressLines: ["100 Market Street, Suite 500", "San Francisco, CA 94105", "United States"],
    email: "quotes@iquote.example",
    phone: "+1 (555) 010-1000",
    website: "www.iquote.example",
  },
  preparedBy: {
    name: "Alex Morgan",
    title: "Commercial Solutions Manager",
    email: "alex.morgan@iquote.example",
    phone: "+1 (555) 010-1024",
  },
  paymentTerms: "Net 30 days from the invoice date.",
  deliveryAndFulfilment:
    "Estimated dispatch within 5-7 business days after order confirmation, subject to inventory availability and final order validation.",
  installationAndStartup:
    "Installation and startup support are not included unless explicitly stated. Customer installation is assumed by default.",
  quoteValidityDays: 30,
  notesAndAssumptions: [
    "Prices exclude freight, duties and applicable taxes unless explicitly stated.",
    "Product availability is subject to change until the customer order is confirmed.",
    "Standard catalogue specifications apply unless custom requirements are explicitly listed.",
    "Delivery estimates begin after receipt of an accepted purchase order and any required approvals.",
  ],
  confidentialityNotice: "Confidential - prepared solely for the named customer.",
  termsReference: "iQuote Standard Commercial Terms v1.0 apply.",
  acceptanceInstructions:
    "To accept this quote, issue a purchase order referencing the quote number shown on this document.",
} as const;
