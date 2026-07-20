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

const atlasMetadata = {
  customerName: "Atlas Manufacturing",
  customerEmail: "procurement@atlas.example",
  companyDomain: "atlas.example",
  opportunityName: "Dallas Paint Line Expansion",
  currencyCode: "USD",
  validUntil: "2026-09-15",
  attachmentName: "atlas-dallas-rfq.eml",
} as const;

export const intakeSeedExamples = [
  {
    id: "standard-quote-ready-for-review",
    label: "Standard quote — ready for review",
    requestText: `Atlas Manufacturing is requesting a quote for the Dallas Paint Line Expansion.

Please quote:

* 4 units of SKU AX-200
* 2 units of SKU AX-200-FKIT

Deliver to Dallas, Texas by September 15, 2026.

Include standard vendor installation.

No additional discount is requested.
There are no other special requirements.`,
    metadata: atlasMetadata,
  },
  {
    id: "large-discount-approval-required",
    label: "Large discount — approval required",
    requestText: `Atlas Manufacturing is requesting a quote for the Dallas Paint Line Expansion.

Please quote 4 units of SKU AX-200.

Deliver to Dallas, Texas by September 15, 2026.
Include standard vendor installation.

Apply a 12% discount, which is above the seeded automatic-approval threshold and therefore requires commercial approval.

There are no other special requirements.`,
    metadata: atlasMetadata,
  },
  {
    id: "ambiguous-requirements-clarification-needed",
    label: "Ambiguous requirements — clarification needed",
    requestText: `Atlas Manufacturing needs AX-200 compressor equipment and matching spare filters for the Dallas Paint Line Expansion.

Delivery is needed around September 2026.

Atlas may handle installation internally, but procurement also wants to know whether vendor installation or startup support can be included.

Confirm the compatible filter product and clarify the installation approach before pricing approval.`,
    metadata: atlasMetadata,
  },
  {
    id: "insufficient-stock-fulfillment-review",
    label: "Insufficient stock — fulfillment review",
    requestText: `Atlas Manufacturing is requesting a quote for 19 units of SKU AX-200 for the Dallas Paint Line Expansion. This quantity exceeds the seeded available inventory of 18 units across the selected demo warehouses.

Deliver to Dallas, Texas by September 15, 2026.
Include standard vendor installation.
No discount is requested.
There are no other special requirements.`,
    metadata: atlasMetadata,
  },
  {
    id: "unknown-sku-product-review",
    label: "Unknown SKU — product review",
    requestText: `Atlas Manufacturing is requesting a quote for 3 units of SKU ZX-999-UNKNOWN for the Dallas Paint Line Expansion.

Deliver to Dallas, Texas by September 15, 2026.
No discount is requested.
There are no other special requirements.`,
    metadata: atlasMetadata,
  },
] as const satisfies readonly IntakeSeedExample[];

export const intakeSeedExampleById = Object.fromEntries(
  intakeSeedExamples.map((example) => [example.id, example]),
) as Record<QuoteIntakeSeedId, IntakeSeedExample>;
