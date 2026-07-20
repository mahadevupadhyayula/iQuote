"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import type { QuoteItemCreateInput, QuoteWithItems } from "@/lib/repositories/quotes";
import { getReviewFieldDefinition, isBlankReviewValue, percentToBps, reviewInformationSchema, type ReviewInformationInput } from "@/lib/rules/review-field-registry";
import { createWorkflowService } from "@/lib/services/workflow-service";

type ActionResult = { ok: true; quoteId: string; status: string } | { ok: false; fieldErrors: Record<string, string>; formError?: string };
type Source = "extracted" | "user_edited" | "system_default" | "customer_record" | "opportunity_record";
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asArray = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
const primitive = (field: unknown) => { const value = asObject(field).value; return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null; };
const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : null;
const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
const addressText = (value: unknown) => { const o = asObject(value); return text(o.formatted) ?? ([o.line1, o.line2, o.city, o.state, o.postal_code, o.country].map(text).filter(Boolean).join(", ") || null); };
const reviewed = (value: unknown, source: Source, original: unknown, confidence: unknown, reviewedAt: string, sourceSpan?: unknown) => ({ value, source, originalExtractedValue: original ?? undefined, confidence: typeof confidence === "number" ? confidence : undefined, sourceSpan, reviewedAt });

const extractedValue = (quote: QuoteWithItems, path: string) => {
  const fields = asObject(asObject(quote.metadata.extraction).fields);
  const def = getReviewFieldDefinition(path);
  if (def?.itemIndex != null) return primitive(asArray(fields.requested_items)[def.itemIndex]?.[path.split(".").at(-1) ?? ""]);
  if (path === "currency") return quote.currency_code;
  if (path === "customer_name") return primitive(fields.customer_name);
  return primitive(fields[path]);
};

const resolveField = async (quote: QuoteWithItems, path: string, raw: unknown, repositories: ReturnType<typeof createRepositories>) => {
  const def = getReviewFieldDefinition(path);
  const original = extractedValue(quote, path);
  const extraction = asObject(quote.metadata.extraction);
  const confidence = asObject(extraction.field_confidence)[path];
  if (!isBlankReviewValue(raw)) return { value: def?.control === "number" || def?.control === "percentage" ? num(raw) : text(raw) ?? raw, source: (String(raw) === String(original) ? "extracted" : "user_edited") as Source, original, confidence };
  if (path === "requested_discount") return { value: 0, source: "system_default" as Source, original, confidence };
  if (path === "installation_requirement") return { value: "not_required", source: "system_default" as Source, original, confidence };
  if (path.endsWith(".specifications")) return { value: { mode: "standard_catalog", text: null, source: "system_default" }, source: "system_default" as Source, original, confidence };
  if (path === "delivery_location") {
    const customer = await repositories.customers.findById(quote.customer_id);
    const shipping = addressText(customer?.shipping_address);
    if (shipping) return { value: shipping, source: "customer_record" as Source, original, confidence };
    const billing = addressText(customer?.billing_address);
    if (billing) return { value: billing, source: "customer_record" as Source, original, confidence };
  }
  if (path === "currency") {
    const opportunity = quote.opportunity_id ? await repositories.opportunities.findById(quote.opportunity_id) : null;
    if (opportunity?.currency_code) return { value: opportunity.currency_code, source: "opportunity_record" as Source, original, confidence };
    const customer = await repositories.customers.findById(quote.customer_id);
    const customerCurrency = text(customer?.metadata.currency_code) ?? text(customer?.metadata.currency);
    if (customerCurrency) return { value: customerCurrency, source: "customer_record" as Source, original, confidence };
    const company = process.env.COMPANY_DEFAULT_CURRENCY;
    if (company) return { value: company, source: "system_default" as Source, original, confidence };
  }
  if (path === "opportunity_name") return { value: text(asObject(quote.metadata).opportunity_name) ?? "Draft quote opportunity", source: "system_default" as Source, original, confidence };
  return { value: null, source: "extracted" as Source, original, confidence };
};

const staleClearedMetadata = (metadata: Record<string, unknown>) => ({ ...metadata, pricing_status: "not_started", pricing_resolved: false, pricing_blockers: [], commercial_calculation: null, readiness: null, approval_evaluation: null });

export async function saveReviewInformation(input: ReviewInformationInput): Promise<ActionResult> {
  const data = reviewInformationSchema.parse(input);
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await repositories.quotes.findById(data.quoteId);
  if (!quote) return { ok: false, fieldErrors: {}, formError: "Quote was not found." };
  const reviewedAt = new Date().toISOString();
  const fields = data.fields;
  const itemIndexes = [...new Set(Object.keys(fields).map((p) => getReviewFieldDefinition(p)?.itemIndex).filter((i): i is number => i != null))];
  if (itemIndexes.length === 0) itemIndexes.push(0);
  const paths = ["customer_name", "opportunity_name", "currency", "delivery_location", "delivery_date", "requested_discount", "installation_requirement", "special_requirements", ...itemIndexes.flatMap((i) => [`requested_items[${i}].raw_item_description`, `requested_items[${i}].requested_sku`, `requested_items[${i}].quantity`, `requested_items[${i}].specifications`])];
  const resolvedEntries = await Promise.all(paths.map(async (path) => [path, await resolveField(quote, path, fields[path], repositories)] as const));
  const resolved = Object.fromEntries(resolvedEntries);
  const errors: Record<string, string> = {};
  if (data.intent === "continue") {
    if (!text(resolved.customer_name?.value)) errors.customer_name = "Customer is required.";
    if (!text(resolved.currency?.value)) errors.currency = "Currency is required.";
    if (!text(resolved.delivery_location?.value)) errors.delivery_location = "Delivery location is required when customer addresses cannot supply it.";
    const validRows = itemIndexes.filter((i) => text(resolved[`requested_items[${i}].raw_item_description`]?.value) || text(resolved[`requested_items[${i}].requested_sku`]?.value));
    if (validRows.length === 0) errors.requested_items = "At least one requested item description or SKU is required.";
    for (const i of itemIndexes) {
      if (!text(resolved[`requested_items[${i}].raw_item_description`]?.value) && !text(resolved[`requested_items[${i}].requested_sku`]?.value)) errors[`requested_items[${i}].raw_item_description`] = "Description or SKU is required.";
      const q = num(resolved[`requested_items[${i}].quantity`]?.value);
      if (q == null || q <= 0) errors[`requested_items[${i}].quantity`] = "Quantity must be greater than zero.";
    }
  }
  if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
  const discountPercent = num(resolved.requested_discount?.value) ?? 0;
  if (discountPercent < 0 || discountPercent > 100) return { ok: false, fieldErrors: { requested_discount: "Requested discount must be between 0 and 100 percent." } };
  const discountBps = percentToBps(discountPercent);
  const reviewedFields = Object.fromEntries(Object.entries(resolved).map(([path, r]) => [path, reviewed(r.value, r.source, r.original, r.confidence, reviewedAt)]));
  const requestedItems = itemIndexes.map((i) => ({ description: text(resolved[`requested_items[${i}].raw_item_description`]?.value), requested_sku: text(resolved[`requested_items[${i}].requested_sku`]?.value), quantity: num(resolved[`requested_items[${i}].quantity`]?.value), specifications: resolved[`requested_items[${i}].specifications`]?.value }));
  const replacementItems: Omit<QuoteItemCreateInput, "quote_id">[] = requestedItems.filter((item) => item.description || item.requested_sku).map((item, index) => {
    const previous = quote.items[index];
    const unchangedProduct = previous && previous.sku === (item.requested_sku ?? previous.sku) && previous.quantity === item.quantity;
    return { product_id: unchangedProduct ? previous.product_id : null, line_number: index + 1, sku: item.requested_sku ?? previous?.sku ?? "UNMATCHED", description: previous?.product_id && unchangedProduct ? previous.description : item.description ?? previous?.description ?? "Unmatched item", quantity: item.quantity ?? previous?.quantity ?? 0, unit_price: 0, discount_bps: discountBps, discount_amount: 0, line_total_amount: 0, metadata: { ...(unchangedProduct ? previous.metadata : {}), requested_sku: item.requested_sku, requested_description: item.description, customer_specifications: item.specifications, pricing_resolved: false } };
  });
  const baseRequirements = asObject(quote.metadata.requirements);
  const metadata = staleClearedMetadata({ ...quote.metadata, review: { ...asObject(quote.metadata.review), reviewed_at: reviewedAt, reviewed_fields: reviewedFields, defaulted_fields: Object.fromEntries(Object.entries(reviewedFields).filter(([, v]) => asObject(v).source === "system_default" || asObject(v).source === "customer_record" || asObject(v).source === "opportunity_record")), edited_fields: Object.fromEntries(Object.entries(reviewedFields).filter(([, v]) => asObject(v).source === "user_edited")), blocking_fields_resolved: Object.keys(errors).length === 0, manual_entry_mode: asObject(quote.metadata.manual_entry).enabled === true }, requirements: { ...baseRequirements, customer_request: { ...asObject(baseRequirements.customer_request), customer_name: reviewedFields.customer_name, currency: reviewedFields.currency, delivery_location: reviewedFields.delivery_location, delivery_date: reviewedFields.delivery_date, requested_discount: reviewedFields.requested_discount, installation_requirement: reviewedFields.installation_requirement, special_requirements: reviewedFields.special_requirements }, commercial: { ...asObject(baseRequirements.commercial), requested_discount_percent: discountPercent, requested_discount_bps: discountBps }, requirements: { ...asObject(baseRequirements.requirements), requested_items: requestedItems } } });
  await repositories.quotes.update(quote.id, { currency_code: text(resolved.currency?.value) ?? quote.currency_code, valid_until: text(resolved.delivery_date?.value) ?? quote.valid_until, subtotal_amount: 0, discount_amount: 0, total_amount: 0, metadata });
  await repositories.quotes.replaceItems(quote.id, replacementItems);
  await repositories.workflowEvents.record({ quote_id: quote.id, event_type: "updated", actor_id: null, from_status: quote.status, to_status: quote.status, payload: { action: "review_information_saved", intent: data.intent } });
  if (data.intent === "continue") {
    const workflowService = createWorkflowService({ quotesRepository: repositories.quotes, workflowEventsRepository: repositories.workflowEvents });
    if (quote.status !== "configuring") await workflowService.transitionQuote({ quoteId: quote.id, toStatus: "configuring", payload: { action: "review_information_completed" }, idempotencyKey: `review-information-completed:${quote.id}` });
    revalidatePath(`/quotes/${quote.id}`);
    redirect(`/quotes/${quote.id}/configure`);
  }
  revalidatePath(`/quotes/${quote.id}/review`);
  return { ok: true, quoteId: quote.id, status: quote.status };
}
