import "server-only";

import type { AuthAdapter, AuthenticatedUser } from "./interfaces";

export const michaelAnderson: AuthenticatedUser = {
  id: "demo-user-michael-anderson",
  externalId: "crm-user-1001",
  displayName: "Michael Anderson",
  email: "michael.anderson@example.com",
  role: "sales_representative",
  territory: "North America Enterprise",
};

export const createDemoAuthAdapter = (): AuthAdapter => ({
  async getCurrentUser() {
    return michaelAnderson;
  },
});
