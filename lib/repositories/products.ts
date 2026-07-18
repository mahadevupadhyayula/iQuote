import "server-only";

import { productRecordSchema, type ProductRecord } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

export type ProductCreateInput = Omit<ProductRecord, "id" | "created_at" | "updated_at"> & { id?: string };
export type ProductUpdateInput = Partial<Omit<ProductRecord, "id" | "created_at" | "updated_at">>;

export type ProductAliasRecord = {
  id: string;
  product_id: string;
  alias: string;
  source: string;
  created_at: string;
};

export const createProductsRepository = (client: RepositoryClient) => ({
  async findById(id: string) {
    const { data, error } = await client.from("products").select("*").eq("id", id).maybeSingle();
    throwRepositoryError("Find product by id", error);
    return data ? productRecordSchema.parse(data) : null;
  },

  async findBySku(sku: string) {
    const { data, error } = await client.from("products").select("*").eq("sku", sku).maybeSingle();
    throwRepositoryError("Find product by sku", error);
    return data ? productRecordSchema.parse(data) : null;
  },

  async search(query: string, limit = 20) {
    const { data, error } = await client
      .from("products")
      .select("*")
      .or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
      .order("sku")
      .limit(limit);
    throwRepositoryError("Search products", error);
    return productRecordSchema.array().parse(data ?? []);
  },

  async findByAlias(alias: string) {
    const { data, error } = await client.from("product_aliases").select("product:products(*)").ilike("alias", alias).limit(1).maybeSingle();
    throwRepositoryError("Find product by alias", error);
    return data?.product ? productRecordSchema.parse(data.product) : null;
  },

  async addAlias(productId: string, alias: string, source = "manual") {
    const { data, error } = await client
      .from("product_aliases")
      .insert({ product_id: productId, alias, source })
      .select("*")
      .single();
    throwRepositoryError("Add product alias", error);
    return data as ProductAliasRecord;
  },

  async create(input: ProductCreateInput) {
    const { data, error } = await client.from("products").insert(input).select("*").single();
    throwRepositoryError("Create product", error);
    return productRecordSchema.parse(data);
  },

  async update(id: string, input: ProductUpdateInput) {
    const { data, error } = await client.from("products").update(input).eq("id", id).select("*").single();
    throwRepositoryError("Update product", error);
    return productRecordSchema.parse(data);
  },
});

export type ProductsRepository = ReturnType<typeof createProductsRepository>;
