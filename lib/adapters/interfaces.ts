import type { InventoryAvailability } from "@/lib/domain/inventory";
import type { ResolvedPrice } from "@/lib/rules/pricing-rules";

export type AdapterUserRole = "sales_representative" | "sales_director" | "product_manager" | "finance" | "admin";

export type AuthenticatedUser = {
  id: string;
  externalId: string;
  displayName: string;
  email: string;
  role: AdapterUserRole;
  territory: string;
};

export type AuthAdapter = {
  getCurrentUser(): Promise<AuthenticatedUser>;
};

export type CrmAccount = {
  id: string;
  externalId: string | null;
  name: string;
  legalName: string | null;
  domain: string | null;
  billingEmail: string | null;
  phone: string | null;
  sourceName: string;
  sourceVersion: string;
};

export type CrmOpportunity = {
  id: string;
  accountId: string;
  name: string;
  externalId: string | null;
  stage: "prospecting" | "qualification" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  ownerId: string;
  currencyCode: string;
  expectedCloseDate: string | null;
  sourceName: string;
  sourceVersion: string;
};

export type CrmAdapter = {
  findAccount(accountId: string): Promise<CrmAccount | null>;
  listOpenOpportunities(accountId: string): Promise<CrmOpportunity[]>;
};

export type ErpInventoryLocationAvailability = {
  locationCode: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
  reorderPoint: number;
  availability: InventoryAvailability;
  asOf: string;
  sourceName: string;
  sourceVersion: string;
};

export type ErpInventoryAvailabilityResponse = {
  productId: string;
  sku: string;
  name: string;
  unitOfMeasure: string;
  status: "active" | "inactive" | "discontinued";
  totalAvailableQuantity: number;
  availability: InventoryAvailability;
  locations: ErpInventoryLocationAvailability[];
  sources: { sourceName: string; sourceVersion: string; refreshedAt: string }[];
};

export type ErpInventoryAdapter = {
  getAvailability(productId: string): Promise<ErpInventoryAvailabilityResponse | null>;
  listAvailability(productIds: string[]): Promise<ErpInventoryAvailabilityResponse[]>;
};

export type PricingSourceMetadata = {
  sourceName: string;
  sourceVersion: string;
  refreshedAt: string;
  currencyCode: string;
  precedence: string[];
};

export type PricingSourceMetadataAdapter = {
  getMetadata(input?: { currencyCode?: string; onDate?: string }): Promise<PricingSourceMetadata>;
};

export type PricingAdapter = PricingSourceMetadataAdapter & {
  resolvePrice(input: {
    productId: string;
    customerId: string;
    customerTier?: string | null;
    quantity: number;
    currencyCode: string;
    onDate?: string;
  }): Promise<ResolvedPrice>;
};

export type NotificationMessage = {
  to: string;
  subject: string;
  body: string;
  channel: "email" | "in_app";
  metadata?: Record<string, unknown>;
};

export type NotificationReceipt = {
  id: string;
  status: "queued" | "sent";
  channel: NotificationMessage["channel"];
  sentAt: string;
};

export type NotificationsAdapter = {
  send(message: NotificationMessage): Promise<NotificationReceipt>;
};
