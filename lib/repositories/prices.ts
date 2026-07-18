import "server-only";

import { discountPolicyRecordSchema, priceRecordSchema, type DiscountPolicyRecord, type PriceRecord } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

export type PriceCreateInput = Omit<PriceRecord, "id" | "created_at"> & { id?: string };
export type DiscountPolicyCreateInput = Omit<DiscountPolicyRecord, "id" | "created_at" | "updated_at"> & { id?: string };

export const createPricesRepository = (client: RepositoryClient) => ({
  async findCurrentPrice(productId: string, currencyCode = "USD", onDate = new Date().toISOString().slice(0, 10)) {
    const { data, error } = await client
      .from("prices")
      .select("*")
      .eq("product_id", productId)
      .eq("currency_code", currencyCode)
      .lte("effective_from", onDate)
      .or(`effective_to.is.null,effective_to.gte.${onDate}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwRepositoryError("Find current price", error);
    return data ? priceRecordSchema.parse(data) : null;
  },

  async listCurrentPrices(productIds: string[], currencyCode = "USD", onDate = new Date().toISOString().slice(0, 10)) {
    if (productIds.length === 0) return [];
    const { data, error } = await client
      .from("prices")
      .select("*")
      .in("product_id", productIds)
      .eq("currency_code", currencyCode)
      .lte("effective_from", onDate)
      .or(`effective_to.is.null,effective_to.gte.${onDate}`)
      .order("effective_from", { ascending: false });
    throwRepositoryError("List current prices", error);
    return priceRecordSchema.array().parse(data ?? []);
  },

  async createPrice(input: PriceCreateInput) {
    const { data, error } = await client.from("prices").insert(input).select("*").single();
    throwRepositoryError("Create price", error);
    return priceRecordSchema.parse(data);
  },

  async listActiveDiscountPolicies(onDate = new Date().toISOString().slice(0, 10)) {
    const { data, error } = await client
      .from("discount_policies")
      .select("*")
      .eq("active", true)
      .or(`starts_on.is.null,starts_on.lte.${onDate}`)
      .or(`ends_on.is.null,ends_on.gte.${onDate}`)
      .order("name");
    throwRepositoryError("List active discount policies", error);
    return discountPolicyRecordSchema.array().parse(data ?? []);
  },

  async createDiscountPolicy(input: DiscountPolicyCreateInput) {
    const { data, error } = await client.from("discount_policies").insert(input).select("*").single();
    throwRepositoryError("Create discount policy", error);
    return discountPolicyRecordSchema.parse(data);
  },
});

export type PricesRepository = ReturnType<typeof createPricesRepository>;
