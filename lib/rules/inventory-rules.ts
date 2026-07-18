import { getAvailableQuantity } from "@/lib/domain/inventory";

export type InventoryRuleRecord = {
  productId: string;
  locationCode: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  updatedAt: string;
};

export type InventoryRuleProduct = {
  id: string;
  sku: string;
  name: string;
  status: "active" | "inactive" | "discontinued";
  metadata?: Record<string, unknown>;
};

export type FulfillmentSource = {
  productId: string;
  locationCode: string;
  quantity: number;
  availableQuantity: number;
};

export type ReplacementProposal = {
  productId: string;
  sku: string;
  name: string;
  reason: string;
  fulfillment: FulfillmentSource[];
};

export type LaterDeliveryOption = {
  productId: string;
  earliestShipDate: string;
  quantity: number;
  reason: string;
};

export type InventoryDecisionStatus =
  | "single_warehouse"
  | "split_fulfillment"
  | "insufficient_single_warehouse"
  | "replacement_proposed"
  | "stale_inventory"
  | "backordered";

export type InventoryDecision = {
  status: InventoryDecisionStatus;
  blocked: boolean;
  productId: string;
  requestedQuantity: number;
  availableQuantity: number;
  staleRecords: InventoryRuleRecord[];
  fulfillment: FulfillmentSource[];
  replacementProposal: ReplacementProposal | null;
  laterDeliveryOptions: LaterDeliveryOption[];
  reason: string | null;
};

export type EvaluateInventoryInput = {
  product: InventoryRuleProduct;
  quantity: number;
  inventory: InventoryRuleRecord[];
  replacementProducts?: InventoryRuleProduct[];
  replacementInventory?: InventoryRuleRecord[];
  now?: string;
  staleAfterHours?: number;
  allowSplitFulfillment?: boolean;
  laterDeliveryDays?: number;
};

const defaultStaleAfterHours = 24;
const defaultLaterDeliveryDays = 7;
const hoursToMs = 60 * 60 * 1000;

const addDays = (isoTimestamp: string, days: number) => {
  const date = new Date(isoTimestamp);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const isStale = (record: InventoryRuleRecord, now: string, staleAfterHours: number) =>
  new Date(now).getTime() - new Date(record.updatedAt).getTime() > staleAfterHours * hoursToMs;

const byAvailableDesc = (left: FulfillmentSource, right: FulfillmentSource) =>
  right.availableQuantity - left.availableQuantity || left.locationCode.localeCompare(right.locationCode);

const sourcesFor = (productId: string, inventory: InventoryRuleRecord[]) =>
  inventory
    .filter((record) => record.productId === productId)
    .map((record) => ({
      productId: record.productId,
      locationCode: record.locationCode,
      quantity: 0,
      availableQuantity: getAvailableQuantity(record),
    }))
    .filter((source) => source.availableQuantity > 0)
    .sort(byAvailableDesc);

const allocate = (quantity: number, sources: FulfillmentSource[]) => {
  let remaining = quantity;
  const fulfillment: FulfillmentSource[] = [];

  for (const source of sources) {
    if (remaining <= 0) break;
    const allocated = Math.min(remaining, source.availableQuantity);
    fulfillment.push({ ...source, quantity: allocated });
    remaining -= allocated;
  }

  return fulfillment;
};

const totalAvailable = (sources: FulfillmentSource[]) => sources.reduce((sum, source) => sum + source.availableQuantity, 0);

const findSeededReplacements = (product: InventoryRuleProduct, replacementProducts: InventoryRuleProduct[]) =>
  replacementProducts.filter(
    (replacement) =>
      replacement.status === "active" &&
      (replacement.metadata?.replaces === product.sku || replacement.metadata?.replacement_for === product.sku),
  );

const buildReplacementProposal = (
  product: InventoryRuleProduct,
  quantity: number,
  replacementProducts: InventoryRuleProduct[],
  replacementInventory: InventoryRuleRecord[],
): ReplacementProposal | null => {
  for (const replacement of findSeededReplacements(product, replacementProducts)) {
    const sources = sourcesFor(replacement.id, replacementInventory);
    if (totalAvailable(sources) >= quantity) {
      return {
        productId: replacement.id,
        sku: replacement.sku,
        name: replacement.name,
        reason: `${replacement.sku} is seeded as a replacement for ${product.sku}.`,
        fulfillment: allocate(quantity, sources),
      };
    }
  }

  return null;
};

export const evaluateInventory = (input: EvaluateInventoryInput): InventoryDecision => {
  const now = input.now ?? new Date().toISOString();
  const staleAfterHours = input.staleAfterHours ?? defaultStaleAfterHours;
  const laterDeliveryDays = input.laterDeliveryDays ?? defaultLaterDeliveryDays;
  const allowSplitFulfillment = input.allowSplitFulfillment ?? true;
  const productInventory = input.inventory.filter((record) => record.productId === input.product.id);
  const staleRecords = productInventory.filter((record) => isStale(record, now, staleAfterHours));
  const sources = sourcesFor(input.product.id, productInventory);
  const availableQuantity = totalAvailable(sources);
  const laterDeliveryOptions = [
    {
      productId: input.product.id,
      earliestShipDate: addDays(now, laterDeliveryDays),
      quantity: input.quantity,
      reason: "Offer a later ship date after warehouse replenishment or transfer.",
    },
  ];

  const base = {
    productId: input.product.id,
    requestedQuantity: input.quantity,
    availableQuantity,
    staleRecords,
    laterDeliveryOptions,
  };

  if (staleRecords.length > 0) {
    return {
      ...base,
      status: "stale_inventory",
      blocked: true,
      fulfillment: [],
      replacementProposal: null,
      reason: "Inventory refresh timestamp is stale; refresh warehouse availability before promising delivery.",
    };
  }

  const singleWarehouse = sources.find((source) => source.availableQuantity >= input.quantity);
  if (singleWarehouse) {
    return {
      ...base,
      status: "single_warehouse",
      blocked: false,
      fulfillment: [{ ...singleWarehouse, quantity: input.quantity }],
      replacementProposal: null,
      reason: null,
    };
  }

  if (availableQuantity >= input.quantity) {
    if (allowSplitFulfillment) {
      return {
        ...base,
        status: "split_fulfillment",
        blocked: false,
        fulfillment: allocate(input.quantity, sources),
        replacementProposal: null,
        reason: "Requested quantity is available only by splitting fulfillment across warehouses.",
      };
    }

    return {
      ...base,
      status: "insufficient_single_warehouse",
      blocked: true,
      fulfillment: [],
      replacementProposal: null,
      reason: "No single warehouse can fulfill the requested quantity.",
    };
  }

  const replacementProposal = buildReplacementProposal(
    input.product,
    input.quantity,
    input.replacementProducts ?? [],
    input.replacementInventory ?? [],
  );

  if (replacementProposal) {
    return {
      ...base,
      status: "replacement_proposed",
      blocked: false,
      fulfillment: [],
      replacementProposal,
      reason: "Requested product has insufficient inventory; propose the seeded replacement product.",
    };
  }

  return {
    ...base,
    status: "backordered",
    blocked: true,
    fulfillment: [],
    replacementProposal: null,
    reason: "Insufficient warehouse inventory for the requested quantity.",
  };
};
