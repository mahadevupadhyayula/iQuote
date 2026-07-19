import "server-only";

import { getAvailableQuantity, getInventoryAvailability, type InventoryAvailability } from "@/lib/domain/inventory";
import type { Repositories } from "@/lib/repositories";
import type { ErpInventoryAdapter, ErpInventoryAvailabilityResponse } from "./interfaces";

const summarizeAvailability = (locations: { availableQuantity: number; availability: InventoryAvailability }[]): InventoryAvailability => {
  if (locations.some((location) => location.availability === "available")) return "available";
  if (locations.some((location) => location.availability === "limited")) return "limited";
  return "backordered";
};

export const createMockErpInventoryAdapter = (repositories: Pick<Repositories, "inventory" | "products">): ErpInventoryAdapter => {
  const getAvailability = async (productId: string): Promise<ErpInventoryAvailabilityResponse | null> => {
    const product = await repositories.products.findById(productId);
    if (!product) return null;

    const inventory = await repositories.inventory.listByProduct(product.id);
    const locations = inventory.map((record) => ({
      warehouseCode: record.location_code,
      locationCode: record.location_code,
      quantityOnHand: record.quantity_on_hand,
      quantityReserved: record.quantity_reserved,
      availableQuantity: getAvailableQuantity({
        quantityOnHand: record.quantity_on_hand,
        quantityReserved: record.quantity_reserved,
      }),
      reorderPoint: record.reorder_point,
      availability: getInventoryAvailability({
        quantityOnHand: record.quantity_on_hand,
        quantityReserved: record.quantity_reserved,
        reorderPoint: record.reorder_point,
      }),
      asOf: record.refreshed_at ?? record.updated_at,
      refreshed_at: record.refreshed_at ?? record.updated_at,
      sourceName: record.source_name,
      sourceVersion: record.source_version,
    }));

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unitOfMeasure: product.unit_of_measure,
      status: product.status,
      totalAvailableQuantity: locations.reduce((sum, location) => sum + location.availableQuantity, 0),
      availableQuantity: locations.reduce((sum, location) => sum + location.availableQuantity, 0),
      availability: summarizeAvailability(locations),
      warehouses: locations,
      locations,
      sourceName: locations[0]?.sourceName ?? "demo_erp_inventory",
      sourceVersion: locations[0]?.sourceVersion ?? "1",
      refreshed_at: locations[0]?.refreshed_at ?? new Date(0).toISOString(),
    };
  };

  return {
    getAvailability,
    async listAvailability(productIds: string[]) {
      const responses = await Promise.all(productIds.map((productId) => getAvailability(productId)));
      return responses.filter((response): response is ErpInventoryAvailabilityResponse => response !== null);
    },
  };
};
