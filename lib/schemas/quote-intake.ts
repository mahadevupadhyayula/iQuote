import { z } from "zod";

export const quoteIntakeSeedIds = [
  "atlas-install-ambiguity",
  "northwind-filter-kits",
  "contoso-budgetary-quote",
] as const;

export type QuoteIntakeSeedId = (typeof quoteIntakeSeedIds)[number];

export const quoteIntakeSchema = z.object({
  customerName: z.string().trim().min(2, "Enter a customer name."),
  customerEmail: z.string().trim().email("Enter a valid customer email."),
  companyDomain: z.string().trim().optional(),
  opportunityName: z.string().trim().optional(),
  currencyCode: z.string().trim().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code.").default("USD"),
  validUntil: z.string().trim().optional(),
  requestText: z.string().trim().min(20, "Paste at least 20 characters from the customer request."),
  attachmentName: z.string().trim().optional(),
  seededScenarioId: z.enum(quoteIntakeSeedIds).optional(),
});

export type QuoteIntakeInput = z.infer<typeof quoteIntakeSchema>;
