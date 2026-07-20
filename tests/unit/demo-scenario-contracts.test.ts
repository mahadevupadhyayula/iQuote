import { describe, expect, it } from "vitest";

import { intakeSeedExamples } from "@/lib/fixtures/intake-seed-examples";
import { quoteIntakeSchema, quoteIntakeSeedIds } from "@/lib/schemas/quote-intake";
import { demoProducts, demoScenarioContracts, seededDiscountPolicies } from "@/lib/demo/scenario-contracts";
import { evaluateApprovalPolicy } from "@/lib/rules/approval-rules";
import { classifyIntakeBusinessReview } from "@/lib/rules/intake-classification-rules";
import { evaluateInventory, type InventoryRuleRecord } from "@/lib/rules/inventory-rules";
import { evaluateMarginFloor } from "@/lib/rules/margin-rules";
import { evaluateQuoteReadiness } from "@/lib/rules/readiness-rules";
import { calculateQuote } from "@/lib/services/quote-calculation-service";
import { workflowTransitions } from "@/lib/services/workflow-service";
import { resolvePricing } from "@/lib/rules/pricing-rules";
import type { QuoteStatus } from "@/lib/domain/quote-statuses";
import type { DemoScenarioContract } from "@/lib/demo/scenario-contracts";

const now = "2026-07-18T12:00:00.000Z";
const onDate = "2026-07-18";

const listPrices = [
  { id: "price-ax-200", productId: demoProducts.ax200.id, currencyCode: "USD", unitPrice: 1280, unitCost: 820, effectiveFrom: "2026-01-01", effectiveTo: null, sourceName: "supabase/seed.sql", sourceVersion: "atlas-northstar" },
  { id: "price-hx-500", productId: demoProducts.hx500.id, currencyCode: "USD", unitPrice: 3425, unitCost: 0, effectiveFrom: "2026-01-01", effectiveTo: "2026-09-30", sourceName: "supabase/seed.sql", sourceVersion: "atlas-northstar" },
];

const inventory: InventoryRuleRecord[] = [
  { productId: demoProducts.ax200.id, locationCode: "CHI-01", quantityOnHand: 12, quantityReserved: 2, reorderPoint: 4, updatedAt: now },
  { productId: demoProducts.ax200.id, locationCode: "DAL-02", quantityOnHand: 8, quantityReserved: 0, reorderPoint: 3, updatedAt: now },
  { productId: demoProducts.hx500.id, locationCode: "DEN-01", quantityOnHand: 3, quantityReserved: 1, reorderPoint: 2, updatedAt: now },
  { productId: demoProducts.hx500.id, locationCode: "SEA-01", quantityOnHand: 4, quantityReserved: 0, reorderPoint: 2, updatedAt: now },
];

const products = [demoProducts.ax200, demoProducts.ax200FilterKit, demoProducts.hx500].map(({ id, sku, name, status }) => ({ id, sku, name, status }));

const expectValidStatusPath = (path: QuoteStatus[]) => {
  for (let index = 0; index < path.length - 1; index += 1) {
    expect((workflowTransitions[path[index]] as Partial<Record<QuoteStatus, unknown>>)[path[index + 1]], `${path[index]} -> ${path[index + 1]}`).toBeDefined();
  }
};

describe("demo scenario contracts", () => {
  it.each(demoScenarioContracts)("asserts Scenario $id against deterministic rules and services", (contract: DemoScenarioContract) => {
    const product = products.find((candidate) => candidate.sku === contract.input.line.sku);
    if (contract.id === "E") {
      expect(product).toBeUndefined();
      expect(contract.expected.productMatch).toMatchObject({ sku: "ZX-999-UNKNOWN", confidenceBps: 0 });
      return;
    }
    expect(product).toBeDefined();
    expect({ productId: product?.id, sku: product?.sku, method: "sku", confidenceBps: 10_000 }).toEqual(contract.expected.productMatch);

    const pricing = resolvePricing({
      productId: contract.expected.productMatch.productId,
      customerId: contract.input.customerId,
      quantity: contract.input.line.quantity,
      currencyCode: contract.input.currencyCode,
      onDate,
      listPrices,
    });
    expect(pricing).toMatchObject({ unitPrice: contract.expected.price.unitPriceCents / 100, currencyCode: "USD", blocked: false });
    expect(pricing.provenance).toMatchObject({ priceType: contract.expected.price.priceType, effectiveFrom: contract.expected.price.effectiveFrom, effectiveTo: contract.expected.price.effectiveTo });

    const inventoryDecision = evaluateInventory({ product: product!, quantity: contract.input.line.quantity, inventory, now });
    expect({
      status: inventoryDecision.status,
      blocked: inventoryDecision.blocked,
      availableQuantity: inventoryDecision.availableQuantity,
      fulfillment: inventoryDecision.fulfillment.map(({ locationCode, quantity, availableQuantity }) => ({ locationCode, quantity, availableQuantity })),
    }).toEqual(contract.expected.inventoryDecision);

    const calculation = calculateQuote([
      {
        lineId: contract.id,
        quantity: contract.input.line.quantity,
        unitPriceCents: contract.expected.price.unitPriceCents,
        unitCostCents: contract.input.line.unitCostCents,
        discountBps: contract.expected.discountDecision.approvedDiscountBps,
        marginFloorBps: 3_000,
      },
    ]);
    expect(calculation).toMatchObject(contract.expected.finalTotals);

    const approval = evaluateApprovalPolicy({
      requestedDiscountBps: contract.expected.discountDecision.requestedDiscountBps,
      projectedMarginBps: calculation.grossMarginBps,
      policies: seededDiscountPolicies,
    });
    expect(approval).toMatchObject({ requirement: contract.expected.discountDecision.approvalRequirement, requiredRole: contract.expected.discountDecision.requiredRole });

    const readinessInventoryDecisions = contract.id === "D" ? [inventoryDecision] : [inventoryDecision];
    const readiness = evaluateQuoteReadiness({
      customerId: contract.input.customerId,
      currencyCode: contract.input.currencyCode,
      lines: [{ productId: product!.id, sku: product!.sku, description: product!.name, quantity: contract.input.line.quantity }],
      products,
      prices: [{
        productId: product!.id,
        unitPrice: contract.expected.price.unitPriceCents / 100,
        unitCost: contract.input.line.unitCostCents / 100,
        currencyCode: "USD",
        sourceName: "supabase/seed.sql",
        sourceVersion: "atlas-northstar",
        effectiveFrom: contract.expected.price.effectiveFrom,
        effectiveTo: contract.expected.price.effectiveTo,
      }],
      inventoryDecisions: readinessInventoryDecisions,
      marginPolicy: evaluateMarginFloor({ sellPriceCents: calculation.sellPriceCents, costCents: calculation.costCents, floorBps: contract.id === "B" ? 2_500 : 3_000 }),
      commercialCalculation: { subtotalAmount: calculation.subtotalCents / 100, discountAmount: calculation.discountAmountCents / 100, totalAmount: calculation.sellPriceCents / 100, grossMarginBps: calculation.grossMarginBps },
      discountPolicyEvaluation: approval,
      approvals: contract.expected.discountDecision.requiredRole ? [{ requiredRole: contract.expected.discountDecision.requiredRole, status: "approved" }] : [],
      paymentTerms: { accepted: true, termsCode: "NET30" },
      slaDueAt: contract.input.validUntil,
      onDate,
    });
    expect({ ready: readiness.ready, status: readiness.status, blockerCodes: readiness.blockers.map((blocker) => blocker.code) }).toEqual(contract.expected.readinessResult);
    expectValidStatusPath(contract.expected.quoteStatusPath);
  });

  it("classifies successful extraction outcomes without using technical failure labels", () => {
    const baseExtraction = { missing_fields: [], ambiguities: [], clarification_questions: [] };
    expect(classifyIntakeBusinessReview({ extraction: baseExtraction as never, productResolutions: [{ product: demoProducts.ax200 } as never], inventoryDecisions: [{ blocked: false, status: "single_warehouse" } as never] })).toBe("ready_for_review");
    expect(classifyIntakeBusinessReview({ extraction: baseExtraction as never, productResolutions: [{ product: demoProducts.ax200 } as never], inventoryDecisions: [{ blocked: false, status: "single_warehouse" } as never], approvalRequired: true })).toBe("approval_required");
    expect(classifyIntakeBusinessReview({ extraction: { ...baseExtraction, ambiguities: [{ field: "installation_requirement", description: "ambiguous" }], clarification_questions: [{ field: "installation_requirement", question: "Clarify installation?" }] } as never })).toBe("clarification_required");
    expect(classifyIntakeBusinessReview({ extraction: baseExtraction as never, productResolutions: [{ product: null } as never] })).toBe("unresolved_product");
    expect(classifyIntakeBusinessReview({ extraction: baseExtraction as never, productResolutions: [{ product: demoProducts.ax200 } as never], inventoryDecisions: [{ blocked: true, status: "backordered" } as never] })).toBe("inventory_shortage");
    expect(classifyIntakeBusinessReview({ extraction: null })).toBe("technical_extraction_failure");
  });
});

describe("intake seed examples", () => {
  it("keeps exported seed identifiers aligned with fixture ids", () => {
    expect(intakeSeedExamples.map((example) => example.id)).toEqual([
      ...quoteIntakeSeedIds,
    ]);
  });

  it("keeps every intake seed valid for the quote intake schema", () => {
    for (const example of intakeSeedExamples) {
      expect(
        quoteIntakeSchema.safeParse({
          ...example.metadata,
          requestText: example.requestText,
          seededScenarioId: example.id,
        }).success,
        example.id,
      ).toBe(true);
    }
  });

  it("covers all five requested quote-intake demo scenarios", () => {
    expect(intakeSeedExamples.map((example) => example.label)).toEqual([
      "Standard quote — ready for review",
      "Large discount — approval required",
      "Ambiguous requirements — clarification needed",
      "Insufficient stock — fulfillment review",
      "Unknown SKU — product review",
    ]);
    expect(intakeSeedExamples[0].requestText).toContain("SKU AX-200-FKIT");
    expect(intakeSeedExamples[1].requestText).toContain("12% discount");
    expect(intakeSeedExamples[2].requestText).toContain("clarify the installation approach");
    expect(intakeSeedExamples[3].requestText).toContain("19 units of SKU AX-200");
    expect(intakeSeedExamples[4].requestText).toContain("ZX-999-UNKNOWN");
  });
});

describe("demo reset seed payloads", () => {
  it("uses warehouse_code, not location_code, in direct inventory seed payloads", async () => {
    const source = await import("node:fs/promises").then((fs) => fs.readFile("lib/services/demo-reset-service.ts", "utf8"));
    const inventorySection = source.slice(source.indexOf("const inventory = ["), source.indexOf("const discountPolicies"));
    expect(inventorySection).toContain("warehouse_code");
    expect(inventorySection).not.toContain("location_code");
  });
});
