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
  NotificationAdapter,
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

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toCrmAccount = (customer: CustomerRecord): CrmAccount => ({
  id: customer.id,
  externalId: customer.external_id,
  name: customer.name,
  legalName: customer.legal_name,
  domain: customer.domain,
  billingEmail: customer.billing_email,
  phone: customer.phone,
  sourceName: "supabase.customers",
  sourceVersion: "demo",
});

export const createMockCrmAdapter = (repositories: Pick<Repositories, "customers">): CrmAdapter => ({
  async findAccount(accountIdOrExternalId: string) {
    const customer = uuidPattern.test(accountIdOrExternalId)
      ? ((await repositories.customers.findById(accountIdOrExternalId)) ??
        (await repositories.customers.findByExternalId(accountIdOrExternalId)))
      : await repositories.customers.findByExternalId(accountIdOrExternalId);
    return customer ? toCrmAccount(customer) : null;
  },

  async listOpenOpportunities(accountId: string) {
    const account = await repositories.customers.findById(accountId);
    if (!account) return [];

    return [
      {
        id: `demo-opportunity-${account.id}`,
        accountId: account.id,
        externalId: null,
        name: `${account.name} expansion quote`,
        stage: "proposal",
        ownerId: michaelAnderson.id,
        currencyCode: "USD",
        expectedCloseDate: null,
        sourceName: "demo.crm",
        sourceVersion: "demo",
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
      refreshed_at: record.updated_at,
      warehouseCode: record.location_code,
      asOf: record.updated_at,
    }));
    const refreshedAt = locations.reduce((latest, location) => (location.refreshed_at > latest ? location.refreshed_at : latest), "");

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unitOfMeasure: product.unit_of_measure,
      status: product.status,
      availableQuantity: locations.reduce((sum, location) => sum + location.availableQuantity, 0),
      availability: summarizeAvailability(locations),
      warehouses: locations,
      sourceName: "Demo Inventory",
      sourceVersion: "seed-v1",
      refreshed_at: refreshedAt || new Date().toISOString(),
      totalAvailableQuantity: locations.reduce((sum, location) => sum + location.availableQuantity, 0),
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

const stableNotificationReceiptId = (message: NotificationMessage) => {
  const payload = JSON.stringify({
    to: message.to,
    subject: message.subject,
    body: message.body,
    channel: message.channel,
    metadata: message.metadata ?? {},
  });
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash * 31 + payload.charCodeAt(index)) >>> 0;
  }
  return `demo-notification-${message.channel}-${hash.toString(16).padStart(8, "0")}`;
};

export const createMockNotificationAdapter = (): NotificationAdapter => ({
  async send(message: NotificationMessage): Promise<NotificationReceipt> {
    return {
      id: stableNotificationReceiptId(message),
      status: "sent",
      channel: message.channel,
      sentAt: "2026-01-01T00:00:00.000Z",
    };
  },
});

export const createMockNotificationsAdapter = createMockNotificationAdapter;
