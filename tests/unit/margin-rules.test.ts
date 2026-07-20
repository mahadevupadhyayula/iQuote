import { describe, expect, it } from "vitest";

import { calculateGrossMarginBps, calculateGrossProfitCents, evaluateMarginFloor } from "@/lib/rules/margin-rules";

describe("margin rules", () => {
  it("calculates gross profit and margin in cents and basis points", () => {
    expect(calculateGrossProfitCents(125_000, 80_000)).toBe(45_000);
    expect(calculateGrossMarginBps(125_000, 80_000)).toBe(3_600);
  });

  it("floors negative margin calculations at zero basis points", () => {
    expect(calculateGrossProfitCents(80_000, 95_000)).toBe(-15_000);
    expect(calculateGrossMarginBps(80_000, 95_000)).toBe(0);
  });

  it("passes margin floor checks at or above the policy threshold", () => {
    expect(evaluateMarginFloor({ sellPriceCents: 100_000, costCents: 70_000, floorBps: 3_000 })).toEqual({
      passes: true,
      grossMarginBps: 3_000,
      floorBps: 3_000,
    });
  });

  it("blocks margin floor checks below the policy threshold", () => {
    expect(evaluateMarginFloor({ sellPriceCents: 100_000, costCents: 76_000, floorBps: 2_500 })).toEqual({
      passes: false,
      grossMarginBps: 2_400,
      floorBps: 2_500,
    });
  });
});
