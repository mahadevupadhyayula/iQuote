import type { InventoryAdapter, InventoryAvailabilityResponse, InventoryWarehouseAvailability } from "@/lib/adapters/interfaces";
import {
  evaluateInventory,
  type EvaluateInventoryInput,
  type InventoryDecision,
  type InventoryRuleProduct,
  type InventoryRuleRecord,
} from "@/lib/rules/inventory-rules";
import type { InventoryRepository } from "@/lib/repositories/inventory";
import type { ProductsRepository } from "@/lib/repositories/products";

type InventoryRepositoryRecord = Awaited<ReturnType<InventoryRepository["listByProduct"]>>[number];

export type InventoryRulesProvider = {
  getInventory?(
    input: Pick<EvaluateInventoryInput, "product" | "quantity">,
  ): Promise<Pick<EvaluateInventoryInput, "inventory" | "replacementInventory">>;
  getReplacementProducts?(product: InventoryRuleProduct): Promise<InventoryRuleProduct[]>;
  inventoryAdapter?: InventoryAdapter;
  inventoryRepository?: Pick<InventoryRepository, "listByProduct" | "listByProducts" | "findAtLocation">;
  productsRepository?: Pick<ProductsRepository, "listSubstitutes">;
};

export type InventoryRequest = Pick<
  EvaluateInventoryInput,
  "product" | "quantity" | "now" | "staleAfterHours" | "allowSplitFulfillment" | "laterDeliveryDays"
> & {
  warehouseCodes?: string[];
};

const recordFromWarehouse = (
  productId: string,
  warehouse: InventoryWarehouseAvailability,
  sourceName: string,
  sourceVersion: string,
): InventoryRuleRecord => ({
  productId,
  locationCode: warehouse.warehouseCode,
  quantityOnHand: warehouse.quantityOnHand,
  quantityReserved: warehouse.quantityReserved,
  reorderPoint: warehouse.reorderPoint,
  updatedAt: warehouse.refreshed_at,
  refreshedAt: warehouse.refreshed_at,
  sourceName,
  sourceVersion,
});

const recordsFromAdapterResponse = (response: InventoryAvailabilityResponse): InventoryRuleRecord[] =>
  response.warehouses.map((warehouse) =>
    recordFromWarehouse(response.productId, warehouse, response.sourceName, response.sourceVersion),
  );

const recordFromRepository = (record: InventoryRepositoryRecord): InventoryRuleRecord => ({
  productId: record.product_id,
  locationCode: record.location_code,
  quantityOnHand: record.quantity_on_hand,
  quantityReserved: record.quantity_reserved,
  reorderPoint: record.reorder_point,
  updatedAt: record.updated_at,
  refreshedAt: record.refreshed_at ?? record.updated_at,
  sourceName: record.source_name,
  sourceVersion: record.source_version,
});

const productFromRepository = (product: Awaited<ReturnType<ProductsRepository["listSubstitutes"]>>[number]): InventoryRuleProduct => ({
  id: product.id,
  sku: product.sku,
  name: product.name,
  status: product.status,
  metadata: product.metadata,
});

const filterWarehouseCodes = (inventory: InventoryRuleRecord[], warehouseCodes?: string[]) =>
  warehouseCodes?.length ? inventory.filter((record) => warehouseCodes.includes(record.locationCode)) : inventory;

const getInventoryFromAdapter = async (adapter: InventoryAdapter, request: InventoryRequest, replacementProducts: InventoryRuleProduct[]) => {
  const productIds = [request.product.id, ...replacementProducts.map((product) => product.id)];
  const responses = await adapter.listAvailability(productIds);
  const primary = responses.find((response) => response.productId === request.product.id);
  const replacements = responses.filter((response) => response.productId !== request.product.id);

  return {
    inventory: primary ? filterWarehouseCodes(recordsFromAdapterResponse(primary), request.warehouseCodes) : [],
    replacementInventory: replacements.flatMap(recordsFromAdapterResponse),
  };
};

const getInventoryFromRepository = async (
  repository: Pick<InventoryRepository, "listByProduct" | "listByProducts" | "findAtLocation">,
  request: InventoryRequest,
  replacementProducts: InventoryRuleProduct[],
) => {
  const primaryRows: Array<InventoryRepositoryRecord | null> = request.warehouseCodes?.length
    ? await Promise.all(
        request.warehouseCodes.map((warehouseCode) => repository.findAtLocation(request.product.id, warehouseCode)),
      )
    : await repository.listByProduct(request.product.id);
  const replacementIds = replacementProducts.map((product) => product.id);
  const replacementRows = replacementIds.length > 0 ? await repository.listByProducts(replacementIds) : [];

  return {
    inventory: primaryRows.filter((record): record is InventoryRepositoryRecord => record !== null).map(recordFromRepository),
    replacementInventory: replacementRows.map(recordFromRepository),
  };
};

const getReplacementProducts = async (provider: InventoryRulesProvider, product: InventoryRuleProduct) => {
  if (provider.getReplacementProducts) return provider.getReplacementProducts(product);
  if (provider.productsRepository) return (await provider.productsRepository.listSubstitutes(product.id)).map(productFromRepository);
  return [];
};

export const createInventoryService = (provider: InventoryRulesProvider) => ({
  async evaluateAvailability(request: InventoryRequest): Promise<InventoryDecision> {
    const replacementProducts = await getReplacementProducts(provider, request.product);
    const inventoryRules = provider.getInventory
      ? await provider.getInventory(request)
      : provider.inventoryAdapter
        ? await getInventoryFromAdapter(provider.inventoryAdapter, request, replacementProducts)
        : provider.inventoryRepository
          ? await getInventoryFromRepository(provider.inventoryRepository, request, replacementProducts)
          : { inventory: [], replacementInventory: [] };

    return evaluateInventory({
      ...request,
      ...inventoryRules,
      replacementProducts,
    });
  },
});

export type InventoryService = ReturnType<typeof createInventoryService>;
