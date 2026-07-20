import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { demoScenarioContracts, type DemoScenarioContract } from "@/lib/demo/scenario-contracts";
import { calculateQuote } from "@/lib/services/quote-calculation-service";

const seedDataDoc = readFileSync("docs/phase-1-seed-data.md", "utf8");
const scenario = (id: "A" | "B" | "C" | "D" | "E") => demoScenarioContracts.find((contract) => contract.id === id)!;

describe("Phase 1 seed-data arithmetic reconciliation", () => {
  it.each(demoScenarioContracts)("keeps scenario $id totals arithmetically reconciled to the seed-data document", (contract: DemoScenarioContract) => {
    if (contract.id === "E") return;
    const approvedDiscountBps = contract.input.line.approvedDiscountBps ?? contract.input.line.requestedDiscountBps;
    const calculation = calculateQuote([{ quantity: contract.input.line.quantity, unitPriceCents: contract.expected.price.unitPriceCents, unitCostCents: contract.input.line.unitCostCents, discountBps: approvedDiscountBps }]);

    expect(calculation).toMatchObject(contract.expected.finalTotals);
    expect(seedDataDoc).toContain(`| Unit price | \`${contract.expected.price.unitPriceCents}\` cents |`);
    expect(seedDataDoc).toContain(`| Quantity | \`${contract.input.line.quantity}\` |`);
    expect(seedDataDoc).toContain(`| Line subtotal | \`${contract.expected.finalTotals.subtotalCents}\` cents`);
    expect(seedDataDoc).toContain(`| Discount amount | \`${contract.expected.finalTotals.discountAmountCents}\` cents`);
    expect(seedDataDoc).toContain(`| Gross profit | \`${contract.expected.finalTotals.grossProfitCents}\` cents`);
  });

  it("documents seeded SKU, customer, price, and inventory rows used by the acceptance scenarios", () => {
    expect(seedDataDoc).toContain("`DEMO-CUST-ATLAS` / Atlas Manufacturing");
    expect(seedDataDoc).toContain("`DEMO-CUST-NORTHSTAR` / Northstar Mining");
    expect(seedDataDoc).toContain("`AX-200` = `128000` cents");
    expect(seedDataDoc).toContain("`HX-500` = `342500` cents");
    expect(scenario("A").expected.inventoryDecision.fulfillment).toEqual([{ locationCode: "CHI-01", quantity: 4, availableQuantity: 10 }]);
    expect(scenario("C").expected.inventoryDecision.fulfillment).toEqual([{ locationCode: "SEA-01", quantity: 4, availableQuantity: 4 }, { locationCode: "DEN-01", quantity: 2, availableQuantity: 2 }]);
  });
});
