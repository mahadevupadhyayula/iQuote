import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createQuoteWorkspaceQueryService } from "@/lib/services/quote-workspace-query-service";
import { allInventoryConfirmed } from "@/lib/services/quote-pricing-resolution-service";
import type { QuoteWithItems } from "@/lib/repositories/quotes";

const timestamp = "2026-07-18T12:00:00.000Z";
const quoteId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333333";

const quote: QuoteWithItems = {
  id: quoteId,
  opportunity_id: "44444444-4444-4444-8444-444444444444",
  customer_id: customerId,
  quote_number: "Q-1000",
  status: "pending_approval",
  currency_code: "USD",
  subtotal_amount: 1000,
  discount_amount: 100,
  tax_amount: 0,
  total_amount: 900,
  valid_until: "2026-07-25",
  submitted_at: timestamp,
  approved_at: null,
  sent_at: null,
  accepted_at: null,
  sla_due_at: "2026-07-19T12:00:00.000Z",
  metadata: {
    internal_notes: "Rep-only note",
    margin_floor_bps: 3000,
    sla: { started_at: "2026-07-18T12:00:00.000Z", due_at: "2026-07-19T12:00:00.000Z", policy_minutes: 1440 },
    payment_terms: { accepted: true, termsCode: "NET30" },
  },
  created_at: timestamp,
  updated_at: timestamp,
  items: [
    {
      id: "55555555-5555-4555-8555-555555555555",
      quote_id: quoteId,
      product_id: productId,
      line_number: 1,
      sku: "SKU-1",
      description: "Customer-safe product",
      quantity: 2,
      unit_price: 500,
      discount_bps: 1000,
      discount_amount: 100,
      line_total_amount: 900,
      metadata: {
        unit_cost: 275,
        internal_notes: "Line-only note",
        inventory_decision: { status: "available", blocked: false, productId },
      },
      created_at: timestamp,
    },
  ],
};

const customer = {
  id: customerId,
  external_id: null,
  name: "Acme Corp",
  legal_name: "Acme Corp LLC",
  domain: "acme.example",
  billing_email: "billing@acme.example",
  phone: "555-0100",
  billing_address: { line1: "1 Main" },
  shipping_address: { line1: "1 Main" },
  metadata: { internal_segment: "enterprise" },
  created_at: timestamp,
  updated_at: timestamp,
};

const repositories = {
  quotes: { findById: vi.fn(async () => quote) },
  customers: { findById: vi.fn(async () => customer) },
  products: { findById: vi.fn(async () => ({ id: productId, sku: "SKU-1", name: "Customer-safe product", status: "active", description: null, unit_of_measure: "ea", metadata: {}, created_at: timestamp, updated_at: timestamp })) },
  prices: { listCurrentPrices: vi.fn(async () => [{ id: "66666666-6666-4666-8666-666666666666", product_id: productId, currency_code: "USD", unit_price: 500, effective_from: "2026-01-01", effective_to: null, created_at: timestamp }]) },
  approvals: { listByQuote: vi.fn(async () => [{ id: "77777777-7777-4777-8777-777777777777", quote_id: quoteId, required_role: "sales_director", status: "pending", requested_by: "88888888-8888-4888-8888-888888888888", approver_id: null, requested_at: timestamp, decided_at: null, comments: "Internal approval comment", metadata: { threshold: 2500 } }]) },
  workflowEvents: { listByQuote: vi.fn(async () => [{ id: "99999999-9999-4999-8999-999999999999", quote_id: quoteId, event_type: "submitted_for_approval", actor_id: null, from_status: "draft", to_status: "pending_approval", payload: { action: "submit" }, created_at: timestamp }]) },
};

describe("quote workspace query service", () => {
  it("returns a customer-facing quote without internal pricing, approval, workflow, or notes", async () => {
    const view = await createQuoteWorkspaceQueryService(repositories as never).getCustomerQuote(quoteId);

    expect(view).toMatchObject({ quoteNumber: "Q-1000", totalAmount: 900, lines: [{ unitPrice: 500, lineTotalAmount: 900 }] });
    expect(JSON.stringify(view)).not.toContain("unitCost");
    expect(JSON.stringify(view)).not.toContain("lineCost");
    expect(JSON.stringify(view)).not.toContain("grossProfit");
    expect(JSON.stringify(view)).not.toContain("grossMargin");
    expect(JSON.stringify(view)).not.toContain("approvalStatus");
    expect(JSON.stringify(view)).not.toContain("workflowEvents");
    expect(JSON.stringify(view)).not.toContain("Rep-only note");
    expect(JSON.stringify(view)).not.toContain("Line-only note");
  });

  it("returns an internal rep workspace with readiness, margin, approvals, SLA, and workflow events", async () => {
    const view = await createQuoteWorkspaceQueryService(repositories as never, () => new Date(timestamp)).getInternalWorkspace(quoteId);

    expect(view?.readiness.status).toBe("requires_approval");
    expect(view?.margin).toMatchObject({ costAmount: 550, grossProfitAmount: 350, grossMarginBps: 3889, floorBps: 3000, floorPasses: true });
    expect(view?.approvalStatus).toMatchObject({ status: "pending", pendingCount: 1, requiredRoles: ["sales_director"] });
    expect(view?.sla).toMatchObject({ startedAt: "2026-07-18T12:00:00.000Z", dueAt: "2026-07-19T12:00:00.000Z", policyMinutes: 1440, breached: false, minutesRemaining: 1440, source: "metadata" });
    expect(view?.workflowEvents).toHaveLength(1);
    expect(view?.lines[0]).toMatchObject({ unitCost: 275, lineCost: 550, grossProfit: 350, grossMarginBps: 3889, internalNotes: "Line-only note" });
    expect(view?.internalNotes).toBe("Rep-only note");
  });

  it("falls back to the explicit SLA due column when nested metadata does not provide a due time", async () => {
    const columnQuote = { ...quote, metadata: { margin_floor_bps: 3000, payment_terms: { accepted: true, termsCode: "NET30" } } };
    const columnRepositories = { ...repositories, quotes: { findById: vi.fn(async () => columnQuote) } };

    const view = await createQuoteWorkspaceQueryService(columnRepositories as never, () => new Date(timestamp)).getInternalWorkspace(quoteId);

    expect(view?.sla).toMatchObject({ startedAt: null, dueAt: "2026-07-19T12:00:00.000Z", policyMinutes: null, breached: false, minutesRemaining: 1440, source: "column" });
  });

  it("uses the canonical completion rule for inventory and product-match readiness", async () => {
    const readyQuote = {
      ...quote,
      items: [{
        ...quote.items[0],
        metadata: {
          ...quote.items[0].metadata,
          product_match: { method: "sku", confidence: 1, ambiguous: false, product_id: productId },
          selected_inventory_decision: { status: "available" },
          selected_fulfillment: [{ warehouse: "MAIN", quantity: 2 }],
          inventory_confirmed_at: timestamp,
        },
      }],
    };
    const readyRepositories = { ...repositories, quotes: { findById: vi.fn(async () => readyQuote) } };

    const view = await createQuoteWorkspaceQueryService(readyRepositories as never, () => new Date(timestamp)).getInternalWorkspace(quoteId);

    expect(view?.configuration).toMatchObject({
      inventoryRequiredCount: 1,
      inventoryResolvedCount: 1,
      allInventorySelectionsApplied: true,
      allProductMatchesConfirmed: true,
      allInventoryConfirmed: true,
    });
    expect(view?.configuration.allInventoryConfirmed).toBe(allInventoryConfirmed(readyQuote.items));
  });

  it("reports product confirmation blockers instead of pending inventory when fulfilment is applied", async () => {
    const unresolvedQuote = {
      ...quote,
      items: [{
        ...quote.items[0],
        metadata: {
          ...quote.items[0].metadata,
          product_match: { method: "ai_suggestion", confidence: 1, ambiguous: false, product_id: productId },
          selected_inventory_decision: { status: "available" },
          selected_fulfillment: [{ warehouse: "MAIN", quantity: 2 }],
          inventory_confirmed_at: timestamp,
        },
      }],
    };
    const unresolvedRepositories = { ...repositories, quotes: { findById: vi.fn(async () => unresolvedQuote) } };

    const view = await createQuoteWorkspaceQueryService(unresolvedRepositories as never, () => new Date(timestamp)).getInternalWorkspace(quoteId);

    expect(view?.configuration).toMatchObject({ allInventorySelectionsApplied: true, allProductMatchesConfirmed: false, allInventoryConfirmed: false, pricingStatus: "pending_product_confirmation" });
  });

});
