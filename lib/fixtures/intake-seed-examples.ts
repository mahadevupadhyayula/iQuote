import type { QuoteIntakeSeedId } from "@/lib/schemas/quote-intake";

export type IntakeSeedExample = {
  id: QuoteIntakeSeedId;
  label: string;
  requestText: string;
  metadata: {
    customerName: string;
    customerEmail: string;
    companyDomain?: string;
    opportunityName?: string;
    currencyCode: "USD";
    validUntil?: string;
    attachmentName?: string;
  };
};

export const intakeSeedExamples = [
  {
    id: "atlas-install-ambiguity",
    label: "Atlas compressor request",
    requestText:
      "Atlas Manufacturing is requesting a quote for the Dallas Paint Line Expansion opportunity. Please include 4 AX-200 industrial compressor packages and 2 matching AX-200 spare filter kits if those are the correct compatible products. They need delivery to Dallas no later than September 15, 2026, or the earliest available delivery window if that date cannot be met. Installation is ambiguous: their facilities lead says Atlas may handle install internally, but procurement also asked whether vendor installation or startup support can be included. Please identify requested fields for customer, opportunity, product match, quantities, delivery constraint, installation requirement, and any clarifications before pricing approval.",
    metadata: {
      customerName: "Atlas Manufacturing",
      customerEmail: "procurement@atlas.example",
      companyDomain: "atlas.example",
      opportunityName: "Dallas Paint Line Expansion",
      currencyCode: "USD",
      validUntil: "2026-09-15",
      attachmentName: "atlas-dallas-rfq.eml",
    },
  },
  {
    id: "northwind-filter-kits",
    label: "Northwind filter kits",
    requestText:
      "Northwind Facilities requested 12 replacement filter kits for their Phoenix distribution center by October 3, 2026. They mentioned PO to follow and asked whether expedited delivery is available.",
    metadata: {
      customerName: "Northwind Facilities",
      customerEmail: "facilities@northwind.example",
      companyDomain: "northwind.example",
      opportunityName: "Phoenix Distribution Center Maintenance",
      currencyCode: "USD",
      validUntil: "2026-10-03",
      attachmentName: "northwind-filter-kit-request.pdf",
    },
  },
  {
    id: "contoso-budgetary-quote",
    label: "Contoso healthcare budgetary quote",
    requestText:
      "Contoso Healthcare needs a budgetary quote for 6 mobile workstations and 2 spare battery packs shipped to Boston before the end of the month. Payment terms and installation requirements are unclear.",
    metadata: {
      customerName: "Contoso Healthcare",
      customerEmail: "sourcing@contoso.example",
      companyDomain: "contoso.example",
      opportunityName: "Boston Clinical Mobility Refresh",
      currencyCode: "USD",
      attachmentName: "contoso-budgetary-request.docx",
    },
  },
] as const satisfies readonly IntakeSeedExample[];

export const intakeSeedExampleById = Object.fromEntries(
  intakeSeedExamples.map((example) => [example.id, example]),
) as Record<QuoteIntakeSeedId, IntakeSeedExample>;
