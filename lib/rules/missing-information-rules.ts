import { z } from "zod";

export type MissingFieldControl = "text" | "number" | "date" | "select" | "textarea" | "product_candidate";

export type MissingFieldDefinition = {
  key: string;
  label: string;
  control: MissingFieldControl;
  required: boolean;
};

export const missingInformationFieldRegistry = {
  customer_name: { key: "customer_name", label: "Customer name", control: "text", required: true },
  opportunity_name: { key: "opportunity_name", label: "Opportunity name", control: "text", required: false },
  requested_items: { key: "requested_items", label: "Requested item", control: "textarea", required: true },
  "requested_items[].requested_sku": { key: "requested_items[].requested_sku", label: "Requested SKU", control: "text", required: false },
  "requested_items[].quantity": { key: "requested_items[].quantity", label: "Quantity", control: "number", required: true },
  "requested_items[].specifications": { key: "requested_items[].specifications", label: "Specifications", control: "textarea", required: false },
  delivery_location: { key: "delivery_location", label: "Delivery location", control: "text", required: true },
  delivery_date: { key: "delivery_date", label: "Delivery date", control: "date", required: true },
  requested_discount: { key: "requested_discount", label: "Requested discount", control: "text", required: false },
  installation_requirement: { key: "installation_requirement", label: "Installation requirement", control: "select", required: false },
  special_requirements: { key: "special_requirements", label: "Special requirements", control: "textarea", required: false },
} as const satisfies Record<string, MissingFieldDefinition>;

export type NormalizedMissingField = MissingFieldDefinition & { path: string; registryKey: string; itemIndex: number | null };

export const normalizeMissingFieldPath = (path: string) => path.trim().replace(/requested_items\.(\d+)\./g, "requested_items[$1].");

const registryKeyForPath = (path: string) => path.replace(/requested_items\[\d+\]/g, "requested_items[]");

export const getMissingFieldDefinition = (path: string): NormalizedMissingField | null => {
  const normalized = normalizeMissingFieldPath(path);
  const registryKey = registryKeyForPath(normalized);
  const definition = missingInformationFieldRegistry[registryKey as keyof typeof missingInformationFieldRegistry];
  if (!definition) return null;
  const itemIndex = /requested_items\[(\d+)\]/.exec(normalized)?.[1];
  return { ...definition, path: normalized, registryKey, itemIndex: itemIndex == null ? null : Number(itemIndex) };
};

const pathSchema = z.string().min(1).transform(normalizeMissingFieldPath);
const valueSchema = z.union([z.string(), z.number(), z.null()]);

export const completeMissingInformationSchema = z.object({
  quoteId: z.string().uuid().or(z.string().min(1)),
  intent: z.enum(["continue", "draft"]).default("continue"),
  fields: z.record(pathSchema, valueSchema).default({}),
  clarificationAnswers: z.record(z.string(), z.string()).default({}),
  productSelections: z.record(z.string(), z.object({
    productId: z.string().nullable(),
    sku: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    unresolved: z.boolean().optional(),
  })).default({}),
});

export type CompleteMissingInformationInput = z.input<typeof completeMissingInformationSchema>;
export type CompleteMissingInformationData = z.output<typeof completeMissingInformationSchema>;

export const isBlankMissingInformationValue = (value: unknown) => value == null || (typeof value === "string" && value.trim().length === 0);

export const requiredFieldsStillMissing = (paths: string[], values: Record<string, unknown>, unresolvedProducts: string[] = []) => {
  const errors: Record<string, string> = {};
  for (const path of paths.map(normalizeMissingFieldPath)) {
    const definition = getMissingFieldDefinition(path);
    if (definition?.required && isBlankMissingInformationValue(values[path])) errors[path] = `${definition.label} is required.`;
  }
  for (const path of unresolvedProducts) errors[path] = "Select a catalog product or mark this item unresolved before continuing.";
  return errors;
};
