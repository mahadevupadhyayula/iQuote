import "server-only";

import { getAvailableQuantity, getInventoryAvailability, type InventoryAvailability } from "@/lib/domain/inventory";
import { pricingPrecedence } from "@/lib/rules/pricing-rules";
import type { CustomerRecord } from "@/lib/schemas/shared-records";
import type { Repositories } from "@/lib/repositories";
import type {
  AuthAdapter,
  AuthenticatedUser,
  CrmAccount,
  CrmAdapter,
  CrmOpportunity,
  ErpInventoryAdapter,
  ErpInventoryAvailabilityResponse,
  NotificationMessage,
  NotificationReceipt,
  NotificationsAdapter,
  PricingSourceMetadata,
  PricingSourceMetadataAdapter,
} from "./interfaces";

const michaelAnderson: AuthenticatedUser = {
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

const toCrmAccount = (customer: CustomerRecord): CrmAccount => ({
  id: customer.id,
  externalId: customer.external_id,
  name: customer.name,
  legalName: customer.legal_name,
  domain: customer.domain,
  billingEmail: customer.billing_email,
  phone: customer.phone,
});

export const createMockCrmAdapter = (repositories: Pick<Repositories, "customers">): CrmAdapter => ({
  async findAccount(accountId: string) {
    const customer = await repositories.customers.findById(accountId);
    return customer ? toCrmAccount(customer) : null;
  },

  async listOpenOpportunities(accountId: string) {
    const account = await repositories.customers.findById(accountId);
    if (!account) return [];

    return [
      {
        id: `demo-opportunity-${account.id}`,
        accountId: account.id,
        name: `${account.name} expansion quote`,
        stage: "proposal",
        ownerId: michaelAnderson.id,
        currencyCode: "USD",
        expectedCloseDate: null,
      } satisfies CrmOpportunity,
    ];
  },
});

const summarizeAvailability = (locations: { availableQuantity: number; availability: InventoryAvailability }[]): InventoryAvailability => {
  if (locations.some((location) => location.availability === "available")) return "available";
  if (locations.some((location) => location.availability === "limited")) return "limited";
  return "backordered";
};

export const createMockErpInventoryAdapter = (repositories: Pick<Repositories, "inventory" | "products">): ErpInventoryAdapter => {
  const getAvailability = async (productId: string): Promise<ErpInventoryAvailabilityResponse | null> => {
    const product = await repositories.products.findById(productId);
    if (!product) return null;

    const inventory = await repositories.inventory.listByProduct(product.id);
    const locations = inventory.map((record) => ({
      locationCode: record.location_code,
      quantityOnHand: record.quantity_on_hand,
      quantityReserved: record.quantity_reserved,
      availableQuantity: getAvailableQuantity({
        quantityOnHand: record.quantity_on_hand,
        quantityReserved: record.quantity_reserved,
      }),
      reorderPoint: record.reorder_point,
      availability: getInventoryAvailability({
        quantityOnHand: record.quantity_on_hand,
        quantityReserved: record.quantity_reserved,
        reorderPoint: record.reorder_point,
      }),
      asOf: record.updated_at,
    }));

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unitOfMeasure: product.unit_of_measure,
      status: product.status,
      totalAvailableQuantity: locations.reduce((sum, location) => sum + location.availableQuantity, 0),
      availability: summarizeAvailability(locations),
      locations,
    };
  };

  return {
    getAvailability,
    async listAvailability(productIds: string[]) {
      const responses = await Promise.all(productIds.map((productId) => getAvailability(productId)));
      return responses.filter((response): response is ErpInventoryAvailabilityResponse => response !== null);
    },
  };
};

export const createMockPricingSourceMetadataAdapter = (): PricingSourceMetadataAdapter => ({
  async getMetadata(input = {}) {
    return {
      sourceName: "Demo Pricing Catalog",
      sourceVersion: input.onDate ?? new Date().toISOString().slice(0, 10),
      refreshedAt: new Date().toISOString(),
      currencyCode: input.currencyCode ?? "USD",
      precedence: Object.keys(pricingPrecedence),
    } satisfies PricingSourceMetadata;
  },
});

export const createMockNotificationsAdapter = (): NotificationsAdapter => ({
  async send(message: NotificationMessage): Promise<NotificationReceipt> {
    return {
      id: `demo-notification-${message.channel}-${Date.now()}`,
      status: "sent",
      channel: message.channel,
      sentAt: new Date().toISOString(),
    };
  },
});
