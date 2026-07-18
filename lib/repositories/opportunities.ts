import "server-only";

import { opportunityRecordSchema, type OpportunityRecord } from "@/lib/schemas/shared-records";
import type { RepositoryClient } from "./types";
import { throwRepositoryError } from "./types";

export type OpportunityCreateInput = Omit<OpportunityRecord, "id" | "created_at" | "updated_at"> & { id?: string };

export const createOpportunitiesRepository = (client: RepositoryClient) => ({
  async findById(id: string) {
    const { data, error } = await client.from("opportunities").select("*").eq("id", id).maybeSingle();
    throwRepositoryError("Find opportunity by id", error);
    return data ? opportunityRecordSchema.parse(data) : null;
  },

  async listOpenByCustomer(customerId: string) {
    const { data, error } = await client
      .from("opportunities")
      .select("*")
      .eq("customer_id", customerId)
      .in("stage", ["prospecting", "qualification", "proposal", "negotiation"])
      .order("expected_close_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
    throwRepositoryError("List open opportunities by customer", error);
    return opportunityRecordSchema.array().parse(data ?? []);
  },

  async create(input: OpportunityCreateInput) {
    const { data, error } = await client.from("opportunities").insert(input).select("*").single();
    throwRepositoryError("Create opportunity", error);
    return opportunityRecordSchema.parse(data);
  },
});

export type OpportunitiesRepository = ReturnType<typeof createOpportunitiesRepository>;
