import type { BasisPoints, Cents } from "@/lib/utils/money";
import { assertBasisPoints, assertCents, ratioToBasisPoints } from "@/lib/utils/money";

export type MarginFloorResult = {
  passes: boolean;
  grossMarginBps: BasisPoints;
  floorBps: BasisPoints;
};

export const calculateGrossProfitCents = (sellPriceCents: Cents, costCents: Cents): Cents => {
  assertCents(sellPriceCents, "sellPriceCents");
  assertCents(costCents, "costCents");
  return sellPriceCents - costCents;
};

export const calculateGrossMarginBps = (sellPriceCents: Cents, costCents: Cents): BasisPoints => {
  const grossProfitCents = calculateGrossProfitCents(sellPriceCents, costCents);
  return ratioToBasisPoints(Math.max(grossProfitCents, 0), sellPriceCents);
};

export const evaluateMarginFloor = ({
  sellPriceCents,
  costCents,
  floorBps,
}: {
  sellPriceCents: Cents;
  costCents: Cents;
  floorBps: BasisPoints;
}): MarginFloorResult => {
  assertBasisPoints(floorBps, "floorBps");
  const grossMarginBps = calculateGrossMarginBps(sellPriceCents, costCents);

  return {
    passes: grossMarginBps >= floorBps,
    grossMarginBps,
    floorBps,
  };
};
