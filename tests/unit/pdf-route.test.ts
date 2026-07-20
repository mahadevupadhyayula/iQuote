import { Buffer } from "node:buffer";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createServerSupabaseClient: vi.fn(() => ({ mocked: true })) }));

const timestamp = "2026-07-18T12:00:00.000Z";
const quoteId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";

const approvedQuote = {
  id: quoteId,
  opportunity_id: "44444444-4444-4444-8444-444444444444",
  customer_id: customerId,
  quote_number: "Q-APPROVED-1",
  status: "approved",
  currency_code: "USD",
  subtotal_amount: 1000,
  discount_amount: 100,
  tax_amount: 72,
  total_amount: 972,
  valid_until: "2026-08-18",
  submitted_at: timestamp,
  approved_at: timestamp,
  sent_at: null,
  accepted_at: null,
  metadata: { payment_terms: { accepted: true, termsCode: "NET30" } },
  created_at: timestamp,
  updated_at: timestamp,
  items: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      quote_id: quoteId,
      product_id: productId,
      line_number: 1,
      sku: "SKU-APPROVED",
      description: "Approved customer-safe product",
      quantity: 2,
      unit_price: 500,
      discount_bps: 1000,
      discount_amount: 100,
      line_total_amount: 900,
      metadata: {},
      created_at: timestamp,
    },
  ],
};

const customer = {
  id: customerId,
  external_id: null,
  name: "Atlas Manufacturing",
  legal_name: "Atlas Manufacturing LLC",
  domain: "atlas.example",
  billing_email: "billing@atlas.example",
  phone: "555-0100",
  billing_address: { line1: "100 Industrial Way", city: "Dallas", state: "TX", postal_code: "75201" },
  shipping_address: { line1: "100 Industrial Way", city: "Dallas", state: "TX", postal_code: "75201" },
  metadata: {},
  created_at: timestamp,
  updated_at: timestamp,
};

const repositories = {
  quotes: { findById: vi.fn(async (id: string) => (id === quoteId ? approvedQuote : null)) },
  customers: { findById: vi.fn(async (id: string) => (id === customerId ? customer : null)) },
  workflowEvents: { record: vi.fn(async () => undefined) },
};

vi.mock("@/lib/repositories", () => ({ createRepositories: vi.fn(() => repositories) }));

import { GET } from "@/app/api/quotes/[quoteId]/pdf/route";

describe("quote PDF route", () => {
  it("returns a PDF response for a seeded approved quote", async () => {
    const response = await GET(new Request("http://localhost/api/quotes/11111111-1111-4111-8111-111111111111/pdf"), {
      params: Promise.resolve({ quoteId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('inline; filename="quote-Q-APPROVED-1.pdf"');
    expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(repositories.quotes.findById).toHaveBeenCalledWith(quoteId);
  });
});
