import { describe, expect, it, vi } from "vitest";

import { createQuoteFoundationService } from "@/lib/services/quote-foundation-service";

const timestamp = "2026-07-18T12:00:00.000Z";
const customer = { id: "11111111-1111-4111-8111-111111111111", external_id: "C-1", name: "Acme", legal_name: null, domain: null, billing_email: null, phone: null, billing_address: {}, shipping_address: {}, metadata: { tier: "gold" }, created_at: timestamp, updated_at: timestamp };
const product = { id: "22222222-2222-4222-8222-222222222222", sku: "SKU-1", name: "Widget", description: null, status: "active" as const, unit_of_measure: "ea", metadata: {}, created_at: timestamp, updated_at: timestamp };
const price = { id: "33333333-3333-4333-8333-333333333333", product_id: product.id, currency_code: "USD", unit_price: 100, effective_from: "2026-01-01", effective_to: null, price_type: "list" as const, customer_tier: null, customer_id: null, unit_cost: 60, source_name: "manual", source_version: "1", created_at: timestamp };
const discountPolicy = { id: "44444444-4444-4444-8444-444444444444", name: "Standard", description: null, policy_type: "percent_off" as const, discount_bps: 500, max_discount_bps: 1_000, amount_off: 0, conditions: {}, minimum_margin_bps: 2_000, starts_on: null, ends_on: null, active: true, metadata: {}, created_at: timestamp, updated_at: timestamp };
const quote = { id: "55555555-5555-4555-8555-555555555555", opportunity_id: null, customer_id: customer.id, quote_number: "Q-1", status: "draft" as const, currency_code: "USD", subtotal_amount: 200, discount_amount: 10, tax_amount: 0, total_amount: 190, valid_until: null, submitted_at: null, approved_at: null, sent_at: null, accepted_at: null, sla_due_at: null, metadata: {}, created_at: timestamp, updated_at: timestamp };
const updatedQuote = { ...quote, status: "approved" as const, approved_at: timestamp };
const item = { id: "66666666-6666-4666-8666-666666666666", quote_id: quote.id, product_id: product.id, line_number: 1, sku: product.sku, description: product.name, quantity: 2, unit_price: 100, discount_bps: 500, discount_amount: 10, line_total_amount: 190, metadata: {}, created_at: timestamp };
const event = { id: "77777777-7777-4777-8777-777777777777", quote_id: quote.id, event_type: "approved" as const, actor_id: null, from_status: "draft" as const, to_status: "approved" as const, payload: {}, created_at: timestamp, idempotency_key: null };

const repositories = () => ({
  customers: { findById: vi.fn(async () => customer), findByExternalId: vi.fn(), findByName: vi.fn() },
  products: { findBySku: vi.fn(async () => product), findByAlias: vi.fn(), findReplacement: vi.fn(async () => null), listSubstitutes: vi.fn(async () => []) },
  prices: { findCustomerSpecificPrice: vi.fn(async () => null), findCustomerTierPrice: vi.fn(async () => null), findListPrice: vi.fn(async () => price), listActiveDiscountPolicies: vi.fn(async () => [discountPolicy]) },
  inventory: { listByProduct: vi.fn(async () => [{ id: "88888888-8888-4888-8888-888888888888", product_id: product.id, location_code: "WH-1", quantity_on_hand: 10, quantity_reserved: 1, reorder_point: 1, source_name: "erp", source_version: "1", refreshed_at: timestamp, updated_at: timestamp }]), listByProducts: vi.fn(async () => []), findAtLocation: vi.fn() },
  quotes: { createQuote: vi.fn(async () => quote), addItems: vi.fn(async () => [item]), findById: vi.fn(async () => ({ ...quote, items: [item] })), updateStatus: vi.fn(async () => updatedQuote) },
  approvals: { request: vi.fn() },
  workflowEvents: { findByIdempotencyKey: vi.fn(async () => null), record: vi.fn(async () => event) },
});

describe("quote foundation service", () => {
  it("runs the phase 1 acceptance flow through repositories and workflow service", async () => {
    const repo = repositories();
    const result = await createQuoteFoundationService({ repositories: repo, now: () => new Date(timestamp), quoteNumber: () => "Q-1" }).accept({
      customerId: customer.id,
      lines: [{ sku: product.sku, quantity: 2, requestedDiscountBps: 500 }],
    });

    expect(repo.customers.findById).toHaveBeenCalledWith(customer.id);
    expect(repo.products.findBySku).toHaveBeenCalledWith(product.sku);
    expect(repo.prices.findListPrice).toHaveBeenCalledWith({ productId: product.id, currencyCode: "USD", onDate: "2026-07-18" });
    expect(repo.inventory.listByProduct).toHaveBeenCalledWith(product.id);
    expect(repo.quotes.createQuote).toHaveBeenCalledWith(expect.objectContaining({ subtotal_amount: 200, discount_amount: 10, total_amount: 190 }));
    expect(repo.quotes.addItems).toHaveBeenCalledWith(quote.id, [expect.objectContaining({ sku: product.sku, line_total_amount: 190 })]);
    expect(repo.approvals.request).not.toHaveBeenCalled();
    expect(repo.quotes.updateStatus).toHaveBeenCalledWith(quote.id, "approved", { approved_at: timestamp });
    expect(repo.workflowEvents.record).toHaveBeenCalledWith(expect.objectContaining({ event_type: "approved", payload: expect.objectContaining({ action: "phase_1_acceptance" }) }));
    expect(result).toMatchObject({ customer, quote: updatedQuote, items: [item], approvals: [], approvalEvaluation: { requirement: "straight_through" } });
    expect(result.lines[0].inventoryDecision.status).toBe("single_warehouse");
    expect(result.calculation.grossMarginBps).toBe(3684);
  });
});
