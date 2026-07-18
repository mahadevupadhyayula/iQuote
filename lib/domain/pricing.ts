export const discountPolicyTypes = ["percent_off", "amount_off"] as const;

export type DiscountPolicyType = (typeof discountPolicyTypes)[number];

export type Money = {
  amount: number;
  currencyCode: string;
};

export type PriceWindow = {
  productId: string;
  currencyCode: string;
  unitPrice: number;
  effectiveFrom: string;
  effectiveTo: string | null;
};

export type DiscountPolicy = {
  id: string;
  name: string;
  policyType: DiscountPolicyType;
  discountBps: number;
  maxDiscountBps: number;
  amountOff: number;
  startsOn: string | null;
  endsOn: string | null;
  active: boolean;
};

export const basisPointsToPercent = (basisPoints: number) => basisPoints / 100;
export const percentToBasisPoints = (percent: number) => Math.round(percent * 100);

export const calculateLineTotal = ({
  quantity,
  unitPrice,
  discountAmount = 0,
}: {
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
}) => Math.max(quantity * unitPrice - discountAmount, 0);
