import { describe, expect, it } from "vitest";

import { evaluateMarginFloor } from "@/lib/rules/margin-rules";
import { calculateQuote } from "@/lib/services/quote-calculation-service";

describe("quote calculation service", () => {
  it("calculates scenario A quote totals with integer cents and basis-point discounts", () => {
    const quote = calculateQuote([
      {
        lineId: "actuator",
        quantity: 10,
        unitPriceCents: 128_000,
        unitCostCents: 82_000,
        discountBps: 800,
        marginFloorBps: 3_000,
      },
      {
        lineId: "installation",
        quantity: 1,
        unitPriceCents: 65_000,
        unitCostCents: 45_000,
        discountBps: 1_500,
        marginFloorBps: 2_000,
      },
    ]);

    expect(quote.lines).toMatchObject([
      {
        lineId: "actuator",
        subtotalCents: 1_280_000,
        discountAmountCents: 102_400,
        sellPriceCents: 1_177_600,
        costCents: 820_000,
        grossProfitCents: 357_600,
        grossMarginBps: 3_036,
        marginFloorPasses: true,
      },
      {
        lineId: "installation",
        subtotalCents: 65_000,
        discountAmountCents: 9_750,
        sellPriceCents: 55_250,
        costCents: 45_000,
        grossProfitCents: 10_250,
        grossMarginBps: 1_855,
        marginFloorPasses: false,
      },
    ]);
    expect(quote).toMatchObject({
      subtotalCents: 1_345_000,
      discountAmountCents: 112_150,
      sellPriceCents: 1_232_850,
      costCents: 865_000,
      grossProfitCents: 367_850,
      grossMarginBps: 2_984,
    });
  });

  it("recalculates scenario B when line quantity and discounts change", () => {
    const original = calculateQuote([
      { lineId: "replacement", quantity: 2, unitPriceCents: 319_500, unitCostCents: 230_000, discountAmountCents: 25_000 },
    ]);
    const recalculated = calculateQuote([
      { lineId: "replacement", quantity: 3, unitPriceCents: 319_500, unitCostCents: 230_000, discountAmountCents: 25_000 },
    ]);

    expect(original).toMatchObject({
      subtotalCents: 639_000,
      discountAmountCents: 25_000,
      sellPriceCents: 614_000,
      costCents: 460_000,
      grossProfitCents: 154_000,
      grossMarginBps: 2_508,
    });
    expect(recalculated).toMatchObject({
      subtotalCents: 958_500,
      discountAmountCents: 25_000,
      sellPriceCents: 933_500,
      costCents: 690_000,
      grossProfitCents: 243_500,
      grossMarginBps: 2_608,
    });
  });

  it("treats the margin floor as inclusive at the boundary", () => {
    expect(evaluateMarginFloor({ sellPriceCents: 100_000, costCents: 70_000, floorBps: 3_000 })).toEqual({
      passes: true,
      grossMarginBps: 3_000,
      floorBps: 3_000,
    });
    expect(evaluateMarginFloor({ sellPriceCents: 100_000, costCents: 70_010, floorBps: 3_000 })).toEqual({
      passes: false,
      grossMarginBps: 2_999,
      floorBps: 3_000,
    });
  });

  it("returns explicit line-level and quote-level cents and basis-point totals", () => {
    const quote = calculateQuote([
      { lineId: "fractional", quantity: 2.5, unitPriceCents: 199, unitCostCents: 101, discountBps: 1_250 },
      { lineId: "fixed", quantity: 1, unitPriceCents: 250, unitCostCents: 100, discountAmountCents: 25 },
    ]);

    expect(quote.lines[0]).toMatchObject({
      lineSubtotalCents: 498,
      subtotalCents: 498,
      lineDiscountCents: 62,
      discountAmountCents: 62,
      lineNetTotalCents: 436,
      netTotalCents: 436,
      sellPriceCents: 436,
      extendedUnitCostCents: 253,
      costCents: 253,
      grossProfitCents: 183,
      grossMarginBps: 4_197,
    });
    expect(quote).toMatchObject({
      quoteSubtotalCents: 748,
      subtotalCents: 748,
      totalDiscountCents: 87,
      discountAmountCents: 87,
      netTotalCents: 661,
      sellPriceCents: 661,
      extendedUnitCostCents: 353,
      costCents: 353,
      grossProfitCents: 308,
      grossMarginBps: 4_660,
    });
  });

  it("documents deterministic half-up rounding without floating-point money arithmetic", () => {
    const quote = calculateQuote([
      { lineId: "rounding", quantity: 1.5, unitPriceCents: 101, unitCostCents: 67, discountBps: 333 },
    ]);

    expect(quote.lines[0]).toMatchObject({
      lineSubtotalCents: 152,
      lineDiscountCents: 5,
      lineNetTotalCents: 147,
      extendedUnitCostCents: 101,
      grossProfitCents: 46,
      grossMarginBps: 3_129,
    });
    expect(quote).toMatchObject({
      quoteSubtotalCents: 152,
      totalDiscountCents: 5,
      netTotalCents: 147,
      extendedUnitCostCents: 101,
      grossProfitCents: 46,
      grossMarginBps: 3_129,
    });
  });
});
