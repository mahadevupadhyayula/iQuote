import { z } from "zod";

export type ReviewFieldDefinition = {
  key: string;
  label: string;
  control: "text" | "number" | "percentage" | "date" | "select" | "textarea";
  requiredForConfiguration: boolean;
  requiredForGeneration?: boolean;
  requiredForSend?: boolean;
  defaultStrategy: "none" | "literal" | "customer_shipping_address" | "customer_billing_address" | "opportunity_currency" | "company_currency" | "standard_catalog";
  defaultValue?: string | number | boolean | null;
  options?: Array<{ value: string; label: string }>;
  minimum?: number;
  maximum?: number;
  step?: number;
  helpText?: string;
};

export const installationRequirementOptions = [
  { value: "vendor_installation_requested", label: "Vendor installation or startup support required" },
  { value: "customer_installed", label: "Installation will be handled internally" },
  { value: "not_required", label: "No installation or startup support required" },
];

export const reviewFieldRegistry = {
  customer_name: { key: "customer_name", label: "Customer", control: "text", requiredForConfiguration: true, defaultStrategy: "none" },
  opportunity_name: { key: "opportunity_name", label: "Opportunity name", control: "text", requiredForConfiguration: false, defaultStrategy: "literal", defaultValue: "Draft quote opportunity" },
  currency: { key: "currency", label: "Currency", control: "text", requiredForConfiguration: true, defaultStrategy: "opportunity_currency", helpText: "Uses extracted/requested currency, then opportunity, customer, and company defaults." },
  "requested_items[].raw_item_description": { key: "requested_items[].raw_item_description", label: "Requested product description", control: "textarea", requiredForConfiguration: true, defaultStrategy: "none" },
  "requested_items[].requested_sku": { key: "requested_items[].requested_sku", label: "Requested SKU", control: "text", requiredForConfiguration: false, defaultStrategy: "none", helpText: "May remain blank when a usable requested description exists." },
  "requested_items[].quantity": { key: "requested_items[].quantity", label: "Quantity", control: "number", requiredForConfiguration: true, defaultStrategy: "none", minimum: 0, step: 1, helpText: "Quantity is not defaulted and must be greater than zero." },
  "requested_items[].specifications": { key: "requested_items[].specifications", label: "Customer specifications", control: "textarea", requiredForConfiguration: false, defaultStrategy: "standard_catalog", helpText: "Blank means standard catalogue specification." },
  delivery_location: { key: "delivery_location", label: "Delivery location", control: "text", requiredForConfiguration: true, defaultStrategy: "customer_shipping_address", helpText: "Uses extracted location, then customer shipping address, then billing address." },
  delivery_date: { key: "delivery_date", label: "Requested delivery date", control: "date", requiredForConfiguration: false, defaultStrategy: "literal", defaultValue: null, helpText: "Blank means not specified." },
  requested_discount: { key: "requested_discount", label: "Requested discount", control: "percentage", requiredForConfiguration: false, defaultStrategy: "literal", defaultValue: 0, minimum: 0, maximum: 100, step: 0.1, helpText: "Blank means 0%." },
  installation_requirement: { key: "installation_requirement", label: "Installation or startup support", control: "select", requiredForConfiguration: false, defaultStrategy: "literal", defaultValue: "not_required", options: installationRequirementOptions, helpText: "Blank means no vendor installation is required." },
  special_requirements: { key: "special_requirements", label: "Special requirements", control: "textarea", requiredForConfiguration: false, defaultStrategy: "literal", defaultValue: null, helpText: "Blank means none." },
} as const satisfies Record<string, ReviewFieldDefinition>;

export type NormalizedReviewField = ReviewFieldDefinition & { path: string; registryKey: string; itemIndex: number | null };
export const normalizeReviewFieldPath = (path: string) => path.trim().replace(/requested_items\.(\d+)\./g, "requested_items[$1].");
const registryKeyForPath = (path: string) => path.replace(/requested_items\[\d+\]/g, "requested_items[]");
export const getReviewFieldDefinition = (path: string): NormalizedReviewField | null => {
  const normalized = normalizeReviewFieldPath(path);
  const registryKey = registryKeyForPath(normalized);
  const definition = reviewFieldRegistry[registryKey as keyof typeof reviewFieldRegistry];
  if (!definition) return null;
  const itemIndex = /requested_items\[(\d+)\]/.exec(normalized)?.[1];
  return { ...definition, path: normalized, registryKey, itemIndex: itemIndex == null ? null : Number(itemIndex) };
};

const valueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const reviewInformationSchema = z.object({
  quoteId: z.string().uuid().or(z.string().min(1)),
  intent: z.enum(["continue", "draft"]).default("continue"),
  fields: z.record(z.string().transform(normalizeReviewFieldPath), valueSchema).default({}),
});
export type ReviewInformationInput = z.input<typeof reviewInformationSchema>;
export const isBlankReviewValue = (value: unknown) => value == null || (typeof value === "string" && value.trim().length === 0);
export const percentToBps = (value: number) => Math.round(value * 100);
