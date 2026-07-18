import { calculateGrossMarginBps, calculateGrossProfitCents, evaluateMarginFloor } from "@/lib/rules/margin-rules";
import type { BasisPoints, Cents } from "@/lib/utils/money";
import { assertBasisPoints, assertCents, basisPointsAmount, multiplyCents, subtractCentsFloorZero, sumCents } from "@/lib/utils/money";

export type QuoteCalculationLineInput = {
  lineId?: string;
  quantity: number;
  unitPriceCents: Cents;
  unitCostCents: Cents;
  discountBps?: BasisPoints;
  discountAmountCents?: Cents;
  marginFloorBps?: BasisPoints;
};

export type QuoteCalculationLine = Required<Omit<QuoteCalculationLineInput, "marginFloorBps">> & {
  marginFloorBps: BasisPoints | null;
  subtotalCents: Cents;
  discountAmountCents: Cents;
  sellPriceCents: Cents;
  costCents: Cents;
  grossProfitCents: Cents;
  grossMarginBps: BasisPoints;
  marginFloorPasses: boolean | null;
};

export type QuoteCalculation = {
  lines: QuoteCalculationLine[];
  subtotalCents: Cents;
  discountAmountCents: Cents;
  sellPriceCents: Cents;
  costCents: Cents;
  grossProfitCents: Cents;
  grossMarginBps: BasisPoints;
};

export const calculateQuoteLine = (line: QuoteCalculationLineInput): QuoteCalculationLine => {
  if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
    throw new Error("quantity must be a positive finite number");
  }
  assertCents(line.unitPriceCents, "unitPriceCents");
  assertCents(line.unitCostCents, "unitCostCents");

  const discountBps = line.discountBps ?? 0;
  assertBasisPoints(discountBps, "discountBps");

  const subtotalCents = multiplyCents(line.unitPriceCents, line.quantity);
  const bpsDiscountCents = basisPointsAmount(subtotalCents, discountBps);
  const explicitDiscountCents = line.discountAmountCents ?? 0;
  assertCents(explicitDiscountCents, "discountAmountCents");

  const discountAmountCents = Math.min(bpsDiscountCents + explicitDiscountCents, subtotalCents);
  const sellPriceCents = subtractCentsFloorZero(subtotalCents, discountAmountCents);
  const costCents = multiplyCents(line.unitCostCents, line.quantity);
  const grossProfitCents = calculateGrossProfitCents(sellPriceCents, costCents);
  const grossMarginBps = calculateGrossMarginBps(sellPriceCents, costCents);
  const marginFloor =
    line.marginFloorBps == null
      ? null
      : evaluateMarginFloor({ sellPriceCents, costCents, floorBps: line.marginFloorBps });

  return {
    lineId: line.lineId ?? "",
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    unitCostCents: line.unitCostCents,
    discountBps,
    discountAmountCents,
    marginFloorBps: line.marginFloorBps ?? null,
    subtotalCents,
    sellPriceCents,
    costCents,
    grossProfitCents,
    grossMarginBps,
    marginFloorPasses: marginFloor?.passes ?? null,
  };
};

export const calculateQuote = (lines: QuoteCalculationLineInput[]): QuoteCalculation => {
  const calculatedLines = lines.map(calculateQuoteLine);
  const subtotalCents = sumCents(calculatedLines.map((line) => line.subtotalCents));
  const discountAmountCents = sumCents(calculatedLines.map((line) => line.discountAmountCents));
  const sellPriceCents = sumCents(calculatedLines.map((line) => line.sellPriceCents));
  const costCents = sumCents(calculatedLines.map((line) => line.costCents));
  const grossProfitCents = calculateGrossProfitCents(sellPriceCents, costCents);
  const grossMarginBps = calculateGrossMarginBps(sellPriceCents, costCents);

  return { lines: calculatedLines, subtotalCents, discountAmountCents, sellPriceCents, costCents, grossProfitCents, grossMarginBps };
};
