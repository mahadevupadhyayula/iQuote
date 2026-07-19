"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/db/server";
import { createRepositories } from "@/lib/repositories";
import type { QuoteItemCreateInput, QuoteWithItems } from "@/lib/repositories/quotes";
import { completeMissingInformationSchema, getMissingFieldDefinition, isBlankMissingInformationValue, normalizeMissingFieldPath, requiredFieldsStillMissing, type CompleteMissingInformationInput } from "@/lib/rules/missing-information-rules";
import { createWorkflowService } from "@/lib/services/workflow-service";

type ActionResult = { ok: true; quoteId: string; status: string } | { ok: false; fieldErrors: Record<string, string>; formError?: string };

const objectValue = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const arrayValue = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
const textValue = (value: unknown) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
const numberValue = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;

const withFieldValue = (field: unknown, value: unknown) => ({ ...objectValue(field), value, missing: isBlankMissingInformationValue(value) });

const mergeMetadata = (quote: QuoteWithItems, data: ReturnType<typeof completeMissingInformationSchema.parse>) => {
  const metadata = quote.metadata as Record<string, unknown>;
  const extraction = objectValue(metadata.extraction);
  const fields = objectValue(extraction.fields);
  const requirements = objectValue(metadata.requirements);
  const customerRequest = objectValue(requirements.customer_request);
  const requirementDetails = objectValue(requirements.requirements);
  const requestedItems = arrayValue(fields.requested_items);
  const persistedRequestedItems = arrayValue(requirementDetails.requested_items);

  for (const [rawPath, rawValue] of Object.entries(data.fields)) {
    if (isBlankMissingInformationValue(rawValue)) continue;
    const path = normalizeMissingFieldPath(rawPath);
    const definition = getMissingFieldDefinition(path);
    if (!definition) continue;
    const value = definition.control === "number" ? numberValue(rawValue) : textValue(rawValue) ?? rawValue;
    if (definition.itemIndex != null) {
      const item = requestedItems[definition.itemIndex] ?? {};
      const fieldName = path.split(".").at(-1) ?? "";
      requestedItems[definition.itemIndex] = { ...item, [fieldName]: withFieldValue(item[fieldName], value) };
      persistedRequestedItems[definition.itemIndex] = { ...(persistedRequestedItems[definition.itemIndex] ?? {}), [fieldName === "raw_item_description" ? "description" : fieldName]: value, review_required: true };
    } else {
      fields[path] = withFieldValue(fields[path], value);
      customerRequest[path] = withFieldValue(customerRequest[path], value);
      if (path === "opportunity_name") metadata.opportunity_name = value;
    }
  }

  for (const [rawPath, selection] of Object.entries(data.productSelections)) {
    const path = normalizeMissingFieldPath(rawPath);
    const itemIndex = getMissingFieldDefinition(`${path}.requested_sku`)?.itemIndex ?? Number(/requested_items\[(\d+)\]/.exec(path)?.[1] ?? Number.NaN);
    if (!Number.isFinite(itemIndex)) continue;
    persistedRequestedItems[itemIndex] = {
      ...(persistedRequestedItems[itemIndex] ?? {}),
      selected_product: selection.unresolved ? { unresolved: true, confirmed_by_rep: true } : { product_id: selection.productId, sku: selection.sku ?? null, description: selection.description ?? null, confirmed_by_rep: true },
      review_required: selection.unresolved === true,
    };
  }

  const answered = Object.fromEntries(Object.entries(data.clarificationAnswers).filter(([, answer]) => answer.trim().length > 0));
  const remainingMissing = (Array.isArray(extraction.missing_fields) ? extraction.missing_fields : []).map(String).map(normalizeMissingFieldPath).filter((path) => isBlankMissingInformationValue(data.fields[path]));

  return {
    ...metadata,
    extraction: { ...extraction, fields: { ...fields, requested_items: requestedItems }, missing_fields: remainingMissing, clarification_answers: { ...objectValue(extraction.clarification_answers), ...answered } },
    requirements: { ...requirements, customer_request: customerRequest, requirements: { ...requirementDetails, requested_items: persistedRequestedItems }, clarification_answers: { ...objectValue(requirements.clarification_answers), ...answered } },
    manual_entry: { ...objectValue(metadata.manual_entry), enabled: remainingMissing.length > 0 },
  };
};

const mergeItems = (quote: QuoteWithItems, data: ReturnType<typeof completeMissingInformationSchema.parse>): Omit<QuoteItemCreateInput, "quote_id">[] => quote.items.map((item, index) => {
  const prefix = `requested_items[${index}]`;
  const quantity = numberValue(data.fields[`${prefix}.quantity`]);
  const requestedSku = textValue(data.fields[`${prefix}.requested_sku`]);
  const specifications = textValue(data.fields[`${prefix}.specifications`]);
  const selection = data.productSelections[prefix];
  return {
    product_id: selection?.unresolved ? item.product_id : selection?.productId ?? item.product_id,
    line_number: item.line_number,
    sku: selection?.unresolved ? item.sku : selection?.sku ?? requestedSku ?? item.sku,
    description: selection?.unresolved ? item.description : selection?.description ?? specifications ?? item.description,
    quantity: quantity ?? item.quantity,
    unit_price: item.unit_price,
    discount_bps: item.discount_bps,
    discount_amount: item.discount_amount,
    line_total_amount: item.line_total_amount,
    metadata: { ...item.metadata, rep_confirmed_product: selection ? !selection.unresolved : item.metadata.rep_confirmed_product, product_unresolved: selection?.unresolved === true },
  };
});

export async function completeMissingInformation(input: CompleteMissingInformationInput): Promise<ActionResult> {
  const data = completeMissingInformationSchema.parse(input);
  const repositories = createRepositories(createServerSupabaseClient());
  const quote = await repositories.quotes.findById(data.quoteId);
  if (!quote) return { ok: false, fieldErrors: {}, formError: "Quote was not found." };

  const extractionMetadata = objectValue(quote.metadata.extraction);
  const missingPaths = Array.isArray(extractionMetadata.missing_fields) ? extractionMetadata.missing_fields.map(String) : [];
  const metadataForCandidates = objectValue(quote.metadata.requirements);
  const candidateItems = arrayValue(objectValue(metadataForCandidates.requirements).requested_items);
  const requiredProductPaths = candidateItems
    .map((item, index) => ({ item, path: `requested_items[${index}]` }))
    .filter(({ item, path }, index) => arrayValue(item.candidates).length > 1 && !objectValue(item.selected_product).product_id && !quote.items[index]?.product_id && !data.productSelections[path])
    .map(({ path }) => path);
  const unresolvedProductPaths = Object.entries(data.productSelections).filter(([, value]) => !value.unresolved && !value.productId).map(([path]) => path).concat(requiredProductPaths);
  const fieldErrors = data.intent === "continue" ? requiredFieldsStillMissing(missingPaths, data.fields, unresolvedProductPaths) : {};
  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  const metadata = mergeMetadata(quote, data);
  await repositories.quotes.update(quote.id, { metadata });
  if (quote.items.length > 0) await repositories.quotes.replaceItems(quote.id, mergeItems(quote, data));
  await repositories.workflowEvents.record({ quote_id: quote.id, event_type: "updated", actor_id: null, from_status: quote.status, to_status: quote.status, payload: { action: "missing_information_saved", intent: data.intent } });

  if (data.intent === "continue") {
    const workflowService = createWorkflowService({ quotesRepository: repositories.quotes, workflowEventsRepository: repositories.workflowEvents });
    if (quote.status === "needs_information") await workflowService.transitionQuote({ quoteId: quote.id, toStatus: "configuring", payload: { action: "missing_information_completed" }, idempotencyKey: `missing-information-completed:${quote.id}` });
    redirect(`/quotes/${quote.id}/configure`);
  }

  return { ok: true, quoteId: quote.id, status: quote.status };
}
