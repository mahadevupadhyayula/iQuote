import { calculateGrossMarginBps, calculateGrossProfitCents, evaluateMarginFloor } from "@/lib/rules/margin-rules";
import type { BasisPoints, Cents } from "@/lib/utils/money";
import { assertBasisPoints, assertCents, subtractCentsFloorZero, sumCents } from "@/lib/utils/money";

const BASIS_POINTS_DENOMINATOR = BigInt(10_000);

const assertPositiveQuantity = (quantity: number) => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("quantity must be a positive finite number");
  }
};

const quantityToRatio = (quantity: number): { numerator: bigint; denominator: bigint } => {
  assertPositiveQuantity(quantity);

  const serialized = quantity.toString();
  if (serialized.includes("e")) {
    throw new Error("quantity must be provided without exponent notation");
  }

  const [whole, fractional = ""] = serialized.split(".");
  const denominator = BigInt(10) ** BigInt(fractional.length);
  return { numerator: BigInt(`${whole}${fractional}`), denominator };
};

const roundHalfUpDivide = (numerator: bigint, denominator: bigint): Cents => {
  if (denominator <= BigInt(0)) {
    throw new Error("denominator must be positive");
  }

  return Number((numerator + denominator / BigInt(2)) / denominator);
};

const multiplyCentsByQuantity = (amountCents: Cents, quantity: number, name: string): Cents => {
  assertCents(amountCents, name);
  const ratio = quantityToRatio(quantity);
  return roundHalfUpDivide(BigInt(amountCents) * ratio.numerator, ratio.denominator);
};

const calculateBasisPointsAmount = (amountCents: Cents, basisPoints: BasisPoints): Cents => {
  assertCents(amountCents, "amountCents");
  assertBasisPoints(basisPoints, "basisPoints");
  return roundHalfUpDivide(BigInt(amountCents) * BigInt(basisPoints), BASIS_POINTS_DENOMINATOR);
};

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
  lineSubtotalCents: Cents;
  subtotalCents: Cents;
  lineDiscountCents: Cents;
  discountAmountCents: Cents;
  lineNetTotalCents: Cents;
  netTotalCents: Cents;
  sellPriceCents: Cents;
  extendedUnitCostCents: Cents;
  costCents: Cents;
  grossProfitCents: Cents;
  grossMarginBps: BasisPoints;
  marginFloorPasses: boolean | null;
};

export type QuoteCalculation = {
  lines: QuoteCalculationLine[];
  quoteSubtotalCents: Cents;
  subtotalCents: Cents;
  totalDiscountCents: Cents;
  discountAmountCents: Cents;
  netTotalCents: Cents;
  sellPriceCents: Cents;
  extendedUnitCostCents: Cents;
  costCents: Cents;
  grossProfitCents: Cents;
  grossMarginBps: BasisPoints;
};

export const calculateQuoteLine = (line: QuoteCalculationLineInput): QuoteCalculationLine => {
  assertPositiveQuantity(line.quantity);
  assertCents(line.unitPriceCents, "unitPriceCents");
  assertCents(line.unitCostCents, "unitCostCents");

  const discountBps = line.discountBps ?? 0;
  assertBasisPoints(discountBps, "discountBps");

  const lineSubtotalCents = multiplyCentsByQuantity(line.unitPriceCents, line.quantity, "unitPriceCents");
  const bpsDiscountCents = calculateBasisPointsAmount(lineSubtotalCents, discountBps);
  const explicitDiscountCents = line.discountAmountCents ?? 0;
  assertCents(explicitDiscountCents, "discountAmountCents");

  const lineDiscountCents = Math.min(bpsDiscountCents + explicitDiscountCents, lineSubtotalCents);
  const lineNetTotalCents = subtractCentsFloorZero(lineSubtotalCents, lineDiscountCents);
  const extendedUnitCostCents = multiplyCentsByQuantity(line.unitCostCents, line.quantity, "unitCostCents");
  const grossProfitCents = calculateGrossProfitCents(lineNetTotalCents, extendedUnitCostCents);
  const grossMarginBps = calculateGrossMarginBps(lineNetTotalCents, extendedUnitCostCents);
  const marginFloor =
    line.marginFloorBps == null
      ? null
      : evaluateMarginFloor({ sellPriceCents: lineNetTotalCents, costCents: extendedUnitCostCents, floorBps: line.marginFloorBps });

  return {
    lineId: line.lineId ?? "",
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    unitCostCents: line.unitCostCents,
    discountBps,
    discountAmountCents: lineDiscountCents,
    marginFloorBps: line.marginFloorBps ?? null,
    lineSubtotalCents,
    subtotalCents: lineSubtotalCents,
    lineDiscountCents,
    lineNetTotalCents,
    netTotalCents: lineNetTotalCents,
    sellPriceCents: lineNetTotalCents,
    extendedUnitCostCents,
    costCents: extendedUnitCostCents,
    grossProfitCents,
    grossMarginBps,
    marginFloorPasses: marginFloor?.passes ?? null,
  };
};

export const calculateQuote = (lines: QuoteCalculationLineInput[]): QuoteCalculation => {
  const calculatedLines = lines.map(calculateQuoteLine);
  const quoteSubtotalCents = sumCents(calculatedLines.map((line) => line.lineSubtotalCents));
  const totalDiscountCents = sumCents(calculatedLines.map((line) => line.lineDiscountCents));
  const netTotalCents = sumCents(calculatedLines.map((line) => line.lineNetTotalCents));
  const extendedUnitCostCents = sumCents(calculatedLines.map((line) => line.extendedUnitCostCents));
  const grossProfitCents = calculateGrossProfitCents(netTotalCents, extendedUnitCostCents);
  const grossMarginBps = calculateGrossMarginBps(netTotalCents, extendedUnitCostCents);

  return {
    lines: calculatedLines,
    quoteSubtotalCents,
    subtotalCents: quoteSubtotalCents,
    totalDiscountCents,
    discountAmountCents: totalDiscountCents,
    netTotalCents,
    sellPriceCents: netTotalCents,
    extendedUnitCostCents,
    costCents: extendedUnitCostCents,
    grossProfitCents,
    grossMarginBps,
  };
};
