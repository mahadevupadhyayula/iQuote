import "server-only";

import { inventoryRecordSchema, type InventoryRecordRow } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

export type InventoryUpsertInput = Omit<InventoryRecordRow, "id" | "updated_at"> & { id?: string };

export const createInventoryRepository = (client: RepositoryClient) => ({
  async listByProduct(productId: string) {
    const { data, error } = await client.from("inventory").select("*").eq("product_id", productId).order("location_code");
    throwRepositoryError("List inventory by product", error);
    return inventoryRecordSchema.array().parse(data ?? []);
  },

  async listByProducts(productIds: string[]) {
    if (productIds.length === 0) return [];
    const { data, error } = await client.from("inventory").select("*").in("product_id", productIds).order("product_id");
    throwRepositoryError("List inventory by products", error);
    return inventoryRecordSchema.array().parse(data ?? []);
  },

  async findAtLocation(productId: string, locationCode: string) {
    const { data, error } = await client
      .from("inventory")
      .select("*")
      .eq("product_id", productId)
      .eq("location_code", locationCode)
      .maybeSingle();
    throwRepositoryError("Find inventory at location", error);
    return data ? inventoryRecordSchema.parse(data) : null;
  },

  async upsert(input: InventoryUpsertInput) {
    const { data, error } = await client
      .from("inventory")
      .upsert(input, { onConflict: "product_id,location_code" })
      .select("*")
      .single();
    throwRepositoryError("Upsert inventory", error);
    return inventoryRecordSchema.parse(data);
  },
});

export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
