import "server-only";

import type { CustomerRecord, OpportunityRecord } from "@/lib/schemas/shared-records";
import type { Repositories } from "@/lib/repositories";
import type { CrmAccount, CrmAdapter, CrmOpportunity } from "./interfaces";
import { michaelAnderson } from "./mock-user";

const metadataText = (metadata: Record<string, unknown>, key: string, fallback: string) => {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : fallback;
};

const toCrmAccount = (customer: CustomerRecord): CrmAccount => ({
  id: customer.id,
  externalId: customer.external_id,
  name: customer.name,
  legalName: customer.legal_name,
  domain: customer.domain,
  billingEmail: customer.billing_email,
  phone: customer.phone,
  sourceName: metadataText(customer.metadata, "source_name", "supabase.customers"),
  sourceVersion: metadataText(customer.metadata, "demo_seed", "1"),
});

const toCrmOpportunity = (opportunity: OpportunityRecord): CrmOpportunity => ({
  id: opportunity.id,
  accountId: opportunity.customer_id,
  externalId: opportunity.external_id,
  name: opportunity.name,
  stage: opportunity.stage,
  ownerId: opportunity.owner_id ?? michaelAnderson.id,
  currencyCode: opportunity.currency_code,
  expectedCloseDate: opportunity.expected_close_date,
  sourceName: metadataText(opportunity.metadata, "source_name", "supabase.opportunities"),
  sourceVersion: metadataText(opportunity.metadata, "demo_seed", "1"),
});

export const createMockCrmAdapter = (repositories: Pick<Repositories, "customers" | "opportunities">): CrmAdapter => ({
  async findAccount(accountId: string) {
    const customer = await repositories.customers.findById(accountId);
    return customer ? toCrmAccount(customer) : null;
  },

  async listOpenOpportunities(accountId: string) {
    const account = await repositories.customers.findById(accountId);
    if (!account) return [];
    const opportunities = await repositories.opportunities.listOpenByCustomer(account.id);
    return opportunities.map(toCrmOpportunity);
  },
});
