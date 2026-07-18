export type InventoryRecord = {
  productId: string;
  locationCode: string;
  quantityOnHand: number;
  quantityReserved: number;
  reorderPoint: number;
  updatedAt: string;
};

export type InventoryAvailability = "available" | "limited" | "backordered";

export const getAvailableQuantity = (record: Pick<InventoryRecord, "quantityOnHand" | "quantityReserved">) =>
  Math.max(record.quantityOnHand - record.quantityReserved, 0);

export const getInventoryAvailability = (
  record: Pick<InventoryRecord, "quantityOnHand" | "quantityReserved" | "reorderPoint">,
): InventoryAvailability => {
  const available = getAvailableQuantity(record);

  if (available <= 0) {
    return "backordered";
  }

  if (available <= record.reorderPoint) {
    return "limited";
  }

  return "available";
};
