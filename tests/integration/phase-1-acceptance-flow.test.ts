import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { evaluateApprovalPolicy } from "@/lib/rules/approval-rules";
import { evaluateInventory } from "@/lib/rules/inventory-rules";
import { calculateQuote } from "@/lib/services/quote-calculation-service";
import { createWorkflowService } from "@/lib/services/workflow-service";
import { demoScenarioContracts, seededDiscountPolicies } from "@/lib/demo/scenario-contracts";
import type { QuoteStatus } from "@/lib/domain/quote-statuses";
import type { QuoteWithItems } from "@/lib/repositories/quotes";
import type { WorkflowEventCreateInput } from "@/lib/repositories/workflow-events";

const now = "2026-07-18T12:00:00.000Z";
const quoteId = "91000000-0000-4000-8000-000000000001";
const eventId = "92000000-0000-4000-8000-000000000001";

const inventoryBySku: Record<string, Parameters<typeof evaluateInventory>[0]["inventory"]> = {
  "AX-200": [{ productId: "20000000-0000-4000-8000-000000000200", locationCode: "CHI-01", quantityOnHand: 12, quantityReserved: 2, reorderPoint: 4, updatedAt: now, refreshedAt: now }],
  "HX-500": [
    { productId: "20000000-0000-4000-8000-000000000500", locationCode: "SEA-01", quantityOnHand: 4, quantityReserved: 0, reorderPoint: 2, updatedAt: now, refreshedAt: now },
    { productId: "20000000-0000-4000-8000-000000000500", locationCode: "DEN-01", quantityOnHand: 3, quantityReserved: 1, reorderPoint: 2, updatedAt: now, refreshedAt: now },
  ],
};

const buildQuote = (status: QuoteStatus, contract: (typeof demoScenarioContracts)[number], totals: ReturnType<typeof calculateQuote>): QuoteWithItems => ({
  id: quoteId,
  opportunity_id: null,
  customer_id: contract.input.customerId,
  quote_number: `Q-P1-${contract.id}`,
  status,
  currency_code: "USD",
  subtotal_amount: totals.subtotalCents,
  discount_amount: totals.discountAmountCents,
  tax_amount: 0,
  total_amount: totals.sellPriceCents,
  valid_until: contract.input.validUntil,
  submitted_at: null,
  approved_at: null,
  sent_at: null,
  accepted_at: null,
  metadata: { grossMarginBps: totals.grossMarginBps },
  created_at: now,
  updated_at: now,
  items: [{ id: "93000000-0000-4000-8000-000000000001", quote_id: quoteId, product_id: contract.expected.productMatch.productId, line_number: 1, sku: contract.expected.productMatch.sku, description: contract.input.line.description, quantity: contract.input.line.quantity, unit_price: contract.expected.price.unitPriceCents, discount_bps: contract.expected.discountDecision.approvedDiscountBps, discount_amount: totals.discountAmountCents, line_total_amount: totals.sellPriceCents, metadata: {}, created_at: now }],
});

describe("server-side Phase 1 acceptance flow", () => {
  it("resolves trusted source data, calculates commercial totals, evaluates approval, and persists quote workflow", async () => {
    const contract = demoScenarioContracts[0];
    const customer = { id: contract.input.customerId, external_id: contract.input.customerExternalId, name: contract.input.customerName, metadata: { customer_tier: "gold" } };
    const product = { id: contract.expected.productMatch.productId, sku: contract.expected.productMatch.sku, name: contract.input.line.description, status: "active" as const, metadata: {} };
    const price = { ...contract.expected.price, sourceName: "demo_erp_pricebook", sourceVersion: "2026.07.18" };

    const inventoryDecision = evaluateInventory({ product, quantity: contract.input.line.quantity, inventory: inventoryBySku[product.sku], now, allowSplitFulfillment: true });
    const totals = calculateQuote([{ quantity: contract.input.line.quantity, unitPriceCents: price.unitPriceCents, unitCostCents: contract.input.line.unitCostCents, discountBps: contract.expected.discountDecision.approvedDiscountBps }]);
    const approval = evaluateApprovalPolicy({ requestedDiscountBps: contract.input.line.requestedDiscountBps, projectedMarginBps: totals.grossMarginBps, policies: seededDiscountPolicies });

    let storedQuote = buildQuote("draft", contract, totals);
    const events: unknown[] = [];
    const workflow = createWorkflowService({
      quotesRepository: { findById: vi.fn(async () => storedQuote), updateStatus: vi.fn(async (_id: string, status: QuoteStatus, timestamps: Partial<QuoteWithItems>) => (storedQuote = { ...storedQuote, status, ...timestamps })) } as never,
      workflowEventsRepository: { listByQuote: vi.fn(async () => events), findByIdempotencyKey: vi.fn(async () => null), record: vi.fn(async (input: WorkflowEventCreateInput) => { const event = { id: eventId, created_at: now, ...input }; events.push(event); return event; }) } as never,
      now: () => new Date(now),
    });

    expect(customer).toMatchObject({ external_id: "DEMO-CUST-ATLAS" });
    expect(product).toMatchObject({ sku: "AX-200" });
    expect(price).toMatchObject({ unitPriceCents: 128000, priceType: "list" });
    expect(inventoryDecision).toMatchObject(contract.expected.inventoryDecision);
    expect(totals).toMatchObject(contract.expected.finalTotals);
    expect(approval).toMatchObject({ requirement: "straight_through", requiredRole: null, blocked: false });

    const approved = await workflow.transitionQuote({ quoteId, toStatus: "approved", payload: { action: "straight_through", customer, price, inventoryDecision }, idempotencyKey: "p1-approve" });
    const sent = await workflow.transitionQuote({ quoteId, toStatus: "sent", payload: { action: "send_quote" }, idempotencyKey: "p1-send" });

    expect(approved.quote.status).toBe("approved");
    expect(sent.quote.status).toBe("sent");
    expect(events).toHaveLength(2);
  });
});
