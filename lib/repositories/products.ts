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

const normalizeProductLookupValue = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

export const createProductsRepository = (client: RepositoryClient) => {
  const findProductsByAlias = async (alias: string) => {
    const { data, error } = await client.from("product_aliases").select("product:products(*)").ilike("alias", alias);
    throwRepositoryError("Find products by alias", error);
    return productRecordSchema.array().parse((data ?? []).map((row: { product?: unknown }) => row.product).filter(Boolean));
  };

  return {
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

  async findByName(name: string) {
    const { data, error } = await client.from("products").select("*").eq("name", name).maybeSingle();
    throwRepositoryError("Find product by name", error);
    return data ? productRecordSchema.parse(data) : null;
  },

  async findByNormalizedName(name: string) {
    const { data, error } = await client.from("products").select("*").order("sku");
    throwRepositoryError("Find product by normalized name", error);
    const normalizedName = normalizeProductLookupValue(name);
    const products = productRecordSchema.array().parse(data ?? []).filter((product) => normalizeProductLookupValue(product.name) === normalizedName);
    return products.length === 1 ? products[0] : null;
  },

  async listActive(options: { query?: string; limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    let query = client.from("products").select("*").eq("status", "active").order("sku").limit(limit);
    const search = options.query?.trim();
    if (search) query = query.or(`sku.ilike.%${search}%,name.ilike.%${search}%`);
    const { data, error } = await query;
    throwRepositoryError("List active products", error);
    return productRecordSchema.array().parse(data ?? []);
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

  findProductsByAlias,

  async findByAlias(alias: string) {
    const products = await findProductsByAlias(alias);
    return products.length === 1 ? products[0] : null;
  },

  async listSubstitutes(productId: string) {
    const product = await this.findById(productId);
    if (!product) return [];

    const { data, error } = await client
      .from("products")
      .select("*")
      .eq("status", "active")
      .or(`metadata->>replaces.eq.${product.sku},metadata->>replacement_for.eq.${product.sku}`)
      .order("sku");
    throwRepositoryError("List product substitutes", error);
    return productRecordSchema.array().parse(data ?? []);
  },

  async findReplacement(productId: string): Promise<ProductRecord | null> {
    const substitutes = await this.listSubstitutes(productId);
    return substitutes[0] ?? null;
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
    const { data, error } = await client.from("products").insert(input as never).select("*").single();
    throwRepositoryError("Create product", error);
    return productRecordSchema.parse(data);
  },

  async update(id: string, input: ProductUpdateInput) {
    const { data, error } = await client.from("products").update(input as never).eq("id", id).select("*").single();
    throwRepositoryError("Update product", error);
    return productRecordSchema.parse(data);
  },
  };
};

export type ProductsRepository = ReturnType<typeof createProductsRepository>;
