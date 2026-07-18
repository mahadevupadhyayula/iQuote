import "server-only";

import { inventoryRecordSchema, type InventoryRecordRow } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

const inventoryRecordRowSchema = inventoryRecordSchema;

type InventoryDbInput = Omit<InventoryRecordRow, "id" | "updated_at"> & { id?: string };
export type InventoryUpsertInput = Omit<InventoryDbInput, "location_code"> & { location_code?: string; warehouse_code?: string };

const toInventoryDbInput = ({ location_code, warehouse_code, ...input }: InventoryUpsertInput) => ({
  ...input,
  warehouse_code: warehouse_code ?? location_code ?? "default",
});

export const createInventoryRepository = (client: RepositoryClient) => ({
  async listByProduct(productId: string) {
    const { data, error } = await client.from("inventory").select("*").eq("product_id", productId).order("warehouse_code");
    throwRepositoryError("List inventory by product", error);
    return inventoryRecordRowSchema.array().parse(data ?? []);
  },

  async listByProducts(productIds: string[]) {
    if (productIds.length === 0) return [];
    const { data, error } = await client.from("inventory").select("*").in("product_id", productIds).order("product_id");
    throwRepositoryError("List inventory by products", error);
    return inventoryRecordRowSchema.array().parse(data ?? []);
  },

  async listByWarehouse(warehouseCode: string) {
    const { data, error } = await client.from("inventory").select("*").eq("warehouse_code", warehouseCode).order("product_id");
    throwRepositoryError("List inventory by warehouse", error);
    return inventoryRecordRowSchema.array().parse(data ?? []);
  },

  async findAtLocation(productId: string, locationCode: string) {
    const { data, error } = await client
      .from("inventory")
      .select("*")
      .eq("product_id", productId)
      .eq("warehouse_code", locationCode)
      .maybeSingle();
    throwRepositoryError("Find inventory at location", error);
    return data ? inventoryRecordRowSchema.parse(data) : null;
  },

  async upsert(input: InventoryUpsertInput) {
    const { data, error } = await client
      .from("inventory")
      .upsert(toInventoryDbInput(input), { onConflict: "product_id,warehouse_code" })
      .select("*")
      .single();
    throwRepositoryError("Upsert inventory", error);
    return inventoryRecordRowSchema.parse(data);
  },
});

export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
