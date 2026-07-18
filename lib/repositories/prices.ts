import "server-only";

import { discountPolicyRecordSchema, priceRecordSchema, type DiscountPolicyRecord, type PriceRecord } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

export type PriceCreateInput = Omit<PriceRecord, "id" | "created_at"> & {
  id?: string;
  customer_id?: string | null;
  customer_tier?: string | null;
  price_type?: "list" | "customer_tier" | "customer_specific";
  unit_cost?: number;
};
export type DiscountPolicyCreateInput = Omit<DiscountPolicyRecord, "id" | "created_at" | "updated_at"> & { id?: string };
export type ActivePriceLookupInput = {
  productId: string;
  currencyCode?: string;
  onDate?: string;
};
export type CustomerPriceLookupInput = ActivePriceLookupInput & { customerId: string };
export type CustomerTierPriceLookupInput = ActivePriceLookupInput & { customerTier: string };

const today = () => new Date().toISOString().slice(0, 10);
const activePriceQuery = (client: RepositoryClient, { productId, currencyCode = "USD", onDate = today() }: ActivePriceLookupInput) =>
  client
    .from("prices")
    .select("*")
    .eq("product_id", productId)
    .eq("currency_code", currencyCode)
    .lte("effective_from", onDate)
    .or(`effective_to.is.null,effective_to.gte.${onDate}`)
    .order("effective_from", { ascending: false });

export const createPricesRepository = (client: RepositoryClient) => ({
  async findActivePricesForProduct(input: ActivePriceLookupInput) {
    const { data, error } = await activePriceQuery(client, input);
    throwRepositoryError("Find active prices for product", error);
    return priceRecordSchema.array().parse(data ?? []);
  },

  async findCustomerSpecificPrice(input: CustomerPriceLookupInput) {
    const { data, error } = await activePriceQuery(client, input).eq("price_type", "customer_specific").eq("customer_id", input.customerId).limit(1).maybeSingle();
    throwRepositoryError("Find customer-specific price", error);
    return data ? priceRecordSchema.parse(data) : null;
  },

  async findCustomerTierPrice(input: CustomerTierPriceLookupInput) {
    const { data, error } = await activePriceQuery(client, input).eq("price_type", "customer_tier").eq("customer_tier", input.customerTier).limit(1).maybeSingle();
    throwRepositoryError("Find customer tier price", error);
    return data ? priceRecordSchema.parse(data) : null;
  },

  async findListPrice(input: ActivePriceLookupInput) {
    const { data, error } = await activePriceQuery(client, input).eq("price_type", "list").limit(1).maybeSingle();
    throwRepositoryError("Find list price", error);
    return data ? priceRecordSchema.parse(data) : null;
  },

  async findUnitCost(input: ActivePriceLookupInput) {
    const { data, error } = await activePriceQuery(client, input).select("unit_cost").limit(1).maybeSingle();
    throwRepositoryError("Find unit cost", error);
    return data?.unit_cost ?? null;
  },

  async findCurrentPrice(productId: string, currencyCode = "USD", onDate = today()) {
    return this.findListPrice({ productId, currencyCode, onDate });
  },

  async listCurrentPrices(productIds: string[], currencyCode = "USD", onDate = today()) {
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

  async listActiveDiscountPolicies(onDate = today()) {
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
