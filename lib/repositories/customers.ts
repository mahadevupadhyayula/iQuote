import "server-only";

import { customerRecordSchema, type CustomerRecord } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

export type CustomerCreateInput = Omit<CustomerRecord, "id" | "created_at" | "updated_at"> & { id?: string };
export type CustomerUpdateInput = Partial<Omit<CustomerRecord, "id" | "created_at" | "updated_at">>;

export const createCustomersRepository = (client: RepositoryClient) => ({
  async findById(id: string) {
    const { data, error } = await client.from("customers").select("*").eq("id", id).maybeSingle();
    throwRepositoryError("Find customer by id", error);
    return data ? customerRecordSchema.parse(data) : null;
  },

  async findByExternalId(externalId: string) {
    const { data, error } = await client.from("customers").select("*").eq("external_id", externalId).maybeSingle();
    throwRepositoryError("Find customer by external id", error);
    return data ? customerRecordSchema.parse(data) : null;
  },

  async findByName(name: string, limit = 20) {
    const { data, error } = await client.from("customers").select("*").ilike("name", `%${name}%`).order("name").limit(limit);
    throwRepositoryError("Find customer by name", error);
    return customerRecordSchema.array().parse(data ?? []);
  },

  async searchByName(query: string, limit = 20) {
    return this.findByName(query, limit);
  },

  async create(input: CustomerCreateInput) {
    const { data, error } = await client.from("customers").insert(input as never).select("*").single();
    throwRepositoryError("Create customer", error);
    return customerRecordSchema.parse(data);
  },

  async update(id: string, input: CustomerUpdateInput) {
    const { data, error } = await client.from("customers").update(input as never).eq("id", id).select("*").single();
    throwRepositoryError("Update customer", error);
    return customerRecordSchema.parse(data);
  },
});

export type CustomersRepository = ReturnType<typeof createCustomersRepository>;
