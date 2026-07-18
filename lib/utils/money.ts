export type Cents = number;
export type BasisPoints = number;

export const BASIS_POINTS_DENOMINATOR = 10_000;

const assertInteger = (value: number, name: string) => {
  if (!Number.isInteger(value)) {
    throw new Error(`${name} must be an integer`);
  }
};

export const assertCents = (value: Cents, name = "amountCents") => {
  assertInteger(value, name);
  if (value < 0) {
    throw new Error(`${name} must be non-negative`);
  }
};

export const assertBasisPoints = (value: BasisPoints, name = "basisPoints") => {
  assertInteger(value, name);
  if (value < 0 || value > BASIS_POINTS_DENOMINATOR) {
    throw new Error(`${name} must be between 0 and ${BASIS_POINTS_DENOMINATOR}`);
  }
};

export const multiplyCents = (amountCents: Cents, multiplier: number): Cents => {
  assertCents(amountCents);
  if (!Number.isFinite(multiplier) || multiplier < 0) {
    throw new Error("multiplier must be a non-negative finite number");
  }

  return Math.round(amountCents * multiplier);
};

export const sumCents = (amountsCents: Cents[]): Cents => {
  amountsCents.forEach((amount, index) => assertCents(amount, `amountsCents[${index}]`));
  return amountsCents.reduce((total, amount) => total + amount, 0);
};

export const basisPointsAmount = (amountCents: Cents, basisPoints: BasisPoints): Cents => {
  assertCents(amountCents);
  assertBasisPoints(basisPoints);
  return Math.round((amountCents * basisPoints) / BASIS_POINTS_DENOMINATOR);
};

export const subtractCentsFloorZero = (amountCents: Cents, discountCents: Cents): Cents => {
  assertCents(amountCents, "amountCents");
  assertCents(discountCents, "discountCents");
  return Math.max(amountCents - discountCents, 0);
};

export const ratioToBasisPoints = (numeratorCents: Cents, denominatorCents: Cents): BasisPoints => {
  assertCents(numeratorCents, "numeratorCents");
  assertCents(denominatorCents, "denominatorCents");
  if (denominatorCents === 0) return 0;
  return Math.round((numeratorCents * BASIS_POINTS_DENOMINATOR) / denominatorCents);
};
