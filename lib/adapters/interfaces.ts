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
  stage: "discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  ownerId: string | null;
  currencyCode: string;
  expectedCloseDate: string | null;
  sourceName: string;
  sourceVersion: string;
};

export type CrmAdapter = {
  findAccount(accountIdOrExternalId: string): Promise<CrmAccount | null>;
  listOpenOpportunities(accountId: string): Promise<CrmOpportunity[]>;
};

export type PriceEffectiveDates = {
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

export type PriceCandidate = {
  priceId: string;
  priceType: "customer_specific" | "customer_tier" | "quantity_volume" | "list" | "blocking_exception";
  selected: boolean;
  sourceName: string;
  sourceVersion: string;
  precedenceReason: string;
  effectiveDates: PriceEffectiveDates;
  currencyCode: string;
  unitPrice: number | null;
  unitCost: number | null;
};

export type ResolvePriceInput = {
  productId: string;
  customerId: string;
  customerTier?: string | null;
  quantity: number;
  currencyCode: string;
  onDate?: string;
};

export type ResolvedPriceResponse = PriceCandidate & {
  selected: true;
  blocked: boolean;
};

export type PricingAdapter = {
  resolvePrice(input: ResolvePriceInput): Promise<ResolvedPriceResponse>;
  getPriceCandidates(input: ResolvePriceInput): Promise<PriceCandidate[]>;
};

export type InventoryWarehouseAvailability = {
  warehouseCode: string;
  quantityOnHand: number;
  quantityReserved: number;
  availableQuantity: number;
  reorderPoint: number;
  availability: InventoryAvailability;
  refreshed_at: string;
};

export type InventoryAvailabilityResponse = {
  productId: string;
  sku: string;
  name: string;
  unitOfMeasure: string;
  status: "active" | "inactive" | "discontinued";
  availableQuantity: number;
  availability: InventoryAvailability;
  warehouses: InventoryWarehouseAvailability[];
  sourceName: string;
  sourceVersion: string;
  refreshed_at: string;
};

export type InventoryAdapter = {
  getAvailability(productId: string): Promise<InventoryAvailabilityResponse | null>;
  listAvailability(productIds: string[]): Promise<InventoryAvailabilityResponse[]>;
};

export type ErpInventoryLocationAvailability = InventoryWarehouseAvailability & {
  locationCode: string;
  asOf: string;
};

export type ErpInventoryAvailabilityResponse = InventoryAvailabilityResponse & {
  totalAvailableQuantity: number;
  locations: ErpInventoryLocationAvailability[];
};

export type ErpInventoryAdapter = InventoryAdapter;

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

export type NotificationAdapter = {
  send(message: NotificationMessage): Promise<NotificationReceipt>;
};

export type NotificationsAdapter = NotificationAdapter;
