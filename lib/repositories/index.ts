import "server-only";

import type { RepositoryClient } from "./types";
import { createApprovalsRepository } from "./approvals";
import { createCustomersRepository } from "./customers";
import { createInventoryRepository } from "./inventory";
import { createOpportunitiesRepository } from "./opportunities";
import { createPricesRepository } from "./prices";
import { createProductsRepository } from "./products";
import { createQuotesRepository } from "./quotes";
import { createWorkflowEventsRepository } from "./workflow-events";

export const createRepositories = (client: RepositoryClient) => ({
  approvals: createApprovalsRepository(client),
  customers: createCustomersRepository(client),
  inventory: createInventoryRepository(client),
  opportunities: createOpportunitiesRepository(client),
  prices: createPricesRepository(client),
  products: createProductsRepository(client),
  quotes: createQuotesRepository(client),
  workflowEvents: createWorkflowEventsRepository(client),
});

export type Repositories = ReturnType<typeof createRepositories>;

export * from "./approvals";
export * from "./customers";
export * from "./inventory";
export * from "./opportunities";
export * from "./prices";
export * from "./products";
export * from "./quotes";
export * from "./types";
export * from "./workflow-events";
